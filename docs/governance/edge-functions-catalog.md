# SISLAC — Edge Functions Catalog

**Total:** 51 functions · **Fonte:** `docs/security/_inventory-edge-functions.txt`

| # | Função | Domínio | Responsabilidade | Permissões | Tenant-aware | Classe |
|---|---|---|---|---|---|---|
| 1 | `admin-delete-user` | Admin user | Remover usuário do tenant | admin | ✅ | Essencial |
| 2 | `admin-invite-user` | Admin user | Convidar usuário | admin | ✅ | Essencial |
| 3 | `admin-update-user` | Admin user | Editar perfil/role | admin | ✅ | Essencial |
| 4 | `ai-suggest-exames` | Atendimento | IA sugere exames | authenticated | ✅ | Essencial |
| 5 | `assinatura-url` | Storage | URL assinada de assinatura | authenticated | ✅ | Essencial |
| 6 | `comprovante-resolve` | Portal | Resolve token comprovante | anon | ❌ (token) | Essencial |
| 7 | `comprovante-shortlink` | Portal | Encurta link | authenticated | ✅ | Essencial |
| 8 | `create-atendimento` | Atendimento | Wrapper transacional + emit eventos | authenticated | ✅ | Essencial |
| 9 | `update-atendimento` | Atendimento | Idem para update | authenticated | ✅ | Essencial |
| 10 | `dbsync-test-connection` | Integração | Testa adaptador DBSync | admin | ✅ | Compartilhável |
| 11 | `extract-requisicao-exames` | Atendimento | OCR + IA da requisição | authenticated | ✅ | Essencial |
| 12 | `image-url` | Storage | URL assinada imagem | authenticated | ✅ | Compartilhável |
| 13 | `integration-dispatch` | Integração | Dispara job para provider | authenticated | ✅ | Essencial |
| 14 | `integration-job-action` | Integração | Retry/cancel | admin | ✅ | Essencial |
| 15 | `integration-jobs-runner` | Integração | Worker cron | service_role | ✅ | Essencial |
| 16 | `integration-pdf-resolve` | Integração | Resolve PDF do provider | authenticated | ✅ | Essencial |
| 17 | `integration-pdf-url` | Integração | URL assinada | authenticated | ✅ | Essencial |
| 18 | `integration-poll-results` | Integração | Poll periódico | service_role | ✅ | Essencial |
| 19 | `integration-save-credentials` | Integração | Cifra e salva creds | admin | ✅ | Essencial |
| 20 | `integration-test-connection` | Integração | Smoke test provider | admin | ✅ | Essencial |
| 21 | `lab-apoio-adapter` | Integração | Adapter lab apoio | service_role | ✅ | Essencial |
| 22 | `lab-apoio-cron-fetch` | Integração | Cron de polling | service_role | ✅ | Essencial |
| 23 | `lab-apoio-upload-pdf` | Integração | Upload PDF terceirizado | authenticated | ✅ | Essencial |
| 24 | `leads-manager` | Portal | Gestão de leads (inscrições) | super_admin | ❌ (cross) | Essencial |
| 25 | `provider-catalog-import` | Integração | Importa catálogo provider | admin | ✅ | Essencial |
| 26 | `provider-health-aggregator` | Integração | Agrega métricas | service_role | ✅ | Essencial |
| 27 | `sitemap` | Marketing | Sitemap dinâmico | anon | ❌ | Essencial |
| 28–43 | `super-admin-*` (16 fns) | Plataforma | Provisionamento, billing, métricas, backup, snapshot, impersonate, plans, reset password, update tenant/admin, integration test, db config | super_admin | ❌ (cross) | Essencial |
| 44 | `tenant-domain-verify` | Tenant runtime | Verifica DNS de domínio custom | authenticated | ✅ | Essencial |
| 45 | `tenant-healthcheck` | Tenant runtime | Liveness por tenant | anon | ✅ | Essencial |
| 46 | `tenant-resolve` | Tenant runtime | Resolve tenant por host | anon | ✅ | Essencial |
| 47 | `upload-assinatura` | Storage | Upload assinatura | authenticated | ✅ | Compartilhável |
| 48 | `upload-image` | Storage | Upload imagem | authenticated | ✅ | Compartilhável |
| 49 | `upload-pdf` | Storage | Upload PDF | authenticated | ✅ | Compartilhável |
| 50 | `whatsapp-send` | WhatsApp | Envio outbound | authenticated | ✅ | Essencial |
| 51 | `whatsapp-webhook` | WhatsApp | Inbound | anon (assinado) | ✅ | Essencial |

## Consolidação proposta (P2)

### Uploads (3 functions → 1)
`upload-assinatura`, `upload-image`, `upload-pdf` compartilham:
- validação de tenant
- escolha de bucket
- antivírus / mime check
- persistência de `storage_audit`

Propor `upload-storage` com parâmetro `kind: 'assinatura'|'image'|'pdf'`. Trade-off: edge functions são baratas e funcionam — refator opcional.

### URL assinada (2 functions → 1)
`assinatura-url` + `image-url` + `integration-pdf-url` → `signed-url` com `kind` parameter.

### dbsync-test-connection vs super-admin-test-integration
Lógica parcialmente sobreposta. Manter ambos: o primeiro é diagnóstico operacional; o segundo é control-plane.

## Não consolidar
- 16 `super-admin-*` — cada um é um caso de uso distinto auditado. Consolidar perde rastreabilidade.
- `integration-jobs-runner` / `lab-apoio-cron-fetch` / `provider-health-aggregator` — três crons distintos com SLO próprio.
