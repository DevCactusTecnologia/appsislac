
# Dedicated Runtime v1.0 — Plano de Conclusão

A radiografia diagnosticou **20% de prontidão do Dedicated**. Este plano encerra o gap sem criar novas abstrações — tudo dentro de `src/runtime/db/*`, `supabase/functions/_shared/runtime/*` e `tenant_registry`.

Antes de executar, preciso alinhar 4 decisões que **não podem ser inferidas do código** — todas viram bloqueadores estruturais se erradas.

---

## Decisões pendentes (bloqueiam Fase 1 e Fase 7)

### D1. Estratégia de Auth Federation
O JWT do projeto Shared não é aceito pelo GoTrue do projeto Dedicated. Três caminhos viáveis, mutuamente exclusivos:

- **A. Asymmetric JWT keys compartilhadas** (recomendado): Shared assina com chave privada (ES256/RS256); Dedicated é configurado com a mesma chave pública via `Auth → JWT Keys`. `auth.uid()` passa a funcionar nativamente no Dedicated. Requer configuração manual no dashboard de **cada** projeto dedicated no provisionamento.
- **B. Auth-per-tenant**: cada Dedicated tem seu próprio GoTrue; usuário faz signup nos dois. Migração de senhas via `auth.users` export. Mais isolado, mais complexo.
- **C. Signed context header** (proxy): edge functions injetam `x-tenant-user-id`; RLS lê via `current_setting()`. Elimina `auth.uid()` — reescreve todas as ~200 policies.

### D2. Service-role key dos projetos Dedicated
Migração de Storage e execução de DDL exigem service-role do Dedicated. Hoje é gerenciada por secret `SB_SERVICE_ROLE_<ref>`. Confirmar: **super-admin cadastra manualmente** por tenant (status quo) ou automatizar via Supabase Management API + PAT?

### D3. Escopo de "todas as edge functions data-plane"
Auditoria mapeou 79 functions. Estimo ~35 data-plane operacionais (atendimento/paciente/resultado/financeiro/whatsapp). Migro **todas as ~35 em uma leva** (grande PR) ou por domínio incremental com validação entre etapas?

### D4. Feature flag / go-live
Ativar Dedicated real por tenant via `tenant_registry.database_strategy = 'dedicated'` **imediatamente** após implementação, ou manter behind flag `runtime_status = 'canary'` com allowlist de tenants beta?

---

## Fase 1 — Auth Federation
Assumindo **D1=A**:
- Estender `tenant-runtime-config` a devolver JWT público do Dedicated (para healthcheck).
- Provisionamento (`super-admin-provision-tenant-schema-full`): novo passo `configure-jwt-federation` documenta chave pública a instalar no Dedicated + valida via probe autenticado.
- `AuthContext` inalterado (login continua no Shared) — o JWT emitido passa a ser válido em ambos.
- Remover `tenant-dedicated-login-gate` (workaround) após validação.

## Fase 2 — Server Runtime
- Remover `throw` fail-closed em `_shared/runtime/db.ts::getTenantClient` (dedicated real).
- `DedicatedServerStrategy`: cria client com service-role do Dedicated (via `db_secret_ref`), cache LRU por tenant, dispose em idle > 5min, `health()` via `select 1`, retry exponencial (3x, 100/400/1600ms).
- Telemetria: `runtime.server.*` events em `platform_audit`.

## Fase 3 — Edge Functions Data-Plane
- Codemod: substituir `getPlatformClient()` por `getTenantClient(tenant_id)` em toda função classificada data-plane.
- Guardrail CI: `scripts/check-data-plane-routing.sh` — falha build se função no allowlist data-plane importar `getPlatformClient` direto.
- Deploy em uma leva se **D3=leva única**; senão por domínio.

