# WhatsApp / Z-API — UX Audit
> Audit date: 2025-07

---

## 1. Mode Selection (Configuration UI)

**Source:** `WhatsappCloudConfig.tsx:254-282`

| Finding | Severity | Detail |
|---------|----------|--------|
| Mode cards are self-explanatory | ✅ Good | Each card has a description; "Simples / Pronto em 30s" clearly communicates speed |
| `badgeTone='success'` for Simples renders identically to `'muted'` | 🟡 Minor | Both tones collapse to grey border — Z-API's "Plug & play" and Simples's "Pronto em 30s" look identical (`WhatsappCloudConfig.tsx:75-77`) |
| Webhook URL visible only in cloud_api mode | ✅ Correct | Contextual disclosure |
| No inline test-send button | 🟡 Gap | Admin cannot verify credentials without leaving the settings page |
| Token fields are masked with eye-toggle | ✅ Good | `showToken`, `showZapiToken`, `showZapiClient` states (`lines 115-117`) |
| `access_token` helper text says "O token fica criptografado no backend" | 🔴 Incorrect | Token is stored in plaintext (see Risk R-01) — misleads admins |

---

## 2. Send Flow — Attendant UX

**Source:** `PdfPreviewDialog.tsx:413-426`

| Finding | Severity | Detail |
|---------|----------|--------|
| Two separate WhatsApp buttons ("Compartilhar PDF" and "Enviar WhatsApp") | 🟡 Confusing | Lines 413-426: "Compartilhar" opens wa.me with link; "Enviar" triggers cloud_api then falls back to wa.me — attendant doesn't know which will run |
| Loading state uses same spinner for both "Gerando..." and "Compartilhando..." | 🟡 Minor | Attendant cannot distinguish PDF generation from network send |
| Silent fallback on `WHATSAPP_NAO_CONFIGURADO` | 🔴 High | `PdfPreviewDialog.tsx:252-260`: if the lab is on `simples` mode, the `whatsapp-send` call returns 412; the `code !== 'NAO_CONFIGURADO'` guard suppresses the toast — but wa.me still opens. Attendant sees no difference and assumes cloud_api sent |
| Toast "Enviado pela WhatsApp Cloud API" is shown before delivery confirmed | 🟡 Misleading | `status='sent'` only means the API accepted the request, not that the patient received the message |
| No indication of phone number being used | 🟡 Minor | Attendant cannot verify the correct number before sending |

---

## 3. Fallback UX

**Source:** `PdfPreviewDialog.tsx:267-272`, `comprovantes.ts:1101-1110`

| Scenario | What the attendant sees |
|----------|------------------------|
| Upload success, cloud_api success | "Enviado pela WhatsApp Cloud API" toast |
| Upload success, cloud_api configured-error | wa.me opens with shortlink (silent) |
| Upload success, cloud_api other-error | Warning toast + wa.me opens |
| Upload fails | Destructive toast + local PDF download + wa.me opens without link |

The final fallback (local download + manual attach) is documented as a fallback but the toast message ("PDF baixado para anexo manual") places the burden on the attendant with no structured guidance.

---

## 4. Patient UX

| Finding | Severity | Detail |
|---------|----------|--------|
| Shortlink TTL 24h with no expiry warning | 🟡 Medium | If patient opens link after 24h it may be expired; no warning in message text |
| Message text is fixed/not customizable | 🟡 Medium | Lab cannot add personalized greetings or exam-specific instructions |
| Orcamento message always uses wa.me regardless of mode | 🟡 Medium | No native attachment for orcamentos even on cloud_api — patient gets a link instead |
| Verification QR code in PDF links to `/verificar/<codigo>` | ✅ Good | Patient can verify document authenticity |

---

## 5. Error Recovery

| Gap | Impact |
|-----|--------|
| No retry button in dialog after failed send | Attendant must close and reopen to retry |
| Failed `whatsapp_mensagens` rows have no UI surface | Lab manager cannot see failed sends without direct DB access |
| No notification to lab admin if Meta/Z-API credentials expire | Silent degradation to wa.me fallback |

