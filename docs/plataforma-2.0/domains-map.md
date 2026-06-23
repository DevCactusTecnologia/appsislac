# Plataforma 2.0 — Fase 2: Mapa de Domínios

Agrupamento das 116 tabelas `public` por domínio funcional.

| Domínio              | Tabelas | Exemplos principais |
|----------------------|--------:|---------------------|
| Atendimento          | 5  | `atendimentos`, `atendimento_exames`, `atendimento_pagamentos`, `atendimento_audit`, `orcamentos`/`orcamento_exames` |
| Exames & catálogos   | 7  | `exames_catalogo`, `exame_layouts`, `exame_parametros`, `exame_pops`, `valores_referencia`, `tabela_preco_itens`, `exames_publicos` |
| Resultados/Mapa      | 3  | `mapas_trabalho`, `mapa_exames`, `resultados_entregas` |
| Pacientes            | 3  | `pacientes`, `identidade_confirmacoes`, `comprovante_links` |
| Soroteca             | 8  | `amostras`, `amostra_alocacoes`, `amostra_emprestimos`, `amostra_movimentacoes`, `amostra_sequence`, `expurgo_lotes`, `expurgo_itens`, `materiais_amostra` |
| Estoque              | 5  | `estoque_insumos`, `estoque_lotes`, `estoque_movimentacoes`, `estoque_fornecedores`, `locais_armazenamento` |
| Financeiro           | 9  | `financeiro_saidas`, `financeiro_estornos`, `financeiro_formas_pagamento`, `financeiro_destinos_pagamento`, `financeiro_tipos_despesa`, `financeiro_audit`, `caixa_sessoes`, `convenio_competencias`, recoletas/motivos |
| Convênios/Faturamento| 4  | `convenios`, `convenio_faturas`, `convenio_fatura_itens`, `convenio_glosas` |
| Equipe/Acesso        | 3  | `profiles`, `user_roles`, `especialistas` |
| Configurações        | 9  | `unidades`, `setores_laboratoriais`, `select_options`, `motivos_cancelamento`, `recoletas_motivos`, `labs_apoio`, `galerias`, `posicoes_galeria`, `documento_templates` |
| Integrações (Apoio/Interface) | 14 | `integrations`, `integration_*` (12 tabelas), `provider_*` |
| WhatsApp             | 5  | `whatsapp_outbox`, `whatsapp_mensagens`, `whatsapp_templates_cache`, `whatsapp_opt_out`, `whatsapp_metrics_tenant` |
| Auditoria & Compliance | 10 | `audit_logs`, `operational_audit`, `platform_audit`, `financeiro_audit`, `atendimento_audit`, `app_settings_audit`, `pdf_override_audit`, `protocolo_auditoria`, `storage_audit`, `tenant_provision_audit` |
| Multi-tenant / SaaS  | 14 | `tenants`, `tenant_registry`, `tenant_settings_public`, `tenant_lab_config`, `tenant_pages`, `tenant_payment_gateways`, `tenant_subscriptions`, `tenant_subscriptions_billing`, `tenant_notification_settings`, `tenant_blocklist`, `tenant_rate_limit`, `tenant_migration_log`, `subscription_plans`, `subscription_changes_log`, `saas_settings`, `app_settings` |
| Inscrições / Público | 4  | `inscricoes`, `solicitacoes_publicas`, `signup_attempts`, `public_rate_limits` |
| Geo & dicionários    | 2  | `states`, `cities` |
| Operações/Transporte | 3  | `transporte_remessas`, `criticos_comunicacoes`, `orientacoes_entregues` |
| Infra / Sequências   | 4  | `friendly_id_counters`, `guia_sequence`, `protocolo_sequence`, `cron_health` |

**Mais complexo:** Multi-tenant/SaaS (14) e Integrações (14), seguido por Auditoria (10).
**Mais simples:** Geo (2), Resultados/Mapa (3), Pacientes (3), Equipe/Acesso (3).
