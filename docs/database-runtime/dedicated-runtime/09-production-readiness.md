# 09 — Production Readiness

## Status atual (após Slice 1)

| Capacidade | Shared | Dedicated |
|---|---|---|
| Runtime front | ✓ | △ allowlist 4 tabelas |
| Runtime server (`getTenantClient`) | ✓ | **✓ (novo — Slice 1)** |
| Identity Layer | **✓ (novo — Slice 1)** | **✓ (novo — pendente federation manual)** |
| Fail-safe explícito | ✓ | **✓ (MigrationBlockedError — Slice 1)** |
| Edge Functions data-plane | ✓ | ✗ 43 pendentes |
| RPC roteado | ✓ | ✗ pendente |
| Storage runtime | ✓ | ✗ pendente |
| Realtime runtime | ✓ | ✗ pendente |
| Migration pipeline idempotente | n/a | △ parcial |
| Auditoria fim-a-fim | ✓ | ✗ pendente |
| Suite E2E dedicated | n/a | ✗ pendente |

## Prontidão

- **Shared**: 90% (inalterado).
- **Dedicated após Slice 1**: **35%** (fundação estrutural entregue; camadas data-plane pendentes).
- **Meta v1.0**: 95% após Slice 6.

## Bloqueadores para venda

1. Federation JWT ainda não configurada em nenhum projeto real → não é possível fazer login autenticado no Dedicated.
2. Edge functions data-plane ainda escrevem no Shared → duplicidade se `database_strategy='dedicated'`.
3. Storage/Realtime não migrados → inconsistência de arquivos e eventos.
4. Migration pipeline sem etapa `flip` atômica.

## Rollout seguro (D4 = canary)

Após S6:
- Tenant #1 canário (interno) → 7 dias observação.
- Ampliar allowlist para 3 tenants beta.
- Após 30 dias sem incidente → habilitar em produção geral.

Nenhum tenant Shared existente é afetado pela evolução.
