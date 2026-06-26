// PacienteSkill — Tools com schema Zod, validação, RLS via cliente do usuário.
import { tool } from "npm:ai@5.0.206";
import { z } from "npm:zod@3.23.8";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SEARCH_LIMIT = 10;

function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function buildPacienteTools(userClient: SupabaseClient) {
  return {
    paciente_search: tool({
      description:
        "Busca pacientes do tenant atual por nome, CPF ou telefone. Retorna até 10 resultados.",
      inputSchema: z.object({
        query: z.string().min(2).max(80),
      }),
      execute: async ({ query }) => {
        const q = normalize(query);
        const onlyDigits = query.replace(/\D/g, "");
        const filters: string[] = [`nome.ilike.%${q}%`];
        if (onlyDigits.length >= 3) {
          filters.push(`cpf.ilike.%${onlyDigits}%`);
          filters.push(`celular.ilike.%${onlyDigits}%`);
          filters.push(`telefone.ilike.%${onlyDigits}%`);
        }
        const { data, error } = await userClient
          .from("pacientes")
          .select("id, nome, cpf, celular, data_nascimento, sexo, status")
          .or(filters.join(","))
          .limit(SEARCH_LIMIT);
        if (error) return { ok: false, error: { code: "INTERNAL", message: error.message } };
        return { ok: true, data: data ?? [] };
      },
    }),

    paciente_create: tool({
      description:
        "Cria um novo paciente no tenant atual. Exige confirmação humana antes da execução.",
      inputSchema: z.object({
        nome: z.string().min(2).max(200),
        cpf: z.string().optional(),
        celular: z.string().optional(),
        email: z.string().email().optional(),
        sexo: z.enum(["M", "F"]).default("M"),
        data_nascimento: z.string().optional(), // ISO yyyy-mm-dd
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
        const { _confirmed, ...payload } = input;
        const { data, error } = await userClient
          .from("pacientes")
          .insert(payload)
          .select("id, nome")
          .single();
        if (error) return { ok: false, error: { code: "INTERNAL", message: error.message } };
        return { ok: true, data };
      },
    }),

    paciente_exames: tool({
      description:
        "Lista todos os exames realizados por um paciente. Recebe nome (parcial), CPF ou ID do paciente. Retorna atendimentos com seus exames, status e datas.",
      inputSchema: z.object({
        paciente: z.string().min(2).max(120).describe("Nome (parcial), CPF ou UUID do paciente"),
      }),
      execute: async ({ paciente }) => {
        const onlyDigits = paciente.replace(/\D/g, "");
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paciente);
        let pacQuery = userClient.from("pacientes").select("id, nome, cpf").limit(5);
        if (isUuid) pacQuery = pacQuery.eq("id", paciente);
        else if (onlyDigits.length >= 6) pacQuery = pacQuery.ilike("cpf", `%${onlyDigits}%`);
        else pacQuery = pacQuery.ilike("nome", `%${normalize(paciente)}%`);

        const { data: pacs, error: pacErr } = await pacQuery;
        if (pacErr) return { ok: false, error: { code: "INTERNAL", message: pacErr.message } };
        if (!pacs || pacs.length === 0) return { ok: true, data: { pacientes: [], atendimentos: [] } };

        const ids = pacs.map((p) => p.id);
        const { data: ats, error: atErr } = await userClient
          .from("atendimentos")
          .select("id, protocolo, data_atendimento, status, paciente_id, atendimento_exames(exame_nome, status)")
          .in("paciente_id", ids)
          .order("data_atendimento", { ascending: false })
          .limit(50);
        if (atErr) return { ok: false, error: { code: "INTERNAL", message: atErr.message } };

        const atendimentos = (ats ?? []).map((a: Record<string, unknown>) => ({
          protocolo: a.protocolo,
          data: a.data_atendimento,
          status: a.status,
          paciente: pacs.find((p) => p.id === a.paciente_id)?.nome,
          exames: (a.atendimento_exames as Array<{ exame_nome: string; status: string }> ?? [])
            .map((e) => ({ nome: e.exame_nome, status: e.status })),
        }));
        const total_exames = atendimentos.reduce((s, a) => s + a.exames.length, 0);
        return { ok: true, data: { pacientes: pacs, atendimentos, total_exames } };
      },
    }),
  };
}
