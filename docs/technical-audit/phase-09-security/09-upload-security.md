# 09 — Upload Security

## Endpoints
- `upload-image` — imagens genéricas.
- `upload-pdf` — PDFs (laudos externos).
- `upload-assinatura` — assinaturas digitais (bucket `assinaturas`).
- `lab-apoio-upload-pdf` — PDFs de laboratório de apoio.
- `image-url` / `assinatura-url` — signed URLs.

## Validação (por edge, não auditadas linha-a-linha)
- Content-Type: presumido no client, **não confirmado server-side em todas**.
- Tamanho máximo: **não confirmado** globalmente (limite de request Supabase ≈ 50MB default).
- Magic-bytes / mime sniffing: **não confirmado**.
- Scanner antivírus (ClamAV, VirusTotal): **ausente**.

## Sanitização
- SVG: sem sanitizador dedicado. Se `upload-image` aceita SVG → **XSS armazenado** se renderizado inline.
- PDF: renderizado via iframe/Paged.js (`src/pages/ResultadoDetalhe`, `laudoBatchPdf`). Se PDF conter JS → executado pelo viewer do browser (Chrome PDF viewer isolado, mas anexos podem exfiltrar).

## Risco de execução
- Buckets privados: risco baixo — signed URL curta.
- Buckets `tenant-site`/`tenant-assets` públicos: se aceitarem `.html`, `.svg`, `.js` → **XSS via subpath**. Não confirmado se há allowlist de extensão.

## Path traversal
- Policies usam `storage.foldername(name)[1]` — se o cliente injetar `../` na name, o storage-api normaliza. Baixo risco.

## Achados
| # | Item | Severidade |
|---|---|---|
| U01 | Sanitização de SVG não confirmada | ALTO (INCONCLUSIVO) |
| U02 | Ausência de antivírus/mime sniffing server-side | MÉDIO |
| U03 | Buckets públicos aceitam extensões arbitrárias? | INCONCLUSIVO |
| U04 | Limite de tamanho por endpoint não confirmado | INCONCLUSIVO |
