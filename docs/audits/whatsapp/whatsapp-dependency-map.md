# WhatsApp / Z-API — Dependency Map
> Audit date: 2025-07  |  Auditor: Senior Architect (read-only)

---

## 1. Components & Entry Points

| Layer | Artefact | Role |
|-------|----------|------|
| Config UI | `src/components/configuracoes/WhatsappCloudConfig.tsx` | Read/write `tenant_whatsapp_config`; selects mode (simples / cloud_api / zapi) |
| Comprovante lib | `src/lib/comprovantes.ts` | Renders PDF, uploads, creates shortlink, calls Cloud/Z-API or opens wa.me |
| Dialog | `src/components/PdfPreviewDialog.tsx` | Orchestrates user-triggered send; cloud_api → wa.me fallback |
| Page trigger | `src/pages/NovoAtendimento.tsx` | Passes `whatsappPhone` + `enviarOrcamentoPorWhatsapp` to dialog |
| Page trigger | `src/pages/Financeiro.tsx` | Builds `comprovanteData`, passes `whatsappPhone` to `PdfPreviewDialog` |
| Edge fn – send | `supabase/functions/whatsapp-send/index.ts` | JWT-auth'd backend send (cloud_api & zapi); writes `whatsapp_mensagens` |
| Edge fn – webhook | `supabase/functions/whatsapp-webhook/index.ts` | Public; HMAC-verified; updates `whatsapp_mensagens.status` (cloud_api only) |
| Edge fn – shortlink | `supabase/functions/comprovante-shortlink/index.ts` | Creates `comprovante_links` record, returns `/p/<code>` short URL |
| Edge fn – upload-pdf | `supabase/functions/upload-pdf/` | Stores PDF Blob in public Storage bucket; returns public URL |

---

## 2. Data Stores

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `tenant_whatsapp_config` | `tenant_id (UNIQUE)`, `modo`, `ativo`, `phone_number_id`, `access_token`, `waba_id`, `webhook_verify_token`, `zapi_instance_id`, `zapi_token`, `zapi_client_token`, `numero_simples` | One config row per tenant; all three mode credentials live side-by-side |
| `whatsapp_mensagens` | `tenant_id`, `message_id`, `status`, `telefone_destino`, `atendimento_protocolo`, `tipo_documento`, `erro`, `payload` | Delivery log for cloud_api & zapi sends; status updated by webhook |
| `comprovante_links` | `codigo (UNIQUE)`, `url_assinada`, `atendimento_protocolo`, `tipo`, `expira_em`, `acessos` | Shortlinks used in wa.me messages; 24 h default TTL |
| `criticos_comunicacoes` | `canal`, `atendimento_id`, `atendimento_exame_id` | RDC 978/2025 audit log for critical-value notifications; `canal` enum includes `'whatsapp'` |
| `resultados_entregas` | `canal`, `atendimento_id` | Audit log for result delivery; `canal` includes `'whatsapp'` |
| `orientacoes_entregues` | `canal`, `exames JSONB`, `atendimento_id` | Audit log for pre-analytical instructions; `canal` includes `'whatsapp'` |

---

## 3. External APIs

| Provider | Endpoint | Auth | Used when |
|----------|----------|------|-----------|
| Meta Graph API v21 | `POST https://graph.facebook.com/v21.0/{phone_number_id}/messages` | `Bearer <access_token>` | `modo = cloud_api` |
| Meta Webhook (inbound) | Calls `whatsapp-webhook` edge fn | HMAC-SHA256 `x-hub-signature-256` | Delivery status updates |
| Z-API | `POST https://api.z-api.io/instances/{id}/token/{token}/send-document/pdf` | `Client-Token` header (optional) | `modo = zapi` |
| wa.me | `https://wa.me/{phone}?text=...` | None (browser-opened URL) | `modo = simples`; fallback for cloud_api/zapi |
| Supabase Storage | `upload-pdf` edge fn → public bucket | Service role key | All modes (PDF upload) |

---

## 4. Call Sequence Diagrams

### 4a. Mode = `simples`

```
User clicks "Enviar WhatsApp"
  → PdfPreviewDialog.handleWhatsapp()
      → comprovantes.renderToBlob()          # client-side html2pdf
      → uploadPdfAndGetUrl()                 # invoke("upload-pdf")
      → criarShortlinkPdf()                  # invoke("comprovante-shortlink")
      → window.open(wa.me/...?text=...)      # browser opens WhatsApp Web
```
No edge-function send; no `whatsapp_mensagens` record; no delivery confirmation.

### 4b. Mode = `cloud_api`

```
User clicks "Enviar WhatsApp"
  → PdfPreviewDialog.handleWhatsapp()
      → renderToBlob()
      → uploadPdfAndGetUrl()
      → criarShortlinkPdf()                  # shortUrl used in wa.me fallback text only
      → enviarPdfWhatsappCloud()             # invoke("whatsapp-send")
            → whatsapp-send edge fn
                → profiles → tenant_id
                → tenant_whatsapp_config (modo, phone_number_id, access_token)
                → POST graph.facebook.com/v21.0/.../messages  (longUrl, not shortUrl)
                → INSERT whatsapp_mensagens (status='sent'|'failed')
      [success] → toast "Enviado pela WhatsApp Cloud API"
      [fail, code≠NAO_CONFIGURADO] → toast warning → window.open(wa.me fallback)
      [fail, code=NAO_CONFIGURADO] → silent → window.open(wa.me fallback)

Later (async):
  Meta → POST whatsapp-webhook
      → HMAC verify (WHATSAPP_APP_SECRET)
      → UPDATE whatsapp_mensagens SET status=delivered|read|failed WHERE message_id=...
```

### 4c. Mode = `zapi`

```
(same frontend flow as cloud_api up to invoke)
      → whatsapp-send edge fn
          → POST api.z-api.io/.../send-document/pdf  (longUrl)
          → INSERT whatsapp_mensagens
No incoming webhook from Z-API → status stays 'sent' forever (no delivery confirmation).
```

### 4d. Orcamento (always simples regardless of mode)

```
NovoAtendimento → enviarOrcamentoPorWhatsapp()  # comprovantes.ts:1038
    → renderToBlob()
    → uploadPdfAndGetUrl()
    → window.open(wa.me)    # Never calls whatsapp-send; no whatsapp_mensagens record
```

---

## 5. Environment Variables

| Variable | Consumed by | Required |
|----------|-------------|---------|
| `SUPABASE_URL` | both edge fns | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | both edge fns | yes |
| `SUPABASE_ANON_KEY` | whatsapp-send | yes |
| `WHATSAPP_APP_SECRET` | whatsapp-webhook | yes (fail-closed if absent → 503) |
| `VITE_SUPABASE_URL` | WhatsappCloudConfig.tsx (webhook URL display) | frontend build |

