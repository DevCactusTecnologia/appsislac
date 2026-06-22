# WhatsApp 2.0 — Fase 1.6 — Mapa de Segurança

## Inventário de superfícies sensíveis

| Item | Local | Risco |
|---|---|---|
| `access_token` (Meta) | `tenant_whatsapp_config.access_token` em **texto plano** | Vazamento se RLS falhar; sem rotação automática; sem criptografia at-rest aplicativa. |
| `zapi_token` / `zapi_client_token` | `tenant_whatsapp_config.*` em texto plano | Idem. |
| `webhook_verify_token` | `tenant_whatsapp_config.webhook_verify_token` | Baixo (token é projetado para ser comparado, não secreto crítico — Meta o envia em query string). |
| `WHATSAPP_APP_SECRET` | Env var da edge function | Bom — usado só no `whatsapp-webhook` para validar HMAC. **Fail-closed** quando ausente. |
| `app_settings.whatsapp_config` (OTP global) | JSONB com `accessToken` em texto plano | Mesmo problema, mas restrito ao Super Admin via RLS. |
| URL pública do PDF (`uploadPdfAndGetUrl`) | Bucket Storage | URL longa contém path; é resolvida para shortlink antes de enviar. |
| Shortlink (`comprovante_links`) | URL curta pública | Acesso direto ao laudo/comprovante; sem expiração obrigatória (verificar). |

---

## Auditoria por item

### 1. Tokens em texto plano
- **Risco**: ALTO se houver bypass de RLS. Hoje as 4 policies restringem por `current_tenant_id()`, mas qualquer query com `service_role` expõe todos os tokens.
- **Mitigação atual**: Edge `whatsapp-send` é a única que lê com service role.
- **Recomendação 2.0**: usar Supabase Vault para credenciais Meta/Z-API; tokens nunca trafegam ao frontend (já confirmado — `WhatsappCloudConfig.tsx` mostra `••••••••`).

### 2. Webhook `/whatsapp-webhook`
- ✅ HMAC `x-hub-signature-256` validado com `WHATSAPP_APP_SECRET`.
- ✅ **Fail-closed**: sem `WHATSAPP_APP_SECRET` configurado, retorna 503.
- ✅ Handshake GET valida `hub.verify_token` contra base.
- ⚠️ Update em `whatsapp_mensagens` ocorre **sem filtrar por tenant** — usa só `message_id`. Como `message_id` é gerado pela Meta e é único globalmente, não há risco prático de cross-tenant, mas seria mais seguro filtrar `(tenant_id, message_id)` se a centralização compartilhar o webhook.

### 3. Edge `whatsapp-send`
- ✅ Exige Bearer token + `getClaims`.
- ✅ Tenant derivado de `profiles.tenant_id` server-side (não confia no frontend).
- ✅ Idempotência por `(tenant_id, idempotency_key)` com índice único.
- ⚠️ Não há rate limit por usuário/tenant — usuário poderia enviar dezenas de mensagens em loop.
- ⚠️ Não há checagem de opt-out do paciente (LGPD).

### 4. Edge `leads-manager`
- ✅ Rate limit por IP (`submit`), por `lead_id` (`verify`/`resend`).
- ✅ OTP criptograficamente seguro (`crypto.getRandomValues`).
- ✅ Limite de tentativas (5) + TTL 5min.
- ⚠️ Token Meta vive em `app_settings` plano.

### 5. Links públicos (`wa.me` + shortlinks)
- `wa.me/<num>?text=` expõe nome de paciente e protocolo na URL — visível no histórico do browser do recepcionista. **Aceitável** (dado interno).
- Shortlinks de PDF: precisam ter TTL e/ou token de validação. Verificar `comprovante_links` (não auditado nesta fase).

---

## Vazamento de dados

### Risco de vazamento direto
**Baixo-Médio.** Tokens só são acessíveis via service role; PDF na URL pública é o vetor mais provável (qualquer pessoa com shortlink acessa o PDF até expiração).

### Risco de acesso cruzado entre tenants
**Baixo.**
- RLS em `whatsapp_mensagens` e `tenant_whatsapp_config` por `current_tenant_id()`.
- Edge `whatsapp-send` resolve tenant via `profiles` do user JWT — não aceita `tenant_id` do body.
- Único ponto sem filtro: UPDATE do webhook por `message_id` (justificável pela unicidade global da Meta).

### Risco de dependência insegura de configuração local
**Médio.**
- Lab com `cloud_api` mal configurado (token expirado, conta sem template aprovado) **não notifica** o paciente — falha silenciosa do ponto de vista do usuário final.
- Lab pode esquecer de marcar `ativo=true`.
- Lab com Z-API depende de provedor não-oficial — risco regulatório (banimento pelo WhatsApp).

---

## Recomendações de segurança para 2.0

1. **Mover tokens para Vault** (`vault.secrets`) com referência por chave em `tenant_whatsapp_config`.
2. **Rate limit** em `whatsapp-send` (por user_id, ex: 30/min).
3. **Opt-out por paciente** (tabela + verificação obrigatória antes do envio).
4. **TTL em shortlinks** (ex: 7 dias) com renovação sob demanda.
5. **Centralização Meta**: 1 conta corporativa elimina N tokens em texto plano.
6. **Audit log** dedicado para mudanças em `tenant_whatsapp_config` (espelhar `app_settings_audit`).
7. **Filtrar `(tenant_id, message_id)`** no webhook quando o número for compartilhado entre labs.
