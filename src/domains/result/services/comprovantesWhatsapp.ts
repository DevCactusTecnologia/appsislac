// ----------------------------------------------------------------------------
// Comprovantes — WhatsApp helpers
//   Após o corte do legado (Fase 3B), o envio oficial de notificações ao
//   paciente é feito EXCLUSIVAMENTE via a arquitetura centralizada Meta:
//     enqueueNotification() → whatsapp_outbox → whatsapp-dispatcher → Meta
//
//   Este módulo mantém apenas o helper `buildWaUrl` para o botão "abrir no
//   WhatsApp Web" (wa.me) usado em telas de pré-visualização de PDF e
//   compartilhamento manual. Não há mais envio de PDF como anexo via
//   Cloud API por tenant — esse caminho foi removido junto com a
//   edge function `whatsapp-send` e a tabela `tenant_whatsapp_config`.
// ----------------------------------------------------------------------------

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
