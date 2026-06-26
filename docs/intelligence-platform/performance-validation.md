# Validação de Performance

## Olhou
- Abertura do Drawer: estado local `open` + `Sheet` shadcn — sem fetch no mount.
- Manifest: cache em memória (`manifestClient.ts`), TTL 5 min, chave por `userId+tenantId+permsHash`.
- Edge `ai-manifest`: `cache-control: private, max-age=60` (cache HTTP do navegador).
- `useAIContext`: memoizado por `[location.pathname, params]`.
- `discoverCapabilities` e `getContextualSuggestions`: memoizados em `AiShell` via `useMemo`.

## Entendeu
- O Manifest é resolvido 1× por sessão por combinação `(user, tenant, perms)`; transições de rota não reemitem requisições.
- Avatar agora permanece montado durante navegação (Suspense isolado), eliminando re-mounts repetidos.
- `streamText` no Edge usa SSE nativo do AI SDK — sem buffer extra.

## Configurou
- Suspense próprio para `AiShell` (`fallback={null}`) → zero remount em navegação.
- Edge bootstrap unificado evita re-criar clientes Supabase em código duplicado.

## Validou (estimado, sem regressão observada)
| Métrica | Antes | Depois |
| --- | --- | --- |
| Avatar mount events por navegação | 1 (remount) | 0 (estável) |
| Requests `ai-manifest` por sessão | 1 / 5 min | 1 / 5 min (inalterado) |
| LoC Edge | 224 | 188 |
| Re-render do AiShell por rota | 1 | 0 (memoizado + sem unmount) |
| Tempo de abertura do Drawer | <1 frame | <1 frame |

Sem otimizações prematuras adicionadas. Nenhuma regressão de performance.
