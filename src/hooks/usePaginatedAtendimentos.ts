// ============================================================
// usePaginatedAtendimentos — C1 (canary)
// ------------------------------------------------------------
// Paginação server-side por cursor (data DESC, id DESC) + KPIs
// agregados via RPCs `atendimentos_page` e `atendimentos_kpis`.
//
// Cache controlado:
//   - até 5 páginas em memória (FIFO)
//   - sempre limpo ao mudar filtro/busca
//   - independente do cache global do atendimentoStore
//
// Estados expostos:
//   - items, kpis, loading (1ª página), loadingMore (next), error
//   - hasMore, loadMore(), refresh()
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { MockAtendimento, StatusType } from "@/data/types";
import { formatIdadeDetalhada } from "@/lib/idade";
import { normalizeAtendimento } from "@/data/atendimentoNormalize";

const PAGE_SIZE = 50;
const MAX_PAGES_IN_CACHE = 5;

export interface AtendimentoPageRow {
  id: number;
  protocolo: string;
  data: string;
  paciente_nome: string | null;
  paciente_cpf: string | null;
  paciente_nascimento: string | null;
  solicitante: string | null;
  convenio_id: number | null;
  convenio_nome: string | null;
  unidade_id: string | null;
  status_atendimento: string;
  status_pagamento: string;
  motivo_cancelamento: string | null;
  updated_at: string;
}

export interface AtendimentoKpis {
  total: number;
  aguardando_coleta: number;
  em_analise: number;
  pendentes: number;
  finalizados: number;
  receita_total: number;
}

const EMPTY_KPIS: AtendimentoKpis = {
  total: 0, aguardando_coleta: 0, em_analise: 0, pendentes: 0, finalizados: 0, receita_total: 0,
};

// ── Adapter: row paginada → MockAtendimento "leve" ──
// Suficiente para listagem (cards/linhas, badges, ações). Para edição/pagamento
// completos a página deve preferir o objeto do cache global (`getAtendimentos()`).
const PG_TYPE: Record<string, StatusType> = {
  "Pagamento efetuado": "success",
  "Pagamento pendente": "warning",
  "Pagamento parcial": "info",
  "Pagamento cancelado": "neutral",
};
const AT_TYPE: Record<string, StatusType> = {
  "Pedido Realizado": "warning",
  "Amostra Coletada": "info",
  "Em Análise": "info",
  "Amostra Analisada": "info",
  "Resultado Salvo": "info",
  "Resultado Liberado": "success",
  "Em Retificação": "warning",
  "Retificado": "info",
  "Pedido cancelado": "danger",
  "Cancelado": "danger",
};

