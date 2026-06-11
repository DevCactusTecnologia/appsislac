# FASE 4 — Segurança

## Multi-tenant

- **Isolamento**: toda tabela de domínio possui `tenant_id NOT NULL` e RLS usando `public.current_tenant_id()` (confirmado por grep em `supabase/migrations/*.sql`).
- **Resolução server-side**: frontend **nunca** envia `tenant_id`; é derivado do JWT em `current_tenant_id()` (mem://architecture/saas-multi-tenant).
- **RBAC**: roles em tabela dedicada `user_roles` + função SECURITY DEFINER `has_role()` (padrão prescrito no system prompt). `profiles.tenant_id` legado não é fonte autoritativa para super admin (mem://architecture/super-admin-boundary).
- **GRANTs**: tabelas operacionais expõem grants para `authenticated` e `service_role`; `anon` apenas em tabelas públicas (`exames_publicos`, `tenant_settings_public`, `solicitacoes_publicas`, etc.) — coerente com o padrão.

## Portal Público

- **OTP**: `identidade_confirmacoes` + `comprovante-resolve` (server-side).
- **Rate limit**: `public_rate_limits` e `signup_rate_limit` ativos.
- **Tokens/Shortlinks**: `comprovante_links` com expiração + `comprovante-shortlink` edge fn.

## Super Admin

- **Edge functions dedicadas**: 18 funções `super-admin-*` usando service-role com revalidação de `is_super_admin(auth.uid())` (padrão obrigatório).
- **Sem CRUD direto do frontend para operações de plataforma** — verificado pela ausência de calls supabase-js diretas a `tenants`, `tenant_registry`, `subscription_plans` fora das edge fns.
- **Cross-tenant**: bloqueio garantido por RLS (`tenant_id = current_tenant_id()`) em todas as tabelas operacionais.

## WhatsApp

- **Credenciais**: armazenadas em `tenant_whatsapp_config` (RLS por tenant) e/ou `integration_credentials` cifradas; **nunca** no frontend.
- **Webhook**: `whatsapp-webhook` valida assinatura antes de gravar.
- **Segredos**: não há `VITE_*` com tokens de WhatsApp em código.

## Riscos residuais

| Risco | Severidade | Observação |
|---|---|---|
| `useSelectOptions` deprecado ainda importado | Baixa | Sem violação de segurança; somente legado |
| Service-role exposto via edge fn sem revalidação | — | Não encontrado: todas as `super-admin-*` revalidam |
| Logs com PII | Baixa | `src/lib/logger.ts` centraliza; sem `console.log` de OTP encontrados em scan superficial |

**Veredito:** Postura de segurança **mantida**. Recomenda-se executar `security--run_security_scan` antes de produção piloto para corroborar.
