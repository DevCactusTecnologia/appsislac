# Runbook — Webhook falhando

Cobre webhooks recebidos pelo SISLAC:

- **Pagamento:** Mercado Pago, InfinitePay (histórico em
  `src/lib/gatewayWebhookHistory.ts` — localStorage por usuário/máquina).
- **WhatsApp:** edge function `whatsapp-webhook`.
- **Integrações laboratoriais:** callbacks de provedores (DBSync, Hermes
  Pardini) tratados em `integration-*` functions.

## 1. Sintomas

- Pagamento confirmado pelo gateway mas atendimento continua "em aberto".
- Mensagens WhatsApp não chegando ou status delivery travado.
- `integration_jobs` com `status='error'` crescendo.
- Usuário relata "validei no app do banco/gateway e nada aconteceu aqui".

## 2. Diagnóstico

### 2.1 Logs HTTP da edge function

Cloud → Edge Functions → `<função>` → Logs. Filtrar por:

- `status_code >= 400` nas últimas 2h.
- Mensagem `signature mismatch` / `invalid token` / `unauthorized`.

### 2.2 Fila de jobs de integração

```sql
select status, count(*)
  from public.integration_jobs
 where created_at > now() - interval '1 hour'
 group by status;

select id, provider, status, attempts, last_error, created_at
  from public.integration_jobs
 where status in ('error','dead_letter')
 order by created_at desc
 limit 20;
```

### 2.3 Pagamento — histórico local

- Abrir Configurações → Gateway de pagamento (ou /financeiro → Integrações).
- O log `WebhookEvent` lista os últimos 50 eventos (`success`/`error`)
  recebidos por aquele navegador.

## 3. Mitigação

### 3.1 Replay de jobs em erro recuperável

Edge function `integration-dlq-replay` faz replay controlado. Pré-requisito:
ter resolvido a causa (ex: provedor voltou).

```bash
# Via UI super_admin: Integrações → DLQ → Replay
# Ou via curl autenticado (super_admin):
curl -X POST "$VITE_SUPABASE_URL/functions/v1/integration-dlq-replay" \
  -H "Authorization: Bearer $SUPABASE_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"job_ids":[123,124]}'
```

### 3.2 Pagamento manual

Se o webhook não chegou e o cliente pagou, lançar como **Entrada manual**
(`mem://features/financeiro/entradas-manuais`) com referência ao protocolo
do gateway. Nunca editar `atendimentos.financeiro_*` direto no DB.

### 3.3 Secret/assinatura inválida

- Mercado Pago / InfinitePay: revalidar `X-Signature` e secret na Cloud.
- WhatsApp: revalidar `WHATSAPP_VERIFY_TOKEN` e `WHATSAPP_APP_SECRET`.
- Rotar secret pelo painel Cloud; redeploy automático.

## 4. Correção definitiva

- Provedor: abrir ticket com ID dos eventos perdidos.
- Código: corrigir validação/parsing, adicionar caso ao teste relevante
  (`supabase/functions/*/index_test.ts` ou `src/lib/__tests__/`).
- Drift de secret: registrar no inventário e na rotação anual.

## 5. Pós-mortem

- Lista de transações afetadas (gateway txid + atendimento_id).
- Confirmar conciliação financeira (`/financeiro` bate com gateway).
- Atualizar runbook se surgiu novo modo de falha.