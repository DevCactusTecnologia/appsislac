# 11 — Runtime Simplification Review

## Princípio

O SISLAC não é framework. O único objetivo do Runtime é:

```
Shared Database  →  Dedicated Database  →  Fim.
```

Toda abstração precisa provar que **reduz complexidade** ou **resolve algo que `getTenantClient()` não resolve sozinho**. Caso contrário, sai.

## Revisão componente-a-componente

| # | Componente | Problema real | Absorvível por `getTenantClient()`? | Arquivos | Veredito | Ação |
|---|---|---|---|---|---|---|
| 1 | `runtime/db/index.ts` (`db` proxy) | Ponto único de entrada do domínio | — (ele É o Runtime) | 1 | **INDISPENSÁVEL** | manter |
| 2 | `runtime/db/factory.ts` | Cache dual shared+dedicated por contexto | — | 1 | **INDISPENSÁVEL** | manter |
| 3 | `runtime/db/tenantContext.ts` | Descobre tenant + credenciais (client) | — | 1 | **INDISPENSÁVEL** | manter |
| 4 | `runtime/db/resolver.ts` | Adapta `TenantContext` legado → `TenantRuntimeContext` novo | Poderia colapsar em `factory.ts` | 1 | **PARCIAL** | manter (custo de merge > benefício hoje) |
| 5 | `runtime/db/strategies/{shared,dedicated}.ts` | Duas fábricas de client | Poderia ser 2 funções em factory | 2 | **PARCIAL** | manter (isolam config por strategy) |
| 6 | `runtime/db/telemetry.ts` | Emite eventos runtime | — (obrigatório para observability) | 1 | **INDISPENSÁVEL** | **REDUZIR** para 4 eventos (Slice 2) |
| 7 | `runtime/db/types.ts` + `MigrationBlockedError` | Contratos + erro tipado | — | 1 | **INDISPENSÁVEL** | manter |
| 8 | `runtime/identity/` (issuer + supabaseIssuer) | Desacoplar app do provedor de auth | Não — `getTenantClient` não trata identidade | 2 | **INDISPENSÁVEL** | manter + **wire no bootstrap** |
| 9 | `_shared/runtime/createClient.ts` (server) | Chokepoint SDK server | — | 1 | **INDISPENSÁVEL** | manter |
| 10 | `_shared/runtime/db.ts` (`getPlatformClient/getUserClient/getTenantClient`) | Fábrica server tenant-aware | — (é o próprio primitivo) | 1 | **INDISPENSÁVEL** | manter + **acrescentar `getUserTenantClient`** |
| 11 | `_shared/runtime/tenantContext.ts` (`TenantContextProvider`) | Abstrai origem de metadados | Sim — hoje só tem 1 impl | 1 | **PARCIAL** | manter (custo de inline > benefício) |
| 12 | `_shared/runtime/identity.ts` (validator) | Extrai claims do JWT server | Não — `getTenantClient` não valida JWT | 1 | **INDISPENSÁVEL** | manter |

## Componentes deliberadamente NÃO criados

Conforme princípio "menos código":

| Camada | Decisão | Justificativa |
|---|---|---|
| `StorageRuntime` | **NÃO criar** | `getTenantClient().storage` resolve. Bucket namespacing por convenção. |
| `RealtimeRuntime` | **NÃO criar** | `getTenantClient().channel(...)` resolve. Reconnect após flip via `resetRuntime()`. |
| `RpcRouter` / `RpcRegistry` | **NÃO criar** | `getTenantClient().rpc(...)` resolve. RPC segue o mesmo caminho da tabela. |
| `HealthMonitor` dedicado | **NÃO criar** | `dedicatedHealth(tenant_id)` já existe como função pura em `db.ts`. |
| `RetryPolicy` explícita | **NÃO criar (por ora)** | SDK Supabase já retenta HTTP. Circuit breaker adiado para quando houver dor real. |
| `CanaryOrchestrator` | **NÃO criar** | `runtime_status='canary'` + allowlist na tabela `tenant_registry` — dado, não código. |
| `MigrationVersioning` framework | **NÃO criar** | `SCHEMA_MINIMO_V1` + migrations lineares no Shared. |
| `StateMachine` de tenant | **NÃO criar** | Coluna `runtime_status` (`active|suspended|provisioning|canary`) é a máquina. |

## Contagem

- Abstrações **removidas neste slice**: 0 (já minimalista).
- Abstrações **evitadas** (não criadas): 8.
- Arquivos runtime totais: **14** (995 linhas). Sem crescimento.

## Conclusão

O Runtime atende **todos** os critérios exigidos:
- ✔ resolve problema real (roteamento shared/dedicated)
- ✔ não pode ser absorvido por primitivo menor
- ✔ código mínimo (~1k linhas totais)
- ✔ acoplamento mínimo (domínio só conhece `db`)
- ✔ legível (arquivos < 170 linhas)

**Nenhum componente removido. Nenhum componente adicionado além do estritamente necessário para Slice 2.**
