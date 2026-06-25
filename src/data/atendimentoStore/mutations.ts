// Mutations (create/update) do atendimentoStore (Fase 4 split).
// Toda persistência transacional ocorre via edge functions
// `create-atendimento` e `update-atendimento`. Rollback otimista do cache
// preservado literalmente.

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { MockAtendimento } from "../types";
import {
  cache, notify, brToIso,
  type AtendimentoTxResponse, type ExamesCatalogoRow,
} from "./_internal";

/**
 * Insere atendimento + exames + pagamentos atomicamente via edge function
 * `create-atendimento` (que executa `create_atendimento_tx` no Postgres).
 *
 * Garantias:
 *  - Toda a operação roda dentro de uma única transação SQL. Se QUALQUER
 *    parte falhar, ROLLBACK automático: nada fica persistido parcialmente.
 *  - Otimista no cache local; em caso de falha, rollback do cache + throw.
 *  - Sucesso só é retornado após o banco confirmar a inserção.
 */
export async function addAtendimento(at: MockAtendimento): Promise<void> {
  // Otimista
  const prev = cache.atendimentos;
  cache.atendimentos = [at, ...cache.atendimentos];
  notify();

  try {
    const dataIso = brToIso(at.data) ?? new Date().toISOString();
    const nascIso = brToIso(at.nascimento);
    const cpfDigits = at.cpf.replace(/\D/g, "");

    // Resolve paciente_id pelo CPF (não-crítico)
    let pacienteId: number | null = null;
    if (cpfDigits.length === 11) {
      const { data: pacRow } = await supabase
        .from("pacientes").select("id").eq("cpf", cpfDigits).maybeSingle();
      if (pacRow) pacienteId = Number(pacRow.id);
    }

    // Resolve convenio_id pelo nome (Particular = 0)
    let convenioIdResolved = 0;
    if (at.convenio && at.convenio !== "Particular") {
      const { data: convRow } = await supabase
        .from("convenios").select("id").eq("nome", at.convenio).maybeSingle();
      if (convRow) convenioIdResolved = Number(convRow.id);
    }

    // Resolve catálogo de exames
    let catMap = new Map<string, { id: string; material_id: string | null; tipo_processo: string; lab_apoio_id: string | null }>();
    if (at.exames.length > 0) {
      const nomesUnicos = Array.from(new Set(at.exames));
      const { data: catRows } = await supabase
        .from("exames_catalogo")
        .select("id, nome, material_id, tipo_processo, lab_apoio_id")
        .in("nome", nomesUnicos);
      type CatLite = Pick<ExamesCatalogoRow, "id" | "nome" | "material_id" | "tipo_processo" | "lab_apoio_id">;
      catMap = new Map((catRows ?? []).map((c: CatLite) => [c.nome, {
        id: c.id,
        material_id: c.material_id ?? null,
        tipo_processo: c.tipo_processo || "INTERNO",
        lab_apoio_id: c.lab_apoio_id ?? null,
      }]));
    }


    const seqCount = new Map<string, number>();
    const grupoMap = new Map<string, string>();
    const examesPayload = at.exames.map((nome, idx) => {
      const meta = at.examesCobranca?.[idx];
      const cat = catMap.get(nome);
      const chave = cat?.id ?? nome.toLowerCase();
      const seq = (seqCount.get(chave) ?? 0) + 1;
      seqCount.set(chave, seq);
      if (!grupoMap.has(chave)) {
        grupoMap.set(chave, meta?.grupoExameId || crypto.randomUUID());
      }
      const tipoProcesso = (meta?.tipoProcesso as string) || cat?.tipo_processo || "INTERNO";
      const labApoioId = tipoProcesso === "TERCEIRIZADO"
        ? (meta?.labApoioId !== undefined ? meta?.labApoioId : (cat?.lab_apoio_id ?? null))
        : null;
      return {
        nome_exame: nome,
        exame_id: cat?.id ?? null,
        material_id: cat?.material_id ?? null,

        status: "pendente",
        valor: Number(meta?.valor) || 0,
        // Preço cheio (antes do desconto distribuído) — fallback = valor.
        // Trigger DB garante valor_original >= valor.
        valor_original: Number(meta?.valorOriginal ?? meta?.valor) || 0,
        ordem: idx + 1,
        cobranca_destino: meta?.cobrancaDestino ?? "paciente",
        convenio_cobranca_id: meta?.convenioCobrancaId ?? null,
        amostra_seq: seq,
        grupo_exame_id: grupoMap.get(chave),
        tipo_processo: tipoProcesso,
        lab_apoio_id: labApoioId,
        solicitante: meta?.solicitante ?? "",
      };
    });

    const pagamentosPayload = (at.pagamentosRealizados ?? []).map((p) => ({
      tipo: p.tipo,
      valor: p.valor,
      data: brToIso(p.data) ?? new Date().toISOString(),
    }));

    // Invoca edge function transacional
    const { data, error } = await supabase.functions.invoke("create-atendimento", {
      body: {
        atendimento: {
          protocolo: at.protocolo,
          data: dataIso,
          paciente_id: pacienteId,
          paciente_nome: at.nome,
          paciente_cpf: cpfDigits,
          paciente_nascimento: nascIso,
          solicitante: at.solicitante,
          convenio_id: convenioIdResolved,
          convenio_nome: at.convenio,
          unidade_id: at.unidadeId ?? "und-001",
          motivo_cancelamento: at.motivoCancelamento ?? null,
        },
        exames: examesPayload,
        pagamentos: pagamentosPayload,
      },
    });

    const resp = data as AtendimentoTxResponse | null;
    if (error || !resp || resp.ok === false) {
      cache.atendimentos = prev;
      notify();
      throw new Error(
        resp?.error || error?.message || "Falha ao criar atendimento",
      );
    }

    const protocoloOficial = resp.protocolo ?? "";
    const atendimentoId = resp.atendimento_id ?? 0;
    if (protocoloOficial && protocoloOficial !== at.protocolo) {
      cache.atendimentos = cache.atendimentos.map((a) =>
        a.protocolo === at.protocolo ? { ...a, protocolo: protocoloOficial } : a,
      );
      at.protocolo = protocoloOficial;
      notify();
    }
    if (protocoloOficial && atendimentoId) {
      cache.idByProtocolo.set(protocoloOficial, atendimentoId);
    }

    // Guia diária (gerada server-side) — propaga para o cache e para o objeto.
    if (resp.guia_numero) {
      at.guiaNumero = resp.guia_numero;
      cache.atendimentos = cache.atendimentos.map((a) =>
        a.protocolo === at.protocolo ? { ...a, guiaNumero: resp.guia_numero } : a,
      );
      notify();
    }

    // Persiste origem operacional (WEB_APROVADO, WEB_AUTO, AGENDAMENTO) e jejum.
    if (atendimentoId) {
      const extraPatch: Record<string, unknown> = {};
      if (at.origem && at.origem !== "INTERNO") extraPatch.origem_atendimento = at.origem;
      if (typeof at.jejum === "boolean") extraPatch.jejum = at.jejum;
      if (Object.keys(extraPatch).length > 0) {
        const { error: extraErr } = await supabase
          .from("atendimentos")
          .update(extraPatch)
          .eq("id", atendimentoId);
        if (extraErr) {
          logger.warn("atendimentoStore", "falha ao persistir extras do atendimento", {
            atendimentoId, extraPatch, error: extraErr.message,
          });
        } else {
          cache.atendimentos = cache.atendimentos.map((a) =>
            a.protocolo === at.protocolo ? { ...a, ...(at.origem ? { origem: at.origem } : {}), ...(typeof at.jejum === "boolean" ? { jejum: at.jejum } : {}) } : a,
          );
          notify();
        }
      }
    }
  } catch (e) {
    cache.atendimentos = prev;
    notify();
    throw e;
  }
}

