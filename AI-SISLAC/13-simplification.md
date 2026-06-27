# 13 — Simplificação

## Componentes que poderiam desaparecer sem perda funcional

| Componente | Linhas | Justificativa | Risco de remover |
|---|---|---|---|
| `src/lib/ai/manifestClient.ts` | 117 | Zero consumidor. | Nenhum |
| `src/lib/ai/contextEngine.ts` | 78 | Zero consumidor. `parseLocalIntent` resolve navegação direto. | Nenhum |
| `supabase/functions/ai-manifest/` | 22 | Servido para o `manifestClient` órfão. | Nenhum |
| Tabelas `ai_threads`, `ai_messages`, `ai_user_preferences`, `ai_metrics_daily` | — | Modeladas, nunca usadas. | Nenhum (DROP cascata via migração) |
| Campos `quickAction`, `supportsSuggestions`, `icon`, `color`, `priority`, `baselineSeconds`, `baselineClicks`, `promptTemplate`, `actions[]`, `findCapability()` em `registry.ts` | ~80 | Apenas o `id`, `description`, `permission`, `needsApproval`, `category` são usados pelo `ai-chat`. | Nenhum |
| `docs/assistant-knowledge/*.md` (15 arquivos) | ~650 | Não carregado em runtime. | Nenhum (ou ativar RAG) |
| `docs/intelligence-platform/` (78 docs) | ~3500 | Histórico de fases já encerradas. Consolidar em 3-5 docs vivos. | Nenhum |
| `resultado.set_valor` | — | Subconjunto de `set_varios`. | Baixo |

## Componentes que poderiam ser fundidos
- `ai-speak` + `ai-transcribe` → não vale fundir (semânticas diferentes), mas o **bootstrap** (`aiAuth`) pode evitar `auth.getUser` redundante via cache.
- `parseLocalIntent` (frontend) + `moduleFromPath` (contextEngine) + lista de rotas no system prompt → uma única **tabela de rotas** importada nos 3 lugares.

## Abstrações que não agregam valor
- "Skill Engine" — é apenas um spread de objetos.
- "Action Engine" — é apenas o `execute` da AI SDK.
- "Manifest" — modelo de dados sem UI consumidora.
- "Capability Discovery" — função existe, nunca chamada.

## Princípio da simplicidade
Substituiríamos hoje:
```
Capability Registry (273 LoC) + Manifest + Discovery + Quick Actions + Memory
```
por:
```
8 tools exportadas em 3 arquivos + has_permission inline + system prompt
```
sem perda funcional, com ~400 LoC a menos e -4 tabelas.
