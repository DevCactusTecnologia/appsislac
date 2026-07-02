# 05 — Isolamento Multi-Tenant

## Modelo
- Shared DB por padrão: 116/119 tabelas com `tenant_id NOT NULL`.
- Dedicated: `tenant_registry.runtime_mode = 'isolated_db'` roteia via `getUserTenantClient` (edges) / `src/runtime/db.ts` (front).
- Frontend **nunca envia** `tenant_id` — resolvido em `current_tenant_id()`.

## Vetores testados (teóricos, sem execução)

| Vetor | Resultado | Evidência |
|---|---|---|
| Alterar `tenant_id` no body de request | **Bloqueado** | Edges ignoram; RLS reforça |
| Setar `tenant_id` de outro tenant no INSERT direto | **Bloqueado** | `WITH CHECK (tenant_id = current_tenant_id())` |
| SELECT direto de outro tenant via PostgREST anon | **Bloqueado** | Anon não passa RLS (não é super_admin, sem profile) |
| RPC direta (`supabase.rpc('...')`) para função sem `SECURITY DEFINER` cuidadosa | **Inconclusivo** | 200 funções — auditoria parcial |
| Storage cross-tenant | **Possível se paths não usarem `tenant_id` como prefixo** — ver 09 |
| Realtime channels | **Inconclusivo** — canais postgres_changes respeitam RLS, mas broadcast/presence não |
| URL manipulation (`/atendimentos/<uuid>`) | **Bloqueado** | Query respeita RLS; UUID de outro tenant retorna vazio |
| Cache React-Query | **Bloqueado** por convenção `queryKey ["tenant", tenantId, ...]` — mas troca de tenant no mesmo browser não recria client Supabase (issue documentada em `db-per-tenant-audit/08`) |
| SQL injection | **Bloqueado** | 0 uso de raw SQL client-side; RPCs parametrizadas |

## Dedicated DB
- Cada tenant migrado tem `SB_SERVICE_ROLE_<ref>` + `<db_anon_key_ref>` como secrets.
- JWT emitido pelo projeto shared **não valida** no projeto dedicated → login para tenants dedicated depende de `tenant-dedicated-login-gate` (edge). Auditar se essa edge propaga corretamente a identidade.

## Achados
| # | Item | Severidade |
|---|---|---|
| MT01 | Realtime broadcast/presence sem enforcement de tenant | ALTO (INCONCLUSIVO até prova) |
| MT02 | Client Supabase singleton — troca de tenant não recria client | INFORMATIVO (não usado no fluxo atual) |
| MT03 | Auditoria caso-a-caso de 200 RPCs não concluída | INCONCLUSIVO |
