# Phase 2 — Schema

Cinco tabelas criadas em `public`, todas com `tenant_id NOT NULL`, RLS habilitado, GRANTs explícitos e índices.

| Tabela | Soft delete | Índices principais | Policies |
|---|---|---|---|
| `ai_threads` | sim (`deleted_at`) | `(tenant_id,user_id,last_message_at DESC)` | 4 (select/insert/update/delete) — tenant + dono |
| `ai_messages` | não | `(thread_id,created_at)`, `(tenant_id,created_at DESC)` | 3 — tenant + dono |
| `ai_audit` | não | `(tenant_id,created_at DESC)`, `(tenant_id,skill,created_at DESC)` | 2 — tenant + super_admin (cross) |
| `ai_user_preferences` | não | unique `(tenant_id,user_id)` | 4 — tenant + dono |
| `ai_metrics_daily` | não | `(tenant_id,day DESC)`; unique `(tenant_id,user_id,day,skill,capability)` | 3 — tenant + super_admin |

Todas usam `current_tenant_id()` e `is_super_admin(auth.uid())` reaproveitando as funções existentes. Nenhuma PII clínica/financeira é armazenada — apenas IDs, métricas e metadata neutra.
