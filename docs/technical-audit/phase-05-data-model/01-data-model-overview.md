# 01 — Data Model Overview

## Escopo
Auditoria factual do modelo de dados do SISLAC no schema `public` do banco compartilhado (Lovable Cloud / Supabase). Sem alterações.

## Números-chave
| Métrica | Valor |
|---|---:|
| Tabelas (BASE TABLE, public) | **119** |
| Views | 13 |
| Funções (schema public) | 200 |
| Triggers (não internos) | 195 |
| Policies RLS (public) | 373 |
| Índices (public) | 480 |
| Constraints totais (public) | 1.544 |
| FKs (referential_constraints) | 147 |
| CHECK constraints | 1.240 |
| UNIQUE constraints | 39 |
| Migrations (`supabase/migrations/`) | 355 |
| Edge Functions (`supabase/functions/`) | 74 |
| Tabelas com coluna `tenant_id` | **116 / 119** |

## Classificação conceitual das 119 tabelas

### Domínio clínico-operacional (núcleo do negócio) — ~55
Cadastro: `pacientes`, `especialistas`, `convenios`, `unidades`, `labs_apoio`, `materiais_amostra`, `setores_laboratoriais`, `motivos_cancelamento`, `recoletas_motivos`, `tabela_preco_itens`, `exames_catalogo`, `exame_parametros`, `exame_layouts`, `exame_pops`, `exames_publicos`, `documento_templates`, `reguas_etarias`, `valores_referencia`, `select_options`, `mapas_trabalho`, `mapa_exames`.

Atendimento / operação: `atendimentos`, `atendimento_exames`, `atendimento_pagamentos`, `orcamentos`, `orcamento_exames`, `amostras`, `amostra_alocacoes`, `amostra_emprestimos`, `amostra_movimentacoes`, `amostra_sequence`, `expurgo_lotes`, `expurgo_itens`, `recoletas`, `transporte_remessas`, `resultados_entregas`, `orientacoes_entregues`, `criticos_comunicacoes`, `identidade_confirmacoes`, `posicoes_galeria`, `galerias`, `locais_armazenamento`.

Financeiro: `financeiro_saidas`, `financeiro_estornos`, `financeiro_destinos_pagamento`, `financeiro_formas_pagamento`, `financeiro_tipos_despesa`, `caixa_sessoes`.

Convênio/faturamento: `convenio_competencias`, `convenio_faturas`, `convenio_fatura_itens`, `convenio_glosas`.

Estoque: `estoque_fornecedores`, `estoque_insumos`, `estoque_lotes`, `estoque_movimentacoes`.

### Plataforma / SaaS multi-tenant — ~20
`tenants`, `tenant_registry`, `tenant_lab_config`, `tenant_settings_public`, `tenant_notification_settings`, `tenant_payment_gateways`, `tenant_pages`, `tenant_subscriptions`, `tenant_subscriptions_billing`, `tenant_rate_limit`, `tenant_blocklist`, `tenant_migration_runs`, `tenant_migration_log`, `tenant_provision_audit`, `saas_settings`, `subscription_plans`, `subscription_changes_log`, `app_settings`, `profiles`, `user_roles`.

### Auditoria / logs — ~10
`ai_audit`, `atendimento_audit`, `app_settings_audit`, `audit_logs`, `financeiro_audit`, `operational_audit`, `pdf_override_audit`, `platform_audit`, `storage_audit`, `protocolo_auditoria`.

### Integrações (labs de apoio, provedores) — ~15
`integrations`, `integration_credentials`, `integration_dead_jobs`, `integration_exam_map`, `integration_jobs`, `integration_logs`, `integration_pdfs`, `integration_requests`, `integration_responses`, `integration_results`, `integration_sync_state`, `integration_provider_exams`, `integration_provider_exam_params`, `integration_provider_exam_refs`, `provider_catalog_import_jobs`, `provider_circuit_state`, `provider_health_metrics`.

### Comunicação — 4
`whatsapp_mensagens`, `whatsapp_metrics_tenant`, `whatsapp_opt_out`, `whatsapp_outbox`, `whatsapp_templates_cache`.

### Aquisição / marketing — 3
`inscricoes`, `solicitacoes_publicas`, `signup_attempts`, `public_rate_limits`.

### Infra técnica / geografia — ~8
`states`, `cities`, `friendly_id_counters`, `guia_sequence`, `protocolo_sequence`, `cron_health`, `comprovante_links`.

## Runtimes
- **Shared**: todas as 119 tabelas moram no projeto Supabase compartilhado (Lovable Cloud).
- **Dedicated**: `tenant_registry` marca tenants com `runtime_mode='isolated_db'`; nesse modo o schema é replicado em outro projeto Supabase. Não há artefatos exclusivos do Dedicated — o modelo é o mesmo, exceto pelas tabelas de plataforma (`tenants`, `tenant_registry`, `tenant_migration_*`, `profiles`, `user_roles`, `subscription_*`) que permanecem apenas no Shared (control-plane).

## Observação
`tenant_id` está presente em 116 das 119 tabelas. As 3 exceções (`states`, `cities`, `select_options` — quando `tenant_id IS NULL`) são dicionários globais compartilhados, decisão intencional documentada em memory.
