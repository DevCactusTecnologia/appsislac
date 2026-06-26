// AtendimentoSkill — consultas operacionais sobre atendimentos do tenant.
// RLS é aplicada via cliente do usuário (tenant_id resolvido server-side).
import { tool } from "npm:ai@5.0.206";
import { z } from "npm:zod@3.23.8";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const PERIODOS = ["hoje", "ontem", "semana", "mes", "ano", "total"] as const;

function rangeFor(periodo: typeof PERIODOS[number]): { from?: string; to?: string } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (periodo === "total") return {};
  if (periodo === "hoje") {
    const f = startOfDay(now);
    return { from: f.toISOString() };
  }
  if (periodo === "ontem") {
    const f = startOfDay(new Date(now.getTime() - 86400000));
    const t = startOfDay(now);
    return { from: f.toISOString(), to: t.toISOString() };
  }
  if (periodo === "semana") {
    const f = startOfDay(new Date(now.getTime() - 6 * 86400000));
    return { from: f.toISOString() };
  }
  if (periodo === "mes") {
    const f = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: f.toISOString() };
  }
  if (periodo === "ano") {
    const f = new Date(now.getFullYear(), 0, 1);
    return { from: f.toISOString() };
  }
  return {};
}

export function buildAtendimentoTools(userClient: SupabaseClient) {
  return {
    atendimento_count: tool({
      description:
        "Conta atendimentos do tenant atual. Use sempre que o usuário perguntar quantidade/total de atendimentos. " +
        "Suporta filtro por período (hoje, ontem, semana, mes, ano, total) e por status_atendimento.",
      inputSchema: z.object({
        periodo: z.enum(PERIODOS).default("total"),
        status: z.string().optional(),
      }),
      execute: async ({ periodo, status }) => {
        const { from, to } = rangeFor(periodo);
        let q = userClient.from("atendimentos").select("id", { count: "exact", head: true });
        if (from) q = q.gte("data", from);
        if (to) q = q.lt("data", to);
        if (status) q = q.eq("status_atendimento", status);
        const { count, error } = await q;
        if (error) return { ok: false, error: { code: "INTERNAL", message: error.message } };
        return { ok: true, data: { total: count ?? 0, periodo, status: status ?? null } };
      },
    }),

    atendimento_summary: tool({
      description:
        "Resumo agregado dos atendimentos do tenant por status_atendimento, com filtro de período opcional.",
      inputSchema: z.object({
        periodo: z.enum(PERIODOS).default("hoje"),
      }),
      execute: async ({ periodo }) => {
        const { from, to } = rangeFor(periodo);
        let q = userClient.from("atendimentos").select("status_atendimento");
        if (from) q = q.gte("data", from);
        if (to) q = q.lt("data", to);
        const { data, error } = await q.limit(5000);
        if (error) return { ok: false, error: { code: "INTERNAL", message: error.message } };
        const por_status: Record<string, number> = {};
        for (const row of data ?? []) {
          const k = (row as { status_atendimento: string | null }).status_atendimento ?? "indefinido";
          por_status[k] = (por_status[k] ?? 0) + 1;
        }
        return { ok: true, data: { periodo, total: data?.length ?? 0, por_status } };
      },
    }),
  };
}
