# 07 — RLS

## Cobertura (do inventário `<supabase-tables>`)

Todas as 100+ tabelas de domínio listam ≥1 policy. Amostragem confirma padrão: 4 policies (SELECT/INSERT/UPDATE/DELETE) usando `current_tenant_id()` + `is_super_admin()` + `has_permission()`.

Exceções observadas:
- `select_options` — tem policy adicional para dicionários globais (`tenant_id IS NULL`), documentado em memory `global-dictionaries`.
- `friendly_id_counters`, `guia_sequence`, `amostra_sequence`, `protocolo_sequence` — 1–2 policies (funções internas).
- `platform_audit`, `signup_attempts`, `public_rate_limits`, `tenant_blocklist`, `saas_settings` — control-plane; policies próprias.

## Dependência de `auth.uid()`

`current_tenant_id()` é definida como SECURITY DEFINER e lê `profiles.tenant_id WHERE user_id = auth.uid()`. Todas as RLS de domínio dependem dela.

## Efeito em Dedicated

No projeto dedicated:
1. JWT do shared **não é válido** → `auth.uid()` retorna NULL.
2. `current_tenant_id()` retorna NULL.
3. Todas as policies filtram para "nenhuma linha" → **queries voltam vazias**, não erros.

## Respostas objetivas

- **Todas usam `current_tenant_id()`?** Sim (nas tabelas de domínio). ~5 tabelas control-plane têm padrões próprios.
- **Alguma tabela sem RLS?** Não identificada — todas listam policies no inventário.
- **Bypass?** Nenhum bypass RLS em produção. Edge functions usam SERVICE_ROLE (bypass legítimo).
- **Policy incorreta?** Não identificada nesta radiografia (sem análise policy-a-policy). Padrão consistente.
