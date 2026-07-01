# 16 — Executive Report

## Contexto

Radiografia exclusivamente diagnóstica (sem alterações de código) do estado da arquitetura Shared → Dedicated do SISLAC, com base no código presente em `src/runtime/db/`, `supabase/functions/`, `supabase/migrations/` e schema real do `tenant_registry`.

## Veredito

O SISLAC opera com excelência em **Shared Database** (score ~90%). O caminho para **Dedicated Database** foi parcialmente pavimentado — existem trilhos (Runtime Factory + Strategies + Provider + wizard de migração), mas o "trem" (Auth federado, edge functions tenant-aware, Storage por projeto, Realtime por projeto, RPC replicadas) ainda não circula. Score de prontidão Dedicated **~20%**.

## Tabela final — TODOS os componentes

| Componente | Shared | Dedicated |
|---|---|---|
| **Runtime — Factory + Cache** | ✓ | △ (sem TTL, sem invalidação distribuída) |
| **Runtime — SharedStrategy** | ✓ | n/a |
| **Runtime — DedicatedStrategy (front)** | n/a | ✓ (funcional, com fallback) |
| **Runtime — DedicatedStrategy (server / `getTenantClient`)** | n/a | ✗ (fail-closed) |
| **Runtime — Porta única `db`** | ✓ | △ (só `db.from` em allowlist de 4 tabelas) |
| **Runtime — Telemetria** | △ (dev only) | △ (dev only) |
| **Tenant Registry** | ✓ | ✓ (schema pronto) |
| **`storage_namespace`** | n/a | ✗ (coluna morta) |
| **Auth (login)** | ✓ | ✗ (JWT mismatch) |
| **Auth — `current_tenant_id()`** | ✓ | ✗ (retorna NULL no dedicated) |
| **Auth — login gate dedicated** | n/a | △ (bloqueia se sem perfil no dedicated) |
| **Profiles** | ✓ | ✗ (não replicado) |
| **User Roles** | ✓ | △ (migração existe, sem `tenant_id`) |
| **RLS (todas as tabelas de domínio)** | ✓ | ✗ (sem `auth.uid()`) |
| **Storage — buckets** | ✓ | ✗ (bucket único no shared) |
| **Storage — signed URLs / upload / download** | ✓ | ✗ |
| **Realtime — `subscribeAtendimentos`** | ✓ | ✗ (canal no shared) |
| **RPC — `update_atendimento_tx`** | ✓ | ✗ (só existe no shared) |
| **RPC — sequences (`friendly_id`, `guia`, `protocolo`)** | ✓ | ✗ |
| **RPC — `is_super_admin`, `has_permission`, `has_role`** | ✓ | ✗ |
| **Migrations — 351 arquivos linear** | ✓ | ✗ (schema dedicated é `SCHEMA_MINIMO_V1`) |
| **Edge fn — chokepoint SDK (`_shared/runtime/createClient`)** | ✓ (79/79) | ✓ (chokepoint) |
| **Edge fn — `super-admin-*` (control-plane)** | ✓ | ✓ (correto ficar no shared) |
| **Edge fn — data-plane (`create-atendimento`, `update-atendimento`, `sign-resultado`, `admin-*`, `whatsapp-*`, `lab-apoio-*`, `integration-*`, `lgpd-*`)** | ✓ | ✗ (escrevem no shared) |
| **Edge fn — Storage (`upload-*`, `image-url`, `comprovante-*`)** | ✓ | ✗ |
| **Edge fn — `tenant-runtime-config`** | ✓ | ✓ |
| **Edge fn — `tenant-dedicated-login-gate`** | n/a | △ (só valida perfil) |
| **Edge fn — `super-admin-provision-tenant-schema-full`** | n/a | ✓ (async, com corrigidos recentes) |
| **Edge fn — `super-admin-migrate-tenant-auth`** | n/a | △ (recém-corrigida) |
| **Edge fn — `super-admin-migrate-tenant-data`** | n/a | △ (existe, não validada nesta radiografia) |
| **Edge fn — `super-admin-migrate-tenant-storage`** | n/a | ✗ (metadata only) |
| **Edge fn — `super-admin-migration-flip` / `-rollback` / `-smoke-test`** | n/a | △ (existem) |
| **Observabilidade — auditoria tabular** | ✓ | ✗ (auditoria fica no shared) |
| **Observabilidade — tracing** | ✗ | ✗ |
| **Observabilidade — métricas por tenant** | △ | ✗ |
| **Secrets — cap 100/env** | n/a | ✗ (>100 tenants inviável) |
| **Frontend — hooks/stores/pages** | ✓ | △ (só 4 tabelas allowlist roteadas) |
| **Frontend — bypass `VITE_SUPABASE_URL` direto** | △ (4 arquivos) | △ |
| **Wizard SuperAdminMigration (`Fase 3`)** | ✓ | ✓ |

## Recomendação de escala

- ✓ **10 clientes** — arquitetura shared atende com folga; dedicated viável só como piloto POC (com aceitação dos gaps).
- ✓ **100 clientes** — shared atende; dedicated **inviável** (cap de secrets + Auth mismatch).
- △ **500 clientes** — shared exige revisão de índices em tabelas cross-tenant (`select_options`, `profiles`, `atendimentos`); dedicated inviável.
- ✗ **1000 clientes** — shared requer particionamento lógico por `tenant_id`; dedicated inviável sem KMS/vault + federação de JWT.
- ✗ **5000 / 10000 clientes** — não sustentado nem por shared nem por dedicated no estado atual.

## Justificativa técnica (sintética)

Shared escala vertical + índices + particionamento em tabelas de alto volume. Dedicated exige, no mínimo: (a) federação de JWT ou custom-signed JWT por projeto, (b) refatoração das ~50 edge functions de data-plane para `getTenantClient` funcional, (c) migração real de Storage e Realtime por tenant, (d) substituição do modelo "env var por secret" por um vault (Doppler/Vault/SOPS/KMS). Enquanto (a)–(d) não existirem, cada tenant "dedicated" hoje opera em modo degradado silencioso: escreve em dois lugares, lê de dois lugares, e Realtime/RPC ficam mudos.

---

**RADIOGRAFIA CONCLUÍDA**
