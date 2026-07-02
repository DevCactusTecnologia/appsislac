# 05 — Pipelines

## 1. Pipeline de Integração Laboratorial
Arquivo: `_shared/drivers/pipeline.ts` — `runPipeline(driver, ctx)`.

Fluxo:
1. `integration-jobs-runner` faz `claim_integration_jobs` (batch atomic).
2. `integration-dispatch` seleciona driver via `_shared/drivers/registry.ts`.
3. `runPipeline`:
   - Gate `circuitShouldAllow` (RPC `circuit_should_allow`).
   - `driver.dispatch(ctx)` → `DriverOutcome { completed | reschedule | fail | dead }`.
   - `healthRecord` (latência, tipo de falha, retry flag).
   - Sucesso → `integration_jobs.status=COMPLETED` + `circuitRecordSuccess`.
   - Reschedule → `rescheduleJob` (backoff via `nextRetryDelayMs(retry)`).
   - Dead → `sendToDlq` + `integration_dead_jobs` + snapshot request/response.

Início: cron `lab-apoio-cron-fetch` ou webhook (`whatsapp-webhook`, `integration-job-action`).
Fim: `integration_jobs.status ∈ {COMPLETED, FAILED}`; DLQ persiste morto.

## 2. Pipeline de Migração (shared → dedicated)
Módulo: `_shared/migration/` + 12 edge functions `super-admin-migration-*` / `super-admin-migrate-*`.

Fases: **Provision → Schema Check → Auth Migrate → Data Migrate → Storage Migrate → Smoke Test → Flip (`runtime_mode=isolated_db`) → Purge Shared**.
Estado persistido em `tenant_migration_runs` (hidratação da UI).
Rollback: `super-admin-migration-rollback` reverte `runtime_mode` e re-liga tenant no shared.

## 3. Pipeline de IA
Edge `ai-chat` → Lovable AI Gateway (Gemini 2.0 flash). Suporta streaming.
Complementares: `ai-transcribe` (STT), `ai-speak` (TTS), `ai-suggest-exames`, `extract-requisicao-exames`.
Autorização via `_shared/aiAuth.ts`.

## 4. Pipeline Financeiro
Puro RPC (não há edge dedicada):
- `create_atendimento_tx` cria pagamentos.
- Triggers `audit_atendimento_pagamentos`.
- `caixa_abrir/fechar` + `attach_pagamento_to_caixa` + `competencia_*` para bloqueio contábil.
- PIX: geração no frontend (`pixBrCode.ts`); webhook confirma via update direto (RLS-safe).

## 5. Pipeline de PDFs / Documentos
Frontend-driven (Paged.js + `laudoBatchPdf.ts`).
Server envolvido apenas em: `upload-pdf`, `integration-pdf-resolve`, `integration-pdf-url`, `lab-apoio-upload-pdf`, `comprovante-resolve`, `comprovante-shortlink`.

## Padrão comum
Todos observam `correlation_id`, `integration_logs`, `tenant_id`.
