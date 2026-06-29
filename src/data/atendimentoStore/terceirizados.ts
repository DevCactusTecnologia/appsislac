// Bloco 5a.5b/5a.7 — Exames TERCEIRIZADOS (Fase 4 split).
// Persistência via persistOrThrow + reidratação do cache.

import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/lib/showError";
import { persistOrThrow } from "@/lib/persist";
import type { TablesUpdate } from "@/integrations/supabase/types";
import type { AtendimentoExameDbRow } from "./_internal";
import { _initAtendimentosStore } from "./queries";
import type {
  StatusExterno, AtendimentoExameRow,
  TerceirizadoActionResult, TerceirizadoOperacionalRow,
} from "./types";

/** Atualiza diretamente os campos de fluxo terceirizado. */
export async function updateExameTerceirizado(
  exameId: number,
  patch: Partial<{
    status_externo: StatusExterno;
    protocolo_externo: string | null;
    data_envio: string | null;
    data_retorno: string | null;
    data_liberacao: string | null;
    resultado_importado: boolean;
    arquivo_resultado_path: string | null;
    status: "pendente" | "coletado" | "em_analise" | "finalizado" | "cancelado";
  }>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Atendimento pode estar pós-finalização (laudo liberado). O trigger
    // `require_justificativa_pos_finalizacao` exige justificativa de auditoria
    // para qualquer UPDATE em `atendimento_exames` nesse estado. Setamos uma
    // justificativa automática descrevendo a operação de fluxo terceirizado.
    const acoes: string[] = [];
    if (patch.status_externo) acoes.push(`status_externo=${patch.status_externo}`);
    if (patch.data_retorno) acoes.push("retorno do laboratório de apoio");
    if (patch.data_envio) acoes.push("envio ao laboratório de apoio");
    if (patch.data_liberacao) acoes.push("liberação do resultado terceirizado");
    if (patch.resultado_importado) acoes.push("importação de resultado");
    if (patch.status) acoes.push(`status=${patch.status}`);
    const motivo = acoes.length > 0
      ? `Fluxo terceirizado: ${acoes.join("; ")}`
      : "Atualização de fluxo terceirizado";
    try {
      await supabase.rpc("set_audit_justificativa" as never, { _text: motivo } as never);
    } catch {
      // segue — se a RPC falhar e o trigger bloquear, o erro será propagado abaixo
    }
    await persistOrThrow<AtendimentoExameDbRow>(
      supabase.from("atendimento_exames").update(patch as TablesUpdate<"atendimento_exames">).eq("id", exameId),
      "atendimentos.updateExameTerceirizado",
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  await _initAtendimentosStore();
  return { ok: true };
}

/** Aciona a edge function `lab-apoio-adapter`. */
export async function callLabApoioAdapter(
  action: "send" | "fetch",
  exameId: number,
): Promise<TerceirizadoActionResult> {
  const { data, error } = await supabase.functions.invoke("lab-apoio-adapter", {
    body: { action, exame_id: exameId },
  });
  if (error) {
    showError(error, { scope: "atendimentoStore.callLabApoioAdapter" });
    return { ok: false, error: error.message };
  }
  await _initAtendimentosStore();
  return data as TerceirizadoActionResult;
}

/**
 * Carrega TODOS os exames terceirizados do tenant para a página
 * "Laboratórios de Apoio".
 */
export async function getTerceirizadosOperacional(
  statusExternos?: StatusExterno[],
): Promise<TerceirizadoOperacionalRow[]> {
  let q = supabase
    .from("atendimento_exames")
    .select("*")
    .eq("tipo_processo", "TERCEIRIZADO")
    .neq("status", "cancelado")
    .order("data_envio", { ascending: false, nullsFirst: false });
  if (statusExternos && statusExternos.length > 0) {
    q = q.in("status_externo", statusExternos);
  }
  const { data: exRows, error } = await q;
  if (error) {
    showError(error, { scope: "atendimentoStore.getTerceirizadosOperacional", silent: true });
    return [];
  }
  const rows = (exRows ?? []) as unknown as AtendimentoExameRow[];
  if (rows.length === 0) return [];

  const atIds = Array.from(new Set(rows.map((r) => r.atendimento_id)));
  const { data: atRows } = await supabase
    .from("atendimentos")
    .select("id, protocolo, paciente_nome, paciente_cpf, paciente_nascimento, unidade_id")
    .in("id", atIds);

  const atMap = new Map<number, { protocolo: string; paciente_nome: string; paciente_cpf: string; paciente_nascimento: string | null; unidade_id: string | null }>();
  (atRows ?? []).forEach((a) => {
    atMap.set(a.id, {
      protocolo: a.protocolo,
      paciente_nome: a.paciente_nome,
      paciente_cpf: (a.paciente_cpf ?? "").replace(/\D/g, ""),
      paciente_nascimento: a.paciente_nascimento ?? null,
      unidade_id: a.unidade_id ?? null,
    });
  });

  return rows.map((r) => {
    const at = atMap.get(r.atendimento_id);
    return {
      ...r,
      protocolo: at?.protocolo ?? "—",
      paciente_nome: at?.paciente_nome ?? "—",
      paciente_cpf: at?.paciente_cpf ?? "",
      paciente_nascimento: at?.paciente_nascimento ?? null,
      unidade_id: at?.unidade_id ?? null,
    } as TerceirizadoOperacionalRow;
  });
}

/**
 * Versão paginada de {@link getTerceirizadosOperacional}.
 */
export async function getTerceirizadosOperacionalPaged(opts: {
  limit: number;
  offset: number;
  statusExternos?: StatusExterno[];
}): Promise<{ rows: TerceirizadoOperacionalRow[]; total: number }> {
  const { limit, offset, statusExternos } = opts;
  let q = supabase
    .from("atendimento_exames")
    .select("*", { count: "estimated" })
    .eq("tipo_processo", "TERCEIRIZADO")
    .neq("status", "cancelado")
    .order("data_envio", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);
  if (statusExternos && statusExternos.length > 0) {
    q = q.in("status_externo", statusExternos);
  }
  const { data: exRows, count, error } = await q;
  if (error) {
    showError(error, { scope: "atendimentoStore.getTerceirizadosOperacionalPaged", silent: true });
    return { rows: [], total: 0 };
  }
  const rows = (exRows ?? []) as unknown as AtendimentoExameRow[];
  if (rows.length === 0) return { rows: [], total: count ?? 0 };

  const atIds = Array.from(new Set(rows.map((r) => r.atendimento_id)));
  const { data: atRows } = await supabase
    .from("atendimentos")
    .select("id, protocolo, paciente_nome, paciente_cpf, paciente_nascimento, unidade_id")
    .in("id", atIds);

  const atMap = new Map<number, { protocolo: string; paciente_nome: string; paciente_cpf: string; paciente_nascimento: string | null; unidade_id: string | null }>();
  (atRows ?? []).forEach((a) => {
    atMap.set(a.id, {
      protocolo: a.protocolo,
      paciente_nome: a.paciente_nome,
      paciente_cpf: (a.paciente_cpf ?? "").replace(/\D/g, ""),
      paciente_nascimento: a.paciente_nascimento ?? null,
      unidade_id: a.unidade_id ?? null,
    });
  });

  return {
    rows: rows.map((r) => {
      const at = atMap.get(r.atendimento_id);
      return {
        ...r,
        protocolo: at?.protocolo ?? "—",
        paciente_nome: at?.paciente_nome ?? "—",
        paciente_cpf: at?.paciente_cpf ?? "",
        paciente_nascimento: at?.paciente_nascimento ?? null,
        unidade_id: at?.unidade_id ?? null,
      } as TerceirizadoOperacionalRow;
    }),
    total: count ?? rows.length,
  };
}
