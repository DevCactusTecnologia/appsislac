# 06 — Storage

## Buckets identificados (string literal)

| Bucket | Consumidor | Onde |
|---|---|---|
| `tenant-assets` | `src/lib/tenantSite/uploadAsset.ts:48,59` | Upload de assets do site público do tenant |
| `integration-assets` | `_shared/drivers/hermes-pardini/driver.ts:174`, `_shared/drivers/dbsync/driver.ts:166` | PDFs de integração |
| Bucket via payload | `lab-apoio-upload-pdf/index.ts` | Executa contra Storage do shared |

## Estado

- Todos os buckets vivem no **único** projeto Supabase (shared).
- `db.storage` no Proxy sempre encaminha para o shared (por design).
- `tenant_registry.storage_namespace` existe mas **nenhum caller consome** — coluna morta.
- Não há resolver `tenant → bucket` nem `tenant → Storage URL`.
- Signed URLs são geradas contra o Storage shared (`image-url`, `assinatura-url`, `comprovante-resolve`).

## Respostas objetivas

- **Storage suporta múltiplos projetos?** ✗ Não. Bucket names são hard-coded; não há dispatcher por tenant. Migrar um tenant para projeto dedicated deixa seus assets órfãos no shared até uma cópia física ser feita (não implementada — `super-admin-migrate-tenant-storage` existe mas migra metadata, não binários entre projetos).
