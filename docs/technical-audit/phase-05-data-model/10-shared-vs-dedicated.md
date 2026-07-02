# 10 — Shared vs Dedicated

Análise exclusiva do modelo. Referência cruzada: `docs/database-runtime/` e `docs/database-per-tenant-audit/`.

## Definições factuais
- **Shared**: banco compartilhado (Lovable Cloud). Contém control-plane + dados de todos os tenants ainda não migrados.
- **Dedicated**: quando `tenant_registry.runtime_mode='isolated_db'`, o tenant tem projeto Supabase próprio, apontado por `db_project_url` + secret `db_secret_ref`.
- **Runtime**: código (`src/runtime/db.ts` e `supabase/functions/_shared/runtime/db.ts`) que resolve dinamicamente qual client usar por request.

## O que pertence exclusivamente ao Shared (control-plane)
Independente de quantos tenants estejam dedicated, estas tabelas moram sempre no Shared:
- `tenants`, `tenant_registry`, `tenant_lab_config`, `tenant_settings_public`, `tenant_notification_settings`, `tenant_payment_gateways`, `tenant_pages`.
- `tenant_subscriptions`, `tenant_subscriptions_billing`, `subscription_plans`, `subscription_changes_log`.
- `tenant_rate_limit`, `tenant_blocklist`, `tenant_provision_audit`.
- `tenant_migration_runs`, `tenant_migration_log`.
- `saas_settings`, `app_settings`, `app_settings_audit`, `platform_audit`.
- `profiles`, `user_roles` (identidade central — JWT emitido pelo Shared).
- `inscricoes`, `signup_attempts`, `public_rate_limits`, `solicitacoes_publicas` (aquisição).
- `states`, `cities` (geografia global).

## O que se replica no Dedicated (dados de domínio)
Quando um tenant vira dedicated, o schema clínico/operacional/financeiro é provisionado no projeto Supabase próprio:
- **Domínio clínico**: `pacientes`, `atendimentos`, `atendimento_exames`, `atendimento_pagamentos`, `especialistas`, `convenios`, `unidades`, `labs_apoio`, `materiais_amostra`, `setores_laboratoriais`, `motivos_cancelamento`.
- **Amostra**: `amostras`, `amostra_alocacoes`, `amostra_movimentacoes`, `amostra_emprestimos`, `amostra_sequence`, `galerias`, `posicoes_galeria`, `locais_armazenamento`, `expurgo_lotes`, `expurgo_itens`, `recoletas`, `recoletas_motivos`, `transporte_remessas`.
- **Catálogo**: `exames_catalogo`, `exame_parametros`, `exame_layouts`, `exame_pops`, `exames_publicos`, `valores_referencia`, `reguas_etarias`, `documento_templates`, `mapas_trabalho`, `mapa_exames`, `tabela_preco_itens`, `select_options` (tenant-scoped).
- **Financeiro**: `caixa_sessoes`, `financeiro_saidas`, `financeiro_estornos`, `financeiro_destinos_pagamento`, `financeiro_formas_pagamento`, `financeiro_tipos_despesa`.
- **Convênio**: `convenio_competencias`, `convenio_faturas`, `convenio_fatura_itens`, `convenio_glosas`.
- **Estoque**: `estoque_fornecedores`, `estoque_insumos`, `estoque_lotes`, `estoque_movimentacoes`.
- **Integrações**: `integrations`, `integration_*` (todas), `provider_*`.
- **WhatsApp**: `whatsapp_outbox`, `whatsapp_mensagens`, `whatsapp_opt_out`, `whatsapp_templates_cache`, `whatsapp_metrics_tenant`.
- **Resultados/entregas**: `resultados_entregas`, `criticos_comunicacoes`, `identidade_confirmacoes`, `orientacoes_entregues`, `comprovante_links`.
- **Auditorias operacionais**: `atendimento_audit`, `financeiro_audit`, `operational_audit`, `pdf_override_audit`, `storage_audit`, `ai_audit`, `audit_logs`, `protocolo_auditoria`.
- **Sequenciadores**: `friendly_id_counters`, `guia_sequence`, `protocolo_sequence`.
- **Cron**: `cron_health`.
- **Orçamento**: `orcamentos`, `orcamento_exames`.

## O que é do Runtime (não é tabela — é código)
- `src/runtime/db.ts` — resolve tenant do usuário logado (cliente).
- `supabase/functions/_shared/runtime/db.ts` — `getPlatformClient`, `getUserClient`, `getTenantClient`, `getUserTenantClient` (servidor).
- Identity layer (`src/runtime/identity/*`, `supabase/functions/_shared/runtime/identity.ts`).
- Cache dedicated com TTL de idle 5 min.
- Não há tabela dedicada ao runtime além das já listadas no control-plane.

## O que é do domínio (independente de runtime)
As tabelas listadas na seção "replica no Dedicated" — o modelo é **idêntico** nos dois lados. Não há divergência de schema entre um tenant shared e um dedicated. A cópia é feita por edges `super-admin-migrate-tenant-*` e verificada por `super_admin_list_migration_tables`.

## Observação factual
- Nenhuma tabela tem lógica "shared-only" ou "dedicated-only" dentro do domínio.
- O único ponto de divergência real é o **JWT issuer** (documentado em `docs/database-per-tenant-audit/06-auth.md`): o token continua sendo emitido pelo projeto Shared, e o Dedicated confia no mesmo par de chaves ao ser provisionado.
- Após flip, `runtime_mode='isolated_db'` faz o server-side rotear todas as escritas para o Dedicated. Purge do Shared é opcional e controlado via `super-admin-purge-tenant-from-shared`.
