// Skill Resultado — abrir tela de resultado e gravar 1..N parâmetros.
// Tool única `resultado_set` substitui as antigas set_valor + set_varios.
import { tool } from "npm:ai@5.0.206";
import { z } from "npm:zod@3.23.8";
import type { SupabaseClient } from "../../_shared/runtime/createClient.ts";

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
        "Abre a tela de inserção/edição de resultado. Use para 'abrir atendimento', 'abrir paciente', " +
        "'abrir resultado', 'abrir exame', 'lançar resultado'. Aceita paciente (nome/CPF/ID) OU protocolo. " +
        "Opcionalmente o nome do exame. Retorna a rota /resultado/{id}.",
      inputSchema: z.object({
        paciente: z.string().min(1).max(120).optional(),
        protocolo: z.string().min(1).max(40).optional(),
        exame: z.string().optional(),
      }),
      execute: async ({ paciente, protocolo, exame }) => {
        try {
          if (protocolo && !paciente) {
            const raw = String(protocolo).trim().replace(/^#/, "");
            const digits = raw.replace(/\D/g, "");
            const candidatos = Array.from(new Set([raw, digits, digits.replace(/^0+/, ""), digits.padStart(7, "0")].filter(Boolean)));
            const { data: ats, error } = await userClient
              .from("atendimentos")
              .select("id, protocolo, data, status, paciente_id, atendimento_exames(nome_exame), pacientes(nome)")
              .in("protocolo", candidatos)
              .order("data", { ascending: false })
              .limit(5);
            if (error) return { ok: false, error: { code: "INTERNAL", message: error.message } };
            if (!ats?.length) return { ok: false, error: { code: "NOT_FOUND", message: `Atendimento ${protocolo} não encontrado.` } };
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
            .select("id, protocolo, data, status, paciente_id, atendimento_exames(nome_exame)")
            .in("paciente_id", ids)
            .order("data", { ascending: false })
            .limit(10);
          if (error) return { ok: false, error: { code: "INTERNAL", message: error.message } };
          if (!ats?.length) return { ok: false, error: { code: "NOT_FOUND", message: "Nenhum atendimento encontrado." } };

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

    /**
     * Tool única para gravar valores. Aceita 1..N parâmetros.
     * needsApproval=true no registry; o gate real está na UI (AssistenteSISLAC).
     */
    resultado_set: tool({
      description:
        "Insere/atualiza 1..N parâmetros de UM exame de um paciente. Aceita um único valor " +
        "(ex.: 'Hemácias 4,5') ou vários ('Hemácias 4,5, Hemoglobina 13,8'). Exige confirmação humana na UI.",
      inputSchema: z.object({
        paciente: z.string().min(2).max(120),
        exame: z.string().min(2).max(120),
        valores: z.array(z.object({
          parametro: z.string().min(1).max(60),
          valor: z.union([z.string(), z.number()]),
        })).min(1).max(40),
      }),
      execute: async (input) => {
        try {
          const pacs = await findPaciente(userClient, input.paciente);
          if (pacs.length === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Paciente não encontrado." } };
          const ids = pacs.map((p) => p.id);

          const ex = norm(input.exame);
          const { data: ats, error: atErr } = await userClient
            .from("atendimentos")
            .select("id, protocolo, data, atendimento_exames(id, nome_exame, exame_id, resultados, status)")
            .in("paciente_id", ids)
            .order("data", { ascending: false })
            .limit(20);
          if (atErr) return { ok: false, error: { code: "INTERNAL", message: atErr.message } };

          let alvo: any = null, atProtocolo: string | null = null, atId: number | null = null;
          for (const a of ats ?? []) {
            const hit = (a.atendimento_exames ?? []).find((e: any) => norm(e.nome_exame ?? "").includes(ex));
            if (hit) { alvo = hit; atProtocolo = a.protocolo; atId = a.id; break; }
          }
          if (!alvo) return { ok: false, error: { code: "NOT_FOUND", message: `Exame "${input.exame}" não encontrado.` } };

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
              ignorados.push({ parametro: item.parametro, motivo: "Parâmetro não encontrado." });
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
