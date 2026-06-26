# Phase 2 — Edge `ai-chat`

Única boundary entre frontend e LLM. Em `supabase/functions/ai-chat/`.

## Responsabilidades implementadas
- Valida `Authorization: Bearer <jwt>` via `admin.auth.getUser`.
- Resolve tenant **server-side** via `userClient.rpc("current_tenant_id")`. Frontend NÃO envia tenant.
- Filtra `CAPABILITIES` por `has_permission(user, capability.permission)` antes de expor tools.
- Carrega contexto recebido (route/module/focus) apenas como hint para o system prompt — nunca confiado para autorização.
- Usa Lovable AI Gateway (`google/gemini-3-flash-preview`) via `@ai-sdk/openai-compatible`.
- Streaming via `streamText` + `toUIMessageStreamResponse`.
- Auditoria automática em `ai_audit` no `onFinish` e em qualquer falha de stream.

## NÃO faz
- SQL direto, lógica de negócio, bypass de RLS, aceitar tenant_id do frontend.

## Arquivos
- `index.ts` — handler.
- `registry.ts` — Capability Registry (fonte de verdade do que o LLM pode chamar).
- `skills/paciente.ts` — Tools com Zod, executadas via `userClient` (RLS aplica).
