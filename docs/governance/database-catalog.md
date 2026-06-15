# SISLAC — Database Catalog

**Data:** 2026-06-15 · **Modo:** somente leitura · **Fonte:** `docs/security/_inventory-tables.txt` (97 tabelas).

## Legenda
- **TA** = Tenant Aware (coluna `tenant_id NOT NULL`, RLS por `current_tenant_id()`)
- **Shared** = vive no banco compartilhado (default hoje)
- **Dedicated** = candidata a viver no banco dedicado quando `tenants.database_strategy='dedicated'` for habilitado (Fase 2 de `src/lib/db/README.md`)
- **SuperAdmin** = vive no banco de controle (plataforma), nunca migra para dedicated

> Regra invariante: **tabelas globais (auth, billing, registro de tenants) JAMAIS migram para dedicated.** Sem isso, o roteamento dinâmico via `tenant_registry` quebra.

## 1. Operacional clínico (TA · Shared→Dedicated)
| Tabela | Responsabilidade |
|---|---|
| `atendimentos` | Pedido clínico (cabeçalho). Protocolo assinado por HMAC. |
| `atendimento_exames` | Itens do pedido; snapshot regulatório CBHPM/TUSS. |
| `atendimento_pagamentos` | Entradas financeiras vinculadas ao atendimento. |
| `atendimento_audit` | Auditoria fina de mutações no domínio atendimento. |
| `amostras` / `amostra_sequence` | Tubos coletados, sequência por unidade. |
| `pacientes` | Cadastro de paciente (PII). |
| `recoletas` / `recoletas_motivos` | Reagendamentos de coleta. |
| `resultados_entregas` | Logs de entrega de laudo. |
| `criticos_comunicacoes` | Comunicação de valores críticos. |
| `mapas_trabalho` / `mapa_exames` | Mapas operacionais. |
| `transporte_remessas` | Logística de amostras. |
| `orcamentos` / `orcamento_exames` | Orçamentos com validade 30 dias. |
| `motivos_cancelamento` | Dicionário de motivos. |
| `protocolo_sequence` / `protocolo_auditoria` | Geração e auditoria de protocolo. |
| `friendly_id_counters` / `guia_sequence` | Sequências amigáveis. |
| `identidade_confirmacoes` / `orientacoes_entregues` | Compliance LGPD/clínico. |

## 2. Catálogos e configuração (TA · Shared→Dedicated)
`exames_catalogo`, `exame_layouts`, `exame_parametros`, `exame_pops`, `valores_referencia`, `convenios`, `tabela_preco_itens`, `especialistas`, `unidades`, `setores_laboratoriais`, `documento_templates`, `tenant_lab_config`, `tenant_settings_public`, `tenant_pages`, `app_settings`, `app_settings_audit`, `labs_apoio`.

## 3. Financeiro (TA · Shared→Dedicated)
`convenio_faturas`, `convenio_fatura_itens`, `financeiro_saidas`, `financeiro_destinos_pagamento`, `financeiro_formas_pagamento`, `financeiro_tipos_despesa`.

## 4. Estoque (TA · Shared→Dedicated)
`estoque_fornecedores`, `estoque_insumos`, `estoque_lotes`, `estoque_movimentacoes`.

## 5. Integração externa (TA · Shared apenas)
`integrations`, `integration_credentials`, `integration_logs`, `integration_jobs`, `integration_dead_jobs`, `integration_exam_map`, `integration_pdfs`, `integration_provider_exam_params`, `integration_provider_exam_refs`, `integration_provider_exams`, `integration_requests`, `integration_responses`, `integration_results`, `integration_sync_state`, `provider_catalog_import_jobs`, `provider_circuit_state`, `provider_health_metrics`.

> **Decisão de arquitetura:** integração permanece no banco compartilhado mesmo quando o tenant for `dedicated`, porque os workers (`integration-jobs-runner`, `lab-apoio-cron-fetch`) precisam de uma fila única para escalonamento. Migrá-las para dedicated quebraria o cron.

## 6. WhatsApp (TA · Shared)
`tenant_whatsapp_config`, `whatsapp_mensagens`.

## 7. Portal paciente / público (TA · Shared)
`solicitacoes_publicas`, `exames_publicos`, `comprovante_links`, `public_rate_limits`, `inscricoes`.

## 8. Dicionários globais (TA-nullable · Shared)
`select_options` — `tenant_id NULL` = dicionário global, intencional (ver `mem://architecture/global-dictionaries`).

## 9. Plataforma / SuperAdmin (G · SuperAdmin)
`tenants`, `tenant_registry`, `tenant_subscriptions`, `tenant_subscriptions_billing`, `subscription_plans`, `subscription_changes_log`, `tenant_provision_audit`, `tenant_migration_log`, `tenant_blocklist`, `tenant_payment_gateways`, `saas_settings`, `platform_audit`, `pdf_override_audit`, `storage_audit`, `cron_health`, `signup_attempts`, `audit_logs`, `operational_audit`.

## 10. Geográficas (Read-only público)
`cities`, `states`.

## 11. Autenticação (G · SuperAdmin)
`profiles`, `user_roles`.

## Sumário por modo
| Modo | Tabelas |
|---|---:|
| Shared (default hoje) | 97 |
| Dedicated (candidatas) | 50 (operacional + catálogos + financeiro + estoque) |
| SuperAdmin (sempre globais) | 22 |
| Integração (sempre shared) | 17 |
| Globais ao banco shared (mesmo em modo dedicated) | `profiles`, `user_roles`, `tenants`, `tenant_registry`, billing, audit cross-tenant |
