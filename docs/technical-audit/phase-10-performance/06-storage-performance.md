# 06 — Storage Performance

## Buckets (Fase 09 §07)

| Bucket | Público | Uso |
|---|---|---|
| `comprovantes` | ❌ | PDFs de comprovante |
| `resultados-externos` | ❌ | PDFs de laudo |
| `integration-assets` | ❌ | Assets de integração |
| `integration-pdfs` | ❌ | PDFs de integração |
| `provider-catalog-imports` | ❌ | Imports CSV/XLS |
| `assinaturas` | ❌ | Grafismo digital |
| `tenant-site` | ✅ | Sites públicos por tenant |
| `tenant-assets` | ✅ | Assets públicos |

## Uploads

- Endpoints: `upload-image`, `upload-pdf`, `upload-assinatura`, `lab-apoio-upload-pdf`.
- Sem validação server-side confirmada de MIME/tamanho/magic-bytes (Fase 09 §09).
- Sem antivírus.

## Downloads / Signed URLs

- `image-url`, `assinatura-url`, `integration-pdf-url`, `integration-pdf-resolve`, `comprovante-resolve`.
- TTL de signed URL não auditado — padrão Supabase (3600s).
- Buckets públicos: SELECT direto por URL — enumeração possível de UUID.

## Tamanho

- Limite request Supabase ≈ 50MB default. Não redefinido.
- PDFs de laudo em lote (`laudoBatchPdf`): geração client-side via Paged.js — carga CPU no browser, não no storage.

## Scanner

- **Ausente** (Fase 09 §09).

## Contenção

- Storage API é gerenciada; sem evidência de saturação em `db_health` (data disk 19%).

## Achados

| # | Item | Severidade |
|---|---|---|
| ST01 | Sem antivírus / MIME sniffing | MÉDIO (repetido) |
| ST02 | Buckets públicos permitem enumeração por path | MÉDIO (repetido) |
| ST03 | TTL de signed URL não parametrizado por endpoint | INCONCLUSIVO |
| ST04 | Sem métricas de storage por tenant | INCONCLUSIVO |
