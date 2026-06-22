# WhatsApp 2.0 — Fase 1.5 — Mapa de Banco de Dados

## Tabelas envolvidas

### `whatsapp_mensagens` (13 colunas)

```sql
CREATE TABLE public.whatsapp_mensagens (
  id uuid PK,
  tenant_id uuid NOT NULL,
  atendimento_protocolo text,           -- vínculo opcional com atendimento
  telefone_destino text,
  tipo_documento text,                  -- comprovante|orcamento|...
  message_id text,                      -- ID retornado pela Meta/Z-API
  status text,                          -- sent|delivered|read|failed
  erro text,
  payload jsonb,                        -- response bruto do provedor
  enviado_por uuid,                     -- user_id que disparou
  idempotency_key text,                 -- hash anti-duplicidade
  created_at, updated_at
);

CREATE INDEX idx_whatsapp_mensagens_tenant   ON whatsapp_mensagens(tenant_id);
CREATE INDEX idx_whatsapp_mensagens_message_id ON whatsapp_mensagens(message_id);
CREATE INDEX idx_whatsapp_mensagens_protocolo ON whatsapp_mensagens(atendimento_protocolo);
CREATE UNIQUE INDEX whatsapp_mensagens_idem_uq
  ON whatsapp_mensagens(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

RLS: 4 policies por tenant (SELECT/INSERT/UPDATE/DELETE).

### `tenant_whatsapp_config` (15 colunas)
Ver `multi-tenant-map.md`.

### `app_settings` (key = 'whatsapp_config')
Configuração global usada **apenas** pelo `leads-manager` (OTP).

### `inscricoes`
Campos `codigo_validacao`, `codigo_expira_em`, `tentativas_codigo`, `whatsapp_confirmado` — fluxo OTP via WhatsApp.

---

## Perguntas chave

### Existe rastreabilidade?
**Parcial.**
- ✅ `whatsapp_mensagens` registra todo envio que passa por `whatsapp-send` (modos `cloud_api` e `zapi`).
- ❌ Envios em modo `simples` (`wa.me`) **não são registrados** — abre o WhatsApp Web e o sistema perde o rastro.
- ❌ Botões "Falar com paciente/especialista" em `Pacientes.tsx`/`Especialistas.tsx` não geram log.
- ❌ OTP de inscrição não grava em `whatsapp_mensagens` (somente em `inscricoes`).

### Existe retry?
**Não.**
- Erro de envio: registra `status='failed'` + `erro` e retorna 502 ao frontend.
- `idempotency_key` é gravado **apenas** quando `status='sent'`, permitindo nova tentativa manual em caso de falha.
- Nenhum worker/cron reprocessa falhas.

### Existe histórico completo?
**Parcial.** Histórico existe para modos oficiais, mas:
- Sem ligação direta com `paciente_id` (apenas `telefone_destino` em texto).
- Sem snapshot do texto enviado (só `payload` da resposta da Meta).
- Sem TTL/política de retenção — cresce indefinidamente.

### Existe fila?
**Não.** Envio é síncrono na request do usuário. Sem `pg_cron`, sem `pgmq`, sem worker.

### Existe auditoria?
**Parcial.** `enviado_por` registra quem disparou; `payload` guarda resposta. Não há `audit_logs` dedicado a WhatsApp — apenas o próprio `whatsapp_mensagens` como log.

---

## Gaps para WhatsApp 2.0

| Necessidade | Falta |
|---|---|
| Fila com retry | criar `whatsapp_outbox` (status: queued/sending/sent/failed/dead) + worker (pg_cron + edge) |
| Templates versionados | criar `whatsapp_templates` (template_name, language, categoria, status_meta) |
| Vínculo a entidade origem | adicionar `origem_tipo` + `origem_id` (atendimento/orcamento/recoleta/resultado) |
| Snapshot do conteúdo | adicionar `template_name`, `template_vars jsonb`, `texto_final` |
| Métricas por lab | view materializada `whatsapp_metrics_tenant` (sent/delivered/read/failed por dia) |
| Opt-out por paciente | tabela `whatsapp_opt_out` (telefone, tenant_id, motivo) — conformidade LGPD |
| Retenção | política de purge >180 dias |
