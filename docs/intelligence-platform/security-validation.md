# Validação de Segurança

## Olhou
- `_shared/aiAuth.ts` — bootstrap único para ambas Edge Functions.
- `ai-chat` e `ai-manifest` — agora delegam JWT/tenant/permissões ao helper compartilhado.
- `_shared/registry.ts` — única fonte de Capabilities; Manifest derivado por `buildManifest()` jamais expõe `tools`, SQL ou services.

## Entendeu
A consolidação no helper **reduz superfície de erro**: qualquer ajuste futuro de auth atinge ambas as funções simultaneamente, eliminando o risco de uma Edge ficar com lógica desatualizada.

## Configurou (sem alterações em camadas críticas)
- JWT: validado por `admin.auth.getUser(token)` no helper.
- Tenant: resolvido server-side via RPC `current_tenant_id()` no `userClient` (RLS-friendly). Frontend **nunca** envia `tenant_id`.
- Permissões: `has_permission(user_id, permission)` em loop sobre `CAPABILITIES`. Capability sem permissão explícita é liberada apenas se `permission: null`.
- Approval: capabilities mutadoras (`paciente.create`) mantêm `needsApproval: true`. Confirmação humana via tool calling do AI SDK.
- Auditoria: `ai_audit.insert` continua em ambos os caminhos de `onFinish` e `catch`.
- Secrets: `LOVABLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` lidos apenas server-side. Helper falha com 500 (`missing_env`) se ausentes — nunca expõe valores.

## Validou
| Vetor | Status |
| --- | --- |
| JWT obrigatório | ✓ 401 sem `Bearer` |
| Token inválido | ✓ 401 `invalid_token` |
| Tenant não resolvido | ✓ 403 `tenant_unresolved` |
| Cross-tenant | ✓ RLS + `current_tenant_id` no `userClient` |
| Permissão ausente | Capability removida do toolMap e do Manifest |
| Prompt injection | System prompt fixo + tools tipadas (Zod no AI SDK) |
| Approval para mutação | ✓ via `needsApproval` no registry |
| Audit log | ✓ `onFinish` e `catch` |
| Secrets expostos | ✓ Nenhum (helper só lê) |

**Zero regressão.**
