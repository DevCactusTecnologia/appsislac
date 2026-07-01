# 02 — Tenant Registry

## Schema real (34 colunas)

Fonte: `information_schema.columns` de `public.tenant_registry`.

| Coluna | Tipo | Null | Uso |
|---|---|---|---|
| tenant_id | uuid | NOT NULL | PK, ligada a `tenants.id` |
| slug | text | NOT NULL | Identificador URL-safe |
| laboratorio | text | NOT NULL | Nome do lab |
| lab_code | text | NOT NULL | Código curto (LAB) |
| database_strategy | text | NOT NULL | `shared` \| `dedicated` — lido em `tenant-runtime-config`, `SharedRegistryProvider` |
| runtime_mode | text | NOT NULL | `shared_db` \| `isolated_db` — aceito como sinônimo de dedicated |
| runtime_status | text | NOT NULL | `active` \| `suspended` \| `provisioning` — provider lança em `suspended` |
| provisioning_status | text | NOT NULL | Fase de provisionamento (usada em `SuperAdminMigration`) |
| billing_status | text | NOT NULL | Não influencia runtime |
| onboarding_version | text | NOT NULL | Metadata onboarding |
| backup_status | text | NOT NULL | Metadata |
| migration_state | text | NOT NULL | Estado da migração Shared→Dedicated |
| schema_version | text | NOT NULL | Versão do schema no dedicated |
| runtime_dedicated_enabled | boolean | NOT NULL | **Feature-flag**: gate em `tenant-runtime-config` |
| schema_provisioned_at | timestamptz | NULL | Gate: sem isso → fail-safe `shared` |
| frozen_at | timestamptz | NULL | Marca tenant congelado durante flip |
| db_provider | text | NULL | `neon` \| `supabase_project` \| `external_postgres` \| `shared_supabase` |
| db_host / db_port / db_name / db_user | text/int | NULL | Conexão pg direta (usada só em `super-admin-*-tenant-db`, `tenant-dedicated-login-gate`) |
| db_secret_ref | text | NULL | Nome do env var com senha pg |
| db_region | text | NULL | Metadata |
| db_project_url | text | NULL | **URL do projeto Supabase dedicado** — consumida pelo frontend |
| db_anon_key_secret_ref | text | NULL | Nome do env var com anon key — resolvido em `tenant-runtime-config` |
| storage_namespace | text | NULL | **NUNCA consumido** (audit 12) |
| last_health_at / last_health_check / last_health_duration_ms / last_health_result / last_health_failure | tstz/int/text | NULL | Populados por `tenant-healthcheck` |
| last_error | text | NULL | Diagnóstico |
| created_at / updated_at | tstz | NOT NULL | Auditoria |

## Constraints & índices

Verificados via schema — PK `(tenant_id)`, unique `(slug)`, unique `(lab_code)`. Não há FK para `tenants.id` explícita no dump (verificar). Não há check-constraint listada garantindo `database_strategy in ('shared','dedicated')` — o valor é validado apenas em código.

## Campos: uso real vs. declarado

| Categoria | Campos |
|---|---|
| **Consumidos em runtime** (crítico) | database_strategy, runtime_mode, runtime_dedicated_enabled, schema_provisioned_at, db_project_url, db_anon_key_secret_ref, runtime_status, migration_state, frozen_at |
| **Consumidos em provisionamento/admin** | db_host, db_port, db_name, db_user, db_secret_ref, db_provider, provisioning_status, schema_version, last_health_* |
| **Metadados (leitura ocasional)** | slug, laboratorio, lab_code, db_region, onboarding_version, billing_status, backup_status |
| **Nunca consumido no código atual** | `storage_namespace` (audit 07-storage) — declarada mas nenhum caller a usa |
| **Redundância** | `database_strategy` e `runtime_mode` cobrem a mesma decisão (dedicated) — `tenant-runtime-config` aceita OR entre os dois |
| **Redundância de health** | `last_health_at` vs `last_health_check` — dois timestamps para o mesmo conceito |

## Integridade

- `runtime_dedicated_enabled` é feature-flag independente de `database_strategy` — permite provisionar sem ativar (bom para safety).
- `db_project_url` e `db_anon_key_secret_ref` são validados por regex em runtime (`PROJECT_URL_RE`, `SECRET_REF_RE` em `tenant-runtime-config`).
- **Não há CHECK garantindo consistência** entre `runtime_mode='isolated_db'` e presença de `db_project_url` — a validação é fail-safe em runtime (retorna `shared` se faltar dado).

## Profiles / outras tabelas relacionadas

- `profiles.tenant_id` — usado pelo `AuthContext` e por `current_tenant_id()` para amarrar auth ao tenant. **Vive no shared** — não há plano de replicação para dedicated.
- Não existe tabela `tenant_connections` nem `tenant_runtime` separada — tudo consolidado em `tenant_registry`.
- `tenant_settings_public`, `tenant_lab_config`, `tenant_notification_settings`, `tenant_subscriptions` — todas no shared, sem sombra no dedicated.
