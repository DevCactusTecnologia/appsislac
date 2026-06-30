# 03 — Tenant Resolution

## Como o tenant é resolvido HOJE
- Front: `AuthContext.tsx:390-423` consulta `profiles.tenant_id` após login Supabase Auth. Guarda em React Context (`user.tenantId`).
- Backend (RLS): função `current_tenant_id()` (security definer) lê `tenant_id` do `profiles` associado ao `auth.uid()`.
- Sem subdomínio, sem domínio próprio, sem header custom, sem cookie de tenant. Tenant = profile do usuário autenticado.

## Implicações para DB-per-tenant
1. O JWT é emitido por **um único Supabase Auth** (projeto shared). Em um cenário per-tenant real, cada tenant teria seu próprio GoTrue/JWT secret — o JWT do projeto A não validaria no banco B.
2. `profiles` vive no banco shared. Se os dados forem para bancos dedicados, `profiles` precisaria ser replicado ou movido — e o lookup `profiles → tenant_id` deixaria de fazer sentido.
3. Não existe nenhum resolver `request → projeto Supabase`. O bootstrap do cliente acontece em build-time (`import.meta.env`).