/**
 * Atualiza campos do atendimento.
 * Aceita os mesmos campos parciais da API legacy. Ignora campos derivados
 * (statusAtendimento/statusPagamento) porque são calculados pelo banco via trigger.
 */
export async function updateAtendimento(
  protocolo: string,
  updates: Partial<MockAtendimento>,
  justificativa?: string,
): Promise<void> {
  const prev = cache.atendimentos;
  cache.atendimentos = cache.atendimentos.map((a) => a.protocolo === protocolo ? { ...a, ...updates } : a);
  notify();

  const id = cache.idByProtocolo.get(protocolo);
  if (!id) {
    cache.atendimentos = prev;
    notify();
    throw new Error(`Atendimento ${protocolo} não encontrado no cache local`);
  }

  await persistUpdateAtendimentoTx(id, protocolo, updates, prev, justificativa);
}

/**
 * Persiste a atualização TRANSACIONAL via edge function `update-atendimento`.
 */
async function persistUpdateAtendimentoTx(
  id: number,
  protocolo: string,
  updates: Partial<MockAtendimento>,
  prev: MockAtendimento[],
  justificativa?: string,
): Promise<void> {
  // 1) Resolve convenio_id quando o convênio mudou
  let convenioIdResolved: number | undefined;
  if (updates.convenio !== undefined) {
    if (!updates.convenio || updates.convenio === "Particular") {
      convenioIdResolved = 0;
    } else {
      const { data: convRow } = await supabase
        .from("convenios").select("id").eq("nome", updates.convenio).maybeSingle();
      convenioIdResolved = convRow ? Number(convRow.id) : 0;
    }
  }

  // 2) Patch (colunas escalares de atendimentos)
  const patch: Record<string, unknown> = {};
  if (updates.nome !== undefined) patch.paciente_nome = updates.nome;
  if (updates.cpf !== undefined) patch.paciente_cpf = updates.cpf.replace(/\D/g, "");
  if (updates.nascimento !== undefined) patch.paciente_nascimento = brToIso(updates.nascimento) ?? "";
  if (updates.solicitante !== undefined) patch.solicitante = updates.solicitante;
  if (updates.convenio !== undefined) {
    patch.convenio_nome = updates.convenio;
    patch.convenio_id = String(convenioIdResolved ?? 0);
  }
  if (updates.unidadeId !== undefined) patch.unidade_id = updates.unidadeId;
  if (updates.motivoCancelamento !== undefined) patch.motivo_cancelamento = updates.motivoCancelamento ?? "";

  // 3) Monta payload de exames (somente se substituição explícita)
  let examesPayload: Array<Record<string, unknown>> | null = null;
  if (updates.exames !== undefined) {
    if (updates.exames.length === 0) {
      examesPayload = [];
    } else {
      const nomesUnicos = Array.from(new Set(updates.exames));
      const { data: catRows } = await supabase
        .from("exames_catalogo")
        .select("id, nome, material_id, tipo_processo, lab_apoio_id")
        .in("nome", nomesUnicos);
      type CatLite = Pick<ExamesCatalogoRow, "id" | "nome" | "material_id" | "tipo_processo" | "lab_apoio_id">;
      const catMap = new Map<string, { id: string; material_id: string | null; tipo_processo: string; lab_apoio_id: string | null }>(
        (catRows ?? []).map((c: CatLite) => [c.nome, {
          id: c.id,
          material_id: c.material_id ?? null,
          tipo_processo: c.tipo_processo || "INTERNO",
          lab_apoio_id: c.lab_apoio_id ?? null,
        }]),
      );


      const seqCount = new Map<string, number>();
      const grupoMap = new Map<string, string>();
      const cancelarTudoFlag = updates.statusAtendimento?.label?.toLowerCase().includes("cancel");

      examesPayload = updates.exames.map((nome, idx) => {
        const meta = updates.examesCobranca?.[idx];
        const cat = catMap.get(nome);
        const chave = cat?.id ?? nome.toLowerCase();
        const seq = (seqCount.get(chave) ?? 0) + 1;
        seqCount.set(chave, seq);
        if (!grupoMap.has(chave)) {
          grupoMap.set(chave, meta?.grupoExameId || crypto.randomUUID());
        }
        const tipoProcesso = (meta?.tipoProcesso as string) || cat?.tipo_processo || "INTERNO";
        const labApoioId = tipoProcesso === "TERCEIRIZADO"
          ? (meta?.labApoioId !== undefined ? meta?.labApoioId : (cat?.lab_apoio_id ?? null))
          : null;
        return {
          nome_exame: nome,
          exame_id: cat?.id ?? null,
          material_id: cat?.material_id ?? null,
          status: cancelarTudoFlag ? "cancelado" : "pendente",
          valor: Number(meta?.valor) || 0,
          // Preço cheio antes do desconto distribuído.
          valor_original: Number(meta?.valorOriginal ?? meta?.valor) || 0,
          ordem: idx + 1,
          motivo_cancelamento: updates.motivoCancelamento ?? null,
          cobranca_destino: meta?.cobrancaDestino ?? "paciente",
          convenio_cobranca_id: meta?.convenioCobrancaId ?? null,
          amostra_seq: seq,
          grupo_exame_id: grupoMap.get(chave),
          tipo_processo: tipoProcesso,
          lab_apoio_id: labApoioId,
          solicitante: meta?.solicitante ?? "",
        };
      });
    }
  }

  // 4) Pagamentos
  let pagamentosPayload: Array<Record<string, unknown>> | null = null;
  if (updates.pagamentosRealizados !== undefined) {
    pagamentosPayload = updates.pagamentosRealizados.map((p) => ({
      tipo: p.tipo,
      valor: p.valor,
      data: brToIso(p.data) ?? new Date().toISOString(),
    }));
  }

  const cancelarTudo = updates.statusAtendimento?.label === "Cancelado";

  // Justificativa de auditoria — sempre enviada.
  let just = (justificativa ?? "").trim();
  if (just.length < 5) {
    if (cancelarTudo) just = `Cancelamento de atendimento${updates.motivoCancelamento ? `: ${updates.motivoCancelamento}` : ""}`;
    else if (pagamentosPayload && !examesPayload && Object.keys(patch).length === 0) just = "Registro de pagamento";
    else just = "Edição de atendimento";
  }

  // 5) Invoca edge function transacional
  try {
    const { data, error } = await supabase.functions.invoke("update-atendimento", {
      body: {
        atendimento_id: id,
        patch: Object.keys(patch).length ? patch : null,
        exames: examesPayload,
        pagamentos: pagamentosPayload,
        cancelar_tudo: cancelarTudo,
        motivo_cancel: updates.motivoCancelamento ?? null,
        justificativa: just,
      },
    });

    const resp = data as AtendimentoTxResponse | null;
    if (error || !resp || resp.ok === false) {
      cache.atendimentos = prev;
      notify();
      throw new Error(
        resp?.error || error?.message || "Falha ao atualizar atendimento",
      );
    }

    if (cancelarTudo && updates.pagamentosRealizados === undefined) {
      cache.atendimentos = cache.atendimentos.map((a) =>
        a.protocolo === protocolo ? { ...a, pagamentosRealizados: undefined } : a,
      );
    }
    notify();
  } catch (e) {
    cache.atendimentos = prev;
    notify();
    throw e;
  }
}
