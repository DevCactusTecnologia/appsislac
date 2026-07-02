# 10 — Matriz de Dependências

## Grafo lógico
```
Frontend
  └─ supabase-js (client.ts, anon + JWT)
        └─ Edge Function (Deno)
              ├─ _shared/edgeBoot.ts
              │     └─ _shared/integrationLog.ts
              │           └─ _shared/runtime/createClient.ts   ← chokepoint
              ├─ _shared/runtime/db.ts
              │     └─ _shared/runtime/createClient.ts
              │     └─ tenant_registry (Postgres)
              ├─ _shared/drivers/pipeline.ts
              │     ├─ circuit.ts → RPC circuit_*
              │     ├─ dlq.ts     → integration_dead_jobs
              │     ├─ health.ts  → integration_health
              │     └─ drivers/*/driver.ts
              │           └─ _shared/drivers/transports/
              └─ RPC (Postgres, SECURITY DEFINER)
                    └─ RLS (current_tenant_id / is_super_admin / has_permission)
                          └─ Tabelas de domínio
                                └─ Triggers audit_*
```

## Matriz Edge × Runtime × RPC × Integração
| Edge | Runtime helper | RPC principal | Integração externa |
|---|---|---|---|
| `create-atendimento` | getUserClient | `create_atendimento_tx` | — |
| `update-atendimento` | getUserClient | `update_atendimento_tx` | — |
| `sign-resultado` | getUserClient | `sign_laudo_tx` | Storage (assinatura) |
| `integration-dispatch` | getPlatformClient | `claim_integration_jobs`, `circuit_*` | Hermes/DBSync |
| `integration-jobs-runner` | getPlatformClient | `claim_integration_jobs` | driver alvo |
| `ai-chat` | edgeBoot | — | Lovable AI Gateway |
| `whatsapp-webhook` | getPlatformClient | — | Meta Cloud API |
| `tenant-resolve` | getPlatformClient | — | — |
| `super-admin-*` | getPlatformClient + revalidar `is_super_admin` | `super_admin_*` | Supabase Admin API |
| `lgpd-*` | edgeBoot | audit_* / soft delete RPCs | — |
| `upload-*` | getUserClient | — | Storage |
| `leads-manager` | getPlatformClient | — | Rate-limit |

## Fan-in (mais dependido)
1. `_shared/runtime/createClient.ts` — 54 edges.
2. `_shared/integrationLog.ts` — 32 edges + pipeline.
3. `_shared/runtime/db.ts` — 14 edges.
4. RPC `is_super_admin()` — 24 edges super-admin.
5. RPC `current_tenant_id()` — 373 policies.

## Fan-out (mais depende)
1. `_shared/drivers/pipeline.ts` — usa 5 módulos + N drivers + 3 RPCs.
2. `super-admin-migrate-tenant-data` — usa runtime, admin API, RPCs de dump/list.
3. `integration-dispatch` — registry + circuit + dlq + health + driver.
