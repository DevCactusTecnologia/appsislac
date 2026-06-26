# Fase 2.2 — Hardening do Core

**Objetivo:** endurecer arquitetura, eliminar complexidade, congelar o Core.
**Resultado:** Core operacional, enxuto e estável. 860 LoC totais distribuídos em 8 arquivos.

## Mudanças aplicadas

### 1. AiShell — visibilidade em transições de rota (crítico)
**Antes:** `AiShell` era irmão de `<Routes>` dentro do mesmo `<Suspense>` que envolvia `AppLayout`. Toda rota `lazy()` que entrava em suspensão acionava o fallback global e **removia o avatar da árvore** durante a transição.
**Depois:** dois `Suspense` aninhados em `AppLayout`:
- Suspense interno (`fallback={<PageLoader/>}`) envolve apenas `<Routes>`.
- Suspense próprio (`fallback={null}`) envolve `<AiShell />`, garantindo que ele permaneça montado durante navegação.

### 2. Edge Functions — bootstrap consolidado
**Antes:** `ai-chat` (155 LoC) e `ai-manifest` (69 LoC) repetiam CORS, validação de JWT, resolução de tenant e o loop de permissões.
**Depois:** novo `_shared/aiAuth.ts` (73 LoC) consolida:
- `aiCorsHeaders` + `jsonResponse()`
- `authenticate(req)` — JWT → tenant → clientes prontos.
- `resolveAllowedCapabilities()` — filtro único de permissões por capability.

Resultado:
| Arquivo | Antes | Depois | Redução |
| --- | --- | --- | --- |
| `ai-chat/index.ts` | 155 | 93 | -40% |
| `ai-manifest/index.ts` | 69 | 22 | -68% |

Zero duplicação restante entre as duas funções.

### 3. Limpeza
- Removidas declarações redundantes de `corsHeaders` e blocos duplicados de bootstrap.
- Nenhum `TODO`/`FIXME`/`console.log`/feature flag introduzido pelo Core (`rg` em `src/components/ai-shell/`, `src/lib/ai/`, `supabase/functions/ai-*`, `_shared/aiAuth.ts`, `_shared/registry.ts` → 0 ocorrências).

## Métricas após hardening

| Componente | LoC |
| --- | --- |
| `AiShell.tsx` | 243 |
| `contextEngine.ts` | 78 |
| `manifestClient.ts` | 116 |
| `ai-chat/index.ts` | 93 |
| `ai-manifest/index.ts` | 22 |
| `_shared/registry.ts` (SSOT) | 165 |
| `_shared/aiAuth.ts` | 73 |
| `skills/paciente.ts` | 70 |
| **Total** | **860** |

Arquivos do Core: 8. Edge Functions: 2. Tabelas: 5 (intactas desde Fase 2). Nenhuma camada adicionada.
