# 15 — Enterprise Readiness

Notas baseadas nas evidências das partes 01–14. Escala 0–100.

| Dimensão | Score | Justificativa |
|---|---|---|
| **Shared** | **90%** | Produto opera em produção; RLS consistente; auditoria por tabela; único gap = observabilidade de runtime |
| **Dedicated** | **20%** | Estrutura criada (Factory, DedicatedStrategy, allowlist, provisionamento), mas Auth quebra, edge fns não migradas, Realtime/RPC/Storage no shared |
| **Runtime (Frontend)** | **65%** | Proxy roteador + fail-open + cache + telemetria dev; falta TTL, sink de prod, adoção completa (4 arquivos ainda com bypass) |
| **Runtime (Server)** | **25%** | Chokepoint SDK adotado 100%; `getTenantClient` fail-closed para dedicated e não consumido por nenhuma fn |
| **Storage** | **10%** | Bucket único, sem resolver, sem migração binária, `storage_namespace` inutilizado |
| **Auth** | **15%** (dedicated) / **95%** (shared) | Sem federação de JWT; login-gate existe mas resolve apenas presença de perfil |
| **Edge Functions** | **30%** | 79/79 usam chokepoint; 0/79 usam roteamento tenant-aware para dedicated |
| **Observabilidade** | **35%** | Auditoria tabular robusta no shared; runtime telemetry dev-only; sem tracing; health por tenant básico |
| **Operação (provisionamento + migração)** | **55%** | Wizard SuperAdminMigration + 10+ fns; contornos manuais (criar projeto Supabase por fora); rollback existe mas não faz merge |
| **Enterprise (multi-projeto, KMS, SLA)** | **20%** | Cap 100 secrets/env; sem vault; sem SLA por tenant; sem tracing |

## Score consolidado

- **Shared em produção**: **~90%** — pronto para produção multi-tenant compartilhada.
- **Dedicated end-to-end**: **~20%** — infraestrutura de trilhos, ainda sem trem.
