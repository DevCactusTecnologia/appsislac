# 13 — Fluxos Críticos

## 1. Login
```
Frontend LoginV2
  → tenant-resolve (public)   → tenant_registry / tenants
  → supabase.auth.signInWithPassword (anon)
  → Se runtime_mode=isolated_db → tenant-dedicated-login-gate
  → AuthContext hidrata profiles + user_roles
```

## 2. Atendimento
```
NovoAtendimento (frontend, JWT)
  → create-atendimento (edgeBoot? user client)
      → RPC create_atendimento_tx
          → insert atendimentos + atendimento_exames + atendimento_pagamentos
          → triggers audit_atendimentos / audit_atendimento_exames / audit_atendimento_pagamentos
          → atendimento_assign_protocolo + sign_protocolo
```

## 3. Resultado / Laudo
```
ResultadoDetalhe
  → update-atendimento (parâmetros)
  → sign-resultado (JWT + PIN)
      → RPC sign_laudo_tx (2ª auditoria)
      → Storage upload assinatura (upload-assinatura)
```

## 4. Pagamento
```
PagamentoDialog → update-atendimento (parcial/quitado)
  → RPC update_atendimento_tx recalcula saldo
  → attach_pagamento_to_caixa (RPC) se caixa aberto
  → PIX: pixBrCode (frontend) + webhook update
  → Impressão comprovante quando status=quitado
```

## 5. Migração shared → dedicated
```
SuperAdminMigration UI
  → super-admin-provision-tenant-schema-full
  → super-admin-migrate-tenant-auth
  → super-admin-migrate-tenant-data
  → super-admin-migrate-tenant-storage
  → super-admin-migration-smoke-test
  → super-admin-migration-flip (runtime_mode=isolated_db)
  → super-admin-purge-tenant-from-shared
Cada passo persistido em tenant_migration_runs.
Rollback: super-admin-migration-rollback.
```

## 6. Integração Laboratorial (Hermes / DBSync)
```
lab-apoio-cron-fetch (cron)
  → cria/atualiza integration_jobs
integration-jobs-runner
  → RPC claim_integration_jobs (atomic)
  → integration-dispatch
      → runPipeline(driver, ctx)
          → circuit_should_allow
          → driver.dispatch  →  Hermes SOAP / DBSync REST
          → outcome: completed | reschedule | fail | dead
          → healthRecord + logIntegration
          → dead → sendToDlq → integration_dead_jobs
```

## 7. IA
```
Frontend chat
  → ai-chat (edgeBoot, JWT)
      → Lovable AI Gateway (Gemini 2.0 flash)
      → stream response
Complementos: ai-transcribe (STT), ai-speak (TTS), ai-suggest-exames.
```