function fmtBr(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  const hh = String(dt.getHours()).padStart(2, "0");
  const mi = String(dt.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}
function fmtBrDate(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}
function fmtCpf(cpf: string | null): string {
  if (!cpf) return "";
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}

export function pageRowToLightAtendimento(r: AtendimentoPageRow): MockAtendimento {
  return normalizeAtendimento({
    protocolo: r.protocolo,
    data: fmtBr(r.data),
    nome: r.paciente_nome ?? "",
    cpf: fmtCpf(r.paciente_cpf),
    nascimento: fmtBrDate(r.paciente_nascimento),
    idade: r.paciente_nascimento ? formatIdadeDetalhada(r.paciente_nascimento) : "",
    statusAtendimento: {
      label: r.status_atendimento,
      type: AT_TYPE[r.status_atendimento] ?? "neutral",
    },
    statusPagamento: {
      label: r.status_pagamento,
      type: PG_TYPE[r.status_pagamento] ?? "warning",
    },
    motivoCancelamento: r.motivo_cancelamento ?? undefined,
    solicitante: r.solicitante ?? "",
    convenio: r.convenio_nome ?? "",
    exames: [],
    examesCobranca: [],
    unidadeId: r.unidade_id ?? undefined,
    pagamentosRealizados: [],
    updatedAt: r.updated_at ? fmtBr(r.updated_at) : undefined,
  });
}

export interface PaginatedFilters {
  status?: string;
  pagamento?: string;
  unidadeId?: string;
  q?: string;
}

export interface UsePaginatedAtendimentosResult {
  items: AtendimentoPageRow[];
  kpis: AtendimentoKpis;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Filtros vêm crus; aplicamos debounce APENAS na busca (`q`).
 */
export function usePaginatedAtendimentos(
  filters: PaginatedFilters,
  enabled: boolean,
): UsePaginatedAtendimentosResult {
  const debouncedQ = useDebouncedValue(filters.q ?? "", 300);

  const effectiveFilters = useMemo<PaginatedFilters>(() => ({
    status: filters.status,
    pagamento: filters.pagamento,
    unidadeId: filters.unidadeId,
    q: debouncedQ,
  }), [filters.status, filters.pagamento, filters.unidadeId, debouncedQ]);

  const [items, setItems] = useState<AtendimentoPageRow[]>([]);
  const [kpis, setKpis] = useState<AtendimentoKpis>(EMPTY_KPIS);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);

  // Token p/ cancelar respostas obsoletas (race conditions)
  const reqTokenRef = useRef(0);

  const fetchPage = useCallback(async (
    f: PaginatedFilters,
    cursor: { data: string; id: number } | null,
  ): Promise<AtendimentoPageRow[]> => {
    const { data, error } = await supabase.rpc("atendimentos_page", {
      _status: f.status ?? undefined,
      _pagamento: f.pagamento ?? undefined,
      _unidade_id: f.unidadeId ?? undefined,
      _q: f.q ?? undefined,
      _cursor_data: cursor?.data ?? undefined,
      _cursor_id: cursor?.id ?? undefined,
      _page_size: PAGE_SIZE,
    });
    if (error) throw error;
    return (data ?? []) as AtendimentoPageRow[];
  }, []);

  const fetchKpis = useCallback(async (f: PaginatedFilters): Promise<AtendimentoKpis> => {
    const { data, error } = await supabase.rpc("atendimentos_kpis", {
      _status: f.status ?? undefined,
      _pagamento: f.pagamento ?? undefined,
      _unidade_id: f.unidadeId ?? undefined,
      _q: f.q ?? undefined,
    });
    if (error) throw error;
    const obj = (data ?? {}) as Partial<AtendimentoKpis>;
    return {
      total: Number(obj.total ?? 0),
      aguardando_coleta: Number(obj.aguardando_coleta ?? 0),
      em_analise: Number(obj.em_analise ?? 0),
      pendentes: Number(obj.pendentes ?? 0),
      finalizados: Number(obj.finalizados ?? 0),
      receita_total: Number(obj.receita_total ?? 0),
    };
  }, []);

  // Reset + carga inicial sempre que filtros efetivos mudarem
  useEffect(() => {
    if (!enabled) return;
    const token = ++reqTokenRef.current;
    setLoading(true);
    setError(null);
    setItems([]);
    setHasMore(false);
    (async () => {
      try {
        // KPIs ignoram o filtro de STATUS para que os cards sempre reflitam
        // a totalidade do escopo atual (unidade/pagamento/busca). Sem isso,
        // ao clicar em "Em andamento" o próprio card zeraria os demais.
        const kpiFilters: PaginatedFilters = { ...effectiveFilters, status: undefined };
        const [pageItems, k] = await Promise.all([
          fetchPage(effectiveFilters, null),
          fetchKpis(kpiFilters),
        ]);
        if (reqTokenRef.current !== token) return;
        setItems(pageItems);
        setKpis(k);
        setHasMore(pageItems.length === PAGE_SIZE);
      } catch (e: unknown) {
        if (reqTokenRef.current !== token) return;
        const msg = (e as Error)?.message ?? "Falha ao carregar atendimentos";
        logger.warn("usePaginatedAtendimentos", "carga inicial falhou", { error: msg });
        setError(msg);
        setKpis(EMPTY_KPIS);
      } finally {
        if (reqTokenRef.current === token) setLoading(false);
      }
    })();
  }, [enabled, effectiveFilters, fetchPage, fetchKpis]);

  const loadMore = useCallback(async () => {
    if (!enabled || loadingMore || !hasMore || items.length === 0) return;
    const last = items[items.length - 1];
    const cursor = { data: last.data, id: last.id };
    const token = reqTokenRef.current;
    setLoadingMore(true);
    try {
      const next = await fetchPage(effectiveFilters, cursor);
      if (reqTokenRef.current !== token) return;
      // Cache controlado: máximo MAX_PAGES_IN_CACHE páginas
      const pagesAhora = Math.ceil(items.length / PAGE_SIZE);
      const merged = pagesAhora >= MAX_PAGES_IN_CACHE
        ? [...items.slice(PAGE_SIZE), ...next] // descarta a página mais antiga
        : [...items, ...next];
      setItems(merged);
      setHasMore(next.length === PAGE_SIZE);
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? "Falha ao carregar mais";
      logger.warn("usePaginatedAtendimentos", "loadMore falhou", { error: msg });
      setError(msg);
    } finally {
      if (reqTokenRef.current === token) setLoadingMore(false);
    }
  }, [enabled, loadingMore, hasMore, items, effectiveFilters, fetchPage]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const token = ++reqTokenRef.current;
    setLoading(true);
    setError(null);
    try {
      const kpiFilters: PaginatedFilters = { ...effectiveFilters, status: undefined };
      const [pageItems, k] = await Promise.all([
        fetchPage(effectiveFilters, null),
        fetchKpis(kpiFilters),
      ]);
      if (reqTokenRef.current !== token) return;
      setItems(pageItems);
      setKpis(k);
      setHasMore(pageItems.length === PAGE_SIZE);
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? "Falha ao recarregar";
      logger.warn("usePaginatedAtendimentos", "refresh falhou", { error: msg });
      setError(msg);
    } finally {
      if (reqTokenRef.current === token) setLoading(false);
    }
  }, [enabled, effectiveFilters, fetchPage, fetchKpis]);

  return { items, kpis, loading, loadingMore, error, hasMore, loadMore, refresh };
}