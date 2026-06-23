// ============================================================
// Hook: useAReceberPacientes  (Financeiro V2 — Fase 1, SSOT)
// ============================================================
// REFATORADO: Agora usa novo padrão de erro handling e cleanup
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useAuth } from "@/contexts/AuthContext";
import { useAppContext } from "@/contexts/AppContext";
import { handleError } from "@/lib/errorHandling";
import { useInterval, useMounted } from "@/hooks/useCleanupUtils";

export interface AReceberRowDTO {
  id: number;
  protocolo: string;
  data: string; // ISO
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

/**
 * Hook para carregar "A Receber" de pacientes
 *
 * ✅ MELHORIAS:
 * - Validação de tenant_id obrigatória
 * - Erro handling diferenciado
 * - useMounted() para evitar setState após desmontar
 * - Cleanup automático
 * - Type-safe com TypeScript
 */
export function useAReceberPacientes(
  enabled: boolean,
  filters: UseAReceberFilters
): UseAReceberPacientesResult {
  const { user } = useAuth();
  const { tenantId, notifyError } = useAppContext();
  const isMounted = useMounted();

  const [rows, setRows] = useState<AReceberRowDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cursorRef = useRef<{ data: string | null; id: number | null }>({
    data: null,
    id: null,
  });
  const reqIdRef = useRef(0);

  const pageSize = filters.pageSize ?? 50;

  // ✅ MUDANÇA 1: fetchPage com melhor error handling
  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (!enabled || !tenantId) {
        if (isMounted()) {
          setRows([]);
          setHasMore(false);
        }
        return;
      }

      const myReq = ++reqIdRef.current;

      if (isMounted()) {
        setLoading(true);
        setError(null);
      }

      try {
        // ✅ MUDANÇA 2: RPC com validação de tenant
        const { data, error: rpcError } = await supabase.rpc(
          "financeiro_a_receber_v2",
          {
            p_tipo: "paciente",
            p_tenant_id: tenantId, // ← ADICIONADO
            p_search: filters.search ?? undefined,
            p_date_from: filters.dateFrom
              ? filters.dateFrom.toISOString()
              : undefined,
            p_date_to: filters.dateTo
              ? new Date(filters.dateTo.getTime() + 86_399_999).toISOString()
              : undefined,
            p_status: filters.status ?? undefined,
            p_cursor_data: reset ? undefined : cursorRef.current.data ?? undefined,
            p_cursor_id: reset ? undefined : cursorRef.current.id ?? undefined,
            p_limit: pageSize,
          }
        );

        // ✅ MUDANÇA 3: Verificar se request é ainda válido
        if (myReq !== reqIdRef.current) return;

        // ✅ MUDANÇA 4: Error handling diferenciado
        if (rpcError) {
          const handled = handleError(
            rpcError,
            "carregar a receber de pacientes"
          );
          if (isMounted()) {
            setError(handled.message);
          }
          notifyError(rpcError, "carregar a receber de pacientes");
          throw rpcError;
        }

        // ✅ MUDANÇA 5: Validar dados
        const list: AReceberRowDTO[] = (data ?? []).map(
          (r: {
            ref_id: number;
            protocolo: string;
            data: string;
            quem: string;
            convenio_nome: string | null;
            valor_total: number | string;
            valor_pago: number | string;
            saldo: number | string;
            status: string;
          }) => ({
            id: r.ref_id,
            protocolo: r.protocolo,
            data: r.data,
            paciente_nome: r.quem,
            convenio_nome: r.convenio_nome || "—",
            valor_total: Number(r.valor_total ?? 0),
            valor_pago: Number(r.valor_pago ?? 0),
            saldo: Number(r.saldo ?? 0),
            status: (r.status === "parcial" ? "parcial" : "pendente") as
              | "parcial"
              | "pendente",
          })
        );

        if (!isMounted()) return;

        if (reset) {
          setRows(list);
        } else {
          setRows((prev) => [...prev, ...list]);
        }

        // ✅ MUDANÇA 6: Atualizar cursor se há mais dados
        if (list.length > 0) {
          const last = list[list.length - 1];
          cursorRef.current = { data: last.data, id: last.id };
          setHasMore(list.length === pageSize);
        } else {
          setHasMore(false);
        }

        setError(null);
      } catch (error) {
        if (!isMounted()) return;

        // Já foi logado pelo handleError
        console.error("❌ [useAReceberPacientes]", error);
        
        // Não setar erro se request foi cancelado
        if (myReq === reqIdRef.current) {
          setError("Erro ao carregar dados");
        }
      } finally {
        if (isMounted()) {
          setLoading(false);
        }
      }
    },
    [enabled, tenantId, filters, pageSize, isMounted, notifyError]
  );

  // ✅ MUDANÇA 7: loadMore com tratamento seguro
  const loadMore = useCallback(async () => {
    await fetchPage(false);
  }, [fetchPage]);

  // ✅ MUDANÇA 8: refresh com tratamento seguro
  const refresh = useCallback(async () => {
    cursorRef.current = { data: null, id: null };
    await fetchPage(true);
  }, [fetchPage]);

  // ✅ MUDANÇA 9: Effect com cleanup automático
  useEffect(() => {
    if (!enabled) return;

    // Fazer fetch inicial
    fetchPage(true);

    // Cleanup automático
    return () => {
      // Cancelar request pendente
      reqIdRef.current = -1;
    };
  }, [enabled, filters, fetchPage]);

  return {
    rows,
    loading,
    hasMore,
    error,
    loadMore,
    refresh,
  };
}
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

