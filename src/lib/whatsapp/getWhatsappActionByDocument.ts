// WhatsApp 2.0 — Envio contextual por aba (Detalhes do Atendimento)
// ------------------------------------------------------------------
// Mapeamento ÚNICO entre a aba ativa (documento selecionado) e a ação
// de envio correspondente. Evita ramificações `if aba === ...` na UI.
//
// Regra canônica:
//   A aba selecionada é a fonte única da verdade.
//   Documento exibido = Documento enviado = Texto do botão.

import type { MockAtendimento } from "@/data/types";
import {
  enqueueNotification,
  buildIdempotencyKey,
} from "@/lib/whatsapp/enqueueNotification";
import { getPacienteByCPF } from "@/data/pacienteStore";
import { fmtBRLNumber } from "@/lib/utils";

export type DocumentTab = "pagamento" | "atendimento" | "comparecimento";

export interface DocumentActionMeta {
  /** Rótulo curto da aba (TabsList). */
  tabLabel: string;
  /** Título canônico do documento (subtítulo "Documento selecionado: ..."). */
  title: string;
  /** Rótulo do botão de envio para a aba ativa. */
  buttonLabel: string;
}

export const DOCUMENT_ACTIONS: Record<DocumentTab, DocumentActionMeta> = {
  pagamento: {
    tabLabel: "Comp. Pagamento",
    title: "Comprovante de Pagamento",
    buttonLabel: "Enviar Comprovante de Pagamento",
  },
  atendimento: {
    tabLabel: "Comp. Atendimento",
    title: "Comprovante de Atendimento",
    buttonLabel: "Enviar Comprovante de Atendimento",
  },
  comparecimento: {
    tabLabel: "Comparecimento",
    title: "Declaração de Comparecimento",
    buttonLabel: "Enviar Declaração de Comparecimento",
  },
};

export interface DocumentSendResult {
  ok: boolean;
  reason?: string;
}

function onlyDigits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D+/g, "");
}

/**
 * Executa o envio do documento correspondente à aba ativa.
 * Usa o mesmo pipeline canônico (Outbox → Dispatcher → Meta).
 */
export async function sendDocumentWhatsapp(
  doc: DocumentTab,
  atendimento: MockAtendimento,
  ctx: { tenantId?: string },
): Promise<DocumentSendResult> {
  const tenantId = ctx.tenantId;
  if (!tenantId) return { ok: false, reason: "missing_tenant" };

  const paciente = atendimento.cpf ? getPacienteByCPF(atendimento.cpf) : undefined;
  if (atendimento.cpf && !paciente) return { ok: false, reason: "paciente_sem_cadastro" };
  const telefone = onlyDigits(paciente?.telefone || paciente?.celular);
  if (!telefone) return { ok: false, reason: "telefone_invalido" };

  const { protocolo } = atendimento;
  const pagoTotal = (atendimento.pagamentosRealizados ?? []).reduce(
    (sum, p) => sum + (p.valor || 0),
    0,
  );

  // Único template Meta atualmente aprovado para comprovantes operacionais.
  // Diferenciação semântica é feita via `tipo` (auditoria/outbox).
  const template = "comprovante_atendimento";

  let tipo: string;
  let variaveis: Record<string | number, string | number>;
  const idemParts: Array<string | undefined> = [tenantId, doc, protocolo];

  if (doc === "pagamento") {
    tipo = "comprovante_pagamento";
    variaveis = {
      1: atendimento.nome,
      2: protocolo,
      3: `R$ ${fmtBRLNumber(pagoTotal)}`,
    };
    idemParts.push(String(pagoTotal));
  } else if (doc === "comparecimento") {
    tipo = "declaracao_comparecimento";
    variaveis = {
      1: atendimento.nome,
      2: protocolo,
      3: atendimento.data,
    };
  } else {
    tipo = "comprovante_atendimento";
    variaveis = {
      1: atendimento.nome,
      2: protocolo,
      3: atendimento.data,
    };
  }

  try {
    const idempotencyKey = await buildIdempotencyKey(idemParts);
    await enqueueNotification({
      tenantId,
      telefone,
      template,
      tipo,
      atendimentoProtocolo: protocolo,
      idempotencyKey,
      variaveis,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "enqueue_failed" };
  }
}
