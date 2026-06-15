# SISLAC — Security Inventory (Phase 1)

**Data:** 2026-06-15
**Modo:** somente leitura. Nenhuma alteração feita.
**Fontes brutas** (geradas via `psql` no DB de produção do tenant Lovable Cloud):

- [`_inventory-tables.txt`](./_inventory-tables.txt) — 97 tabelas (schema `public`)
- [`_inventory-policies.txt`](./_inventory-policies.txt) — 305 policies RLS
- [`_inventory-rpcs.txt`](./_inventory-rpcs.txt) — 151 funções no schema `public`
- [`_inventory-triggers.txt`](./_inventory-triggers.txt) — 149 triggers
- [`_inventory-edge-functions.txt`](./_inventory-edge-functions.txt) — 51 edge functions

---

## 1. Resumo quantitativo

| Camada | Total | Observação |
|---|---:|---|
| Tabelas (`public`) | **97** | 100% com RLS habilitado (confirmado em `pg_class.relrowsecurity`) |
| Policies RLS | **305** | Média 3,1 por tabela (esperado: SELECT/INSERT/UPDATE/DELETE) |
| RPCs/funções | **151** | inclui `has_role`, `current_tenant_id`, `is_super_admin`, `has_permission`, triggers e RPCs de domínio |
| Triggers (não-internos) | **149** | maioria são `audit_trigger`, `_updated_at`, `recompute_status_*` |
| Edge Functions | **51** | 16 são `super-admin-*`, 13 são `integration-*`, 3 `whatsapp-*`/comprovante |

---

## 2. Tabelas — responsabilidade e tenant-awareness

Convenção: **tenant-aware = T**, **plataforma/global = G**, **público (sem auth) = P**.
Lista completa em `_inventory-tables.txt`. Agrupamento abaixo:

### 2.1 Operacional clínico (T)
`atendimentos`, `atendimento_exames`, `atendimento_pagamentos`, `atendimento_audit`, `amostras`, `amostra_sequence`, `pacientes`, `recoletas`, `recoletas_motivos`, `resultados_entregas`, `criticos_comunicacoes`, `mapas_trabalho`, `mapa_exames`, `transporte_remessas`, `orcamentos`, `orcamento_exames`, `motivos_cancelamento`, `protocolo_sequence`, `protocolo_auditoria`, `friendly_id_counters`, `guia_sequence`, `identidade_confirmacoes`, `orientacoes_entregues`.

### 2.2 Catálogos / configuração de tenant (T)
`exames_catalogo`, `exame_layouts`, `exame_parametros`, `exame_pops`, `valores_referencia`, `convenios`, `tabela_preco_itens`, `especialistas`, `unidades`, `setores_laboratoriais`, `documento_templates`, `tenant_lab_config`, `tenant_settings_public`, `tenant_pages`, `app_settings`, `app_settings_audit`, `labs_apoio`.

### 2.3 Financeiro (T)
`convenio_faturas`, `convenio_fatura_itens`, `financeiro_saidas`, `financeiro_destinos_pagamento`, `financeiro_formas_pagamento`, `financeiro_tipos_despesa`.

### 2.4 Selects/dicionários (T + global)
`select_options` — `tenant_id NULL` = dicionário global compartilhado (intencional, ver `mem://architecture/global-dictionaries`).

### 2.5 Integração externa (T)
`integrations`, `integration_credentials`, `integration_logs`, `integration_jobs`, `integration_dead_jobs`, `integration_exam_map`, `integration_pdfs`, `integration_provider_exam_params`, `integration_provider_exam_refs`, `integration_provider_exams`, `integration_requests`, `integration_responses`, `integration_results`, `integration_sync_state`, `provider_catalog_import_jobs`, `provider_circuit_state`, `provider_health_metrics`.

### 2.6 Estoque (T)
`estoque_fornecedores`, `estoque_insumos`, `estoque_lotes`, `estoque_movimentacoes`.

### 2.7 Portal paciente / público (T + P)
`solicitacoes_publicas`, `exames_publicos`, `comprovante_links`, `public_rate_limits`, `inscricoes`.

### 2.8 WhatsApp (T)
`tenant_whatsapp_config`, `whatsapp_mensagens`.

### 2.9 Plataforma / super-admin (G)
`tenants`, `tenant_registry`, `tenant_subscriptions`, `tenant_subscriptions_billing`, `tenant_provision_audit`, `tenant_migration_log`, `tenant_blocklist`, `tenant_payment_gateways`, `subscription_plans`, `subscription_changes_log`, `saas_settings`, `platform_audit`, `pdf_override_audit`, `storage_audit`, `cron_health`, `signup_attempts`, `cities`, `states`, `audit_logs`, `operational_audit`.

### 2.10 Autenticação
`profiles`, `user_roles`.

