// Bloco 5a.5 — helpers de RESULTADOS / exames operacionais (Fase 4 split).
// Mantém o contrato síncrono via re-hidratação do cache após mutações.

import { supabase } from "@/integrations/supabase/client";
import { resolveMaterialNome } from "../materiaisAmostraStore";

import { showError } from "@/lib/showError";
import { persistOrThrow } from "@/lib/persist";
import type { TablesUpdate } from "@/integrations/supabase/types";
import {
  cache,
  type AtendimentoExameDbRow,
} from "./_internal";
import { _initAtendimentosStore } from "./queries";
import type {
  AtendimentoExameRow, AtendimentoExamePatch, ExameOperacionalRow,
} from "./types";

/**
 * Busca, direto do Supabase, os exames de um atendimento (incluindo a
 * coluna jsonb `resultados`). Use para carregar a tela de resultado/detalhe.
 */
export async function getAtendimentoExamesDB(protocolo: string): Promise<AtendimentoExameRow[]> {
  let id = cache.idByProtocolo.get(protocolo);
  if (!id) {
    const { data: at, error: atError } = await supabase
      .from("atendimentos")
      .select("id, protocolo")
      .eq("protocolo", protocolo)
      .maybeSingle();
    if (atError) {
      showError(atError, { scope: "atendimentoStore.getAtendimentoExamesDB.resolveAtendimento", silent: true });
      return [];
    }
    if (!at) {
      return [];
    }
    id = Number(at.id);
    cache.idByProtocolo.set(at.protocolo, id);
    cache.protocoloById.set(id, at.protocolo);
  }
  const { data, error } = await supabase
    .from("atendimento_exames")
    .select("*")
    .eq("atendimento_id", id)
    .order("ordem", { ascending: true });
  if (error) {
    showError(error, { scope: "atendimentoStore.getAtendimentoExamesDB", silent: true });
    return [];
  }
  return (data ?? []) as unknown as AtendimentoExameRow[];
}

/**
 * Atualiza um exame específico (por id da row em atendimento_exames).
 * O trigger no banco recalcula o status do atendimento automaticamente.
 * Após sucesso, refaz a hidratação do cache.
 */
