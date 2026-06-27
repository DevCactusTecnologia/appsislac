# Cleanup Report — AI-SISLAC 2.0

## Arquivos removidos

### Frontend (3)
- `src/lib/ai/manifestClient.ts`
- `src/lib/ai/contextEngine.ts`
- `src/lib/ai/capabilityRegistry.ts`
- Diretório `src/lib/ai/` removido.

### Edge Functions (1 função inteira)
- `supabase/functions/ai-manifest/` (deploy + código)

### Documentação consolidada (5 árvores → 1)
- `docs/intelligence-platform/` (≈80 arquivos)
- `docs/ai-agent-1.0/` (10 arquivos)
- `docs/ai-agent-rollback/` (6 arquivos)
- `docs/assistant-knowledge/` (15 arquivos)
- `AI-SISLAC/` (15 arquivos de radiografia)
- **Total**: ~126 documentos antigos → 7 documentos novos em `docs/AI-SISLAC/`.

### Banco de dados (4 tabelas)
- `public.ai_threads`
- `public.ai_messages`
- `public.ai_user_preferences`
- `public.ai_metrics_daily`
- Todas com policies, índices e triggers removidos via `DROP TABLE CASCADE`.

## Código reduzido em arquivos vivos

| Arquivo                                     | Antes | Depois | Δ      |
|---------------------------------------------|-------|--------|--------|
| `supabase/functions/_shared/registry.ts`    | 273   | ~90    | -183   |
| `supabase/functions/_shared/aiAuth.ts`      | 73    | ~75    | ~0 (reorganizado, paraleliza permissões) |
| `supabase/functions/ai-chat/index.ts`       | 155   | ~150   | reorg (prompts split + audit por step) |
| `supabase/functions/ai-chat/skills/resultado.ts` | 272 | ~190   | -82 (fusão set_valor+set_varios) |

## Dead code remanescente

Nenhum. Varredura final:
- `rg -l "@/lib/ai/"` → zero matches.
- `rg -l "ai-manifest|manifestClient|contextEngine|buildManifest|findCapability\b|MANIFEST_VERSION"` → zero matches no código vivo.