// ────────────────────────────────────────────────────────────
// A Receber — Convênios (Financeiro V2 — Fase 1, SSOT)
// ------------------------------------------------------------
// Consome a mesma RPC `financeiro_a_receber_v2` com p_tipo='convenio'.
// Retorna saldo agregado por convênio (exames com cobrança ao convênio
// que ainda não foram faturados). Substitui `fetchSaldoEmAbertoPorConvenio`.
// ────────────────────────────────────────────────────────────

export interface AReceberConvenioDTO {
  convenioId: number;
  convenioNome: string;
  saldo: number;
  qtdExames: number;
  qtdPacientes: number;
  /** Atendimento mais antigo com exame em aberto (Fase 5 V2). */
  desde: string | null;
}

export function useAReceberConvenios(
  enabled: boolean,
  filters: { search?: string } = {},
): { rows: AReceberConvenioDTO[]; loading: boolean; refresh: () => void } {
  const [rows, setRows] = useState<AReceberConvenioDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const reqIdRef = useRef(0);

  const fetchIt = useCallback(async () => {
    if (!enabled) { setRows([]); return; }
    const myReq = ++reqIdRef.current;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("financeiro_a_receber_v2", {
        p_tipo:   "convenio",
        p_search: filters.search ?? undefined,
      });
      if (myReq !== reqIdRef.current) return;
      if (error) throw error;
      const list: AReceberConvenioDTO[] = (data ?? []).map((r: {
        ref_id: number; quem: string; saldo: number | string;
        qtd_exames: number | null; qtd_pacientes: number | null;
        desde: string | null;
      }) => ({
        convenioId:    Number(r.ref_id),
        convenioNome:  r.quem,
        saldo:         Number(r.saldo) || 0,
        qtdExames:     Number(r.qtd_exames) || 0,
        qtdPacientes:  Number(r.qtd_pacientes) || 0,
        desde:         r.desde ?? null,
      }));
      setRows(list);
    } catch (e: unknown) {
      if (myReq !== reqIdRef.current) return;
      logger.warn("useAReceberConvenios", (e as Error)?.message);
      setRows([]);
    } finally {
      if (myReq === reqIdRef.current) setLoading(false);
    }
  }, [enabled, filters.search]);

  useEffect(() => { void fetchIt(); }, [fetchIt]);

  return { rows, loading, refresh: () => { void fetchIt(); } };
}

// ────────────────────────────────────────────────────────────
// A Receber — TOTAIS (Financeiro V2 — Fase 7, SSOT definitivo)
// ------------------------------------------------------------
// Hook único que consome a RPC `financeiro_a_receber_totais`,
// fonte oficial dos cards/KPIs de "A Receber" em qualquer tela
// (Dashboard, Recepção, Painel Financeiro, relatórios).
// Frontend lê. Banco calcula. Uma verdade.
// ────────────────────────────────────────────────────────────

export interface AReceberTotais {
  totalPacientes: number;
  qtdPacientes: number;
  totalConvenios: number;
  qtdConvenios: number;
  totalGeral: number;
}

const TOTAIS_EMPTY: AReceberTotais = {
  totalPacientes: 0,
  qtdPacientes: 0,
  totalConvenios: 0,
  qtdConvenios: 0,
  totalGeral: 0,
};

export function useAReceberTotais(
  enabled: boolean,
): { totais: AReceberTotais; loading: boolean; refresh: () => void } {
  const [totais, setTotais] = useState<AReceberTotais>(TOTAIS_EMPTY);
  const [loading, setLoading] = useState(false);
  const reqIdRef = useRef(0);

  const fetchIt = useCallback(async () => {
    if (!enabled) { setTotais(TOTAIS_EMPTY); return; }
    const myReq = ++reqIdRef.current;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("financeiro_a_receber_totais");
      if (myReq !== reqIdRef.current) return;
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      setTotais(row ? {
        totalPacientes: Number(row.total_pacientes) || 0,
        qtdPacientes:   Number(row.qtd_pacientes)   || 0,
        totalConvenios: Number(row.total_convenios) || 0,
        qtdConvenios:   Number(row.qtd_convenios)   || 0,
        totalGeral:     Number(row.total_geral)     || 0,
      } : TOTAIS_EMPTY);
    } catch (e: unknown) {
      if (myReq !== reqIdRef.current) return;
      logger.warn("useAReceberTotais", (e as Error)?.message);
      setTotais(TOTAIS_EMPTY);
    } finally {
      if (myReq === reqIdRef.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { void fetchIt(); }, [fetchIt]);

  return { totais, loading, refresh: () => { void fetchIt(); } };
}
