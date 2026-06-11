# Cross-Tenant Admin Audit — P0

Data: 2026-06-08

## Escopo
Auditadas todas as edge functions com prefixo `admin-*` e `super-admin-*` que tocam contas de usuário usando `service_role`.

## Vulnerabilidade original
`admin-delete-user` e `admin-update-user` validavam apenas `has_role(caller, 'admin')` e aceitavam `userId` arbitrário. Qualquer admin de Tenant A podia excluir/atualizar/redefinir senha de usuários de Tenant B conhecendo o UUID.

## Correção aplicada
Novo helper compartilhado `supabase/functions/_shared/tenantGuard.ts` com `assertSameTenantOrSuperAdmin(admin, callerId, targetId)`:

- Resolve `caller.tenant_id` e `target.tenant_id` server-side via `profiles` (nunca confia no client).
- `super_admin` (`is_super_admin` RPC) bypassa a regra.
- Tenant admin **não** pode operar sobre `super_admin` (defesa em profundidade).
- Caller sem tenant → 403. Tenants diferentes → 403.

## Funções endurecidas
| Função                  | Antes                       | Depois                                                                 |
|-------------------------|-----------------------------|------------------------------------------------------------------------|
| admin-delete-user       | só `has_role('admin')`      | + `assertSameTenantOrSuperAdmin` + log de auditoria estruturado        |
| admin-update-user       | só `has_role('admin')`      | + `assertSameTenantOrSuperAdmin` + log de auditoria estruturado        |
| admin-invite-user       | criava user sem fixar tenant| Resolve `callerTenantId` e força `profiles.tenant_id = callerTenantId` |
| super-admin-reset-tenant-password | já validava tenant + bloqueava super_admin | sem mudanças                                       |
| super-admin-*           | já exigem `is_super_admin`  | sem mudanças                                                            |

## Outras funções administrativas no projeto
Nenhuma outra função `admin-*` toca contas de usuário fora das três acima. Funções de domínio (`create-atendimento`, `update-atendimento`, integrações) usam RLS via `current_tenant_id()` e não bypassam com service-role para alterar contas.

## Log de auditoria
Todas as operações endurecidas agora emitem evento estruturado contendo:
`actor_user_id`, `actor_tenant_id`, `target_user_id`, `target_tenant_id`, `super_admin`, `requestId`.

## RBAC × Tenant boundary
| Papel         | Escopo                         |
|---------------|--------------------------------|
| super_admin   | plataforma inteira (bypass)    |
| admin         | apenas próprio tenant          |
| gestor/recepcionista/analista/financeiro | apenas próprio tenant (via RLS) |

## Relatório executivo
- Vulnerabilidade corrigida? **SIM**
- Risco de alteração cross-tenant? **NÃO**
- Outras edge functions vulneráveis? **NÃO** (varredura completa em `supabase/functions/`)
- Helper reutilizável criado? **SIM** (`_shared/tenantGuard.ts`)
- RBAC respeita tenant boundaries? **SIM**
