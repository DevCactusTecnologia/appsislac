# AI Agent 1.0 — Inventário

## Arquivos da implementação

| Arquivo | Linhas | Consumido por |
|---|---:|---|
| `src/pages/AgentPage.tsx` | 23 | rota `/agent` em `src/App.tsx:355` |
| `src/components/Agent/ChatInterface.tsx` | 146 | apenas `AgentPage` |
| `src/hooks/agent/useAgent.ts` | 83 | apenas `ChatInterface` |
| `src/hooks/agent/useVoice.ts` | 109 | apenas `ChatInterface` |
| `src/lib/agent/prompts.ts` | 43 | **nenhum consumidor** (morto) |
| `src/lib/agent/validators.ts` | 80 | apenas `src/__tests__/agent.test.ts` |
| `src/types/agent.ts` | 42 | `useAgent` |
| `src/__tests__/agent.test.ts` | 87 | testes |
| `supabase/functions/chat-agent/index.ts` | 110 | rota `/agent` via `fetch('/functions/v1/chat-agent')` |
| `supabase/migrations/20240126_agent_tables.sql` | 53 | **nunca executada** |

**Total**: ~776 LOC, todas dependentes de uma única rota (`/agent`) que **não está exposta em nenhum menu/sidebar**.

## Tabelas / RPCs / Feature flags

- `agent_audit_log` — **não existe no banco** (migration falha; ver `architecture-audit`).
- `feature_flags` — migration tenta criar duplicado; o projeto já tem `featureFlags.ts` em outro padrão.
- RPC: nenhuma.
- Permissões: rota usa `permissao="visualizar_dashboard"` — não há permissão dedicada.

## Conclusão

**Uma única implementação**, isolada, sem duplicação interna, mas:
- `prompts.ts` é código morto (nunca importado).
- A rota `/agent` é órfã (sem entrada de menu).
- Toda a cadeia depende de uma edge function que não funciona (ver `architecture-audit`).
