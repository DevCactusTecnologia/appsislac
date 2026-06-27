# 12 — Segurança

## Pontos fortes
- **JWT obrigatório** em todas as edges (`aiAuth.authenticate` retorna 401 sem token). ✅
- **Tenant resolvido server-side** via `current_tenant_id()` RPC; frontend nunca envia. ✅
- **RLS aplicada nas skills** via `userClient` (anon key + JWT). ✅
- **Permissões filtradas** antes de expor tools ao LLM (`resolveAllowedCapabilities`). ✅
- **Auditoria automática** de cada turno em `ai_audit` com `tenant_id`, `user_id`, `duration_ms`, `usage`. ✅
- **`LOVABLE_API_KEY` server-side only**. ✅

## Pontos fracos

1. **CORS `*`** em `aiCorsHeaders` (linha 8 `aiAuth.ts`). Aceitável para Lovable preview, mas vale revisar em produção.
2. **Auditoria pobre**: `skill: "router"` fixo, `capability/action: null` no INSERT do `onFinish`. Não dá para responder "qual usuário chamou `resultado.set_valor` ontem?". As tools rodam mas não geram registro por tool.
3. **`needsApproval` sem enforcement real**: a aprovação só existe no prompt; o LLM pode chamar `resultado_set_valor` sem qualquer confirmação UX. O `_confirmed: true` é injetado pelo próprio LLM. **Risco real de execução não confirmada.**
4. **Sem rate limit por usuário/tenant** nas edges `ai-chat`/`ai-speak`/`ai-transcribe`.
5. **Sem sanitização do `context`** recebido do cliente (linha 33 `ai-chat`). Hoje só é serializado no prompt — risco de prompt injection via `context.focus`.
6. **`token` retornado por `aiAuth`** mas não usado pelas Edges atuais. Excesso de superfície.
7. **`error_code` em ai_audit** usa string livre; sem enum.

## Tabelas órfãs com RLS
- `ai_threads`, `ai_messages`, `ai_user_preferences`, `ai_metrics_daily` têm políticas RLS mas nenhum consumidor. Superfície de ataque desnecessária — DROP recomendado.

## Conclusão
A segurança operacional do caminho ativo é sólida. O risco real está em **`needsApproval` ser vaporware** — uma tool de mutação pode rodar sem confirmação humana real, dependendo apenas da disciplina do LLM.
