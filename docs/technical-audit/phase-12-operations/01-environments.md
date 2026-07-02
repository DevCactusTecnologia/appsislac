# 01 — Environments

## Evidências

| Ambiente | Evidência no repo | Status |
|---|---|---|
| Desenvolvimento (local Vite `localhost:8080`) | `vite.config.ts`, `.env` publishable | ✓ COMPROVADA |
| Homologação (staging) | Nenhum workflow, branch ou variável dedicada. `.github/workflows/ci.yml` roda em `main`/`develop`, sem deploy staging | ✗ NÃO ENCONTRADA |
| Produção (`appsislac.lovable.app`) | Lovable Cloud + custom URL declarada | ✓ COMPROVADA |
| Canary / Blue-Green | Nenhuma configuração | ✗ NÃO ENCONTRADA |
| Multi-tenant Shared DB | `tenant_registry.runtime_mode='shared_db'` | ✓ COMPROVADA |
| Multi-tenant Dedicated DB | `tenant_registry.runtime_mode='isolated_db'`, `db_secret_ref`, edges `super-admin-migrate-*` | ✓ COMPROVADA |

## Separação

- Um único projeto Lovable Cloud (`xhaeozwdfjuvpxgguqqp`). Dev/Prod compartilham o mesmo backend.
- Isolamento entre tenants via RLS + `current_tenant_id()`; tenants dedicated via secret `SB_SERVICE_ROLE_<ref>`.

## Achados
| # | Item | Severidade |
|---|---|---|
| ENV01 | Sem ambiente de staging/homologação | ALTO |
| ENV02 | Sem canary/blue-green | MÉDIO |
| ENV03 | Dev e Prod usam o mesmo Cloud backend | ALTO |
