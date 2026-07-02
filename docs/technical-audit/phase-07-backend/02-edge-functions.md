# 02 — Edge Functions (74)

Classificação por domínio e responsabilidade. Todas em `supabase/functions/<nome>/index.ts`.

## Domínio — Atendimento & Resultado (4)
| Função | Objetivo | Consumidores |
|---|---|---|
| `create-atendimento` | Cria atendimento via RPC `create_atendimento_tx` | Frontend (Novo Atendimento) |
| `update-atendimento` | Atualiza atendimento (RPC `update_atendimento_tx`) | Frontend (Edição/Wizard) |
| `sign-resultado` | Assina digitalmente laudo (2ª auditoria) | Tela Resultado |
| `extract-requisicao-exames` | Extrai exames de requisição PDF/imagem via IA | Wizard atendimento |

## Domínio — Administração de Tenant (3)
`admin-invite-user`, `admin-update-user`, `admin-delete-user` — CRUD de usuários dentro do tenant (checa role manager/admin).

## Domínio — Leads & Público (3)
`leads-manager` (inscrições), `tenant-resolve` (login V2 multi-db), `sitemap`.

## Infraestrutura — Uploads & URLs (7)
`upload-image`, `upload-pdf`, `upload-assinatura`, `image-url`, `assinatura-url`, `comprovante-resolve`, `comprovante-shortlink`.

## Integração Laboratorial (12)
- **Dispatcher/Runner**: `integration-dispatch`, `integration-jobs-runner`, `integration-job-action`.
- **Poll/Fetch**: `integration-poll-results`, `integration-pdf-resolve`, `integration-pdf-url`.
- **Credenciais/Teste**: `integration-save-credentials`, `integration-test-connection`, `dbsync-test-connection`, `super-admin-test-integration`.
- **Apoio & Catálogo**: `lab-apoio-adapter`, `lab-apoio-cron-fetch`, `lab-apoio-upload-pdf`, `provider-catalog-import`, `provider-health-aggregator`.

## IA / Voz (4)
`ai-chat`, `ai-speak`, `ai-transcribe`, `ai-suggest-exames` — todas via Lovable AI Gateway.

## WhatsApp (3)
`whatsapp-dispatcher`, `whatsapp-template-sync`, `whatsapp-webhook` (público, valida signature).

## LGPD / Compliance (3)
`lgpd-auditoria-relatorio`, `lgpd-consentimento`, `lgpd-deletar-paciente`.

## Soroteca (2)
`soroteca-reorganizar-galeria`, `soroteca-sugerir-posicao`.

## Domínio de Tenant (2)
`tenant-domain-verify`, `tenant-dedicated-login-gate`.

## Super Admin Plane (24)
Gestão de tenants: `super-admin-create-tenant`, `super-admin-delete-tenant`, `super-admin-update-tenant`, `super-admin-list-tenants`, `super-admin-update-tenant-admin`, `super-admin-import-tenant-admin`, `super-admin-reset-tenant-password`, `super-admin-impersonate-tenant`, `super-admin-change-tenant-plan`, `super-admin-plans`, `super-admin-billing`, `super-admin-metrics`.

Migração shared→dedicated: `super-admin-migrate-tenant-auth`, `super-admin-migrate-tenant-data`, `super-admin-migrate-tenant-storage`, `super-admin-migration-flip`, `super-admin-migration-rollback`, `super-admin-migration-smoke-test`, `super-admin-purge-tenant-from-shared`, `super-admin-provision-tenant-schema`, `super-admin-provision-tenant-schema-full`, `super-admin-check-tenant-schema`, `super-admin-tenant-snapshot`, `super-admin-tenant-backup`, `super-admin-update-tenant-db-config`, `super-admin-test-tenant-anon-key`, `super-admin-test-tenant-db`.

## Distribuição por categoria
| Categoria | Qtde |
|---|---|
| Super-admin plane | 24 |
| Integração labs de apoio | 12 |
| Infraestrutura (upload/url) | 7 |
| Atendimento/Resultado | 4 |
| IA | 4 |
| WhatsApp | 3 |
| Tenant Admin | 3 |
| LGPD | 3 |
| Leads/Público | 3 |
| Tenant runtime | 2 |
| Soroteca | 2 |
| Outros | 7 |
| **Total** | **74** |
