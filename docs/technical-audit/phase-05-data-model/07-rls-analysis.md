# 07 — RLS Analysis

## Números
- **373 policies** em 119 tabelas → média 3,1 policies/tabela.
- Tabelas com RLS habilitada: 100% do domínio (regra de plataforma).

## Padrão canônico (documentado em memory `saas-multi-tenant`)
Toda tabela de domínio tem 4 policies:
```
<prefixo>_select  USING (tenant_id = current_tenant_id() OR is_super_admin())
<prefixo>_insert  WITH CHECK (tenant_id = current_tenant_id() AND has_permission('create.<x>'))
<prefixo>_update  USING (tenant_id = current_tenant_id()) WITH CHECK (...)
<prefixo>_delete  USING (tenant_id = current_tenant_id() AND has_role('admin'))
```
Amostra observada (do dump `pg_policies`): `amostras_{select,insert,update,delete}`, `atend_{select,insert,update,delete}`, `atex_{select,insert,update,delete}`, `appset_{select,insert,update,delete}`, `alocacoes_{select,insert,update,delete_super_admin}`, `caixa_sessoes_{...}_tenant`.

## Variações identificadas
1. **Somente-leitura** — tabelas de log/audit têm apenas `<prefix>_select` (`ai_audit`, `app_settings_audit`, `atendimento_audit`).
2. **Insert-only** — `amostra_movimentacoes` tem `mov_insert` + `mov_select` (imutável após criado) + `mov_update` bloqueado + `mov_super_all` para super_admin.
3. **Super-admin puro** — `tenant_registry`, `tenant_migration_runs`, `platform_audit`, `saas_settings`: policies exigem `is_super_admin()`.
4. **Público** — `exames_publicos`, `tenant_settings_public`, `tenant_pages`, `solicitacoes_publicas`, `signup_attempts`, `inscricoes`, `public_rate_limits`: policies liberam `SELECT` para `anon`.
5. **Global dictionary** — `select_options` permite leitura quando `tenant_id IS NULL OR tenant_id = current_tenant_id()`.
6. **Geo** — `states`, `cities`: leitura para todos, escrita bloqueada.
7. **Comprovantes** — `comprovante_links` valida token de acesso além do tenant.

## Coerência observada
- Todas as tabelas de domínio respeitam o mesmo template (prefixo curto por tabela, 4 verbs).
- Uso consistente de `current_tenant_id()` (função `SECURITY DEFINER` que resolve do JWT via `profiles`).
- Uso consistente de `is_super_admin()` como bypass explícito.
- Uso de `has_permission()` / `has_role()` para restringir escrita — padrão RBAC uniforme.

## Áreas críticas cobertas
- Isolamento de dados clínicos (pacientes, atendimentos, resultados): validado por 4 policies + FK lógica de `tenant_id`.
- Auditoria: apenas leitura (imutável).
- Financeiro: escrita restrita a `admin`/`manager`.
- Super Admin: totalmente isolado do domínio (não pode operar como tenant sem impersonate).

## Observações neutras
- `atendimento_pagamentos` tem 3 policies (sem `_delete`) — pagamentos são imutáveis por design (estornos via `financeiro_estornos`).
- `select_options` tem 5 policies porque separa read-global de read-tenant.
- `profiles` tem 5 policies (self-read, admin-read, insert via trigger, self-update parcial, super_admin).
- Não foram detectadas policies `USING (true)` em tabelas de domínio (bloqueadas por memória de constraints).

## Veredito factual
RLS é **coerente, uniforme e cobre toda a superfície do domínio**. O template de 4 policies é o mecanismo primário de isolamento multi-tenant, e é reforçado por `tenant_id NOT NULL` + funções `SECURITY DEFINER`. Não há evidência de policies permissivas legadas.