---

## 3. Policies — Distribuição

305 policies em 97 tabelas. Padrão dominante:

```
<tabela>_select : is_super_admin(uid) OR (tenant_id = current_tenant_id() AND has_permission(uid,'…'))
<tabela>_insert : tenant_id = current_tenant_id() AND has_permission(uid,'…')
<tabela>_update : idem (USING + WITH CHECK simétricos)
<tabela>_delete : tenant_id = current_tenant_id() AND (has_role(uid,'admin') OR has_permission(uid,'…'))
```

Lista bruta com USING/WITH CHECK em `_inventory-policies.txt`.

Tabelas com **> 4 policies** (revisar deduplicação na Fase 3):
`documento_templates` (5), `profiles` (5), `select_options` (5), `solicitacoes_publicas` (5), `tabela_preco_itens` (5), `tenant_subscriptions` (3 — operacional), `unidades` (5).

---

## 4. RPCs — funções públicas chave (151 total)

### 4.1 Helpers de autorização (SSOT)
- `current_tenant_id()`, `current_tenant_id_strict()`
- `is_super_admin(uuid)`
- `has_role(uuid, app_role)`
- `has_permission(uuid, text)`
- `is_post_finalizacao(bigint)`, `_is_post_finalizacao(bigint)`

### 4.2 Domínio — atendimento
`create_atendimento_tx`, `update_atendimento_tx`, `atendimento_assign_protocolo`, `atendimento_exames_rbac_check`, `atendimento_exames_snapshot_regulatorio`, `aplicar_enriquecimento_exame`, `a_receber_pacientes_page`.

### 4.3 Domínio — pagamento / financeiro
`registrar_pagamento_tx`, `estornar_pagamento_tx`, `criar_fatura_convenio_tx`, `financeiro_saida_tx` (lista completa em arquivo bruto).

### 4.4 Plataforma
`get_published_tenant_page` (exposta ao `anon`, intencional), `lookup_paciente_publico` (exposta ao `anon`, intencional, com rate-limit).

### 4.5 Triggers / utilitários
`audit_trigger`, `fwd_*_to_*`, `touch_*_updated_at`, `tg_*_updated_at`, `trg_recompute_*`, `_calc_dv_amostra`, `_get_protocolo_hmac_key`, `_get_audit_justificativa`.

---

## 5. Triggers — 149 totais, 3 padrões

| Padrão | Quantidade aprox. | Propósito |
|---|---:|---|
| `*_updated_at` / `touch_*` | ~75 | atualizar `updated_at` em UPDATE |
| `audit_*` / `audit_trigger` | ~50 | gerar linha de auditoria (`audit_logs`, `atendimento_audit`, etc.) |
| `recompute_status_*`, `*_rbac_check_*`, `*_snapshot_*`, `*_assign_protocolo`, `*_fwd_*` | ~24 | regras de domínio |

Lista completa em `_inventory-triggers.txt`.

---

## 6. Edge Functions — 51 totais

Agrupamento por domínio:

| Grupo | Funções | Total |
|---|---|---:|
| Super-admin (control plane) | `super-admin-{billing,change-tenant-plan,create-tenant,delete-tenant,impersonate-tenant,import-tenant-admin,list-tenants,metrics,plans,reset-tenant-password,tenant-backup,tenant-snapshot,test-integration,update-tenant,update-tenant-admin,update-tenant-db-config}` | 16 |
| Integrações externas | `integration-{dispatch,job-action,jobs-runner,pdf-resolve,pdf-url,poll-results,save-credentials,test-connection}`, `dbsync-test-connection`, `lab-apoio-{adapter,cron-fetch,upload-pdf}`, `provider-{catalog-import,health-aggregator}` | 15 |
| Tenant runtime | `tenant-{resolve,healthcheck,domain-verify}` | 3 |
| Atendimento / dados | `create-atendimento`, `update-atendimento`, `ai-suggest-exames`, `extract-requisicao-exames` | 4 |
| Mídia / uploads | `upload-image`, `upload-pdf`, `upload-assinatura`, `image-url`, `assinatura-url` | 5 |
| Portal / comprovante | `comprovante-resolve`, `comprovante-shortlink` | 2 |
| WhatsApp | `whatsapp-send`, `whatsapp-webhook` | 2 |
| Admin de usuário | `admin-invite-user`, `admin-update-user`, `admin-delete-user` | 3 |
| Outros | `leads-manager`, `sitemap` | 2 |

Endpoint base: `https://<project>.supabase.co/functions/v1/<name>` (chamadas via `supabase.functions.invoke`, com `verify_jwt = false` + validação manual em código — exceto `tenant-resolve`/`sitemap`/`comprovante-resolve` que são públicos por design).

---

**Fim Fase 1.** Nada alterado.
