# Storage Security Audit — SISLAC

**Data:** 2026-06-08  
**Escopo:** Auditoria de policies em `storage.objects` para todos os buckets.  
**Critério P0:** Nenhum anon enumera ou baixa arquivos de outro tenant; nenhum bucket sensível expõe assets internos.

## Sumário de Buckets

| Bucket | public | Tipo | Conteúdo |
|---|---|---|---|
| `tenant-assets` | true | Público (CDN) | Logos, favicons, OG, hero, banners de unidades |
| `tenant-site` | true | Público (CDN) | Imagens do site público do laboratório |
| `comprovantes` | false | Sensível | Comprovantes de pagamento |
| `integration-assets` | false | Privado | Assets de integração (laudos, etc.) |
| `integration-pdfs` | false | Privado | PDFs retornados por labs de apoio |
| `provider-catalog-imports` | false | Privado | Importações de catálogo de provedores |
| `resultados-externos` | false | Sensível | Resultados de exames externos (PHI) |

## Achados e Correções

### 🔴 P0-1 — `tenant-assets` permitia anon listar/baixar de qualquer tenant

- **Policy removida:** `tenant-assets read by tenant or anon-direct`
- **Qual original:** `(bucket_id='tenant-assets') AND (auth.role()='anon' OR (foldername)[1]=current_tenant_id()::text OR is_super_admin(...))`
- **Risco:** O ramo `auth.role()='anon'` não filtra por path/tenant. Anon podia chamar `storage.from('tenant-assets').list()` e enumerar todos os arquivos de todos os tenants via API.
- **Correção aplicada:** Nova policy `tenant-assets authenticated tenant read` exige `TO authenticated` e escopo `foldername[1] = current_tenant_id()::text` (ou `is_super_admin`).
- **Impacto:** Nenhum impacto funcional. URLs públicas via `/storage/v1/object/public/tenant-assets/...` continuam servindo logos/imagens pelo CDN (bypass de RLS quando `bucket.public=true`).

### 🔴 P0-2 — `tenant-site` permitia anon ler qualquer objeto

- **Policy removida:** `tenant-site public get only`
- **Qual original:** Permitia `auth.role()='anon' AND name IS NOT NULL AND length(name)>0` — efetivamente todos os objetos.
- **Risco:** Anon podia enumerar imagens do site público de qualquer tenant.
- **Correção aplicada:** Nova policy `tenant-site authenticated tenant read` exige `TO authenticated` + escopo por tenant.
- **Impacto:** Nenhum. Site público (TenantSite.tsx) consome URLs públicas via CDN, não a API autenticada.

### ✅ `comprovantes` — Seguro

- 3 policies, todas `TO authenticated`, escopadas por `foldername[1] = current_tenant_id()::text`.
- INSERT/UPDATE/DELETE adicionalmente exigem `has_role(admin)`.
- Sem acesso anon. Conforme.

### ✅ `integration-assets` — Seguro

- 4 policies, escopadas por `foldername[1]::uuid = current_tenant_id()`.
- Write requer `has_role(admin)`. Read aberto a `is_super_admin` ou ao tenant.
- Roles `{public}` mas as cláusulas exigem `auth.uid()` válido (anon não passa). Conforme.

### ✅ `integration-pdfs` — Seguro

- 4 policies `TO authenticated`, escopadas por tenant. Conforme.

### ✅ `provider-catalog-imports` — Seguro

- 4 policies `TO authenticated`, escopadas por tenant + `has_permission('integracoes.gerenciar')`. Conforme.

### ✅ `resultados-externos` — Seguro

- 4 policies `TO authenticated`, escopadas por tenant.
- Write exige `has_permission('liberar_resultado'|'analisar_amostra')` ou `admin`. Conforme.

## Validação dos Critérios de Sucesso

- ✔ **Nenhum anon lista/baixa arquivos de outro tenant** — única superfície anon existente (`tenant-assets`, `tenant-site`) foi removida; o que resta é acesso via CDN público com URL conhecida, que não permite enumeração.
- ✔ **Nenhum bucket sensível (`comprovantes`, `resultados-externos`, `integration-*`) tem acesso público** — todos `public=false` e sem policy anon.
- ✔ **Assinaturas/documentos**: assinaturas vivem no bucket S3 externo (`saas_settings.s3_config`) acessado via SigV4 nas edge functions, fora do Supabase Storage. Documentos de pacientes idem. Sem exposição via RLS de `storage.objects`.

## Pendências (fora do escopo P0)

- 79 warnings do linter Supabase (`function_search_path_mutable`, `security_definer_executable`, `extension_in_public`, `permissive_rls_policy`) são pré-existentes e não relacionados a storage. Tratar em missão dedicada de hardening de funções.