export async function updateAtendimentoExame(
  exameId: number,
  patch: AtendimentoExamePatch,
  justificativa?: string,
): Promise<{ ok: boolean; error?: string }> {
  const payload = patch as TablesUpdate<"atendimento_exames">;
  try {
    if (justificativa?.trim()) {
      const { data, error } = await supabase.rpc("update_atendimento_exame_tx" as never, {
        _exame_id: exameId,
        _patch: payload,
        _justificativa: justificativa.trim(),
      } as never);
      if (error) throw error;
      if (!data) throw new Error("exame não encontrado");
    } else {
      await persistOrThrow<AtendimentoExameDbRow>(
        supabase.from("atendimento_exames").update(payload).eq("id", exameId),
        "atendimentos.atualizarExame",
      );
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  await _initAtendimentosStore();
  return { ok: true };
}

/**
 * Atribui um mesmo analista a vários exames de uma vez.
 * Usado pela página /mapa (aba Exame).
 */
export async function setAnalistaParaExames(
  exameIds: number[],
  analista: string,
): Promise<{ ok: boolean; error?: string }> {
  if (exameIds.length === 0) return { ok: true };
  try {
    await persistOrThrow<AtendimentoExameDbRow>(
      supabase.from("atendimento_exames").update({ analista }).in("id", exameIds),
      "atendimentos.setAnalistaParaExames",
      { expectAtLeast: exameIds.length },
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  await _initAtendimentosStore();
  return { ok: true };
}

/**
 * Carrega exames de atendimentos cujos exames possuem algum dos statuses
 * dados, agrupando por atendimento (paciente). Usado em Registrar Coleta /
 * Analisar Amostra.
 */
export async function getExamesOperacionaisByStatus(
  statuses: Array<"pendente" | "coletado" | "em_bancada" | "analisado" | "em_analise" | "finalizado" | "cancelado">,
): Promise<ExameOperacionalRow[]> {
  const { data: exRows, error: exErr } = await supabase
    .from("atendimento_exames")
    .select("*")
    .in("status", statuses)
    .order("ordem", { ascending: true });
  if (exErr) {
    showError(exErr, { scope: "atendimentoStore.getExamesOperacionais.exames", silent: true });
    return [];
  }

  const examesByAt = new Map<number, typeof exRows>();
  (exRows ?? []).forEach((e) => {
    const arr = examesByAt.get(e.atendimento_id) ?? [];
    arr.push(e);
    examesByAt.set(e.atendimento_id, arr);
  });

  const atIds = Array.from(examesByAt.keys());
  if (atIds.length === 0) return [];

  const { data: atRows, error: atErr } = await supabase
    .from("atendimentos")
    .select("id, protocolo, paciente_id, paciente_nome, paciente_cpf, paciente_nascimento, unidade_id, jejum, prioridade_clinica")
    .in("id", atIds);
  if (atErr) {
    showError(atErr, { scope: "atendimentoStore.getExamesOperacionais.atendimentos", silent: true });
    return [];
  }

  // Buscar sexo dos pacientes (evita hardcode "M").
  // Resolve em cascata: por `paciente_id` → por CPF → por nome+nascimento.
  // Atendimentos legados podem não ter `paciente_id` preenchido e o CPF
  // pode estar vazio/placeholder ("00000000000"); o casamento por
  // nome+nascimento cobre esses casos sem chutar sexo.
  const isCpfValido = (c: string) => c.length === 11 && !/^(\d)\1{10}$/.test(c);
  const pacIds = Array.from(
    new Set((atRows ?? []).map((a) => a.paciente_id).filter((v): v is number => v != null))
  );
  const cpfsSemId = Array.from(
    new Set(
      (atRows ?? [])
        .filter((a) => a.paciente_id == null)
        .map((a) => (a.paciente_cpf ?? "").replace(/\D/g, ""))
        .filter(isCpfValido),
    ),
  );
  const nomesSemId = Array.from(
    new Set(
      (atRows ?? [])
        .filter((a) => a.paciente_id == null)
        .map((a) => (a.paciente_nome ?? "").trim())
        .filter((n) => n.length > 0),
    ),
  );
  const sexoByPacId = new Map<number, string>();
  const sexoByCpf = new Map<string, string>();
  const sexoByNomeNasc = new Map<string, string>();
  const keyNomeNasc = (nome: string, nasc: string | null | undefined) =>
    `${nome.trim().toUpperCase()}|${(nasc ?? "").slice(0, 10)}`;
  if (pacIds.length > 0) {
    const { data: pacRows } = await supabase
      .from("pacientes")
      .select("id, sexo")
      .in("id", pacIds);
    (pacRows ?? []).forEach((p) => sexoByPacId.set(Number(p.id), (p.sexo as string) || ""));
  }
  if (cpfsSemId.length > 0) {
    const { data: pacRows } = await supabase
      .from("pacientes")
      .select("cpf, sexo")
      .in("cpf", cpfsSemId);
    (pacRows ?? []).forEach((p) => {
      const cpf = String(p.cpf ?? "").replace(/\D/g, "");
      if (cpf) sexoByCpf.set(cpf, (p.sexo as string) || "");
    });
  }
  if (nomesSemId.length > 0) {
    const { data: pacRows } = await supabase
      .from("pacientes")
      .select("nome, data_nascimento, sexo")
      .in("nome", nomesSemId);
    (pacRows ?? []).forEach((p) => {
      const k = keyNomeNasc(String(p.nome ?? ""), p.data_nascimento as string | null);
      if (!sexoByNomeNasc.has(k)) sexoByNomeNasc.set(k, (p.sexo as string) || "");
    });
  }

  return (atRows ?? []).map((at) => {
    const exs = examesByAt.get(at.id) ?? [];
    const responsavel = exs.find((e) => e.analista)?.analista ?? "";
    const cpfDigits = (at.paciente_cpf ?? "").replace(/\D/g, "");
    const sexoResolvido =
      (at.paciente_id != null ? sexoByPacId.get(at.paciente_id) : undefined) ||
      (isCpfValido(cpfDigits) ? sexoByCpf.get(cpfDigits) : undefined) ||
      sexoByNomeNasc.get(keyNomeNasc(at.paciente_nome ?? "", at.paciente_nascimento)) ||
      "";
    return {
      id: at.id,
      atendimento_id: at.id,
      protocolo: at.protocolo,
      paciente_id: at.paciente_id ?? null,
      paciente_nome: at.paciente_nome,
      paciente_cpf: cpfDigits,
      paciente_sexo: sexoResolvido,
      paciente_nascimento: at.paciente_nascimento ?? "",
      unidade_id: at.unidade_id,
      responsavel,
      exames: exs.map((e) => ({
        id: e.id,
        nome: e.nome_exame,
        exame_id: e.exame_id ?? null,
        amostra_id: e.amostra_id ?? null,
        material_id: (e as { material_id?: string | null }).material_id ?? null,
        material: resolveMaterialNome((e as { material_id?: string | null }).material_id) || "—",


        status: e.status as "pendente" | "coletado" | "em_bancada" | "analisado" | "em_analise" | "finalizado" | "cancelado",
        data_coleta: e.data_coleta,
        data_analise: e.data_analise,
        motivo_cancelamento: e.motivo_cancelamento,
        updated_at: e.updated_at ?? null,
        tipo_processo: (e.tipo_processo === "TERCEIRIZADO" ? "TERCEIRIZADO" : "INTERNO") as "INTERNO" | "TERCEIRIZADO",
        lab_apoio_id: e.lab_apoio_id ?? null,
      })),
    };
  });
}
