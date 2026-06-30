// ============================================================================
// usePaginatedPacientes — VERSÃO SEGURA (com filtro tenant_id)
// ============================================================================
// Arquivo: src/hooks/usePaginatedPacientes.ts
// Mudança: Adiciona .eq('tenant_id', userTenantId) em TODAS as queries
//
// Este é um exemplo. Aplique o mesmo padrão em TODOS seus hooks que
// fazem queries em tabelas multi-tenant (pacientes, atendimentos, etc)

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db as supabase } from "@/runtime/db";
import { logger } from "@/lib/logger";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAuth } from "@/contexts/AuthContext";  // ← ADICIONE ISTO
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
  // ✅ MUDANÇA 1: Obter tenant_id do usuario
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  
  // Validar que temos tenant_id
  useEffect(() => {
    if (enabled && !tenantId) {
      logger.warn("usePaginatedPacientes", "No tenant_id available");
    }
  }, [enabled, tenantId]);

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

  // ✅ MUDANÇA 2: Atualizar fetchPage para incluir filtro tenant_id
  const fetchPage = useCallback(async (
    f: PacientesFilters,
    cursor: Cursor | null,
  ): Promise<PacienteRowSlim[]> => {
    // Validar que temos tenant_id antes de fazer query
    if (!tenantId) {
      throw new Error("Tenant ID not available");
    }

    // ✅ MUDANÇA 3: ADICIONAR .eq('tenant_id', tenantId) AQUI
    let q = supabase
      .from("pacientes")
      .select(SLIM_COLS)
      .eq('tenant_id', tenantId)  // ← DEFENSE IN DEPTH: Filtro frontend
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
  }, [tenantId]);  // ← ADICIONE tenantId como dependência

  useEffect(() => {
    if (!enabled) return;
    // ✅ MUDANÇA 4: Validar tenant antes de começar
    if (!tenantId) {
      setError("Sem acesso a tenant");
      setLoading(false);
      return;
    }

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
  }, [enabled, eff, fetchPage, tenantId]);  // ← ADICIONE tenantId

  const loadMore = useCallback(async () => {
    if (!enabled || loadingMore || !hasMore || items.length === 0) return;
    // ✅ MUDANÇA 5: Validar tenant em loadMore também
    if (!tenantId) {
      setError("Sem acesso a tenant");
      return;
    }

    const token = reqTokenRef.current;
    setLoadingMore(true);
    try {
      // Reconstitui cursor a partir do último item
      const lastId = items[items.length - 1].id;
      
      // ✅ MUDANÇA 6: ADICIONAR .eq('tenant_id', tenantId) aqui também
      const { data: cur } = await supabase
        .from("pacientes")
        .select("created_at,id")
        .eq('tenant_id', tenantId)  // ← ADICIONE ISTO
        .eq("id", lastId)
        .maybeSingle();

      const created_at = (cur as { created_at?: string } | null)?.created_at;
      if (!created_at) { setHasMore(false); return; }
      const next = await fetchPage(eff, { created_at, id: lastId });
      if (reqTokenRef.current !== token) return;
      setItems((prev) => [...prev, ...next.map(rowToPaciente)]);
      setHasMore(next.length === PAGE_SIZE);
    } catch (e: unknown) {
      if (reqTokenRef.current !== token) return;
      const msg = (e as Error)?.message ?? "Falha ao carregar mais pacientes";
      logger.warn("usePaginatedPacientes", "loadMore falhou", { error: msg });
      setError(msg);
    } finally {
      if (reqTokenRef.current === token) setLoadingMore(false);
    }
  }, [enabled, loadingMore, hasMore, items, eff, fetchPage, tenantId]);  // ← ADICIONE tenantId

  const refresh = useCallback(async () => {
    // Reset para recarregar dados
    setItems([]);
    setError(null);
    if (!tenantId) {
      setError("Sem acesso a tenant");
      return;
    }

    try {
      const rows = await fetchPage(eff, null);
      setItems(rows.map(rowToPaciente));
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? "Falha ao recarregar pacientes";
      logger.warn("usePaginatedPacientes", "refresh falhou", { error: msg });
      setError(msg);
    }
  }, [eff, fetchPage, tenantId]);

  return {
    items,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}

// ============================================================================
// ✅ RESUMO DAS MUDANÇAS:
// ============================================================================
// 1. Importar useAuth para obter tenant_id
// 2. Validar que tenantId existe antes de fazer queries
// 3. Adicionar .eq('tenant_id', tenantId) em TODAS queries:
//    - fetchPage inicial
//    - Select do cursor em loadMore
// 4. Adicionar tenantId como dependência em useCallback/useEffect
// 5. Mostrar erro se tenant_id não disponível
//
// PADRÃO: Apply to all paginated hooks:
// - usePaginatedAtendimentos
// - usePaginatedResultados
// - usePaginatedRelatorios
// etc.
