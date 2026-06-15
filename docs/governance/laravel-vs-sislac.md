# SISLAC × Laravel SaaS Multi-Database

| Dimensão | Laravel (Spatie/Tenancy v3) | SISLAC (Supabase Hybrid) |
|---|---|---|
| **Isolamento** | Database-per-tenant nativo (`stancl/tenancy`) | Shared default + dedicated opcional via `tenant_registry.database_strategy` |
| **RLS** | Não nativo — depende de scope global em Eloquent | Nativo no PostgreSQL; aplicado em 100% das 97 tabelas |
| **Authorization** | Policies + Gates em PHP | RLS + `has_role`/`has_permission` SECURITY DEFINER (defesa em profundidade) |
| **Tenant resolution** | Middleware (subdomain/header) | `current_tenant_id()` server-side via JWT → `profiles.tenant_id` |
| **Migrations** | Artisan + tenant runner | Supabase migrations (shared); dedicated requer pipeline próprio (futuro) |
| **Cron / Workers** | Queue workers Laravel (Horizon) | Edge functions cron (`integration-jobs-runner`, `lab-apoio-cron-fetch`) |
| **Auditoria** | `owen-it/laravel-auditing` (1 tabela) | 10 tabelas especializadas + `audit_trigger` genérica |
| **Super-admin** | Painel separado (Nova/Filament) | 16 edge functions `super-admin-*` com service-role |
| **Storage** | S3 / FS | Supabase Storage + `storage_audit` |
| **Real-time** | Pusher / Reverb | Supabase Realtime (channels com `tenant_id` namespacing) |
| **Custo cognitivo** | Alto (4 camadas: model + policy + scope + middleware) | Médio (1 camada: RLS) |

## O que o Laravel faz melhor
1. **Migrations por tenant**: rodar `php artisan tenants:migrate` é trivial. SISLAC ainda não tem isso (Fase 2 do plano multi-db).
2. **Seeders por tenant**: idem.
3. **Tenant context implícito**: no Laravel, `tenancy()->initialize($tenant)` troca conexão; aplicação não sabe. No SISLAC, código TS precisa chamar `getTenantContext()` quando o adapter de DB for `dedicated`.
4. **Ferramental maduro**: Telescope, Horizon, Pulse. SISLAC depende de `cron_health`, `provider_health_metrics`, `platform_audit`.

## O que o SISLAC faz melhor
1. **Isolamento em profundidade**: RLS no banco + validação em RPC + validação em edge function. Laravel depende de scope global — se programador esquecer, vaza.
2. **Single source of truth para autorização**: `has_permission()` é uma função SQL; mesma resposta em RLS, em RPC e em edge function. Laravel duplica entre Gate + Policy + middleware.
3. **Multi-tenant transparente para o frontend**: nenhum código TS envia `tenant_id`. Laravel exige cuidado em formulários.
4. **Edge functions globais**: 51 funções em V8 isolado, baixa latência. Laravel queue tem cold-start de PHP-FPM.
5. **Auditoria diferenciada por domínio**: SISLAC tem `atendimento_audit`, `pdf_override_audit`, `storage_audit`, `platform_audit` — investigação é rápida. Laravel-auditing junta tudo numa tabela.
6. **Circuit breaker server-side**: `circuit_*` RPCs + `provider_circuit_state` tabela. Laravel exige Bulkhead / package externo.
7. **Real-time nativo**: sem Pusher / Reverb.

## O que deve ser MANTIDO
- RLS como camada principal de autorização (vs Spatie Permissions PHP).
- `current_tenant_id()` server-side (vs middleware client-trusted).
- Edge functions por caso de uso (vs controller-fat).
- Auditoria por domínio (vs tabela única).
- `user_roles` separado de `profiles` (vs `users.role` enum em Laravel — anti-pattern).

## O que deve ser SIMPLIFICADO
- Triggers de auditoria duplicados (P1).
- 75 funções `touch_*_updated_at` → uma única `set_updated_at_timestamp()` (P2).
- 3 funções `upload-*` → 1 com parâmetro `kind` (P3, opcional).

## O que deve ser DOCUMENTADO
- Como provisionar tenant `dedicated` quando Fase 2 sair (runbook).
- Padrões em `docs/governance/official-patterns.md` ✅ (este pacote).
- Catálogos vivos (este pacote).
- ADRs para decisões grandes (e.g. "Por que mantemos integração em shared mesmo em modo dedicated?").

## Recomendação executiva
SISLAC **não deve adotar Laravel patterns**. A arquitetura atual é superior em isolamento e SSOT de autorização. Adotar o melhor do Laravel = trazer **ferramentas operacionais** (Horizon-like dashboard), não modelo de autorização.
