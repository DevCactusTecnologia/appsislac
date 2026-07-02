# 09 — Pipeline Performance

## Integrações (Hermes-Pardini, DBSync, Lab Apoio)

- Edges: `integration-dispatch`, `integration-jobs-runner`, `integration-poll-results`, `integration-job-action`, `lab-apoio-adapter`, `lab-apoio-cron-fetch`.
- Retry/Circuit Breaker: **evidência de Circuit Breaker** (Fase 07 — memory da migração).
- DLQ: **não encontrado** — falhas persistidas em `integration_jobs.status='failed'` sem tópico morto formal.

## IA (Lovable AI Gateway / Gemini)

- Edges: `ai-chat`, `ai-suggest-exames`, `ai-transcribe`, `ai-speak`.
- Rate-limit: `_shared/rateLimit.ts` in-memory (não coordenado).
- Retry: não confirmado.

## Migração

- Edges `super-admin-migrate-tenant-*` — batelada, hidratação de estado via `tenant_migration_runs` (66 rows).
- Retry/rollback: presente (`super-admin-migration-rollback`).

## PDF

- Client-side (Paged.js). `laudoBatchPdf.ts` processa em paralelo.
- Sem fila server-side; contenção fica no browser do operador.

## Financeiro

- RPCs `*_tx` transacionais (Fase 07).
- PIX: `create-atendimento` + webhook.

## Cron

- `lab-apoio-cron-fetch`, `whatsapp-template-sync`, `provider-health-aggregator`, `whatsapp-dispatcher` — orquestração cron não visível em `supabase/config.toml`. Provável `pg_cron` (não confirmado nesta fase).

## Retry / DLQ / Circuit Breaker

| Pipeline | Retry | DLQ | Circuit Breaker |
|---|---|---|---|
| Integração provider | ✅ | ❌ | ✅ |
| WhatsApp outbox | ? | ❌ | ? |
| IA | ? | ❌ | ? |
| Migração | ✅ | N/A | N/A |

## Achados

| # | Item | Severidade |
|---|---|---|
| P01 | Sem DLQ formal em nenhum pipeline | ALTO |
| P02 | Cron scheduling não documentado no repo | INCONCLUSIVO |
| P03 | PDF em lote depende de CPU do operador | MÉDIO |
| P04 | Retry policy de IA e WhatsApp não confirmadas | INCONCLUSIVO |
