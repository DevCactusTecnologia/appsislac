// ----------------------------------------------------------------------------
// Comprovantes — WhatsApp delivery
//   Cloud API (oficial Meta) via edge function `whatsapp-send`, com
//   idempotência por janela de 5min (anti-duplo-clique), e helpers para
//   envio por wa.me (fallback). Extraído de `src/lib/comprovantes.ts`.
// ----------------------------------------------------------------------------
import { supabase } from "@/integrations/supabase/client";
import type { ComprovanteTipo } from "@/lib/comprovantes";

const _whatsappInFlight = new Set<string>();

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Envia um PDF como anexo via WhatsApp Cloud API (Meta) usando as
 * credenciais oficiais cadastradas pelo laboratório. Retorna o message_id
 * em caso de sucesso, ou lança erro se o lab não tiver configurado a API.
 *
 * P0 #4 — Idempotência: calcula uma chave baseada em
 * (protocolo|tipo|telefone|janela_5min) e mantém um lock in-memory
 * para impedir reenvio por duplo clique. O backend valida via índice único.
 */
export async function enviarPdfWhatsappCloud(params: {
  telefone: string;
  pdfUrl: string;
  filename?: string;
  caption?: string;
  protocolo?: string;
  tipo?: ComprovanteTipo;
}): Promise<{ messageId: string; idempotent?: boolean }> {
  const telefoneNorm = (params.telefone || "").replace(/\D/g, "");
  const bucket = Math.floor(Date.now() / (5 * 60_000));
  const idempotencyKey = await sha256Hex(
    `${params.protocolo ?? ""}|${params.tipo ?? ""}|${telefoneNorm}|${bucket}`,
  );

  if (_whatsappInFlight.has(idempotencyKey)) {
    throw new Error("Envio já em andamento, aguarde a confirmação.");
  }
  _whatsappInFlight.add(idempotencyKey);

  try {
    const { data, error } = await supabase.functions.invoke("whatsapp-send", {
      body: {
        telefone: params.telefone,
        pdfUrl: params.pdfUrl,
        filename: params.filename,
        caption: params.caption,
        atendimentoProtocolo: params.protocolo,
        tipo: params.tipo,
        idempotencyKey,
      },
    });
    if (error) {
      const msg = error.message || "Falha ao enviar pelo WhatsApp Cloud API";
      const e = new Error(msg) as Error & { code?: string };
      if (/configurado/i.test(msg)) e.code = "WHATSAPP_NAO_CONFIGURADO";
      throw e;
    }
    const d = data as { messageId?: string; idempotent?: boolean } | null;
    if (!d?.messageId) throw new Error("Cloud API nao retornou messageId");
    return { messageId: d.messageId, idempotent: d.idempotent };
  } finally {
    setTimeout(() => _whatsappInFlight.delete(idempotencyKey), 5_000);
  }
}

/** wa.me URL helper — normaliza telefone (adiciona 55 se faltar). */
export function buildWaUrl(phone: string | undefined, msg: string): string {
  const phoneDigits = (phone ?? "").replace(/\D/g, "");
  const fp = phoneDigits
    ? phoneDigits.startsWith("55")
      ? phoneDigits
      : `55${phoneDigits}`
    : "";
  return fp
    ? `https://wa.me/${fp}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
}
