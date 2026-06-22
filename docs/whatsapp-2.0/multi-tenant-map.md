# WhatsApp 2.0 — Fase 1.4 — Mapa Multi-Tenant

## Respostas diretas

| Cada laboratório possui... | Hoje | Onde está armazenado |
|---|---|---|
| Token próprio? | **Sim** | `tenant_whatsapp_config.access_token` (Meta) e/ou `zapi_token` (Z-API), por `tenant_id`. |
| Número próprio? | **Sim** | `tenant_whatsapp_config.phone_number_id` + `display_phone` (Meta) ou `numero_simples` (modo wa.me). |
| Configuração própria? | **Sim** | `tenant_whatsapp_config.modo` (`simples` / `cloud_api` / `zapi`) + `ativo`. |
| Webhook próprio? | **Sim, parcialmente** | `tenant_whatsapp_config.webhook_verify_token` único por tenant. URL do webhook é a mesma (`/functions/v1/whatsapp-webhook`), mas o token de verificação difere — Meta de cada lab aponta para o mesmo endpoint com seu token. |
| Template próprio? | **Não** | Nenhum template cadastrado em lugar nenhum. |

---

## Tabela `tenant_whatsapp_config` (15 colunas)

```sql
CREATE TABLE public.tenant_whatsapp_config (
  id uuid PK,
  tenant_id uuid NOT NULL,         -- FK tenants
  modo text,                        -- 'simples' | 'cloud_api' | 'zapi'
  ativo boolean,
  numero_simples text,              -- modo simples (wa.me)
  phone_number_id text,             -- Cloud API
  waba_id text,                     -- Cloud API
  access_token text,                -- Cloud API (SECRETO, plain text)
  display_phone text,               -- Cloud API (informativo)
  webhook_verify_token text,        -- Cloud API (handshake Meta)
  zapi_instance_id text,            -- Z-API
  zapi_token text,                  -- Z-API (SECRETO, plain text)
  zapi_client_token text,           -- Z-API (SECRETO, plain text)
  created_at, updated_at
);
```

**1 linha por tenant** (não há índice único explícito, mas o frontend e a edge function tratam como singleton — `.maybeSingle()`).

RLS: 4 policies (SELECT/INSERT/UPDATE/DELETE) restritas a admin do tenant via `current_tenant_id()`.

---

## Configuração GLOBAL (paralela)

`app_settings.key = 'whatsapp_config'` armazena credenciais Meta usadas **apenas** pelo `leads-manager` para enviar OTP de cadastro de novos laboratórios (lead público).

Estrutura no JSON:
```json
{ "provider": "meta", "phoneNumberId": "...", "accessToken": "..." }
```

Esse caminho é **independente** do `tenant_whatsapp_config` — é o embrião do modelo centralizado, hoje usado apenas para OTP.

---

## Pontos de dependência multi-tenant

1. **Edge `whatsapp-send`** lê `tenant_whatsapp_config` por `tenant_id` derivado de `profiles.tenant_id` do usuário autenticado. Sem credencial → erro 412.
2. **Edge `whatsapp-webhook`** identifica o tenant pelo `webhook_verify_token` recebido no handshake (busca em `tenant_whatsapp_config`). Status POST usa apenas `message_id` (não precisa do tenant para o UPDATE).
3. **Frontend** (`WhatsappCloudConfig.tsx`) resolve `tenant_id` via `getCurrentTenantId()` e edita a linha do tenant correto.

---

## Impacto de centralizar (1 conta Meta corporativa)

| Hoje (descentralizado) | Amanhã (centralizado) |
|---|---|
| `phone_number_id` por tenant | 1 `phone_number_id` global em `app_settings` ou `platform_whatsapp_config` |
| `access_token` por tenant | 1 token global (rotacionável pelo Super Admin) |
| `webhook_verify_token` por tenant | 1 token global |
| `display_phone` por tenant | 1 número corporativo SISLAC |
| Cada lab configura Meta | Super Admin configura uma vez |
| `tenant_whatsapp_config.ativo` controla envio | Continua existindo como **opt-in por tenant** (lab pode pausar notificações) |
| Template inclui nome do lab implícito (via número) | Template inclui `{{1}} = nome_laboratorio` como variável obrigatória |

**O que precisa permanecer por tenant** mesmo após centralização:
- `ativo` (opt-in/opt-out)
- `numero_simples` para o "fale conosco" público do site institucional
- Eventual override (lab grande que queira usar Cloud API próprio) — opcional
- `display_phone` informativo para "Esta mensagem é enviada via SISLAC em nome de <lab>"
