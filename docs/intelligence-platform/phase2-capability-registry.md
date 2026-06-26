# Phase 2 — Capability Registry

Fonte de verdade dupla, sincronizada manualmente:

- **Server** (`supabase/functions/ai-chat/registry.ts`): controla o que o LLM pode chamar. Cada item declara `id`, `skill`, `description`, `permission`, `needsApproval`, `category`, `baselineSeconds`, `baselineClicks`.
- **Client** (`src/lib/ai/capabilityRegistry.ts`): espelho mínimo para Quick Actions, com `enabled` e `promptTemplate`.

Capacidades registradas nesta fase:
| ID | Skill | Permissão | Approval | Baseline (s / cliques) |
|---|---|---|---|---|
| `paciente.search` | paciente | `visualizar_pacientes` | não | 20 / 4 |
| `paciente.create` | paciente | `cadastrar_paciente` | sim | 90 / 12 |
| `atendimento.create` | atendimento | — | — | placeholder desabilitado |

O Assistente NUNCA acessa tabelas/stores/RPCs diretos — apenas Capabilities.
