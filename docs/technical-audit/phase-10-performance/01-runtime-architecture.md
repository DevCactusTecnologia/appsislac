# 01 — Runtime Architecture

## Componentes por modo de execução

| Modo | Componente | Evidência |
|---|---|---|
| **Contínuo** | Postgres (Lovable Cloud) | `db_health`: up, 16/60 conexões, 1/200 pool clients |
| Contínuo | PgBouncer | `db_health`: up |
| Contínuo | Vite dev server (build) / SPA estática (prod) | `vite.config.ts`, deploy Lovable |
| **Sob demanda** | 74 Edge Functions (isolate ephemeral por request) | `ls supabase/functions` = 74 |
| Sob demanda | PostgREST (REST/RPC) | Cloud-managed |
| Sob demanda | Storage HTTP API (8 buckets) | Fase 09 §07 |
| **Background** | `whatsapp-dispatcher`, `integration-jobs-runner`, `integration-poll-results`, `lab-apoio-cron-fetch`, `whatsapp-template-sync`, `provider-catalog-import`, `provider-health-aggregator` | Nomes de functions |
| Background | `sitemap`, `super-admin-migration-*` (batelada) | idem |
| **Por evento** | `whatsapp-webhook` (público) | verify_jwt=false |
| Por evento | Realtime `postgres_changes` (front) | 7 arquivos em `src/` |
| Por evento | 211 triggers PL/pgSQL | `information_schema.triggers` |

## Chokepoints

- Data plane: `src/runtime/db.ts` → `getUserTenantClient` (front) / `_shared/migration/connect.ts` (edges).
- Auth plane: singleton `@/integrations/supabase/client`.
- Identidade tenant: `current_tenant_id()` SECURITY DEFINER.

## Conclusão

Runtime híbrido serverless + Postgres gerenciado. Nenhum processo residente da aplicação: escala vertical do banco é o eixo dominante; escala horizontal é delegada aos isolates de Edge Functions.
