# SISLAC — Edge Functions Audit (Phase 5)

**Data:** 2026-06-15. Somente leitura. Base: `supabase/functions/` (51 funções, lista bruta em `_inventory-edge-functions.txt`).

Classificação:
- 🟢 **Essencial** — responsabilidade única, sem duplicação aparente.
- 🟡 **Consolidável** — sobrepõe outra função; candidato a merge.
- ⚫ **Obsoleta** — sem chamador no frontend.

---

## 1. Quadro completo

| Função | Quem chama | Faz | Tabelas | Classificação |
|---|---|---|---|---|
| `super-admin-list-tenants` | SuperAdminTenants page | SELECT `tenants` agregado | `tenants`, `tenant_registry` | 🟢 |
| `super-admin-create-tenant` | SuperAdminNovoLab | provisiona tenant + admin | `tenants`, `unidades`, `user_roles`, `tenant_registry` | 🟢 |
| `super-admin-update-tenant` | SuperAdminTenantDetalhe | UPDATE básico | `tenants` | 🟡 (sobreposição parcial com `change-tenant-plan` no campo `plano`) |
| `super-admin-change-tenant-plan` | SuperAdminTenantDetalhe | upsert billing | `tenant_subscriptions_billing` | 🟡 (campo `plano` também em `update-tenant`) |
| `super-admin-delete-tenant` | SuperAdminTenantDetalhe | cascade delete | `tenants` (+FKs) | 🟢 — atenção a OOM em tenants grandes (já documentado) |
| `super-admin-impersonate-tenant` | SuperAdminTenantDetalhe | magic link | `profiles` | 🟢 |
| `super-admin-reset-tenant-password` | SuperAdminTenantDetalhe | reset senha | `profiles` (sync email) | 🟢 |
| `super-admin-update-tenant-admin` | SuperAdminTenantDetalhe | troca admin do tenant | `profiles`, `user_roles` | 🟢 |
| `super-admin-import-tenant-admin` | SuperAdminTenantDetalhe | importa admin externo | `profiles`, `user_roles` | 🟡 (semelhante a `update-tenant-admin`) |
| `super-admin-update-tenant-db-config` | SuperAdminTenantDetalhe | grava config DB dedicado | `tenant_registry` | 🟢 |
| `super-admin-tenant-snapshot` | SuperAdminTenantDetalhe | 13 SELECTs paralelos | múltiplas | 🟢 |
| `super-admin-tenant-backup` | SuperAdminTenantDetalhe | export sql/json/xlsx | múltiplas (read) | 🟢 — risco OOM documentado |
| `super-admin-metrics` | SuperAdminDashboard | KPIs | `tenants`, `atendimentos` | 🟢 |
| `super-admin-plans` | SuperAdminPlanos | CRUD planos | `subscription_plans` | 🟢 |
| `super-admin-billing` | SuperAdminTenantDetalhe | snapshot billing | `tenant_subscriptions_billing` | 🟡 (parcial overlap com `change-tenant-plan` GET) |
| `super-admin-test-integration` | SuperAdminConfiguracoes | ping de integração SaaS | — | 🟢 |
| `tenant-resolve` | login público | branding por lab_code | `tenant_registry`, `tenants` | 🟢 |
| `tenant-healthcheck` | cron | health-check | `tenant_registry` | 🟢 |
| `tenant-domain-verify` | tela domínios | verifica CNAME | `tenant_registry` | 🟢 |
| `create-atendimento` | NovoAtendimento | RPC wrapper | `atendimentos`, `atendimento_exames`, `pagamentos` | 🟡 — existe RPC `create_atendimento_tx` no DB; função apenas wrap. Avaliar uso direto da RPC. |
| `update-atendimento` | EditarAtendimento | RPC wrapper | mesmo set | 🟡 (idem) |
| `ai-suggest-exames` | NovoAtendimento (IA) | LLM call | — | 🟢 |
| `extract-requisicao-exames` | NovoAtendimento (OCR) | OCR + LLM | — | 🟢 |
| `integration-dispatch` | jobs runner | manda job ao provider | `integration_jobs` | 🟢 |
| `integration-jobs-runner` | cron | consome fila | `integration_jobs`, `integration_dead_jobs` | 🟢 |
| `integration-poll-results` | cron | pull de resultados | `integration_results` | 🟢 |
| `integration-job-action` | UI ops | retry/cancel | `integration_jobs` | 🟢 |
| `integration-pdf-resolve` | UI laudo | resolve PDF terceirizado | `integration_pdfs` | 🟢 |
| `integration-pdf-url` | UI laudo | signed URL | `integration_pdfs` | 🟡 — overlap parcial com `integration-pdf-resolve` (resolve→url) |
| `integration-save-credentials` | Config integração | grava creds cifradas | `integration_credentials` | 🟢 |
| `integration-test-connection` | Config | testa conexão | — | 🟡 (overlap com `dbsync-test-connection`) |
| `dbsync-test-connection` | Config (DBSync) | testa DBSync | — | 🟡 |
| `lab-apoio-adapter` | jobs runner | adapter genérico | `integration_*` | 🟢 |
| `lab-apoio-cron-fetch` | cron | pull lab apoio | `integration_*` | 🟢 |
| `lab-apoio-upload-pdf` | webhook | recebe PDF | `integration_pdfs` | 🟢 |
| `provider-catalog-import` | Config | importa catálogo | `provider_catalog_import_jobs` | 🟢 |
| `provider-health-aggregator` | cron | métricas | `provider_health_metrics` | 🟢 |
| `comprovante-resolve` | público | resolve shortlink | `comprovante_links`, `public_rate_limits` | 🟢 |
| `comprovante-shortlink` | UI | gera shortlink | `comprovante_links` | 🟢 |
| `whatsapp-send` | NovoAtendimento/Resultado | envia msg | `whatsapp_mensagens` | 🟢 |
| `whatsapp-webhook` | provedor | recebe status | `whatsapp_mensagens` | 🟢 |
| `admin-invite-user` | Usuarios page | convida | `profiles`, `user_roles` | 🟢 |
| `admin-update-user` | Usuarios page | edita | `profiles`, `user_roles` | 🟢 |
| `admin-delete-user` | Usuarios page | remove | `profiles`, `user_roles` | 🟢 |
| `upload-image` / `upload-pdf` / `upload-assinatura` | UI uploads | grava em Storage | bucket | 🟡 — 3 funções com mesmo pattern; consolidar em `upload-asset` parametrizado (P2) |
| `image-url` / `assinatura-url` | UI render | signed URL | bucket | 🟡 — 2 funções idênticas com bucket diferente; consolidar (P2) |
| `leads-manager` | landing | recebe inscrição | `inscricoes` | 🟢 |
| `sitemap` | crawlers | gera sitemap.xml | `tenant_pages` | 🟢 |

