# Multi-Tenant Model

## Regra de ouro
> O frontend **nunca** envia, sugere ou confia em `tenant_id`.
> O tenant é resolvido **sempre** server-side via `current_tenant_id()`.

## Fluxo
1. Browser despacha mensagem para `POST /functions/v1/ai-chat` com `Authorization: Bearer <jwt>`.
2. Edge cria cliente Supabase com o JWT do usuário.
3. Edge chama `select current_tenant_id()` → obtém `tenant_id` autoritativo.
4. Toda Tool executa sob esse cliente; RLS impede vazamento.
5. Auditoria grava `tenant_id` recuperado server-side.

## RLS — políticas obrigatórias nas tabelas de IA
Padrão SISLAC (4 policies + GRANT + ENABLE RLS):

```sql
-- ai_threads, ai_messages, ai_audit, ai_user_prefs
CREATE POLICY "tenant_select" ON public.<t> FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "tenant_insert" ON public.<t> FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_update" ON public.<t> FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_delete" ON public.<t> FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
```
+ `GRANT SELECT, INSERT, UPDATE, DELETE ON public.<t> TO authenticated;`
+ `GRANT ALL ON public.<t> TO service_role;`

## Super Admin
- Pode ler auditoria cross-tenant (somente `SELECT`).
- Não pode executar Actions em tenants via AI sem impersonate (segue fluxo `super-admin-impersonate-tenant` já existente).
- Skills financeiras/clínicas: bloqueadas para super_admin direto.

## Estratégia híbrida (shared vs dedicated)
- `tenant_resolver` já distingue `database_strategy`.
- `ai-chat` respeita: para tenants `dedicated`, cliente Supabase é criado com a URL roteada (mesmo padrão dos stores). Sem código novo aqui — reuso de `clientFactory.ts`.

## Memória entre tenants
- `ai_threads.tenant_id NOT NULL`.
- Troca de tenant (super admin) invalida cache de threads no browser.
- Cache do AI Shell limpo em `SIGNED_OUT` e em mudança de `tenant_id`.

## Antiprovas (red team)
- Mesmo se o LLM "imaginar" um tenant_id, **não há tool** que aceite tenant_id.
- Mesmo se RLS for desativada por engano, `current_tenant_id()` é checado redundantemente em cada Action crítica.
- Mensagens de erro nunca expõem nomes de tenants alheios.
