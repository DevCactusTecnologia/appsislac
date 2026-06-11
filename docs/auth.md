# Auth & RBAC Architecture

## Autenticação
O SISLAC utiliza Supabase Auth.
- O `AuthContext` gerencia a sessão no frontend.
- O `profiles` mapeia o `user_id` do Supabase para um `tenant_id`.

## RBAC (Role-Based Access Control)
As permissões são centralizadas e espelhadas entre o Banco (RLS/Functions) e UI.

### Papéis (Roles)
- `admin`: Gestão total do laboratório.
- `recepcao`: Cadastro e atendimento.
- `tecnico`: Coleta e triagem.
- `analista`: Análise e liberação.

### Lógica de Permissão
Use `hasPermission(permissao)` do `useAuth()` no frontend.
No backend, use a função `has_permission(auth.uid(), 'permissao')`.

## Multi-Tenant
Toda query deve filtrar por `tenant_id`.
O RLS garante que um usuário só acesse dados de seu próprio tenant.
A função `current_tenant_id()` é usada em triggers e queries server-side.
