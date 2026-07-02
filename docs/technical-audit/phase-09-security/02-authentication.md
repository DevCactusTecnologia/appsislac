# 02 — Autenticação

## Login
- Único provedor: **Supabase Auth** (projeto `xhaeozwdfjuvpxgguqqp`).
- `src/contexts/AuthContext.tsx` → `signInWithPassword`. Sem mock/demo (removido — memory `saas-multi-tenant`).
- Não há fallback nem bypass client-side (grepped: `admin@sislac.com` só em docs/histórico).

## Logout
- `supabase.auth.signOut()` chamado em `AuthContext`. Não invalida server-side tokens já emitidos (comportamento padrão Supabase — revogação apenas por expiração ou `admin.signOut`).

## Refresh Token
- `autoRefreshToken: true`, `persistSession: true`, `storage: localStorage` (`src/integrations/supabase/client.ts`).
- **Evidência**: localStorage é acessível a qualquer script do domínio → XSS = roubo de sessão.

## JWT
- Assinado pelo projeto único. Claims `sub`, `email`, `role`, `exp`.
- **Não** contém `tenant_id` — resolvido server-side por `current_tenant_id()` a partir de `profiles.tenant_id` (SECURITY DEFINER).
- Edges revalidam via `admin.auth.getUser(token)` (não confiam apenas em decode local).

## Expiração / Revogação
- TTL padrão do Supabase Auth (1h access, 30d refresh — não customizado no `config.toml`).
- Sem lista de revogação aplicacional. Logout local não impede reuso do access token até expirar.

## Troca de tenant
- Um usuário = um `tenant_id` (FK em `profiles`). Não há UI para trocar.
- Impersonation por super_admin é o único path cross-tenant legítimo.

## Super Admin
- `is_super_admin(_user_id)` checada em toda edge `super-admin-*` (defesa em profundidade, além do JWT).
- Guard frontend: `RequireSuperAdmin.tsx` — puramente cosmético, RLS/edges bloqueiam do lado servidor.

## Impersonation
- `super-admin-impersonate-tenant/index.ts`:
  - Verifica caller `is_super_admin`.
  - Resolve admin do tenant, **filtra super_admins** do alvo (defesa em profundidade explícita).
  - Emite **magic link** (one-shot, TTL do Supabase).
  - Loga em `integration_logs`.
- **Sem MFA obrigatório para super_admin**. Nenhum step-up antes de gerar magic link.
- Magic link tem `redirectTo` livre — validação básica, aceita qualquer string enviada pelo caller (super_admin).

## Achados
| # | Item | Severidade |
|---|---|---|
| A01 | Sessão em localStorage → XSS-hijack | ALTO |
| A02 | Sem revogação de token após logout | MÉDIO |
| A03 | Sem MFA para super_admin | ALTO |
| A04 | Sem rate-limit em `signInWithPassword` (delegado ao Supabase, config default) | MÉDIO |
| A05 | Password HIBP check — status não verificado no config | INCONCLUSIVO |
