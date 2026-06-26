# Simplificação do Core

## Olhou
| Componente | Antes | Depois |
| --- | --- | --- |
| `ai-chat/index.ts` | 155 LoC | 93 LoC |
| `ai-manifest/index.ts` | 69 LoC | 22 LoC |
| `_shared/aiAuth.ts` | (inexistente) | 73 LoC |
| **Total Edge** | 224 | 188 (-16%) |

## Entendeu
Duas Edge Functions repetiam: CORS, leitura de `Authorization`, criação de `admin`/`userClient`, `getUser(token)`, RPC `current_tenant_id`, loop de `has_permission` por capability.

## Configurou
- Novo `_shared/aiAuth.ts` consolida:
  - `aiCorsHeaders`, `jsonResponse()`.
  - `authenticate(req)` — devolve `{ admin, userClient, userId, tenantId, token }` ou `Response` de falha.
  - `resolveAllowedCapabilities(admin, userId)` — única implementação do filtro de permissões.
- `ai-chat` e `ai-manifest` reescritos para consumir o helper. Zero duplicação.

## Itens avaliados e mantidos (já estavam mínimos)
| Item | Decisão |
| --- | --- |
| `manifestClient.ts` (frontend) | Mantido — único consumidor do Manifest, sem duplicação. |
| `contextEngine.ts` | Mantido — 78 LoC, sem estado, sem helpers mortos. |
| `AiShell.tsx` | Mantido — UI única do Assistente, sem subcomponentes. |
| `registry.ts` (SSOT) | Mantido — única declaração de Capabilities. |

## Abstrações eliminadas
- Inline duplicado de CORS em ambas as Edges → 1 fonte (`aiCorsHeaders`).
- Bootstrap manual (JWT + tenant) em duas funções → 1 helper (`authenticate`).
- Loop de permissões reimplementado em duas funções → 1 helper (`resolveAllowedCapabilities`).
- Builder ad-hoc de `Response` JSON → `jsonResponse()`.

## Resultado
- **8 arquivos** no Core (sem variação no número de componentes, mas com menos LoC e zero duplicação).
- **0 helpers órfãos** detectados em `src/lib/ai/` e `supabase/functions/_shared/`.
- **0 listas hardcoded** de capabilities fora do registry.
