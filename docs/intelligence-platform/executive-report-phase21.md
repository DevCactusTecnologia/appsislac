# Fase 2.1 — Relatório Executivo

## Entregáveis (objetivo)
| Pergunta | Resposta |
|---|---|
| Existe apenas um Capability Registry? | **Sim** — `supabase/functions/ai-chat/registry.ts`. |
| O frontend deixou de manter Capabilities próprias? | **Sim** — `src/lib/ai/capabilityRegistry.ts` foi removido. |
| O Manifest é derivado automaticamente? | **Sim** — `buildManifest()` + Edge `ai-manifest`. |
| Quick Actions usam exclusivamente o Manifest? | **Sim**. |
| Suggestions usam exclusivamente o Manifest? | **Sim**. |
| O Discovery funciona automaticamente? | **Sim** — `discoverCapabilities()` aplica visibility/priority/category/contexto. |
| Existe qualquer duplicação restante? | **Não**. `rg` confirma 0 referências a `CLIENT_CAPABILITIES`. |
| Quantos consumidores foram migrados? | **2** (Quick Actions, Sugestões). |
| Houve regressão? | **Não** — Tool Calling, RLS, Audit intactos. |
| O Capability Registry é a única fonte oficial? | **Sim**. |

## Arquivos
- **Novo**: `supabase/functions/ai-manifest/index.ts`, `src/lib/ai/manifestClient.ts`.
- **Alterado**: `supabase/functions/ai-chat/registry.ts` (+ campos SSOT + validação + `buildManifest`), `supabase/functions/ai-chat/index.ts` (label→title), `src/components/ai-shell/AiShell.tsx`, `src/lib/ai/contextEngine.ts`.
- **Removido**: `src/lib/ai/capabilityRegistry.ts`.

## Governança nova
Proibido declarar Capabilities fora de `supabase/functions/ai-chat/registry.ts`.
Toda nova Capability nasce no Registry; Manifest é derivado automaticamente.

## PARADO
Sem novas Skills. Sem novas Actions. Sem Fase 3. Aguardando aprovação explícita.
