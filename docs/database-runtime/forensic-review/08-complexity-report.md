# 08 — Complexity Report

Classificação: SIM (indispensável) / PARCIAL (útil mas revisável) / NÃO (dispensável hoje).

| Componente | Indispensável? | Justificativa |
|---|---|---|
| `_shared/runtime/db.ts` (getPlatformClient/UserClient) | **SIM** | Padroniza 12+ edge functions; sem ele há duplicação evidente |
| `_shared/runtime/db.ts` (getTenantClient dedicated + cache) | **PARCIAL** | Necessário só quando algum tenant estiver dedicated; não há tenant assim hoje |
| `_shared/migration/connect.ts` | **SIM (para pipeline)** | Único caminho para bypass de triggers e cópia direta |
| Edge functions `super-admin-migrate-*` | **PARCIAL** | Indispensáveis se a migração for executada; código pronto mas nunca rodou |
| Edge functions `super-admin-tenant-{snapshot,backup}` | **PARCIAL** | Backups paralelos ao pipeline; sem plano de operação |
| Edge `tenant-runtime-config` | **PARCIAL** | Só faz sentido se cliente rotear por tabela (allowlist vazia hoje) |
| Edge `tenant-dedicated-login-gate` | **NÃO** | Sem call-site no `AuthContext` |
| Edge `tenant-resolve` | **NÃO** | Duplica `tenant-runtime-config` |
| `src/runtime/db/index.ts` (Proxy fachada) | **NÃO** | Nenhum store consome; app usa `supabase` direto |
| `src/runtime/db/factory.ts` (dois transports por contexto) | **NÃO** | Roteamento por tabela nunca ativa |
| `src/runtime/db/strategies/*` | **NÃO** | Só usadas pela factory acima |
| `src/runtime/db/tenantContext.ts` | **PARCIAL** | Faz lookup útil do tenant, mas duplica lógica com `AuthContext` |
| `src/runtime/db/resolver.ts` | **NÃO** | Camada tradutora para tipos que só a factory usa |
| `src/runtime/db/telemetry.ts` | **NÃO** | Apenas `console.debug` |
| `src/runtime/identity/*` | **NÃO** | Registrado, nunca chamado |
| `_shared/runtime/identity.ts` | **NÃO** | Nunca instanciado por edge function |
| `_shared/runtime/tenantContext.ts` | **PARCIAL** | Usado por `getTenantClient`; sobrepõe leitura do registry |
| Coluna `runtime_dedicated_enabled` | **NÃO** | Não lido em nenhum caminho ativo |
| Coluna `db_provider` | **NÃO** | Não lido |
| Guardrail `check-data-plane-routing.sh` | **SIM** | Previne regressão nas 12 migradas |
| UI `SuperAdminMigration.tsx` | **PARCIAL** | Só útil quando pipeline for exercitado |
| UI `TenantDatabaseConfig.tsx` (827L) | **PARCIAL** | Grande superfície para configurar campos que não têm consumidor operacional |
