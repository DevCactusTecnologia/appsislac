# Fase 2.1 — Capability SSOT

## Princípio
Existe **um único Capability Registry**: `supabase/functions/ai-chat/registry.ts`.
Nenhum outro arquivo do projeto pode declarar Capabilities. O frontend consome um
**Manifest** derivado automaticamente do Registry via Edge Function `ai-manifest`.

## Antes
- `supabase/functions/ai-chat/registry.ts` (LLM)
- `src/lib/ai/capabilityRegistry.ts` (Quick Actions/Sugestões) ← duplicação manual

## Depois
- `supabase/functions/ai-chat/registry.ts` — **SSOT**, declara Capabilities + `buildManifest()`.
- `supabase/functions/ai-manifest/index.ts` — Edge function pública (autenticada) que devolve o Manifest filtrado.
- `src/lib/ai/manifestClient.ts` — único consumidor no frontend; cache em memória; hook `useManifest()` + `discoverCapabilities()`.
- `src/lib/ai/capabilityRegistry.ts` — **REMOVIDO**.

## Garantias
- O Manifest contém apenas metadados de interface (id, title, description, category, visibility, priority, icon, color, enabled, needsApproval, baselines, permission).
- O Manifest **nunca** expõe tools, SQL, services, secrets.
- Validação em cold-start: build/edge falha se uma Capability não tiver os campos obrigatórios.
- Duplicidade de `id` lança erro no boot do Registry.
