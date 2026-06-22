// WhatsApp 2.0 — Fase 3F — Recoleta
// ------------------------------------------------------------------
// Dispara o template oficial Meta `recoleta` quando o operador registra
// uma recoleta para um exame.
//
// SSOT do disparo: `SolicitarRecoletaDialog.handleConfirm` →
// `criarRecoleta()` → este helper. Espelha o padrão consolidado em
// `notifyResultadoPronto`: resolve paciente + telefone, respeita a
// política `getNotificationMode(tenant, "recoleta")` e usa o mesmo
// `enqueueNotification` (Outbox → dispatcher → Meta). Sem nova fila,
// sem novo dispatcher, sem novo template engine.
//
// Segurança / opt-out / rate limit / idempotência / isolamento por
// tenant: 100% garantidos server-side pela RPC `enqueue_whatsapp`.

import { supabase } from "@/integrations/supabase/client";
import { getLabConfig } from "@/data/labConfigStore";
import {
  buildIdempotencyKey,
  enqueueNotification,
} from "@/lib/whatsapp/enqueueNotification";
import { getNotificationMode } from "@/lib/whatsapp/notificationPolicy";

export type NotifyRecoletaInput = {
  /** Protocolo do atendimento (mesma chave usada em `notifyResultadoPronto`). */
  protocolo: string;
  /** Motivo legível da recoleta (já vem do dicionário no dialog). */
  motivo: string;
  /** Quando true, ignora a política (modo manual) e força o envio. */
  force?: boolean;
};

export type NotifyRecoletaResult =
  | { ok: true; outboxId: string; status: string }
  | { ok: false; reason: string };

function onlyDigits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D+/g, "");
}

function isValidBrazilianPhone(s: string): boolean {
  const d = onlyDigits(s);
  return d.length === 10 || d.length === 11 || d.length === 12 || d.length === 13;
}

export async function notifyRecoleta(
  input: NotifyRecoletaInput,
): Promise<NotifyRecoletaResult> {
  const { protocolo, motivo, force = false } = input;
  if (!protocolo) return { ok: false, reason: "missing_protocolo" };

  const { data: at, error: atErr } = await supabase
    .from("atendimentos")
    .select("tenant_id, paciente_id, paciente_nome")
    .eq("protocolo", protocolo)
    .maybeSingle();
  if (atErr || !at) return { ok: false, reason: "atendimento_not_found" };
  if (!at.paciente_id) return { ok: false, reason: "paciente_sem_cadastro" };

  if (!force) {
    const mode = await getNotificationMode(at.tenant_id, "recoleta");
    if (mode === "manual") return { ok: false, reason: "policy_manual" };
  }

  const { data: pac } = await supabase
    .from("pacientes")
    .select("telefone, nome")
    .eq("id", at.paciente_id)
    .maybeSingle();
  const telefone = onlyDigits((pac as { telefone?: string | null } | null)?.telefone);
  if (!telefone || !isValidBrazilianPhone(telefone)) {
    return { ok: false, reason: "telefone_invalido" };
  }

  const lab = getLabConfig();
  const pacienteNome =
    (pac as { nome?: string | null } | null)?.nome ?? at.paciente_nome ?? "Paciente";
  const telefoneLab = lab.telefone?.trim() || "—";

  const idempotencyKey = await buildIdempotencyKey([
    "recoleta",
    at.tenant_id,
    protocolo,
    motivo,
  ]);

  try {
    const res = await enqueueNotification({
      tenantId: at.tenant_id,
      pacienteId: String(at.paciente_id),
      telefone,
      template: "recoleta",
      variaveis: {
        1: lab.nome || "Laboratório",
        2: pacienteNome,
        3: motivo || "—",
        4: telefoneLab,
      },
      idempotencyKey,
      atendimentoProtocolo: protocolo,
      tipo: "recoleta",
    });
    return { ok: true, outboxId: res.outboxId, status: res.status };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "enqueue_failed" };
  }
}
