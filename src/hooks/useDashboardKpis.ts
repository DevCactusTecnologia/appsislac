// ============================================================
// useDashboardKpis — C-2 (canary do Dashboard)
// ------------------------------------------------------------
// Busca KPIs agregados do dashboard via RPC `dashboard_kpis`.
// Quando `enabled = false`, fica inerte (consumidor cai no
// caminho legado baseado em `getAtendimentos()`).
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface DashboardKpis {
  operacional: {
    atendimentosHoje: number;
    liberadosHoje: number;
    coletasPendentes: number;
    analisesAndamento: number;
    resultadosLiberar: number;
    cancelados: number;
  };
  financeiro: {
    receitaHoje: number;
    receitaMes: number;
    aReceber: number;
    saidasMes: number;
    saldoMes: number;
    ticketMedio: number;
  };
  pacientes: {
    total: number;
    ativos: number;
    atendidos30d: number;
    novos30d: number;
    topConvenio: string | null;
  };
  produtividade: {
    exames30d: number;
    taxaCancelamento: number;
    topSolicitante: string | null;
  };
  topExames: Array<[string, number]>;
}

const EMPTY: DashboardKpis = {
  operacional: { atendimentosHoje: 0, liberadosHoje: 0, coletasPendentes: 0, analisesAndamento: 0, resultadosLiberar: 0, cancelados: 0 },
  financeiro: { receitaHoje: 0, receitaMes: 0, aReceber: 0, saidasMes: 0, saldoMes: 0, ticketMedio: 0 },
  pacientes: { total: 0, ativos: 0, atendidos30d: 0, novos30d: 0, topConvenio: null },
  produtividade: { exames30d: 0, taxaCancelamento: 0, topSolicitante: null },
  topExames: [],
};

export interface UseDashboardKpisResult {
  data: DashboardKpis;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDashboardKpis(enabled: boolean): UseDashboardKpisResult {
  const [data, setData] = useState<DashboardKpis>(EMPTY);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: raw, error: err } = await supabase.rpc("dashboard_kpis");
      if (err) throw err;
      const obj = (raw ?? {}) as Partial<DashboardKpis>;
      setData({
        operacional: { ...EMPTY.operacional, ...(obj.operacional ?? {}) },
        financeiro:  { ...EMPTY.financeiro,  ...(obj.financeiro  ?? {}) },
        pacientes:   { ...EMPTY.pacientes,   ...(obj.pacientes   ?? {}) },
        produtividade: { ...EMPTY.produtividade, ...(obj.produtividade ?? {}) },
        topExames: Array.isArray(obj.topExames)
          ? (obj.topExames as unknown[]).map((it) => {
              if (Array.isArray(it)) return [String(it[0] ?? ""), Number(it[1] ?? 0)] as [string, number];
              if (it && typeof it === "object") {
                const o = it as { nome?: unknown; total?: unknown };
                return [String(o.nome ?? ""), Number(o.total ?? 0)] as [string, number];
              }
              return ["", 0] as [string, number];
            })
          : [],
      });
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? "Falha ao carregar KPIs";
      logger.warn("useDashboardKpis", "rpc dashboard_kpis falhou", { error: msg });
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void fetchOnce();
  }, [enabled, fetchOnce]);

  return { data, loading, error, refresh: fetchOnce };
}
