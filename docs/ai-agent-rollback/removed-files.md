# Arquivos Removidos — AI Agent 1.1

## Frontend
- `src/pages/AgentPage.tsx`
- `src/components/Agent/ChatInterface.tsx` (+ diretório `src/components/Agent/`)
- `src/hooks/agent/useAgent.ts`
- `src/hooks/agent/useVoice.ts` (+ diretório `src/hooks/agent/`)
- `src/lib/agent/prompts.ts`
- `src/lib/agent/validators.ts` (+ diretório `src/lib/agent/`)
- `src/types/agent.ts`
- `src/__tests__/agent.test.ts`

## Backend
- `supabase/functions/chat-agent/index.ts` (+ diretório `supabase/functions/chat-agent/`)
- `supabase/migrations/20240126_agent_tables.sql` (migration nunca aplicada)

## Infra
- `deploy-agent.sh`

## Edições no App
- `src/App.tsx`: removido `lazy(() => import("./pages/AgentPage"))` e `<Route path="/agent" ... />`.

**Total: 11 arquivos + 2 trechos em `App.tsx`.**
