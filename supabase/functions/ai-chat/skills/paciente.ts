// PacienteSkill — Tools com schema Zod, validação, RLS via cliente do usuário.
import { tool } from "npm:ai@4.3.16";
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
      parameters: z.object({
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
      parameters: z.object({
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
  };
}
