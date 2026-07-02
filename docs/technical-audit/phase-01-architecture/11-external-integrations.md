# 11 — External Integrations

Todas as integrações externas observadas e o ponto exato do código onde entram na arquitetura.

## Supabase (Lovable Cloud)
- **SDK**: `@supabase/supabase-js@^2.103.3`.
- **Cliente**: `src/integrations/supabase/client.ts` (auto-gerado). Consumido por stores, contexts, hooks, `runtime/db.ts`.
- **PostgreSQL**: 355 migrations em `supabase/migrations/`. Convenções: RLS + GRANTs + `has_role`/`current_tenant_id`.
- **Auth**: usado em `AuthContext` (signIn, onAuthStateChange, session).
- **Edge Functions**: `supabase/functions/**` (74 functions Deno), com `_shared/edgeBoot.ts`, `hardening.ts`, `rateLimit.ts`.
- **Storage**: buckets acessados por `image-url`, `assinatura-url`, `lab-apoio-upload-pdf`, `integration-pdf-*`, `sign-resultado`, `super-admin-tenant-snapshot`.
- **Realtime**: assinado via `src/hooks/useRealtimeChannel.ts` e listeners de stores (`subscribeAtendimentos`).
- **Runtime dedicated (isolated_db)**: `src/runtime/db.ts` + `supabase/functions/_shared/{registry,tenantGuard,runtime,neonProvider,drivers,migration,canonical}`.

## Lovable AI Gateway
- **Uso**: chat, sugestão de exames, transcrição, TTS, OCR de requisição, resumo.
- **Entrada no código**: edge functions `ai-chat`, `ai-speak`, `ai-transcribe`, `ai-suggest-exames`, `extract-requisicao-exames`, mediados por `_shared/aiAuth.ts`.
- **Front-end**: `src/components/assistente/AssistenteSISLAC.tsx`, `src/components/LeituraRequisicaoDialog.tsx`, `AvaliacaoIADialog.tsx`.

## Provedores de Laboratório de Apoio
- **Providers**: `src/integrations/providers/dbsync/*` (XML/DTO/transports/parsers) e `src/integrations/providers/hermes-pardini/*` (WSDL SOAP).
- **Contracts comuns**: `src/integrations/contracts/{transport,capabilities,providers,providerUI}.ts`.
- **Pipeline server-side**: `lab-apoio-adapter`, `lab-apoio-cron-fetch`, `lab-apoio-upload-pdf`, `integration-dispatch`, `integration-jobs-runner`, `integration-job-action`, `integration-poll-results`, `integration-pdf-resolve`, `integration-pdf-url`, `integration-save-credentials`, `integration-test-connection`, `provider-catalog-import`, `provider-health-aggregator`, `super-admin-test-integration`.
- **Front-end**: `pages/LabApoio.tsx`, `components/RoteamentoApoioPanel.tsx`, `components/ExamesTerceirizadosPanel.tsx`, `components/IntegrationStatusBadge.tsx`, `components/IntegrationWarningsList.tsx`, `components/AuditoriaIntegracaoDrawer.tsx`, `hooks/useSolicitacoesNaoLidas.ts`.

## PIX
- **Client**: `src/lib/pixBrCode.ts` gera o BR Code.
- **UI**: `src/components/PagamentoDialog.tsx` exibe QR e escuta atualização.
- **Recepção**: webhook processado no backend (referência em memory: “PagamentoDialog.tsx” e “NovoAtendimento.tsx”).

## Neon / Postgres externo (per-tenant)
- **Adapter**: `supabase/functions/_shared/neonProvider.ts` + `_shared/drivers/*` + `pg@^8.21.0` em devDependencies.
- **Usado por**: `super-admin-migrate-tenant-data`, `-provision-tenant-schema[-full]`, `-check-tenant-schema`, `-tenant-snapshot`, `-tenant-backup`, `-migration-*`.

## S3-compatible
- **Adapter**: `supabase/functions/_shared/s3.ts`.
- **Consumido por**: functions de comprovantes/laudos que produzem/consumem PDFs binários em armazenamento externo (quando configurado).

## LGPD / Compliance
- **Front**: `hooks/useCompliance.tsx`, `pages/Privacidade.tsx`, `lib/lgpdReport.ts`.
- **Server**: `lgpd-consentimento`, `lgpd-auditoria-relatorio`, `lgpd-deletar-paciente`.

## Assinatura digital / Rastreabilidade
- **Server**: `sign-resultado`, `assinatura-url`.
- **Client**: `PdfPreviewDialog`, `lib/dossieRastreabilidade.ts`, `lib/criticoAudit.ts`, `components/rastreabilidade/*`.

## Sitemap / Marketing / SEO
- Edge `sitemap` + `components/seo/*` + `LandingPageResponsive.tsx` + JSON-LD em `index.html`.

## E-mail / Leads
- Edge `leads-manager` invocado por `pages/Inscricao.tsx` para gravar leads.

## WhatsApp
- **Front**: `components/whatsapp/*`, `src/lib/whatsapp/*` (deep-links / templates).
- Nenhuma edge function `whatsapp-*` observada — integração é via link/URL scheme.

## CKEditor 5
- Editor oficial (memory) — pacotes `@ckeditor/ckeditor5-react`, `ckeditor5`; usado em `MapaTrabalhoDialog`, `DocumentoTemplateDialog`, `LayoutDialog`, `pages/admin/CKEditorTest.tsx`.

## Bibliotecas de PDF/Imagem/QR
- `html2pdf.js`, `jspdf`, `html2canvas`, `qrcode`, `xlsx`.

## Hospedagem / Deploy
- `vercel.json` presente (fallback SPA). `deploy-compliance.sh` documentado.
- Domínio publicado: `https://appsislac.lovable.app`.

## Onde cada integração entra na arquitetura

```
Frontend  ──▶ Supabase JS ──▶ runtime/db.ts ──▶ Postgres (Lovable Cloud ou Neon dedicado)
Frontend  ──▶ Supabase JS ──▶ Edge Functions ──▶ Lovable AI Gateway
Frontend  ──▶ Edge Functions ──▶ Providers (dbsync / hermes-pardini) ──▶ Labs externos
Frontend  ──▶ pixBrCode ──▶ QR ↔ Webhook PIX
Frontend  ──▶ Supabase Storage ──▶ Assets binários
Front público ──▶ leads-manager ──▶ Postgres
Super Admin ──▶ super-admin-* ──▶ Postgres + Neon + Storage
```
