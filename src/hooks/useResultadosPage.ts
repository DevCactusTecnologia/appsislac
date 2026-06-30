// ============================================================
// useResultadosPage — C-2 (canary da tela Resultados)
// ------------------------------------------------------------
// Paginação por cursor (data DESC, id DESC) via RPC `resultados_page`.
// Cache controlado em memória (FIFO até MAX_PAGES_IN_CACHE).
// Independente do cache global do atendimentoStore.
//
// Quando `enabled = false`, fica inerte (consumidor cai no caminho
// legado baseado em `getAtendimentos()`).
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db as supabase } from "@/runtime/db";
import { logger } from "@/lib/logger";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const PAGE_SIZE = 50;
const MAX_PAGES_IN_CACHE = 5;

/**
 * Status canônicos de `atendimentos.status_atendimento` que pertencem à
 * etapa de Resultados. Exames em `pendente` (Pedido Realizado) ou apenas
 * `coletado` (Amostra Coletada) ainda não chegaram nesta tela e devem
 * ser bloqueados na origem do hook.
 */
const RESULTADOS_ALLOWED_STATUSES = new Set<string>([
  "Resultado Liberado",
  "Amostra Analisada",
  "Resultado Salvo",
  "Cancelado",
]);

export function isStatusAllowedForResultados(label: string | null | undefined): boolean {
  if (!label) return false;
  return RESULTADOS_ALLOWED_STATUSES.has(label);
}

export interface ResultadoPageRow {
  id: number;
  protocolo: string;
  paciente_nome: string | null;
  paciente_nascimento: string | null;
  solicitante: string | null;
  status_resultado: string;
  motivo_cancelamento: string | null;
  data: string;
  /** True quando algum exame ativo está com `retificado=true`. Não é status. */
  tem_retificacao?: boolean;
}

export interface ResultadosFilters {
  /** Status canônico do atendimento (ex.: "Resultado liberado"); undefined = todos */
  status?: string;
  /** Busca por nome ou protocolo (substring case-insensitive) */
  q?: string;
}

export interface UseResultadosPageResult {
  items: ResultadoPageRow[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useResultadosPage(
  filters: ResultadosFilters,
  enabled: boolean,
): UseResultadosPageResult {
  const debouncedQ = useDebouncedValue(filters.q ?? "", 300);

  const effective = useMemo<ResultadosFilters>(() => ({
    status: filters.status,
    q: debouncedQ,
  }), [filters.status, debouncedQ]);

  const [items, setItems] = useState<ResultadoPageRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);

  const reqTokenRef = useRef(0);

  const fetchPage = useCallback(async (
    f: ResultadosFilters,
    cursor: { data: string; id: number } | null,
  ): Promise<ResultadoPageRow[]> => {
    const { data, error } = await supabase.rpc("resultados_page", {
      _cursor_data: cursor?.data ?? undefined,
      _cursor_id: cursor?.id ?? undefined,
      _limit: PAGE_SIZE,
      _status: f.status && f.status.length > 0 ? f.status : undefined,
      _busca: f.q && f.q.trim().length > 0 ? f.q.trim() : undefined,
    });
    if (error) throw error;
    const rows = (data ?? []) as ResultadoPageRow[];
    // Guard de domínio: nunca devolver atendimentos cujos exames ainda
    // estão em etapas anteriores (pendente / coletado).
    return rows.filter((r) => isStatusAllowedForResultados(r.status_resultado));
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
        const msg = (e as Error)?.message ?? "Falha ao carregar resultados";
        logger.warn("useResultadosPage", "carga inicial falhou", { error: msg });
        setError(msg);
      } finally {
        if (reqTokenRef.current === token) setLoading(false);
      }
    })();
  }, [enabled, effective, fetchPage]);

  const loadMore = useCallback(async () => {
    if (!enabled || loadingMore || !hasMore || items.length === 0) return;
    const last = items[items.length - 1];
    const cursor = { data: last.data, id: last.id };
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
      logger.warn("useResultadosPage", "loadMore falhou", { error: msg });
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
      logger.warn("useResultadosPage", "refresh falhou", { error: msg });
      setError(msg);
    } finally {
      if (reqTokenRef.current === token) setLoading(false);
    }
  }, [enabled, effective, fetchPage]);

  return { items, loading, loadingMore, error, hasMore, loadMore, refresh };
}
