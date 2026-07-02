# 03 — Autorização

## Camadas
1. **Frontend** — `RequireAuth`, `RequireSuperAdmin`, `has_permission` no `AuthContext`. Cosmético.
2. **Edge Function** — `edgeBoot({require_auth, require_tenant})` + revalidação `is_super_admin` para plane admin.
3. **Banco (verdade)** — RLS por policy usando `current_tenant_id()`, `is_super_admin()`, `has_permission()`.

## Modelo
- Roles em `user_roles` (enum `app_role`) — separado de `profiles` (evita privilege escalation).
- `profiles.permissoes` (jsonb) — permissões finas por chave (`create.atendimento`, etc.). Lidas por `has_permission` SECURITY DEFINER.
- Templates de policy (4 verbs por tabela) aplicam `has_permission` no `INSERT/UPDATE/DELETE`.

## Dupla validação
- **Sim**: edges checam JWT + RPC; banco reforça via RLS. Ex.: `super-admin-impersonate-tenant` valida `is_super_admin` em edge E qualquer SELECT reforçado por RLS.

## Escalonamento possível?
| Vetor | Bloqueio | Evidência |
|---|---|---|
| Chamar `super-admin-*` sem JWT super_admin | Bloqueado | `is_super_admin` RPC + service-role só em edge |
| Alterar `user_roles.role='admin'` | Bloqueado | RLS de `user_roles`: só super_admin ou próprio user via RPC controlada |
| Setar `profiles.tenant_id` de outro tenant | **Parcial** | `profiles` tem 5 policies; INSERT via trigger; UPDATE self-parcial — verificar se `tenant_id` é imutável (não confirmado nesta auditoria) |
| Injeção via `permissoes` jsonb | Bloqueado | `has_permission` é RPC; jsonb não é executado |
| Setar próprio role via API | Bloqueado | Não há endpoint público de escrita em `user_roles` |

## Achados
| # | Item | Severidade |
|---|---|---|
| B01 | Imutabilidade de `profiles.tenant_id` não verificada empiricamente | INCONCLUSIVO |
| B02 | `permissoes` jsonb sem schema estrito — não é vetor de exec, mas dificulta auditoria | BAIXO |
| B03 | Frontend guards puramente cosméticos — OK por design, mas expõe rotas admin ao render (não a dados) | INFORMATIVO |
