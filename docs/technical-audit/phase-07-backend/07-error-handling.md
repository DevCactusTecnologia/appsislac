# 07 — Tratamento de Erros

## Padrão centralizado
- **`edgeBoot`** aplica catch-all → 500 JSON com `correlation_id` + `content-type`.
- **`runPipeline`** normaliza qualquer exceção em `DriverOutcome` e chama `rescheduleJob` / `failJob` / `sendToDlq`.
- **`MigrationBlockedError`** (`runtime/db.ts`) — códigos catalogados (`DEDICATED_URL_MISSING`, `DEDICATED_SERVICE_KEY_MISSING`, `DEDICATED_CLIENT_FAILED`, `TENANT_SUSPENDED`).

## Retry
- `nextRetryDelayMs(retry)` em `integrationLog.ts` — backoff exponencial.
- `integration_jobs.max_retries` (default 5) e `next_retry_at/scheduled_at`.
- Runner atomiza claim para não duplicar (`claim_integration_jobs`).

## Rollback
- Migrações: `super-admin-migration-rollback` reverte `runtime_mode`.
- Financeiro: `estornar_pagamento_tx` + `block_delete_use_estorno` (nunca DELETE).
- RPCs `*_tx` executadas em transação; falha aborta todos os inserts.

## DLQ
- Tabela `integration_dead_jobs` + snapshot `envelope`/`response` da última tentativa.
- Motivos: `SCHEMA_VIOLATION`, `PARSE_ERROR`, `CONTRACT_MISMATCH`, `AUTH_IRRECOVERABLE`, `CAPABILITY_NOT_SUPPORTED`, `ENVELOPE_INCONSISTENT`, `MALFORMED_RESPONSE`, `PROVIDER_NOT_SUPPORTED`.
- `sendToDlq` atualiza job original para `FAILED` prefixado `DEAD:`.

## Circuit Breaker
- Feature flag `integrations.config.resilience.circuit_breaker.enabled` (default on).
- RPCs `circuit_should_allow / circuit_record_success / circuit_record_failure` — estado por (tenant, provider).
- Falhas semânticas **não** contam para o breaker (só transport/timeout/failure).

## Logs
- `logIntegration(admin, {tenant_id, integration_id, job_id, level, message, context})` grava em `integration_logs`.
- `correlation_id` propagado em header `x-correlation-id`, resposta, log e request downstream.

## Cobertura
- **Padrão único**: sim, para tudo que passa por `edgeBoot` + `runPipeline`.
- **Exceção**: edge functions legadas sem `edgeBoot` (60 delas) fazem `try/catch` local — cobertura ~80% do plane admin.
