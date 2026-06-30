// Métricas de produção e séries agregadas consumidas pelas telas operacionais.
// C2 — Agregação server-side via RPCs `dashboard_metrics` / `dashboard_daily_series`.
// Não fazemos mais fetch massivo de atendimentos/exames no cliente.
import { db as supabase } from "@/runtime/db";
import { logger } from "@/lib/logger";

/* ─────────────── Types ─────────────── */

export interface ProducaoBucket {
  nome: string;
  total: number;
}

export interface ProducaoAggregates {
  porAnalista: ProducaoBucket[];
  porConvenio: ProducaoBucket[];
  porMaterial: ProducaoBucket[];
  porExame: ProducaoBucket[];
  totalExames: number;
  intervalo: { inicio: string; fim: string };
}

export interface DailySeries {
  dia: string; // YYYY-MM-DD
  total: number;
}

/* ─────────────── Helpers ─────────────── */

const toISODateStart = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
};
const toISODateEnd = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.toISOString();
};

/* ─────────────── Tipos da RPC ─────────────── */
interface DashboardMetricsRpc {
  porAnalista: ProducaoBucket[];
  porConvenio: ProducaoBucket[];
  porMaterial: ProducaoBucket[];
  porExame:    ProducaoBucket[];
  totalExames: number;
  serieDiaria: { dia: string; total: number }[];
  intervalo:   { inicio: string; fim: string };
}

/* ─────────────── Producao aggregates ─────────────── */

export async function fetchProducaoAggregates(
  inicio: Date,
  fim: Date,
  _signal?: AbortSignal,
): Promise<ProducaoAggregates> {
  const ini = toISODateStart(inicio);
  const end = toISODateEnd(fim);

  const { data, error } = await supabase.rpc("dashboard_metrics", {
    _inicio: ini,
    _fim: end,
  });
  if (error) {
    logger.warn("producaoMetricsStore", "dashboard_metrics falhou", { error: error.message });
    throw error;
  }

  const m = (data ?? {}) as Partial<DashboardMetricsRpc>;
  const norm = (arr?: ProducaoBucket[]): ProducaoBucket[] =>
    (arr ?? []).map(b => ({ nome: String(b.nome ?? "—"), total: Number(b.total ?? 0) }));

  return {
    porAnalista: norm(m.porAnalista),
    porConvenio: norm(m.porConvenio),
    porMaterial: norm(m.porMaterial),
    porExame:    norm(m.porExame),
    totalExames: Number(m.totalExames ?? 0),
    intervalo:   { inicio: ini, fim: end },
  };
}

/* ─────────────── Daily series (used by Producao chart) ─────────────── */

export async function fetchDailySeries(
  inicio: Date,
  fim: Date,
  filter?: { nomeExame?: string; convenio?: string; analista?: string; material?: string },
  _signal?: AbortSignal,
): Promise<DailySeries[]> {
  const ini = toISODateStart(inicio);
  const end = toISODateEnd(fim);

  const { data, error } = await supabase.rpc("dashboard_daily_series", {
    _inicio: ini,
    _fim: end,
    _nome_exame: filter?.nomeExame ?? undefined,
    _convenio:   filter?.convenio   ?? undefined,
    _analista:   filter?.analista   ?? undefined,
    _material:   filter?.material   ?? undefined,
  });
  if (error) {
    logger.warn("producaoMetricsStore", "dashboard_daily_series falhou", { error: error.message });
    throw error;
  }
  const arr = (data ?? []) as { dia: string; total: number }[];
  return arr.map(r => ({ dia: String(r.dia), total: Number(r.total ?? 0) }));
}
