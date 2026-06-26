# Consumer Migration — Fase 2.1

| Consumidor | Antes | Depois |
|---|---|---|
| Quick Actions (`AiShell`) | `CLIENT_CAPABILITIES` hardcoded | `useManifest()` + `discoverCapabilities({ quickActionOnly })` |
| Sugestões (`contextEngine`) | string hardcoded "Pesquisar histórico..." | derivada do Manifest filtrado por `supportsSuggestions` |
| Modo Assistente | grade lia `CLIENT_CAPABILITIES` | grade lê `ManifestItem[]` |
| Tool Calling (Edge) | `CAPABILITIES` direto | inalterado (mesma SSOT) |

## Arquivos tocados
- ✅ `supabase/functions/ai-chat/registry.ts` — extendido com title/category/visibility/priority/icon/color/quickAction/supportsSuggestions/actions + `buildManifest()` + validação.
- ✅ `supabase/functions/ai-manifest/index.ts` — **NOVO** endpoint.
- ✅ `src/lib/ai/manifestClient.ts` — **NOVO**, único consumidor frontend.
- ✅ `src/components/ai-shell/AiShell.tsx` — migrado para Manifest.
- ✅ `src/lib/ai/contextEngine.ts` — sugestões derivam do Manifest.
- ❌ `src/lib/ai/capabilityRegistry.ts` — **REMOVIDO**.

## Total
- 2 consumidores migrados (Quick Actions, Sugestões).
- 1 arquivo duplicado removido.
- 0 listas hardcoded restantes.
