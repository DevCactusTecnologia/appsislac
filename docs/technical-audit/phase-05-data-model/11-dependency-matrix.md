# 11 — Dependency Matrix

Amostra representativa (não exaustiva) da matriz Tabela → Views → RPC → Edge Functions → Frontend.

## Cabeça (núcleo clínico)

### atendimentos
- **Views**: dashboards de KPIs (view `v_dashboard_kpis` e similares).
- **RPCs**: `create_atendimento_tx`, `update_atendimento_tx`, `cancel_atendimento_tx`.
- **Triggers**: `audit_atendimentos`, `ensure_tenant_billing_after_insert` (indireto).
- **Edge Functions**: `create-atendimento`, `update-atendimento`.
- **Frontend**: `src/data/atendimentoStore/*`, `src/pages/Atendimentos.tsx`, `NovoAtendimento.tsx`, `Dashboard.tsx`, `useDashboardKpis`, `usePaginatedAtendimentos`, `useResultadosPage`.

### atendimento_exames
- **RPCs**: `update_atendimento_tx`, `sign_resultado_tx`, `calc_preco_atendimento_exame`.
- **Triggers**: `audit_atendimento_exames`, `atendimento_exames_rbac_check_trg`.
- **Edges**: `sign-resultado`, `upload-pdf`, `upload-image`, `image-url`, `integration-pdf-*`.
- **Frontend**: `atendimentoStore/exames.ts`, `ResultadoDetalhe.tsx`, `ParamTypedInput.tsx`, `Mapa.tsx`, `Producao.tsx`.

### atendimento_pagamentos
- **RPCs**: `register_pagamento_tx`, `calc_saldo_devedor`.
- **Edges**: `PIX webhook`, `comprovante-resolve`, `comprovante-shortlink`.
- **Frontend**: `PagamentoDialog.tsx`, `financeiroStore.ts` (leitura), `caixaSessoesStore.ts`.

### amostras
- **RPCs**: `move_amostra_tx`, `emprestar_amostra_tx`, `expurgar_amostras_tx`, `next_amostra_codigo`.
- **Triggers**: `amostras_updated_at`, `audit_amostras`.
- **Frontend**: `sorotecaStore.ts`, `sorotecaEstruturaStore.ts`, `sorotecaExpurgoStore.ts`.

## Catálogo

### exames_catalogo
- **RPCs**: import de catálogos, `calc_preco_atendimento_exame`.
- **Edges**: `provider-catalog-import` (via `provider_catalog_import_jobs`).
- **Frontend**: `exameCatalogoStore.ts`, telas de configuração.

### valores_referencia + reguas_etarias + exame_parametros
- **RPCs**: `resolve_vr_por_paciente`, `resolve_critico`.
- **Frontend**: `valoresReferenciaStore.ts`, `exameParametrosStore.ts`, `ResultadoDetalhe.tsx`, `laudoHtmlBuilder.ts`, `criticoChecker.ts`.

## Financeiro

### caixa_sessoes
- **RPCs**: `open_caixa_tx`, `close_caixa_tx`.
- **Frontend**: `caixaSessoesStore.ts`.

### convenio_faturas + itens + glosas
- **RPCs**: `fechar_fatura_convenio_tx`, `registrar_glosa_tx`, `calc_total_fatura`.
- **Frontend**: `convenioFaturasStore.ts`, `convenioGlosasStore.ts`, `useConvenioFaturas`.

## Integrações

### integration_jobs / requests / responses / results / pdfs
- **RPCs**: `integration_enqueue`, `integration_mark_dead`, `integration_bump_circuit`.
- **Edges**: workers Hermes-Pardini, DBsync, etc.
- **Frontend**: `src/integrations/providers/*`, painéis de status.

## Plataforma

### tenant_registry
- **RPCs**: `super_admin_list_migration_tables`, `super_admin_dump_ddl`, `super_admin_tenants_metrics`.
- **Edges**: todas as `super-admin-*` (create-tenant, provision-schema, migrate-*, flip, rollback, purge, snapshot, backup, healthcheck).
- **Frontend**: `SuperAdminMigration.tsx`, `TenantDatabaseConfig.tsx`.

### tenants + tenant_lab_config + tenant_settings_public
- **Edges**: `tenant-runtime-config`, `tenant-resolve`, `tenant-dedicated-login-gate`.
- **Frontend**: `AuthContext`, `labConfigStore.ts`, páginas públicas, sidebar (feature flags).

### profiles + user_roles
- **RPCs**: `has_role`, `has_permission`, `is_super_admin`, `current_tenant_id`.
- **Frontend**: `AuthContext.tsx`, todo controle de acesso.

## Auditoria (padrão único)
Toda tabela `*_audit` é escrita **apenas** por trigger `audit_<tabela>` correspondente e lida pelas telas de auditoria (`AuditoriaStore.ts`, `auditLogsStore.ts`, `operationalAuditReader.ts`). Sem edge functions próprias.

## Sequenciadores
`friendly_id_counters`, `guia_sequence`, `protocolo_sequence`, `amostra_sequence` → funções `next_*` → chamadas pelas RPCs `*_tx`. Nenhum frontend acessa direto.

## Observação
- **Camadas de indireção**: Frontend → Store → (Edge Function | supabase.from) → (RPC | RLS + trigger) → tabela.
- **Ponto único de escrita** para atendimento/pagamento/amostra/caixa/fatura: sempre via RPC `*_tx`. Frontend nunca faz `INSERT` direto nessas tabelas críticas (validado por `check-data-plane-routing.sh`).
- Auditoria é 100% side-effect de trigger — nenhum consumidor precisa se preocupar em escrevê-la.
