// ============================================================
// useOcorrenciasPage — paginação por cursor para Relatório de Ocorrências
// ------------------------------------------------------------
// Cursor composto: (occurred_at DESC, kind ASC, row_id DESC).
// Filtros server-side: data_from, data_to, busca (debounced).
// Retorna rows planas — a agregação por protocolo é feita na tela
// (mantém o shape `OcorrenciaAtendimento` legado intacto).
//
// Quando `enabled = false`, fica inerte (consumidor cai no caminho legado).
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db as supabase } from "@/runtime/db";
import { logger } from "@/lib/logger";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const PAGE_SIZE = 50;
const MAX_PAGES_IN_CACHE = 6;

export interface OcorrenciaRow {
  kind: "atendimento" | "amostra";
  row_id: number;
  atendimento_id: number;
  protocolo: string;
  paciente_nome: string;
  paciente_cpf: string;
  data_protocolo: string;     // ISO
  occurred_at: string;        // ISO
  motivo: string;
  exame_nome: string | null;
  exame_material: string | null;
  exame_data_coleta: string | null;
  exame_data_analise: string | null;
}

export interface OcorrenciasFilters {
  /** Inclusivo: occurred_at >= dateFrom (ISO date) */
  dateFrom?: string;
  /** Inclusivo: occurred_at < dateTo + 1 day (ISO date) */
  dateTo?: string;
  /** Substring case-insensitive em nome/protocolo/CPF */
  q?: string;
}

export interface UseOcorrenciasPageResult {
  items: OcorrenciaRow[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useOcorrenciasPage(
  filters: OcorrenciasFilters,
  enabled: boolean,
): UseOcorrenciasPageResult {
  const debouncedQ = useDebouncedValue(filters.q ?? "", 300);

  const effective = useMemo<OcorrenciasFilters>(() => ({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    q: debouncedQ,
  }), [filters.dateFrom, filters.dateTo, debouncedQ]);

  const [items, setItems] = useState<OcorrenciaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const reqTokenRef = useRef(0);

  const fetchPage = useCallback(async (
    f: OcorrenciasFilters,
    cursor: { occurredAt: string; kind: string; id: number } | null,
  ): Promise<OcorrenciaRow[]> => {
    const { data, error } = await supabase.rpc("ocorrencias_page", {
      _cursor_occurred_at: cursor?.occurredAt ?? undefined,
      _cursor_id: cursor?.id ?? undefined,
      _cursor_kind: cursor?.kind ?? undefined,
      _limit: PAGE_SIZE,
      _date_from: f.dateFrom && f.dateFrom.length > 0 ? f.dateFrom : undefined,
      _date_to: f.dateTo && f.dateTo.length > 0 ? f.dateTo : undefined,
      _busca: f.q && f.q.trim().length > 0 ? f.q.trim() : undefined,
    });
    if (error) throw error;
    return (data ?? []) as OcorrenciaRow[];
  }, []);

  // Reset + carga inicial
  useEffect(() => {
    if (!enabled) return;
    const token = ++reqTokenRef.current;
    setLoading(true);
    setError(null);
    setItems([]);
    setHasMore(false);
    (async () => {
      try {
        const rows = await fetchPage(effective, null);
        if (reqTokenRef.current !== token) return;
        setItems(rows);
        setHasMore(rows.length === PAGE_SIZE);
      } catch (e: unknown) {
        if (reqTokenRef.current !== token) return;
        const msg = (e as Error)?.message ?? "Falha ao carregar ocorrências";
        logger.warn("useOcorrenciasPage", "carga inicial falhou", { error: msg });
        setError(msg);
      } finally {
        if (reqTokenRef.current === token) setLoading(false);
      }
    })();
  }, [enabled, effective, fetchPage]);

  const loadMore = useCallback(async () => {
    if (!enabled || loadingMore || !hasMore || items.length === 0) return;
    const last = items[items.length - 1];
    const cursor = { occurredAt: last.occurred_at, kind: last.kind, id: last.row_id };
    const token = reqTokenRef.current;
    setLoadingMore(true);
    try {
      const next = await fetchPage(effective, cursor);
      if (reqTokenRef.current !== token) return;
      const pages = Math.ceil(items.length / PAGE_SIZE);
      const merged = pages >= MAX_PAGES_IN_CACHE
        ? [...items.slice(PAGE_SIZE), ...next]
        : [...items, ...next];
      setItems(merged);
      setHasMore(next.length === PAGE_SIZE);
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? "Falha ao carregar mais";
      logger.warn("useOcorrenciasPage", "loadMore falhou", { error: msg });
      setError(msg);
    } finally {
      if (reqTokenRef.current === token) setLoadingMore(false);
    }
  }, [enabled, loadingMore, hasMore, items, effective, fetchPage]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const token = ++reqTokenRef.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchPage(effective, null);
      if (reqTokenRef.current !== token) return;
      setItems(rows);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? "Falha ao recarregar";
      logger.warn("useOcorrenciasPage", "refresh falhou", { error: msg });
      setError(msg);
    } finally {
      if (reqTokenRef.current === token) setLoading(false);
    }
  }, [enabled, effective, fetchPage]);

  return { items, loading, loadingMore, error, hasMore, loadMore, refresh };
}