## Fase 4 — RPC
- Classificar 100% das funções `public.*` em `rpc_registry` (nova coluna `scope: platform|tenant`).
- Recriar tenant RPCs no schema do Dedicated via migração `SCHEMA_MINIMO_V2` (inclui `current_tenant_id`, sequences, `has_permission`, `has_role`).
- Front `RpcRouter`: lê registry, roteia dedicated vs shared. Já suportado pelo `getDedicatedClient()`.

## Fase 5 — Storage Runtime
- `StorageRuntime.resolveBucket(logicalName)` → `{client, bucket, prefix}`. Sem string hardcoded fora deste módulo.
- Migração física: `super-admin-migrate-tenant-storage` já existe (copia buckets); adicionar verificação de checksum e cutover flag `storage_flipped_at`.
- Refatorar chamadas de `assinaturas`, `tenant-assets`, `lab-apoio-upload-pdf`, `comprovantes` para usar `StorageRuntime`.

## Fase 6 — Realtime Runtime
- `getRealtimeChannel(name)` no `runtime/db/index.ts` — usa `getClient()` ou `getDedicatedClient()` conforme allowlist.
- Reconnect após flip: listener em `resetRuntime()` remove canais e reassina.
- Refatorar `useRealtimeChannel` + `subscribeAtendimentos`.

## Fase 7 — Migration Pipeline
Refatorar `SuperAdminMigration.tsx` em 7 etapas independentes idempotentes (state machine em `tenant_migration_runs.phase`):
1. `provision-schema` (existe) — idempotente via `_sislac_schema_health`
2. `migrate-data` (novo) — pg-dump lógico shared → restore dedicated
3. `migrate-auth` (existe) — federation via chaves ou export/import
4. `migrate-storage` (existe) — física + checksum
5. `smoke-test` (novo) — probe cada domínio
6. `flip` (novo) — atomic update de `database_strategy` + invalidação de cache runtime
7. `monitor` (novo) — janela 24h de dupla-leitura para reconciliação

Cada etapa lê estado do runtime anterior; retry seguro.

## Fase 8 — Failover
- `MigrationBlockedException` novo tipo em `runtime/db/types.ts`.
- `SharedStrategy.fallback` no `factory.ts` **removido** quando `strategy=dedicated`.
- Erro → log em `platform_audit` + notificação super-admin + rollback (`database_strategy` volta a `shared` só via ação humana).

## Fase 9 — Consistência
- `TenantContext` único (front: `tenantContext.ts`, server: `_shared/runtime/tenantContext.ts`) — verificação por testes contract.
- Testes: `runtime.contract.test.ts` valida que Storage/Realtime/RPC/Edge derivam do mesmo `tenant_id`.

## Fase 10 — Simulação End-to-End
Script `scripts/simulate-dedicated-lifecycle.ts`:
- Cria tenant fake → provisiona → migra → valida → flip → executa 50 operações → rollback → nova migração.
- Falha o CI se qualquer etapa desviar.

## Validação
Playwright suite em 3 perfis (P/M/G) cobrindo login, cadastro, atendimento, resultado, financeiro, upload PDF, realtime, WhatsApp.

## Auditoria + Relatórios
Gerar em `docs/database-runtime/dedicated-runtime/` os 10 relatórios `01-auth.md` → `10-executive-report.md` com checklist SIM/NÃO da auditoria final.

---

## Estimativa de escopo
- **~180 arquivos tocados**, ~35 edge functions refatoradas, 1 nova migration SCHEMA_MINIMO_V2, 10 relatórios, 1 script de simulação, 1 guardrail CI.
- Sem D1 definida, Fase 1 e todo o resto está bloqueado.

## Ordem de execução após aprovação
1. Respostas D1–D4
2. Fase 1 (auth) → smoke test isolado
3. Fase 2 → Fase 3 (data-plane)
4. Fase 4 → 5 → 6 em paralelo
5. Fase 7 → 8 → 9
6. Fase 10 + validação + relatórios + FREEZE

Aprovar plano + responder D1–D4 para iniciar.
