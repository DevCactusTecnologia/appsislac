# 14 — Executive Summary

## O que foi construído
Uma plataforma completa (pipeline + runtime + docs) para migrar tenants do banco Shared para bancos Dedicated (um projeto Supabase por tenant). O trabalho abrange:

- 44 arquivos novos de código (~8.100 linhas).
- 43 documentos (~15.000 linhas).
- 20 edge functions dedicated-specific (provisionamento, validação, migração em 3 camadas, flip, rollback, purge).
- 5 migrations em `tenant_registry` (control-plane).
- Um runtime cliente com fachada `db`, factory, duas strategies e Identity Layer.
- Um runtime servidor com fachada de clients tenant-aware + helpers de migração.
- Guardrail CI e template de migração de domínio para futuros slices.

## O que está ativo em produção
- 12 edge functions consumindo `getPlatformClient` / `getUserClient` / `getUserTenantClient` — sempre pela ramificação `shared`.
- Fachada `db` (client) — chamada apenas por `AuthContext`.
- Identity Layer — registrado no boot, sem call-sites.
- Zero tenants em modo dedicated.

## O que ainda não foi provado em produção
- Pipeline completo `provision → migrate-auth → migrate-data → migrate-storage → flip`.
- Roteamento por tabela via `allowed_tables` (allowlist sempre vazia).
- Cache LRU dedicado (cliente e servidor).
- `dedicatedHealth`, `invalidateDedicatedCache`, `installTenantAuthInvalidation`.

## Riscos / gaps documentados por evidência
1. **Duplicidade semântica** — `runtime_mode` vs `database_strategy` vs `runtime_dedicated_enabled` lidos por OR em 4 lugares diferentes.
2. **Duplicidade de credenciais** — três famílias de colunas (`db_host/port/...`, `db_project_url/anon_ref`, feature flag).
3. **Invalidação de cache não conectada** — `migration-flip` não chama `invalidateDedicatedCache`; clientes ativos continuariam apontando errado.
4. **Fachada `db` sem consumidores** — o app roda 100% no `supabase` singleton; a fachada não protege nada hoje.
5. **Identity Layer sem uso real** — abstração criada para troca futura de provedor; nenhum call-site.
6. **Documentação redundante** — 3 pastas descrevem o mesmo esforço em fases diferentes.

## Métricas de dispersão
- 3 fontes de leitura para o mesmo `tenant_registry`.
- 2 definições de `MigrationBlockedError` com códigos divergentes.
- 4 pontos de decisão “é dedicated?”.
- ~13 símbolos exportados sem consumidor.
