// WhatsApp 2.0 — Fase 3F.2 — Decisor único de ação manual
// ------------------------------------------------------------------
// Centraliza a lógica de "qual mensagem o sistema deve enviar quando
// o operador clica em [Send WhatsApp]?". Evita `if resultado / if
// recoleta / if comprovante` espalhados pela UI.
//
// Entrada: o atendimento em memória (MockAtendimento) + um sinal
// opcional "todosLiberados" quando a UI já sabe.
//
// Saída: { kind, label, execute } — `execute()` enfileira pelo
// pipeline oficial (Outbox → Dispatcher → Meta). O componente apenas
// renderiza o botão e chama `execute()`.

import type { MockAtendimento } from "@/data/types";
import { notifyResultadoPronto } from "@/lib/whatsapp/notifyResultadoPronto";
import {
  enqueueNotification,
  buildIdempotencyKey,
} from "@/lib/whatsapp/enqueueNotification";
import { getPacienteByCPF } from "@/data/pacienteStore";
import { fmtBRLNumber } from "@/lib/utils";

export type WhatsappActionKind =
  | "resultado_pronto"
  | "comprovante_pagamento"
  | "comprovante_atendimento";

export interface BestWhatsappAction {
  kind: WhatsappActionKind;
  /** Rótulo descritivo curto, para mostrar abaixo do botão. */
  hint: string;
  /** Executa o envio (força — modo manual, ignora política). */
  execute: () => Promise<{ ok: boolean; reason?: string }>;
}

function onlyDigits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D+/g, "");
}

export function getBestWhatsappAction(
  atendimento: MockAtendimento,
  ctx: { tenantId?: string; todosLiberados?: boolean } = {},
): BestWhatsappAction {
  const { protocolo } = atendimento;
  const tenantId = ctx.tenantId;

  // 1) Resultado pronto — prioridade máxima quando tudo está liberado.
  if (ctx.todosLiberados) {
    return {
      kind: "resultado_pronto",
      hint: "Aviso de resultado pronto",
      execute: async () => {
        const r = await notifyResultadoPronto({ protocolo, force: true });
        return r.ok ? { ok: true } : { ok: false, reason: r.reason };
      },
    };
  }

  // 2) Pagamento concluído — comprovante de pagamento.
  const pagoTotal = (atendimento.pagamentosRealizados ?? []).reduce(
    (sum, p) => sum + (p.valor || 0),
    0,
  );
  const pagouAlgo = pagoTotal > 0;
  const pacienteCad = atendimento.cpf ? getPacienteByCPF(atendimento.cpf) : undefined;
  const telefone = onlyDigits(pacienteCad?.telefone || pacienteCad?.celular);

  if (pagouAlgo) {
    return {
      kind: "comprovante_pagamento",
      hint: "Comprovante de pagamento",
      execute: async () => {
        if (!tenantId) return { ok: false, reason: "missing_tenant" };
        if (!telefone) return { ok: false, reason: "telefone_invalido" };
        const idem = await buildIdempotencyKey([
          tenantId,
          "comprovante_pagamento",
          protocolo,
          String(pagoTotal),
        ]);
        try {
          await enqueueNotification({
            tenantId,
            telefone,
            template: "comprovante_atendimento",
            tipo: "comprovante_pagamento",
            atendimentoProtocolo: protocolo,
            idempotencyKey: idem,
            variaveis: {
              1: atendimento.nome,
              2: protocolo,
              3: `R$ ${fmtBRLNumber(pagoTotal)}`,
            },
          });
          return { ok: true };
        } catch (e) {
          return { ok: false, reason: e instanceof Error ? e.message : "enqueue_failed" };
        }
      },
    };
  }

  // 3) Default — comprovante de atendimento.
  return {
    kind: "comprovante_atendimento",
    hint: "Comprovante de atendimento",
    execute: async () => {
      if (!tenantId) return { ok: false, reason: "missing_tenant" };
      if (!telefone) return { ok: false, reason: "telefone_invalido" };
      const idem = await buildIdempotencyKey([
        tenantId,
        "comprovante_atendimento",
        protocolo,
      ]);
      try {
        await enqueueNotification({
          tenantId,
          telefone,
          template: "comprovante_atendimento",
          tipo: "comprovante_atendimento",
          atendimentoProtocolo: protocolo,
          idempotencyKey: idem,
          variaveis: {
            1: atendimento.nome,
            2: protocolo,
            3: atendimento.data,
          },
        });
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: e instanceof Error ? e.message : "enqueue_failed" };
      }
    },
  };
}
