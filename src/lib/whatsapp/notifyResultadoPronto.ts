// WhatsApp 2.0 — Fase 3E — Resultado Pronto
// ------------------------------------------------------------------
// Dispara o template oficial Meta `resultado_pronto` quando TODOS os
// exames de um atendimento foram liberados.
//
// SSOT do disparo: `ResultadoDetalhe.executarLiberacao` /
// `handleLiberarTodos` → checagem "todos liberados" → este helper.
//
// PROIBIDO: novo portal, novo token, novo link público. O link enviado
// reaproveita o site público do tenant (`/site/:slug`) quando existir,
// caindo no `window.location.origin` quando não houver slug — ambos já
// fazem parte do SISLAC hoje.
//
// Segurança / auditoria / opt-out / rate limit / isolamento por tenant:
// 100% garantidos server-side pela RPC `enqueue_whatsapp` consumida por
// `enqueueNotification`. Este arquivo apenas resolve dados do paciente
// e enfileira — não toca regra clínica, PDF, assinatura ou impressão.

import { supabase } from "@/integrations/supabase/client";
import { getLabConfig } from "@/data/labConfigStore";
import {
  buildIdempotencyKey,
  enqueueNotification,
} from "@/lib/whatsapp/enqueueNotification";

export type NotifyResultadoProntoInput = {
  protocolo: string;
};

export type NotifyResultadoProntoResult =
  | { ok: true; outboxId: string; status: string }
  | { ok: false; reason: string };

function onlyDigits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D+/g, "");
}

function isValidBrazilianPhone(s: string): boolean {
  const d = onlyDigits(s);
  // Aceita 10 (fixo) ou 11 (móvel) dígitos com DDD; com DDI 55 vira 12/13.
  return d.length === 10 || d.length === 11 || d.length === 12 || d.length === 13;
}

async function resolveLinkResultado(tenantId: string): Promise<string> {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";
  try {
    const { data } = await supabase
      .from("tenant_settings_public")
      .select("slug, dominio_custom")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    const dominio = (data as { dominio_custom?: string | null } | null)?.dominio_custom;
    if (dominio) return dominio.startsWith("http") ? dominio : `https://${dominio}`;
    const slug = (data as { slug?: string | null } | null)?.slug;
    if (slug && origin) return `${origin}/site/${slug}`;
  } catch {
    /* fallback abaixo */
  }
  return origin || "https://appsislac.lovable.app";
}

/**
 * Enfileira o aviso "resultado pronto" para o paciente do atendimento.
 * Idempotente por protocolo: chamadas repetidas no mesmo bucket de 5min
 * devolvem o mesmo outbox (lado servidor garante).
 */
export async function notifyResultadoPronto(
  input: NotifyResultadoProntoInput,
): Promise<NotifyResultadoProntoResult> {
  const { protocolo } = input;
  if (!protocolo) return { ok: false, reason: "missing_protocolo" };

  // 1) Resolve atendimento (tenant + paciente)
  const { data: at, error: atErr } = await supabase
    .from("atendimentos")
    .select("tenant_id, paciente_id, paciente_nome")
    .eq("protocolo", protocolo)
    .maybeSingle();
  if (atErr || !at) return { ok: false, reason: "atendimento_not_found" };
  if (!at.paciente_id) return { ok: false, reason: "paciente_sem_cadastro" };

  // 2) Resolve telefone do paciente
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
  const linkResultado = await resolveLinkResultado(at.tenant_id);
  const pacienteNome =
    (pac as { nome?: string | null } | null)?.nome ?? at.paciente_nome ?? "Paciente";

  const idempotencyKey = await buildIdempotencyKey([
    "resultado_pronto",
    at.tenant_id,
    protocolo,
  ]);

  try {
    const res = await enqueueNotification({
      tenantId: at.tenant_id,
      pacienteId: String(at.paciente_id),
      telefone,
      template: "resultado_pronto",
      variaveis: {
        1: lab.nome || "Laboratório",
        2: pacienteNome,
        3: linkResultado,
      },
      idempotencyKey,
      atendimentoProtocolo: protocolo,
      tipo: "resultado_pronto",
    });
    return { ok: true, outboxId: res.outboxId, status: res.status };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "enqueue_failed" };
  }
}
