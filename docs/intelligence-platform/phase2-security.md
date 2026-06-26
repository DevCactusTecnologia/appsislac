# Phase 2 — Security

- **JWT**: validado no Edge via `admin.auth.getUser(token)`. Sem JWT → 401.
- **Tenant**: resolvido server-side via `current_tenant_id()` chamado com o cliente Supabase do USUÁRIO (não admin). Sem tenant → 403. Frontend nunca envia tenant.
- **RLS**: todas as tools usam `userClient` (anon + Bearer JWT). RLS oficial das tabelas (`pacientes` etc.) aplica isolamento.
- **Permissões**: `has_permission(userId, perm)` é checado server-side antes de cada Capability entrar no system prompt do LLM. Defesa em profundidade: o próprio tool retorna `NEEDS_APPROVAL` quando aplicável.
- **Prompt Injection**: o LLM só pode mutar via tool calling. Não há `run_sql`, `call_api` ou tool genérica.
- **Cross-tenant**: impossível — Edge ignora tenant do payload. Tools usam cliente do usuário; super_admin não impersona via AI.
- **Secrets**: `LOVABLE_API_KEY` permanece server-side. Nenhuma chave de provedor chega ao frontend.
- **Auditoria**: toda execução grava em `ai_audit` (tenant, usuário, skill, status, duração, origem, metadata sem PII).

Tabelas `ai_*` possuem 4 policies cada (select/insert/update/delete) e GRANTs explícitos para `authenticated` e `service_role`.
