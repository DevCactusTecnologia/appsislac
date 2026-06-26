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

// Status reais usados em `atendimentos.status_atendimento`.
const STATUS_CONHECIDOS = [
  "Pedido Realizado",
  "Amostra Coletada",
  "Amostra Analisada",
  "Laudo Pronto",
  "Laudo Entregue",
  "Cancelado",
] as const;

// Estados considerados "finalizados" — todo o resto é pendente/em andamento.
const STATUS_FINALIZADOS = new Set(["Laudo Entregue", "Cancelado"]);

// Mapeia termos coloquiais → status reais (lowercase).
const STATUS_ALIASES: Record<string, string[]> = {
  pendente: ["Pedido Realizado", "Amostra Coletada", "Amostra Analisada", "Laudo Pronto"],
  pendentes: ["Pedido Realizado", "Amostra Coletada", "Amostra Analisada", "Laudo Pronto"],
  "em andamento": ["Pedido Realizado", "Amostra Coletada", "Amostra Analisada", "Laudo Pronto"],
  aberto: ["Pedido Realizado", "Amostra Coletada", "Amostra Analisada", "Laudo Pronto"],
  abertos: ["Pedido Realizado", "Amostra Coletada", "Amostra Analisada", "Laudo Pronto"],
  finalizado: ["Laudo Entregue"],
  finalizados: ["Laudo Entregue"],
  entregue: ["Laudo Entregue"],
  cancelado: ["Cancelado"],
  cancelados: ["Cancelado"],
};

function resolverStatus(status?: string): string[] | null {
  if (!status) return null;
  const key = status.trim().toLowerCase();
  if (STATUS_ALIASES[key]) return STATUS_ALIASES[key];
  // tenta match case-insensitive contra os status reais
  const match = STATUS_CONHECIDOS.find((s) => s.toLowerCase() === key);
  return match ? [match] : [status];
}

export function buildAtendimentoTools(userClient: SupabaseClient) {
  return {
    atendimento_count: tool({
      description:
        "Conta atendimentos do tenant atual. Use sempre que o usuário perguntar quantidade/total de atendimentos. " +
        "Suporta filtro por período (hoje, ontem, semana, mes, ano, total) e por status. " +
        "Para 'pendentes/em andamento/abertos' passe status='pendente' — a tool traduz para os status reais " +
        "(Pedido Realizado, Amostra Coletada, Amostra Analisada, Laudo Pronto). " +
        "Status reais conhecidos: " + STATUS_CONHECIDOS.join(", ") + ".",
      inputSchema: z.object({
        periodo: z.enum(PERIODOS).default("total"),
        status: z
          .string()
          .optional()
          .describe("Status real ou alias (pendente, em andamento, finalizado, cancelado, entregue)."),
      }),
      execute: async ({ periodo, status }) => {
        const { from, to } = rangeFor(periodo);
        const statusList = resolverStatus(status);
        let q = userClient.from("atendimentos").select("id", { count: "exact", head: true });
        if (from) q = q.gte("data", from);
        if (to) q = q.lt("data", to);
        if (statusList && statusList.length > 0) q = q.in("status_atendimento", statusList);
        const { count, error } = await q;
        if (error) return { ok: false, error: { code: "INTERNAL", message: error.message } };
        return {
          ok: true,
          data: {
            total: count ?? 0,
            periodo,
            status_solicitado: status ?? null,
            status_aplicados: statusList,
          },
        };
      },
    }),

    atendimento_summary: tool({
      description:
        "Resumo agregado dos atendimentos do tenant agrupados por status_atendimento. " +
        "Inclui também o total 'pendentes' (qualquer status diferente de Laudo Entregue/Cancelado). " +
        "Filtro de período opcional.",
      inputSchema: z.object({
        periodo: z.enum(PERIODOS).default("total"),
      }),
      execute: async ({ periodo }) => {
        const { from, to } = rangeFor(periodo);
        let q = userClient.from("atendimentos").select("status_atendimento");
        if (from) q = q.gte("data", from);
        if (to) q = q.lt("data", to);
        const { data, error } = await q.limit(5000);
        if (error) return { ok: false, error: { code: "INTERNAL", message: error.message } };
        const por_status: Record<string, number> = {};
        let pendentes = 0;
        for (const row of data ?? []) {
          const k = (row as { status_atendimento: string | null }).status_atendimento ?? "indefinido";
          por_status[k] = (por_status[k] ?? 0) + 1;
          if (!STATUS_FINALIZADOS.has(k)) pendentes += 1;
        }
        return {
          ok: true,
          data: { periodo, total: data?.length ?? 0, pendentes, por_status },
        };
      },
    }),
  };
}
