# 05 — Storage Runtime

## Status: PLANEJADO — execução no Slice 4

## Diagnóstico

Buckets hardcoded em toda a app:
- `assinaturas`, `tenant-assets`, `integration-assets`, `lab-apoio-upload-pdf`, `comprovantes`.
- Todos endereçados via `sharedClient.storage.from(...)`.
- Tenant dedicated hoje: uploads/downloads vão para o Shared, mesmo com dados no Dedicated. **Inconsistência crítica**.

## Ação planejada

Novo módulo `src/runtime/storage/`:
- `resolveBucket(logicalName)` → `{ client, bucket, prefix }`
  - Shared: `{ sharedClient, logicalName, `${tenant_id}/` }`.
  - Dedicated: `{ dedicatedClient, logicalName, `${tenant_id}/` }` (mesmo bucket lógico, projeto físico diferente).
- Todos os call sites (~18 identificados) passam a chamar `resolveBucket()` — nenhuma string de bucket fora deste módulo.

## Migração física

`super-admin-migrate-tenant-storage` já existe (copia buckets + objects tenant-prefixed shared → dedicated). Adições necessárias:
- Checksum SHA-256 por objeto (antes/depois).
- Flag `tenant_registry.storage_flipped_at` para gating.
- Etapa `storage-cutover` no wizard (bloqueia flip enquanto storage não flipado).

## Validação

Playwright: upload assinatura → gerar laudo → verificar URL apontando para projeto correto.

## Status

| Item | Estado |
|---|---|
| Migração física (edge function) | ✓ existe |
| Checksum verification | ✗ pendente |
| StorageRuntime.resolveBucket | ✗ pendente |
| Refactor 18 call sites | ✗ pendente |
| `storage_flipped_at` gate | ✗ pendente |
