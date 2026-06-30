# 07 — Storage

Buckets resolvidos como string literal:
- `tenant-assets` — `src/lib/tenantSite/uploadAsset.ts:48,59`
- `integration-assets` — `_shared/drivers/hermes-pardini/driver.ts:174`, `_shared/drivers/dbsync/driver.ts:166`
- `lab-apoio-upload-pdf` — bucket vem por payload, mas executado no Storage do projeto shared.

Não há resolver `tenant → bucket name` nem `tenant → Storage URL`. Todos os arquivos físicos vivem em UM único Storage. Em per-tenant real cada projeto teria seu próprio Storage namespace e signed URLs.

Veredito: **não preparado**. `tenant_registry.storage_namespace` existe como coluna mas não é consumida em nenhum upload/download.
