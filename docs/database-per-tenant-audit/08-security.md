# 08 — Segurança

Riscos identificados num cenário de DB-per-tenant aplicado sobre o código atual:
1. **Singleton global**: o mesmo `supabase` client é compartilhado em runtime entre abas/sessões. Trocar de tenant exigiria recriar o client; hoje não há API para isso.
2. **JWT cross-project**: tokens emitidos pelo projeto shared não validam em outros projetos Supabase.
3. **Service-role único** nas edge functions — não há cofre por tenant; `SUPABASE_SERVICE_ROLE_KEY` é global.
4. **Storage cruzado**: buckets hardcoded. Risco de vazar arquivo de um tenant ao apontar bucket de outro.
5. **Cache de queries (`@tanstack/react-query`)**: `queryKeys` usam prefixo `["tenant", tenantId, ...]` (Core), mas o transport por baixo é o mesmo client — invalidações por trocas dinâmicas não estão implementadas.
6. **`profiles.tenant_id`** continua sendo a verdade — em banco dedicado precisaria existir uma cópia, ou um diretório central.
7. **Realtime channel** não tem isolamento por projeto.

Pontos positivos:
- RLS robusta com `current_tenant_id()` e `is_super_admin()` em todas as tabelas operacionais.
- `tenant_registry` com policies super-admin-only.
