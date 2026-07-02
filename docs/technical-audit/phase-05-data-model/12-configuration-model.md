# 12 — Configuration Model

Classificação das 119 tabelas por natureza de dado.

## Configuração (definida no setup, muda com baixa frequência) — ~30
### Configuração de tenant
`tenant_lab_config` (feature flags), `tenant_settings_public`, `tenant_notification_settings`, `tenant_payment_gateways`, `tenant_pages`, `app_settings`, `saas_settings`.

### Catálogo clínico configurável
`exames_catalogo`, `exame_parametros`, `exame_layouts`, `exame_pops`, `exames_publicos`, `valores_referencia`, `reguas_etarias`, `documento_templates`, `select_options`.

### Listas mestras
`materiais_amostra`, `setores_laboratoriais`, `motivos_cancelamento`, `recoletas_motivos`, `labs_apoio`, `locais_armazenamento`, `financeiro_destinos_pagamento`, `financeiro_formas_pagamento`, `financeiro_tipos_despesa`.

### Estrutura física
`unidades`, `galerias`, `posicoes_galeria`.

### Preços
`tabela_preco_itens`.

### SaaS / assinatura
`subscription_plans`.

## Entidades permanentes (cadastro — vive enquanto o negócio existe) — ~10
`tenants`, `pacientes`, `especialistas`, `convenios`, `estoque_fornecedores`, `estoque_insumos`, `integrations`, `integration_credentials`, `states`, `cities`.

## Operação (nasce e vive no dia-a-dia — alto volume) — ~40
### Fluxo clínico
`atendimentos`, `atendimento_exames`, `atendimento_pagamentos`, `orcamentos`, `orcamento_exames`, `amostras`, `amostra_alocacoes`, `amostra_movimentacoes`, `amostra_emprestimos`, `recoletas`, `resultados_entregas`, `criticos_comunicacoes`, `identidade_confirmacoes`, `orientacoes_entregues`, `transporte_remessas`, `expurgo_lotes`, `expurgo_itens`.

### Financeiro
`caixa_sessoes`, `financeiro_saidas`, `financeiro_estornos`.

### Faturamento
`convenio_competencias`, `convenio_faturas`, `convenio_fatura_itens`, `convenio_glosas`.

### Estoque
`estoque_lotes`, `estoque_movimentacoes`.

### Mapa de trabalho
`mapas_trabalho`, `mapa_exames`.

### Integrações — jobs
`integration_jobs`, `integration_dead_jobs`, `integration_requests`, `integration_responses`, `integration_results`, `integration_pdfs`, `integration_exam_map`, `integration_sync_state`, `integration_provider_exams`, `integration_provider_exam_params`, `integration_provider_exam_refs`, `provider_catalog_import_jobs`.

### Comunicação
`whatsapp_outbox`, `whatsapp_mensagens`, `whatsapp_opt_out`, `whatsapp_templates_cache`.

## Plataforma / SaaS (control-plane) — ~15
`tenant_registry`, `tenant_subscriptions`, `tenant_subscriptions_billing`, `subscription_changes_log`, `tenant_rate_limit`, `tenant_blocklist`, `tenant_provision_audit`, `tenant_migration_runs`, `tenant_migration_log`, `profiles`, `user_roles`, `signup_attempts`, `public_rate_limits`, `inscricoes`, `solicitacoes_publicas`.

## Auditoria / logs — ~10
`ai_audit`, `atendimento_audit`, `app_settings_audit`, `audit_logs`, `financeiro_audit`, `operational_audit`, `pdf_override_audit`, `platform_audit`, `storage_audit`, `protocolo_auditoria`.

## Infra técnica — ~10
`friendly_id_counters`, `guia_sequence`, `protocolo_sequence`, `amostra_sequence`, `cron_health`, `comprovante_links`, `whatsapp_metrics_tenant`, `provider_circuit_state`, `provider_health_metrics`, `galerias` (borderline — configuração + operação).

## Resumo
| Categoria | Tabelas | % |
|---|---:|---:|
| Configuração | ~30 | 25% |
| Entidades permanentes | ~10 | 8% |
| Operação | ~40 | 34% |
| Plataforma SaaS | ~15 | 13% |
| Auditoria | ~10 | 8% |
| Infra técnica | ~10 | 8% |
| Outros (aquisição) | ~4 | 4% |

O balanço mostra um sistema dominado por **operação** e **configuração** — coerente com o domínio (laboratório clínico é essencialmente cadastro + fluxo transacional).
