# AI Agent 1.0 — Relatório de Limpeza (proposta)

> **Nada foi removido nesta fase.** Memória do projeto exige confirmação explícita do usuário para alterar rotas e remover páginas. Este documento lista o que deve ser removido após aprovação.

## Código morto (sem consumidores)

- `src/lib/agent/prompts.ts` — nenhum import.

## Código órfão na prática (rota oculta + função quebrada)

- `src/pages/AgentPage.tsx`
- `src/components/Agent/ChatInterface.tsx`
- `src/hooks/agent/useAgent.ts`
- `src/hooks/agent/useVoice.ts`
- `src/types/agent.ts`
- `src/lib/agent/validators.ts`
- `src/__tests__/agent.test.ts`
- Rota `/agent` em `src/App.tsx:355` e o `lazy import` em `src/App.tsx:54`.

## Backend a remover

- `supabase/functions/chat-agent/` — depende de `ANTHROPIC_API_KEY` (não usar) e consulta tabela inexistente.
- `supabase/migrations/20240126_agent_tables.sql` — nunca executou; `laboratorios` não existe, `feature_flags` duplica padrão. Manter o arquivo no histórico mas garantir que o conteúdo não seja reaplicado; se for reescrever, fazer numa migration nova com `GRANT` e RLS conforme padrão SISLAC.

## Tabelas no banco

- `agent_audit_log` — **não existe**, nada a fazer.
- `feature_flags` (variante do agente) — não existe, nada a fazer.

## Secrets

- Confirmar que `ANTHROPIC_API_KEY` e `VITE_ELEVENLABS_KEY` **não** estão configurados; se estiverem, remover.

## Impacto estimado

- ~776 LOC removidos.
- 1 rota órfã eliminada.
- 1 edge function inutilizada eliminada.
- 0 regressão funcional (nada do produto consome esse módulo).
