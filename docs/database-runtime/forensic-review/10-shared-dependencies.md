# 10 — Dependências do Shared (banco compartilhado)

Todos os pontos que hoje dependem do projeto Shared.

## Obrigatória
- `src/integrations/supabase/client.ts` — singleton oficial.
- Todos os `src/data/*Store.ts` (~40 arquivos) importam `supabase` direto.
- Todos os hooks/páginas que fazem queries.
- `AuthContext.tsx` — `supabase.auth.*`.
- `tenant_registry` mora no Shared (control-plane).
- `profiles`, `user_roles`, `auth.users` são resolvidos no Shared para JWT/RLS.
- Toda edge function usa `SUPABASE_URL` + `SERVICE_ROLE_KEY` do Shared para bootstrap.

## Temporária (esperada em migração viva)
- `tenant-runtime-config` lê metadados no Shared para servir cliente.
- `super-admin-migrate-*` faz DUMP de `auth.users`/tabelas via RPC no Shared.

## Legada (não deveria estar mais no Shared se migração fosse real)
- Após flip, dados de domínio do tenant deveriam residir só no Dedicated; hoje continuam duplicados (o purge nunca é executado).
- `_shared/runtime/tenantContext.ts` faz lookup a cada request, sem cache — dependência recorrente do Shared mesmo para tenant dedicated.

## Desnecessária
- `installTenantAuthInvalidation` observa `sharedClient.auth` mas não é chamada.
- `dedicatedHealth` faz `select` em tabela `_sislac_schema_health` que não é criada por nenhuma migration.
- `runtime_dedicated_enabled` como coluna nova sem código que a leia.
