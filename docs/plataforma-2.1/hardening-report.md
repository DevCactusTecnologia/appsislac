# Plataforma 2.1 — Fase 9: Hardening Report

## Ações executadas (migration `20260623_plataforma_2_1_hardening`)

| Item | Antes | Depois |
|------|-------|--------|
| Views com SECURITY DEFINER implícito | 7 | **0** |
| Funções com `search_path` mutável | 1 | **0** |
| Trigger functions executáveis por anon/authenticated | 13 | **0** |
| RPCs operacionais executáveis por anon | 15 | **0** |
| Índices novos | — | `idx_pacientes_tenant_nome_asc` |

## Validação

| Check | Resultado |
|-------|-----------|
| `supabase linter`: ERRORs | 7 → **0** |
| `supabase linter`: WARNs | 166 → **124** (−42) |
| `supabase linter`: total | 173 → **124** (−49) |
| RLS 100 % coberta | ✅ |
| Policies/tabela média | 3,15 |
| Build (Vite) | ✅ |
| Typecheck (`tsgo`) | ✅ |
| Lint | ✅ |
| Edge functions tocadas | 0 |
| Triggers afetados | 0 (apenas EXECUTE; trigger continua usando owner) |
| Realtime / replicação | sem impacto |

## Compatibilidade

- Frontend continua chamando RPCs via `supabase.rpc(...)` autenticado — sem mudança.
- Portal/landing usam `anon` apenas em `lookup_paciente_publico` e `get_published_tenant_page` — mantidos.
- Edge functions `super-admin-*` usam `service_role`, não afetadas por REVOKE de anon/authenticated.

## Zero regressão confirmada.