---

## 2. Sumário

| Categoria | Total |
|---|---:|
| 🟢 Essencial | **38** |
| 🟡 Consolidável (P2) | **13** |
| ⚫ Obsoleta | **0** detectada |

### Candidatos a merge (P2 — não executar agora)
1. `upload-image` + `upload-pdf` + `upload-assinatura` → `upload-asset` (parametriza bucket + content-type).
2. `image-url` + `assinatura-url` → `asset-url`.
3. `integration-test-connection` + `dbsync-test-connection` → `integration-test-connection` com `provider` no body.
4. `integration-pdf-resolve` + `integration-pdf-url` → revisar boundary; possivelmente um chama o outro.
5. `super-admin-update-tenant` + `super-admin-change-tenant-plan` → manter separadas mas remover `plano` do `update-tenant` (SSOT).
6. `create-atendimento` / `update-atendimento` → avaliar invocação direta da RPC `create_atendimento_tx` pelo frontend (eliminando o wrapper); reter só se houver lógica de orquestração extra.

---

## 3. Compartilhado (`_shared/`)

`hardening.ts` (CORS, request_id, retry, timeout, logger), `neonProvider.ts` (DB dedicado, dry-run em Wave 2).

**Faltando como helper compartilhado (oportunidade P2):**
- `requireSuperAdmin(req)` — hoje cada `super-admin-*` reimplementa o bloco `auth.getUser() + rpc('is_super_admin')`.
- `requireRoleInTenant(req, ['admin','manager'])` — admin-*.
- `auditAction(actor, action, target)` — gravação em `platform_audit`/`audit_logs`.

**Fim Fase 5.** Nada alterado.
