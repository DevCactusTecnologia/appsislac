// WhatsApp 2.0 — helper único para produtores enfileirarem notificações.
//
// Uso:
//   await enqueueNotification({
//     tenantId, pacienteId, telefone,
//     template: "sislac_comprovante_atendimento",
//     variaveis: { 1: "Lab X", 2: "Maria", 3: "amanhã 14h", 4: "abc123" },
//     idempotencyKey: "atend:123:comprovante",
//     atendimentoProtocolo: "ATD-123",
//     tipo: "comprovante_atendimento",
//   });
//
// Faz: RPC `enqueue_whatsapp` (valida opt-out + rate limit + idempotência)
// e dispara `whatsapp-dispatcher` em fire-and-forget para entrega imediata.

import { supabase } from "@/integrations/supabase/client";

export type EnqueueParams = {
  tenantId: string;
  pacienteId?: string | null;
  telefone: string;
  template: string;
  variaveis?: Record<string | number, string | number>;
  idempotencyKey: string;
  idioma?: string;
  botoes?: { url_suffix?: string } | null;
  prioridade?: number;
  atendimentoProtocolo?: string | null;
  tipo?: string | null;
};

export type EnqueueResult = { outboxId: string; status: string };

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function buildIdempotencyKey(parts: Array<string | undefined>): Promise<string> {
  const bucket = Math.floor(Date.now() / (5 * 60_000));
  return sha256Hex(parts.map((p) => p ?? "").join("|") + "|" + bucket);
}

export async function enqueueNotification(p: EnqueueParams): Promise<EnqueueResult> {
  const { data, error } = await supabase.rpc("enqueue_whatsapp", {
    p_tenant_id: p.tenantId,
    p_paciente_id: p.pacienteId ?? undefined,
    p_telefone: p.telefone,
    p_template: p.template,
    p_variaveis: (p.variaveis ?? {}) as never,
    p_idempotency_key: p.idempotencyKey,
    p_atendimento_protocolo: p.atendimentoProtocolo ?? undefined,
    p_tipo_documento: p.tipo ?? undefined,
    p_idioma: p.idioma ?? "pt_BR",
    p_botoes: (p.botoes ?? undefined) as never,
    p_prioridade: p.prioridade ?? 5,
  } as never);
  if (error) throw new Error(error.message || "enqueue_whatsapp_failed");
  const row = Array.isArray(data) ? data[0] : data;
  const outboxId = (row as { outbox_id?: string })?.outbox_id ?? "";
  const status = (row as { status?: string })?.status ?? "pending";

  // Dispatch imediato fire-and-forget — não bloqueia o produtor.
  if (status === "pending" && outboxId) {
    supabase.functions.invoke("whatsapp-dispatcher", { body: { outbox_id: outboxId } }).catch(() => {
      // silencioso — cron de retry processa em até 1 min
    });
  }

  return { outboxId, status };
}
