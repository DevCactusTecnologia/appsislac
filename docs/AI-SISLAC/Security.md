# Security — Modelo de segurança

## Camadas

1. **JWT obrigatório** — `authenticate()` em `_shared/aiAuth.ts` rejeita 401 sem Bearer válido.
2. **Tenant server-side** — resolvido por `current_tenant_id()` via `userClient`. Frontend nunca envia tenant.
3. **Permissões filtram Tools** — `resolveAllowedCapabilities()` carrega apenas Tools com `has_permission(user, capability.permission) = true`.
4. **RLS aplica em toda query** — Tools usam `userClient` (com JWT do usuário), nunca service-role.
5. **needsApproval com gate na UI** — Tools marcadas como `needsApproval` exigem confirmação no `AssistenteSISLAC.tsx`. O prompt avisa o modelo, mas a confiança real está no botão "Confirmar" da interface, nunca no LLM.
6. **Auditoria obrigatória** — toda execução de Tool grava em `ai_audit` (tool, capability, user, tenant, duration, status, error_code, mode, input).

## Tabelas

- Apenas `ai_audit` permanece. As tabelas `ai_threads`, `ai_messages`, `ai_user_preferences`, `ai_metrics_daily` foram removidas (zero linhas, zero consumidor).

## Princípio da verdade

O LLM nunca acessa SQL diretamente. Nenhuma Tool aceita SQL. Toda escrita passa por uma operação tipada do Supabase client com schema Zod validando o input.
