# 08 — Migration History

## Números
- **355 migrations** em `supabase/migrations/`.
- Nomenclatura Supabase padrão: `YYYYMMDDHHMMSS_<slug>.sql`.
- Nenhuma migration foi consolidada/squashed — a história completa está preservada.

## Fases arquiteturais identificadas (por cronologia de slugs e cross-ref com docs)

### Fase 0 — Bootstrap inicial (primeiras dezenas)
Criação de `tenants`, `profiles`, `user_roles`, enum `app_role`, funções `has_role`, `is_super_admin`, `current_tenant_id`. Instalação do template canônico de RLS.

### Fase 1 — Núcleo clínico
`pacientes`, `especialistas`, `convenios`, `unidades`, `atendimentos`, `atendimento_exames`, `atendimento_pagamentos`. Introdução das primeiras RPCs `*_tx` transacionais.

### Fase 2 — Catálogo e resultados
`exames_catalogo`, `exame_parametros`, `exame_layouts`, `exame_pops`, `valores_referencia`. Migrations subsequentes evoluem `exame_parametros` (tipos numérico/select/tempo/fórmula) e `valores_referencia` (VR por sexo/idade → "Valores de Referência 2.0" com `reguas_etarias`).

### Fase 3 — Amostra e rastreabilidade
`amostras`, `amostra_alocacoes`, `amostra_movimentacoes`, `amostra_emprestimos`, `galerias`, `posicoes_galeria`, `expurgo_*`, `recoletas`. Sequenciador `amostra_sequence` humano.

### Fase 4 — Financeiro / Convênios
`caixa_sessoes`, `financeiro_saidas`, `financeiro_estornos`, listas `financeiro_*`, `convenio_competencias`, `convenio_faturas`, `convenio_fatura_itens`, `convenio_glosas`. RPCs `close_caixa_tx`, `fechar_fatura_convenio_tx`.

### Fase 5 — Integrações (labs de apoio)
`integrations`, `integration_credentials`, `integration_jobs`, `integration_dead_jobs`, `integration_requests`, `integration_responses`, `integration_results`, `integration_pdfs`, `integration_exam_map`, `integration_provider_*`, circuit breaker (`provider_circuit_state`, `provider_health_metrics`).

### Fase 6 — Comunicação
`whatsapp_outbox`, `whatsapp_mensagens`, `whatsapp_opt_out`, `whatsapp_templates_cache`, `whatsapp_metrics_tenant`. `criticos_comunicacoes`, `resultados_entregas`, `orientacoes_entregues`.

### Fase 7 — Plataforma SaaS
`subscription_plans`, `tenant_subscriptions`, `tenant_subscriptions_billing`, `subscription_changes_log`, `tenant_lab_config`, `tenant_settings_public`, `tenant_notification_settings`, `tenant_payment_gateways`, `tenant_pages`, `tenant_rate_limit`, `tenant_blocklist`.

### Fase 8 — Auditoria / Compliance (LGPD/RDC 302)
`atendimento_audit`, `financeiro_audit`, `platform_audit`, `operational_audit`, `pdf_override_audit`, `storage_audit`, `ai_audit`, `protocolo_auditoria`. Triggers `audit_*` gerados em massa.

### Fase 9 — Database Runtime (Shared → Dedicated)
Marcadores explícitos na base atual (`20260525130936_*`, `20260525134033_*`, `20260701010019_*`, `20260701012659_*`, `20260701032431_*`):
- `tenant_registry` (control-plane).
- `tenant_migration_runs`, `tenant_migration_log`.
- RPCs `super_admin_dump_auth_users`, `super_admin_list_migration_tables`, `super_admin_dump_table_page`, `super_admin_dump_ddl`.
- Colunas incrementais: `db_project_url`, `db_anon_key_secret_ref`, `schema_provisioned_at`, `runtime_dedicated_enabled`, `migration_state`, `frozen_at`.

### Fase 10 — Assinatura, comprovantes, otimizações
`comprovante_links`, `documento_templates`, `orcamentos`/`orcamento_exames`, `mapas_trabalho`/`mapa_exames`, `signup_attempts`, `inscricoes` (com `email` + `senha_hash`), `public_rate_limits`.

## Ondas transversais
- Múltiplas migrations de **hardening** (documentadas em `docs/plataforma-2.1/`) adicionando índices, `search_path` explícito em funções, `SECURITY DEFINER`, GRANTs faltantes.
- Migrations de **cleanup** removendo tabelas/colunas depreciadas (documentadas em `docs/technical-audit/phase-02-source-code/11-dead-code-evidence.md`).
- Migrations pontuais de **Valores de Referência 2.0** consolidando lógica de VR.

## Coerência
A cronologia conta uma história linear e coerente: bootstrap → domínio → catálogo → operação → financeiro → integração → SaaS → compliance → runtime dedicated. Cada onda é rastreável nos documentos internos.

## Observações
- 355 migrations é um volume alto que reflete evolução incremental sem squash — cada mudança é histórica e auditável.
- Não há migrations "órfãs" identificadas nesta auditoria (nenhuma cria objeto que outra apaga sem justificativa).
