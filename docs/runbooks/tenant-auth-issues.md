# Runbook — Tenant / Auth issues

Cobre: usuário sem acesso, perfil errado, RLS suspeita, super_admin
lock-out, tenant "sumiu".

## 1. Sintomas

- Login OK mas usuário cai em `/login` ou vê tela em branco.
- "Você não tem permissão" em telas que deveriam estar liberadas.
- Listas vazias onde deveria haver dados (suspeita de RLS ou tenant errado).
- Super admin não consegue entrar em `/super-admin`.

## 2. Diagnóstico

### 2.1 Quem é o usuário no banco

```sql
select p.id, p.email, p.tenant_id, p.perfil, p.ativo,
       array_agg(ur.role) as roles
  from public.profiles p
  left join public.user_roles ur on ur.user_id = p.id
 where p.email = '<email>'
 group by p.id;
```

Sanidade:
- `tenant_id` não pode ser NULL para usuário operacional.
- `super_admin` aparece em `user_roles`, **não** em `profiles.perfil`.
- `ativo=true`.

### 2.2 Tenant existe e está ativo

```sql
select id, nome, slug, status, created_at
  from public.tenants
 where id = '<tenant_id>';
```

### 2.3 RLS bloqueando algo específico

Reproduzir a query como o usuário (no SQL editor da Cloud, usar
`set role authenticated; set local request.jwt.claim.sub = '<user_id>';`).
Comparar com a mesma query como `service_role`.

## 3. Mitigação

### 3.1 Usuário com perfil errado

- UI: `/equipe` (admin do tenant) → editar perfil.
- Nunca UPDATE direto em `profiles.perfil` em PROD.

### 3.2 Super admin sem acesso

1. Confirmar que o user existe em `auth.users` e em `public.profiles`.
2. Confirmar que existe linha em `user_roles` com `role='super_admin'`.
3. Se faltar, criar via migration **com escopo super_admin** (ver
   `mem://architecture/saas-multi-tenant`), nunca diretamente como
   `insert` ad-hoc em PROD sem auditoria.

### 3.3 Tenant "sumiu" para o usuário

- Verificar `profiles.tenant_id` vs `tenants.id`.
- Se houve mudança de tenant, hidratação do `AuthContext` pode estar
  cacheada; pedir logout/login (não usar `localStorage.clear()` cego —
  destrói mocks demo).

### 3.4 Suspeita de RLS frouxa (P1 hot-spot)

- Ver `mem://security/risk-hotspots` para policies conhecidas com
  `USING (true)`.
- Nunca relaxar policy em PROD para "destravar" — investigar primeiro
  com filtro `tenant_id = current_tenant_id()` faltando.

## 4. Correção definitiva

- Bug de RBAC frontend: revisar `ALLOWED_PATHS_BY_PERFIL`
  (`mem://auth/rbac-menu-visibility`) e `has_permission` no DB.
- Bug de RLS: nova migration com policy correta + teste em
  `src/lib/__tests__/` ou edge function de validação.
- Lock-out recorrente: documentar processo de recuperação em
  `mem://architecture/saas-multi-tenant`.

## 5. Pós-mortem

- Usuário(s) afetado(s) e janela.
- Confirmar via `audit_logs` se houve acesso indevido a dados de outro
  tenant.
- Se sim → tratar como incidente de segurança (P0).