# 14 — Readiness Score

| Dimensão | Status | Evidência |
|----------|--------|-----------|
| Schema control-plane (`tenant_registry`) | ✅ | migration 20260525130936 |
| UI para configurar DB do tenant | ✅ | `TenantDatabaseConfig.tsx` |
| Teste de conexão pg real | ✅ | `super-admin-test-tenant-db` |
| Provider Neon | 🟡 dry-run | `neonProvider.ts:14-60` |
| Resolver runtime `tenant → SupabaseClient` | ❌ | `tenantConnection.ts:73-75` lança erro |
| Auth federada / per-projeto | ❌ | AuthContext usa 1 client |
| Storage per-tenant | ❌ | buckets literais |
| Edge functions per-tenant | ❌ | `Deno.env.SUPABASE_URL` fixo |
| Migrations multi-banco | ❌ | sem runner |
| Failover/observabilidade per-tenant | ❌ | inexistente |

## Pontuação
**~18% pronto** (somente o esqueleto de metadados e o teste de conexão).

## Maturidade
**Nível 1 — Protótipo** (Onda 1 do roadmap interno declarado em `tenantConnection.ts:6-9`).
