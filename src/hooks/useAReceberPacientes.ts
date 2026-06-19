// ============================================================
// Hook: useAReceberPacientes  (Financeiro V2 — Fase 1, SSOT)
// ------------------------------------------------------------
// Lista paginada (cursor) de saldos a receber por paciente,
// consumindo a RPC SSOT `financeiro_a_receber_v2` com p_tipo='paciente'.
// Esta é agora a ÚNICA fonte de "A Receber (Pacientes)" do módulo
// Financeiro — o cálculo client-side legacy foi removido.
// Ver docs/financeiro/ssot.md.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface AReceberRowDTO {
  id: number;
  protocolo: string;
  data: string;            // ISO
  paciente_nome: string;
  convenio_nome: string;
  valor_total: number;
  valor_pago: number;
  saldo: number;
  status: "parcial" | "pendente";
}

export interface UseAReceberFilters {
  search?: string;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  status?: "parcial" | "pendente" | null;
  pageSize?: number;
}

export interface UseAReceberPacientesResult {
  rows: AReceberRowDTO[];
  loading: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => void;
  refresh: () => void;
}

export function useAReceberPacientes(
  enabled: boolean,
  filters: UseAReceberFilters,
): UseAReceberPacientesResult {
  const [rows, setRows] = useState<AReceberRowDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef<{ data: string | null; id: number | null }>({ data: null, id: null });
  const reqIdRef = useRef(0);

  const pageSize = filters.pageSize ?? 50;

  const fetchPage = useCallback(async (reset: boolean) => {
    if (!enabled) { setRows([]); setHasMore(false); return; }
    const myReq = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc("financeiro_a_receber_v2", {
        p_tipo:        "paciente",
        p_search:      filters.search ?? undefined,
        p_date_from:   filters.dateFrom ? filters.dateFrom.toISOString() : undefined,
        p_date_to:     filters.dateTo   ? new Date(filters.dateTo.getTime() + 86_399_999).toISOString() : undefined,
        p_status:      filters.status ?? undefined,
        p_cursor_data: reset ? undefined : (cursorRef.current.data ?? undefined),
        p_cursor_id:   reset ? undefined : (cursorRef.current.id ?? undefined),
        p_limit:       pageSize,
      });
      if (myReq !== reqIdRef.current) return;
      if (error) throw error;
      // Adapta o shape unificado do v2 ao DTO legado consumido pelos templates.
      const list: AReceberRowDTO[] = (data ?? []).map((r: {
        ref_id: number; protocolo: string; data: string;
        quem: string; convenio_nome: string | null;
        valor_total: number | string; valor_pago: number | string;
        saldo: number | string; status: string;
      }) => ({
        id:             Number(r.ref_id),
        protocolo:      r.protocolo,
        data:           r.data,
        paciente_nome:  r.quem,
        convenio_nome:  r.convenio_nome ?? "Particular",
        valor_total:    Number(r.valor_total) || 0,
        valor_pago:     Number(r.valor_pago)  || 0,
        saldo:          Number(r.saldo)       || 0,
        status:         (r.status === "parcial" ? "parcial" : "pendente"),
      }));
      setRows((prev) => reset ? list : [...prev, ...list]);
      const last = list[list.length - 1];
      if (last) {
        cursorRef.current = { data: last.data, id: last.id };
      }
      setHasMore(list.length >= pageSize);
    } catch (e: unknown) {
      if (myReq !== reqIdRef.current) return;
      const msg = (e as Error)?.message ?? "Falha ao carregar A Receber";
      logger.warn("useAReceberPacientes", msg);
      setError(msg);
    } finally {
      if (myReq === reqIdRef.current) setLoading(false);
    }
  }, [enabled, filters.search, filters.dateFrom, filters.dateTo, filters.status, pageSize]);

  // Reset + primeira página sempre que filtros mudam
  useEffect(() => {
    cursorRef.current = { data: null, id: null };
    void fetchPage(true);
  }, [fetchPage]);

  return {
    rows,
    loading,
    hasMore,
    error,
    loadMore: () => { void fetchPage(false); },
    refresh:  () => { cursorRef.current = { data: null, id: null }; void fetchPage(true); },
  };
}

// ────────────────────────────────────────────────────────────
// Resumo financeiro agregado (single round-trip)
// ────────────────────────────────────────────────────────────

export interface FinanceiroResumo {
  total_recebido: number;
  qtd_recebido: number;
  total_a_receber: number;
  qtd_a_receber: number;
  total_saidas_pagas: number;
  qtd_saidas_pagas: number;
  total_saidas_pendentes: number;
  qtd_saidas_pendentes: number;
}

export interface UseFinanceiroResumoFilters {
  dateFrom?: Date | null;
  dateTo?: Date | null;
  convenio?: string | null;
}

export function useFinanceiroResumo(
  enabled: boolean,
  filters: UseFinanceiroResumoFilters,
): { resumo: FinanceiroResumo | null; loading: boolean; refresh: () => void } {
  const [resumo, setResumo] = useState<FinanceiroResumo | null>(null);
  const [loading, setLoading] = useState(false);
  const reqIdRef = useRef(0);

  const fetchIt = useCallback(async () => {
    if (!enabled) { setResumo(null); return; }
    const myReq = ++reqIdRef.current;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("financeiro_resumo", {
        p_date_from: filters.dateFrom ? filters.dateFrom.toISOString() : undefined,
        p_date_to:   filters.dateTo   ? new Date(filters.dateTo.getTime() + 86_399_999).toISOString() : undefined,
        p_convenio:  filters.convenio ?? undefined,
      });
      if (myReq !== reqIdRef.current) return;
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      setResumo(row ? {
        total_recebido:        Number(row.total_recebido) || 0,
        qtd_recebido:          Number(row.qtd_recebido) || 0,
        total_a_receber:       Number(row.total_a_receber) || 0,
        qtd_a_receber:         Number(row.qtd_a_receber) || 0,
        total_saidas_pagas:    Number(row.total_saidas_pagas) || 0,
        qtd_saidas_pagas:      Number(row.qtd_saidas_pagas) || 0,
        total_saidas_pendentes: Number(row.total_saidas_pendentes) || 0,
        qtd_saidas_pendentes:  Number(row.qtd_saidas_pendentes) || 0,
      } : null);
    } catch (e: unknown) {
      if (myReq !== reqIdRef.current) return;
      logger.warn("useFinanceiroResumo", (e as Error)?.message);
      setResumo(null);
    } finally {
      if (myReq === reqIdRef.current) setLoading(false);
    }
  }, [enabled, filters.dateFrom, filters.dateTo, filters.convenio]);

  useEffect(() => { void fetchIt(); }, [fetchIt]);

  return { resumo, loading, refresh: () => { void fetchIt(); } };
}