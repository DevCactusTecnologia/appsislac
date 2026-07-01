
# Fase 3 — Migração Cirúrgica Shared → Dedicated

Escopo: permitir migrar um tenant específico (ex.: Lab 0004) do banco compartilhado para um projeto Supabase dedicado, com janela curta, rollback e quarentena de 30 dias. Nenhum outro lab é afetado.

## Decisões aprovadas (Etapa 2)
- Opção B (espelho com `tenant_id` fixo no dedicado).
- Auditoria truncada no destino.
- `pg_cron` não replicado (fica no shared/plataforma).
- Cutover com janela ~5 min + rollback via toggle.

## Entregas (nesta ordem)

### 1. Migração de banco (control plane)
Tabela `tenant_migration_runs` para rastrear cada migração:
- `id`, `tenant_id`, `phase` (schema|dryrun|auth|data|storage|smoke|flip|purge), `status` (running|ok|failed|aborted), `started_at`, `finished_at`, `stats jsonb`, `error text`, `initiated_by`.
- RLS: só super_admin lê/escreve.

Colunas novas em `tenant_registry`:
- `frozen_at timestamptz` — marca shared como somente-leitura para esse tenant.
- `migration_state text` — `idle|provisioning|migrating|dedicated|frozen_shared`.

### 2. Edge Functions (Deno, service-role, revalidam `is_super_admin`)

Todas seguem o padrão já usado (`_shared/hardening.ts`, logger, requestId, CORS).

**a) `super-admin-provision-tenant-schema-full`**
- Introspecta o shared via `pg_catalog` (extensões, enums, tabelas, colunas, PKs, FKs, índices, triggers, funções, views, sequences).
- Gera DDL na ordem correta e executa no dedicado via `pg-meta`/SQL endpoint do projeto dedicado usando o service role dedicado.
- Idempotente: verifica objetos existentes antes de criar.
- Insere linha sentinela em `tenants` no dedicado com o UUID do tenant.
- Grava linha em `tenant_migration_runs` com stats (n objetos criados).

**b) `super-admin-migrate-tenant-auth`**
- Lê `profiles` do shared filtrado por `tenant_id`.
- Para cada user_id: usa admin API do shared para pegar dados; copia via SQL direto no `auth.users` do dedicado preservando `id`, `email`, `encrypted_password`, `raw_user_meta_data`, `raw_app_meta_data`, `email_confirmed_at`.
- Replica `user_roles` correspondentes.

**c) `super-admin-migrate-tenant-data`**
- Aceita `dryRun: boolean`.
- Percorre tabelas na ordem topológica (6 níveis definidos em `02-entender.md`).
- Para cada tabela: `SELECT ... WHERE tenant_id = $1` no shared → `INSERT` no dedicado com `session_replication_role = replica`.
- Auto-FK (unidades.parent_id): 2 passos (INSERT com NULL → UPDATE).
- Auditoria: pulada por padrão (truncar no destino).
- Checkpoint por tabela; erros abortam com log.

**d) `super-admin-migrate-tenant-storage`**
- Cria buckets no dedicado com mesma visibilidade.
- Lista `storage.objects` filtrados por caminhos com UUID do tenant / users migrados.
- Baixa via signed URL do shared, faz upload no dedicado.

**e) `super-admin-migration-smoke-test`**
- Valida no dedicado: profiles > 0, pacientes count == shared, atendimentos count == shared, tabela `select_options` presente.
- Retorna pass/fail por check.

**f) `super-admin-migration-flip`**
- Só executa se última smoke passou.
- Atualiza `tenant_registry`: `runtime_mode='isolated_db'`, `migration_state='dedicated'`, `frozen_at=now()`.

**g) `super-admin-migration-rollback`**
- Reverte `runtime_mode='shared_db'`, `frozen_at=null`.
- Loga em `tenant_migration_runs`.

**h) `super-admin-purge-tenant-from-shared`** (só após 30 dias)
- Verifica `frozen_at < now() - 30 days`.
- Gera backup .sql.gz completo antes.
- DELETE em ordem reversa de FK filtrado por tenant_id.
- Auditoria detalhada.

### 3. UI — Wizard de migração

Rota: `/super-admin/laboratorios/:id/migrar` (`src/pages/superadmin/SuperAdminMigration.tsx`).

7 etapas em Tabs verticais com estado persistido:

1. **Preparação** — checklist do secret + teste de conexão (reusa `super-admin-test-tenant-anon-key`).
2. **Schema** — botão "Provisionar", progress via polling em `tenant_migration_runs`.
3. **Dry-run** — mostra contagens esperadas por tabela.
4. **Cutover** — botão "Iniciar janela" com confirmação dupla; contador 5min; logs em Realtime.
5. **Smoke test** — checklist verde/vermelho.
6. **Flip** — só habilita se smoke 100%.
7. **Pós-migração** — mostra `frozen_at`, botão "Rollback" (30 dias), botão "Purge" (após 30 dias).

Cada etapa: card com título, descrição em linguagem clara, botão único de ação, log em `<pre>` colapsável.

## Estilo e segurança
- Sem gradientes/sombras (SISLAC minimalist).
- Todas as edges revalidam `is_super_admin` server-side.
- Confirmação dupla nos botões destrutivos (cutover, flip, purge).
- Logs anonimizados (nunca imprimir hash de senha, service role, etc.).

## Fora de escopo (fica para depois)
- Migração delta contínua (usaremos janela curta).
- Auditoria histórica no dedicado (fica no shared).
- Cross-project queries de auditoria.

## Ordem de execução das entregas (nesta task)
1. Migração SQL (tabela `tenant_migration_runs` + colunas em `tenant_registry`).
2. Edges na ordem: schema-full → auth → data → storage → smoke → flip → rollback → purge.
3. Wizard UI + rota no router.
4. Link "Migrar para dedicado" em `SuperAdminTenants` / detalhe do lab.

Devido ao tamanho, entrego em 3 turnos:
- **T1 (agora):** migração SQL + edges `provision-schema-full`, `migrate-auth`, `migrate-data`.
- **T2:** edges `storage`, `smoke`, `flip`, `rollback`, `purge`.
- **T3:** wizard UI + rota + links no admin.

Ao final de cada turno: teste rápido via `curl_edge_functions` e commit lógico.
