// ============================================================
// usePaginatedPacientes — C-2 (canary)
// ------------------------------------------------------------
// Paginação server-side de pacientes por cursor (created_at DESC, id DESC).
// Filtros aplicados no banco: status (Ativo/Inativo/Todos), busca (nome/CPF).
//
// Não usa o cache global do `pacienteStore`. Ideal para tenants grandes.
// Cache local controlado: até MAX_PAGES_IN_CACHE (FIFO).
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { Paciente } from "@/data/pacienteStore";

const PAGE_SIZE = 50;
const MAX_PAGES_IN_CACHE = 5;

const SLIM_COLS =
  "id,nome,cpf,data_nascimento,sexo,telefone,email,status," +
  "celular,cep,estado,cidade,bairro,endereco,numero,complemento," +
  "guardian_name,guardian_cpf,consentimento_lgpd,consentimento_em,created_at";

interface PacienteRowSlim {
  id: number;
  nome: string;
  cpf: string;
  data_nascimento: string | null;
  sexo: string | null;
  telefone: string | null;
  email: string | null;
  status: string | null;
  celular: string | null;
  cep: string | null;
  estado: string | null;
  cidade: string | null;
  bairro: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  guardian_name: string | null;
  guardian_cpf: string | null;
  consentimento_lgpd: boolean | null;
  consentimento_em: string | null;
  created_at: string | null;
}

function fmtCpf(cpf: string): string {
  const d = (cpf || "").replace(/\D/g, "");
  if (d.length !== 11) return cpf || "";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function fmtDateBR(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}
function sexoLong(s: string | null): string {
  return s === "M" ? "Masculino" : s === "F" ? "Feminino" : (s ?? "");
}
function initials(nome: string): string {
  return nome.split(" ").filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function rowToPaciente(r: PacienteRowSlim): Paciente {
  return {
    id: Number(r.id),
    nome: r.nome,
    cpf: fmtCpf(r.cpf),
    dataNascimento: fmtDateBR(r.data_nascimento),
    sexo: sexoLong(r.sexo),
    telefone: r.telefone || "",
    email: r.email || "",
    status: (r.status === "Ativo" ? "Ativo" : "Inativo") as "Ativo" | "Inativo",
    celular: r.celular || "",
    cep: r.cep || "",
    estado: r.estado || "",
    cidade: r.cidade || "",
    bairro: r.bairro || "",
    endereco: r.endereco || "",
    numero: r.numero || "",
    complemento: r.complemento || "",
    guardianName: r.guardian_name || "",
    guardianCpf: r.guardian_cpf ? fmtCpf(r.guardian_cpf) : "",
    consentimentoLgpd: !!r.consentimento_lgpd,
    consentimentoEm: r.consentimento_em ?? undefined,
    initials: initials(r.nome),
  };
}

export interface PacientesFilters {
  status?: "Todos" | "Ativo" | "Inativo";
  q?: string;
}

export interface UsePaginatedPacientesResult {
  items: Paciente[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

interface Cursor { created_at: string; id: number; }

export function usePaginatedPacientes(
  filters: PacientesFilters,
  enabled: boolean,
): UsePaginatedPacientesResult {
  const debouncedQ = useDebouncedValue(filters.q ?? "", 300);
  const eff = useMemo<PacientesFilters>(() => ({
    status: filters.status ?? "Todos",
    q: debouncedQ,
  }), [filters.status, debouncedQ]);

  const [items, setItems] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const reqTokenRef = useRef(0);

  const fetchPage = useCallback(async (
    f: PacientesFilters,
    cursor: Cursor | null,
  ): Promise<PacienteRowSlim[]> => {
    let q = supabase
      .from("pacientes")
      .select(SLIM_COLS)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE);
    if (f.status && f.status !== "Todos") {
      q = q.eq("status", f.status);
    }
    if (f.q && f.q.trim()) {
      const term = f.q.trim();
      const digits = term.replace(/\D/g, "");
      if (digits.length >= 3) {
        // CPF parcial: prioriza match por dígitos.
        q = q.ilike("cpf", `%${digits}%`);
      } else {
        q = q.ilike("nome", `%${term}%`);
      }
    }
    if (cursor) {
      // (created_at, id) < cursor — emulado via .or() para tuple comparison.
      q = q.or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
      );
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as PacienteRowSlim[];
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const token = ++reqTokenRef.current;
    setLoading(true);
    setError(null);
    setItems([]);
    setHasMore(false);
    (async () => {
      try {
        const rows = await fetchPage(eff, null);
        if (reqTokenRef.current !== token) return;
        setItems(rows.map(rowToPaciente));
        setHasMore(rows.length === PAGE_SIZE);
      } catch (e: unknown) {
        if (reqTokenRef.current !== token) return;
        const msg = (e as Error)?.message ?? "Falha ao carregar pacientes";
        logger.warn("usePaginatedPacientes", "carga inicial falhou", { error: msg });
        setError(msg);
      } finally {
        if (reqTokenRef.current === token) setLoading(false);
      }
    })();
  }, [enabled, eff, fetchPage]);

  const loadMore = useCallback(async () => {
    if (!enabled || loadingMore || !hasMore || items.length === 0) return;
    const token = reqTokenRef.current;
    setLoadingMore(true);
    try {
      // Reconstitui cursor a partir do último item: precisamos de created_at —
      // como `Paciente` não expõe created_at, voltamos a buscar o id do último.
      // Estratégia simples: pega created_at via select pontual.
      const lastId = items[items.length - 1].id;
      const { data: cur } = await supabase
        .from("pacientes")
        .select("created_at,id")
        .eq("id", lastId)
        .maybeSingle();
      const created_at = (cur as { created_at?: string } | null)?.created_at;
      if (!created_at) { setHasMore(false); return; }
      const next = await fetchPage(eff, { created_at, id: lastId });
      if (reqTokenRef.current !== token) return;
      const pagesAhora = Math.ceil(items.length / PAGE_SIZE);
      const merged = pagesAhora >= MAX_PAGES_IN_CACHE
        ? [...items.slice(PAGE_SIZE), ...next.map(rowToPaciente)]
        : [...items, ...next.map(rowToPaciente)];
      setItems(merged);
      setHasMore(next.length === PAGE_SIZE);
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? "Falha ao carregar mais";
      logger.warn("usePaginatedPacientes", "loadMore falhou", { error: msg });
      setError(msg);
    } finally {
      if (reqTokenRef.current === token) setLoadingMore(false);
    }
  }, [enabled, loadingMore, hasMore, items, eff, fetchPage]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const token = ++reqTokenRef.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchPage(eff, null);
      if (reqTokenRef.current !== token) return;
      setItems(rows.map(rowToPaciente));
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? "Falha ao recarregar";
      logger.warn("usePaginatedPacientes", "refresh falhou", { error: msg });
      setError(msg);
    } finally {
      if (reqTokenRef.current === token) setLoading(false);
    }
  }, [enabled, eff, fetchPage]);

  return { items, loading, loadingMore, error, hasMore, loadMore, refresh };
}