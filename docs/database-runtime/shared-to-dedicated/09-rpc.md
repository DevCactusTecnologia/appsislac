# 09 — RPC

## Padrão

RPCs (`supabase.rpc(...)`) são invocadas via `db.rpc(...)` no Proxy — que **sempre encaminha para o shared** (Proxy só desvia `db.from(table)`).

## RPCs identificadas (amostra)

- `current_tenant_id()`, `is_super_admin()`, `has_permission()`, `has_role()` — segurança/RLS.
- `update_atendimento_tx()`, `super_admin_dump_auth_users()`, `super_admin_provision_*()`, `friendly_id_next()`, `guia_next()`, `protocolo_next()`.

## Estado por RPC

| RPC | Escopo | Funciona em Dedicated? |
|---|---|---|
| `current_tenant_id`, `is_super_admin`, `has_permission`, `has_role` | RLS shared | ✗ Não replicado no dedicated |
| `update_atendimento_tx` | data-plane transacional | ✗ Existe apenas no shared |
| Sequences (`*_next`) | shared counters | ✗ Não existem no dedicated |
| `super_admin_*` | control-plane | ✓ Corretamente shared |

## Respostas objetivas

- **Todas respeitam tenant?** Sim (via `current_tenant_id()`).
- **Todas funcionam em Dedicated?** ✗ Não — `SCHEMA_MINIMO_V1` provisiona tabelas mas **não replica as funções**. Qualquer `db.rpc(...)` em tenant dedicated ainda cai no shared por design do Proxy.
- **Dependência Shared?** Sim, absoluta — RPCs continuam servidas pelo shared mesmo com tabelas em dedicated. Isso significa que `update_atendimento_tx` no shared não enxerga dados que estão no dedicated → **quebra transacional** se allowlist crescer.
