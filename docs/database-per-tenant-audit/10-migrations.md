# 10 — Migrations

- `supabase/migrations/` contém **343 arquivos**. Todos aplicados ao banco shared via Supabase CLI/Cloud.
- Não existe runner que aplique migrations em N bancos. Não existe registry de `schema_version` consumido por automação (a coluna `tenant_registry.schema_version` existe, mas nada a atualiza).
- Não há rollback automatizado per-tenant.
- Não há feature-flag de schema por tenant.

Veredito: **Inexistente** para per-tenant. Adicionar 1 banco dedicado hoje exigiria rodar 343 migrations manualmente e nunca há garantia de paridade.
