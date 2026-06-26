// ResultadoSkill — abrir tela de resultados e gravar valor de parâmetro.
// Mutação via RLS do usuário; valida exame e parâmetro pelo tenant atual.
import { tool } from "npm:ai@5.0.206";
import { z } from "npm:zod@3.23.8";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

function norm(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

async function findPaciente(client: SupabaseClient, paciente: string) {
  const digits = paciente.replace(/\D/g, "");
  const isUuid = /^[0-9a-f-]{36}$/i.test(paciente);
  let q = client.from("pacientes").select("id, nome").limit(5);
  if (isUuid) q = q.eq("id", paciente);
  else if (digits.length >= 6) q = q.ilike("cpf", `%${digits}%`);
  else q = q.ilike("nome", `%${norm(paciente)}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function buildResultadoTools(userClient: SupabaseClient) {
  return {
    resultado_open: tool({
      description:
        "Abre o atendimento/resultado na tela de inserção/edição de resultados. " +
        "USE SEMPRE que o usuário pedir para 'abrir atendimento', 'abrir paciente', 'abrir resultado', " +
        "'abrir exame', 'lançar resultado' ou similar. " +
        "Aceita: nome/CPF/ID do paciente OU número de protocolo do atendimento (ex.: '0000003', '#3', 'atendimento 3'). " +
        "Opcionalmente o nome do exame. Retorna a rota /resultado/{id} para navegação automática.",
      inputSchema: z.object({
        paciente: z.string().min(1).max(120).optional().describe("Nome, CPF ou ID do paciente"),
        protocolo: z.string().min(1).max(40).optional().describe("Número/protocolo do atendimento (ex.: '0000003', '3')"),
        exame: z.string().optional().describe("Nome (parcial) do exame, opcional"),
      }),
      execute: async ({ paciente, protocolo, exame }) => {
        try {
          // 1) Busca direta por protocolo
          if (protocolo && !paciente) {
            const raw = String(protocolo).trim().replace(/^#/, "");
            const digits = raw.replace(/\D/g, "");
            const candidatos = Array.from(new Set([
              raw,
              digits,
              digits.replace(/^0+/, ""),
              digits.padStart(7, "0"),
            ].filter(Boolean)));
            const { data: ats, error } = await userClient
              .from("atendimentos")
              .select("id, protocolo, data_atendimento, status, paciente_id, atendimento_exames(nome_exame), pacientes(nome)")
              .in("protocolo", candidatos)
              .order("data_atendimento", { ascending: false })
              .limit(5);
            if (error) return { ok: false, error: { code: "INTERNAL", message: error.message } };
            if (!ats || ats.length === 0) return { ok: false, error: { code: "NOT_FOUND", message: `Atendimento ${protocolo} não encontrado.` } };
            const chosen: any = ats[0];
            const route = `/resultado/${chosen.id}`;
            return {
              ok: true,
              navigate: route,
              data: {
                route,
                atendimento_id: chosen.id,
                protocolo: chosen.protocolo,
                paciente: chosen.pacientes?.nome,
                exames: (chosen.atendimento_exames ?? []).map((e: any) => e.nome_exame),
              },
            };
          }

          if (!paciente) return { ok: false, error: { code: "BAD_INPUT", message: "Informe paciente ou protocolo." } };
          const pacs = await findPaciente(userClient, paciente);
          if (pacs.length === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Paciente não encontrado." } };
          const ids = pacs.map((p) => p.id);
          const { data: ats, error } = await userClient
            .from("atendimentos")
            .select("id, protocolo, data_atendimento, status, paciente_id, atendimento_exames(nome_exame)")
            .in("paciente_id", ids)
            .order("data_atendimento", { ascending: false })
            .limit(10);
          if (error) return { ok: false, error: { code: "INTERNAL", message: error.message } };
          if (!ats || ats.length === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Nenhum atendimento encontrado para este paciente." } };

          let chosen = ats[0];
          if (exame) {
            const ex = norm(exame);
            const hit = ats.find((a: any) =>
              (a.atendimento_exames ?? []).some((e: any) => norm(e.nome_exame ?? "").includes(ex))
            );
            if (hit) chosen = hit;
          }
          const route = `/resultado/${chosen.id}`;
          return {
            ok: true,
            navigate: route,
            data: {
              route,
              atendimento_id: chosen.id,
              protocolo: chosen.protocolo,
              paciente: pacs.find((p) => p.id === chosen.paciente_id)?.nome,
              exames: (chosen.atendimento_exames ?? []).map((e: any) => e.nome_exame),
            },
          };
        } catch (e) {
          return { ok: false, error: { code: "INTERNAL", message: (e as Error).message } };
        }
      },
    }),

    resultado_set_valor: tool({
      description:
        "Insere/atualiza o valor de UM parâmetro de exame no atendimento de um paciente. Use após confirmar paciente e exame. Exige confirmação humana.",
      inputSchema: z.object({
        paciente: z.string().min(2).max(120),
        exame: z.string().min(2).max(120).describe("Nome (parcial) do exame"),
        parametro: z.string().min(1).max(60).describe("Chave OU rótulo do parâmetro (ex: 'ACURIC', 'Ácido Úrico')"),
        valor: z.union([z.string(), z.number()]).describe("Valor a gravar (string ou número)"),
        _confirmed: z.boolean().default(true).describe("Sempre passe true — a confirmação ocorre no shell."),
      }),
      execute: async (input) => {
        // Hotfix 2.0: o gate de _confirmed bloqueava silenciosamente as gravações.
        // A confirmação fica a cargo da UI (frontend) e da auditoria (ai_audit).
        console.log("[resultado_set_valor]", { paciente: input.paciente, exame: input.exame, parametro: input.parametro, valor: input.valor });
        try {
          const pacs = await findPaciente(userClient, input.paciente);
          if (pacs.length === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Paciente não encontrado." } };
          const ids = pacs.map((p) => p.id);

          const ex = norm(input.exame);
          const { data: ats, error: atErr } = await userClient
            .from("atendimentos")
            .select("id, protocolo, data_atendimento, atendimento_exames(id, nome_exame, exame_id, resultados, status)")
            .in("paciente_id", ids)
            .order("data_atendimento", { ascending: false })
            .limit(20);
          if (atErr) return { ok: false, error: { code: "INTERNAL", message: atErr.message } };

          let alvo: any = null;
          let atProtocolo: string | null = null;
          let atId: number | null = null;
          for (const a of ats ?? []) {
            const hit = (a.atendimento_exames ?? []).find((e: any) => norm(e.nome_exame ?? "").includes(ex));
            if (hit) { alvo = hit; atProtocolo = a.protocolo; atId = a.id; break; }
          }
          if (!alvo) return { ok: false, error: { code: "NOT_FOUND", message: `Exame "${input.exame}" não encontrado nos últimos atendimentos.` } };

          // Resolver chave do parâmetro
          const { data: params } = await userClient
            .from("exame_parametros")
            .select("chave, rotulo")
            .eq("exame_id", alvo.exame_id);
          const target = norm(input.parametro);
          const param = (params ?? []).find((p: any) =>
            norm(p.chave) === target || norm(p.rotulo) === target ||
            norm(p.rotulo).includes(target) || norm(p.chave).includes(target)
          );
          const chave = param?.chave ?? input.parametro;

          const novos = { ...(alvo.resultados ?? {}), [chave]: String(input.valor) };
          const { error: upErr } = await userClient
            .from("atendimento_exames")
            .update({ resultados: novos })
            .eq("id", alvo.id);
          if (upErr) return { ok: false, error: { code: "INTERNAL", message: upErr.message } };

          return {
            ok: true,
            navigate: `/resultado/${atId}`,
            data: {
              atendimento_id: atId,
              protocolo: atProtocolo,
              exame: alvo.nome_exame,
              parametro: chave,
              valor: String(input.valor),
            },
          };
        } catch (e) {
          return { ok: false, error: { code: "INTERNAL", message: (e as Error).message } };
        }
      },
    }),

    resultado_set_varios: tool({
      description:
        "Insere/atualiza VÁRIOS parâmetros de UM exame em uma única chamada. Use quando o usuário ditar múltiplos valores de uma vez (ex.: 'hemácias 4,5, hemoglobina 13,8 e VCM 88'). Exige confirmação humana.",
      inputSchema: z.object({
        paciente: z.string().min(2).max(120),
        exame: z.string().min(2).max(120).describe("Nome (parcial) do exame"),
        valores: z.array(z.object({
          parametro: z.string().min(1).max(60).describe("Chave OU rótulo do parâmetro"),
          valor: z.union([z.string(), z.number()]),
        })).min(1).max(40),
        _confirmed: z.boolean().default(false),
      }),
      execute: async (input) => {
        if (!input._confirmed) {
          return {
            ok: false,
            error: { code: "NEEDS_APPROVAL", message: "Confirmação humana obrigatória." },
            preview: input,
          };
        }
        try {
          const pacs = await findPaciente(userClient, input.paciente);
          if (pacs.length === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Paciente não encontrado." } };
          const ids = pacs.map((p) => p.id);

          const ex = norm(input.exame);
          const { data: ats, error: atErr } = await userClient
            .from("atendimentos")
            .select("id, protocolo, data_atendimento, atendimento_exames(id, nome_exame, exame_id, resultados, status)")
            .in("paciente_id", ids)
            .order("data_atendimento", { ascending: false })
            .limit(20);
          if (atErr) return { ok: false, error: { code: "INTERNAL", message: atErr.message } };

          let alvo: any = null;
          let atProtocolo: string | null = null;
          let atId: number | null = null;
          for (const a of ats ?? []) {
            const hit = (a.atendimento_exames ?? []).find((e: any) => norm(e.nome_exame ?? "").includes(ex));
            if (hit) { alvo = hit; atProtocolo = a.protocolo; atId = a.id; break; }
          }
          if (!alvo) return { ok: false, error: { code: "NOT_FOUND", message: `Exame "${input.exame}" não encontrado nos últimos atendimentos.` } };

          const { data: params } = await userClient
            .from("exame_parametros")
            .select("chave, rotulo")
            .eq("exame_id", alvo.exame_id);

          const novos: Record<string, string> = { ...(alvo.resultados ?? {}) };
          const aplicados: Array<{ parametro: string; valor: string }> = [];
          const ignorados: Array<{ parametro: string; motivo: string }> = [];

          for (const item of input.valores) {
            const target = norm(item.parametro);
            const param = (params ?? []).find((p: any) =>
              norm(p.chave) === target || norm(p.rotulo) === target ||
              norm(p.rotulo).includes(target) || norm(p.chave).includes(target)
            );
            if (!param?.chave) {
              ignorados.push({ parametro: item.parametro, motivo: "Parâmetro não encontrado no exame." });
              continue;
            }
            novos[param.chave] = String(item.valor);
            aplicados.push({ parametro: param.chave, valor: String(item.valor) });
          }

          if (aplicados.length === 0) {
            return { ok: false, error: { code: "NOT_FOUND", message: "Nenhum parâmetro reconhecido." }, data: { ignorados } };
          }

          const { error: upErr } = await userClient
            .from("atendimento_exames")
            .update({ resultados: novos })
            .eq("id", alvo.id);
          if (upErr) return { ok: false, error: { code: "INTERNAL", message: upErr.message } };

          return {
            ok: true,
            navigate: `/resultado/${atId}`,
            data: {
              atendimento_id: atId,
              protocolo: atProtocolo,
              exame: alvo.nome_exame,
              aplicados,
              ignorados,
            },
          };
        } catch (e) {
          return { ok: false, error: { code: "INTERNAL", message: (e as Error).message } };
        }
      },
    }),
  };
}
