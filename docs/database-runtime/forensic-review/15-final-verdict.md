# 15 — Final Verdict

## Complexidade geral
**Muito complexa** para o objetivo real declarado ("migrar um tenant do Shared para um Supabase dedicado").

Justificativa por evidências:
- ~8.100 linhas de código novo + 15.000 de docs para um pipeline que nunca foi executado em produção.
- 14 abstrações públicas criadas; ~13 sem consumidor.
- 3 caminhos paralelos de acesso ao banco (singleton, fachada, strategies).
- 3 famílias de colunas para descrever a mesma coisa em `tenant_registry`.
- 20 edge functions dedicated-specific vs 0 tenants dedicated.

## Classificação por bloco

### ✔ Indispensável
- `_shared/runtime/db.ts` — `getPlatformClient` / `getUserClient` (padroniza 15+ edges).
- `_shared/migration/connect.ts` — única forma de copiar dados com `session_replication_role=replica`.
- Edge functions `super-admin-migrate-tenant-{auth,data,storage}` — coração do pipeline.
- Edge function `super-admin-migration-flip` — chaveamento final.
- Edge function `super-admin-provision-tenant-schema[-full]` — bootstrap do dedicado.
- Migrations `20260525130936_*` e `20260525134033_*` — control-plane mínimo.
- Guardrail `check-data-plane-routing.sh`.
- UI `SuperAdminMigration.tsx` (com escopo reduzido).

### △ Precisa ser reavaliado
- `getTenantClient` / `getUserTenantClient` (server) — úteis se o roteamento dedicated for ativado; hoje só a ramificação `shared` executa.
- `tenant-runtime-config` — só justifica se o cliente for de fato rotear por tabela.
- `TenantDatabaseConfig.tsx` (827L) — grande para o que hoje é configurado.
- Coluna `migration_state` — usada só pelo `migrate-data`.
- Estruturas `TenantContextProvider` (server) / `IdentityIssuer` (client) — abstrações “trocar de provedor” sem 2ª implementação.

### ✖ Aparentemente não faz mais sentido
- Fachada `db` (client) + `factory` + `strategies/shared` + `strategies/dedicated` + `resolver` + `telemetry` — nenhum store consome; o app usa `supabase` direto.
- Identity Layer (`src/runtime/identity/*` + `_shared/runtime/identity.ts`) — registrado, nunca lido.
- `installTenantAuthInvalidation`, `getCachedTenantContext`, `RuntimeError` — sem consumidor.
- `dedicatedHealth`, `invalidateDedicatedCache`, `assertDedicatedRegistry`, `isDedicatedRegistry` — sem call-site.
- Edge `tenant-dedicated-login-gate` e `tenant-resolve` — sem consumidor.
- Coluna `runtime_dedicated_enabled` — redundante com `database_strategy`.
- Coluna `db_provider` — nunca escrita.
- Coluna `runtime_status` — nunca escrita por código.
- Docs em `docs/database-runtime/shared-to-dedicated/*` (16 arquivos) — planejamento absorvido por `dedicated-runtime/*` e `slices/*`.
- Fase Slices 2-3 de migração da fachada para 12 edges — protege um caminho que hoje é sempre `shared`.

## Conclusão
A implementação carrega ~40% de código e infraestrutura que atende a um cenário multi-provedor / roteamento por tabela que **não é o objetivo declarado** ("migrar do Shared para um Supabase dedicado por tenant"). O núcleo verdadeiramente necessário para esse objetivo cabe em: `connect.ts`, 7 edges de pipeline, 1 flip, 2 migrations de control-plane e a UI de wizard.

---

**FORENSIC ARCHITECTURE REVIEW CONCLUÍDA**

PARAR. Aguardando autorização explícita para iniciar a fase de cirurgia arquitetural.
