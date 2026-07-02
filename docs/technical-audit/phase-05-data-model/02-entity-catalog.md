# 02 — Entity Catalog

Catálogo das 119 tabelas do schema `public`. Objetivo, responsabilidade e principais consumidores (frontend `src/data/*Store.ts`, edge functions `supabase/functions/*`, triggers/RPCs).

## Convenções
- **Escreve**: quem faz `INSERT`/`UPDATE`/`DELETE`.
- **Lê**: consumidores principais (frontend/edge/RPC).
- **Referencia**: tabelas que têm FK apontando para ela.

## Núcleo clínico

### `pacientes` (25 col, 4 policies)
Cadastro de pacientes. Escrito por `pacienteStore.ts` e edge `create-atendimento`. Lido por praticamente todas as telas de atendimento/resultado. Referenciado por `atendimentos`, `amostras`, `recoletas`. Auditado por `audit_pacientes`.

### `atendimentos` (31 col, 4 policies)
Ordem de serviço. Escrito exclusivamente via RPC `create_atendimento_tx` / `update_atendimento_tx`. Lido por `atendimentoStore/*`, dashboards, financeiro. Referencia: `pacientes`, `especialistas`, `convenios`, `unidades`. Referenciado por `atendimento_exames`, `atendimento_pagamentos`, `amostras`, `recoletas`, `resultados_entregas`.

### `atendimento_exames` (46 col, 4 policies, 8 FKs)
Linha de exame do atendimento — coração do fluxo (coleta → análise → resultado → laudo). Escrito por RPCs `update_atendimento_tx`, `sign-resultado`, `update-atendimento`. Trigger `atendimento_exames_rbac_check_trg` valida perfil. Auditado por `audit_atendimento_exames`.

### `atendimento_pagamentos` (11 col, 3 policies)
Cada pagamento (parcial/quitação) do atendimento. Escrito por `PagamentoDialog.tsx` e webhooks PIX. Auditado.

### `amostras`, `amostra_alocacoes`, `amostra_movimentacoes`, `amostra_emprestimos`, `amostra_sequence`
Rastreabilidade completa da amostra: geração de código (`amostra_sequence`), alocação em posições (`amostra_alocacoes` → `posicoes_galeria`), movimentações e empréstimos inter-unidades.

### `expurgo_lotes`, `expurgo_itens`
Descarte controlado de amostras (RDC 302). Escrito por `sorotecaExpurgoStore.ts`.

### `recoletas`, `recoletas_motivos`
Solicitações de recoleta. Escrito por telas de resultado quando exame reprovado.

### `resultados_entregas`
Registra cada entrega de laudo (portal, e-mail, WhatsApp, impressão).

### `criticos_comunicacoes`
Comunicação obrigatória de valor crítico ao médico solicitante.

### `identidade_confirmacoes`
Confirmação de identidade do paciente na coleta (LGPD).

### `orientacoes_entregues`
Instrução pré-analítica entregue por exame.

### `transporte_remessas`
Remessas de amostras a laboratórios de apoio.

## Catálogo clínico (configuração pesada)

- `exames_catalogo` — dicionário de exames do tenant (46 colunas: código, sinônimos, material padrão, prazo, integração).
- `exame_parametros` (28 col) — parâmetros individuais do exame (numérico/select/tempo/fórmula), com `casas_decimais`, `formato_exibicao`, `formula`.
- `exame_layouts`, `exame_pops`, `exames_publicos` — layouts de laudo, POPs e visibilidade pública.
- `valores_referencia` (29 col) — VR por sexo/idade/condição.
- `reguas_etarias` — faixas etárias reutilizáveis.
- `documento_templates` — templates de PDF (laudo, comprovante, guia).
- `mapas_trabalho`, `mapa_exames` — agrupamento operacional por setor.
- `select_options` — dicionário compartilhado de listas (tenant_id NULL = global).
- `materiais_amostra`, `setores_laboratoriais`, `motivos_cancelamento`, `labs_apoio`, `locais_armazenamento`, `galerias`, `posicoes_galeria`.

## Orçamento e preço
- `orcamentos`, `orcamento_exames` — cotações com validade.
- `tabela_preco_itens` — preços particulares/CBHPM/TUSS por convênio.

## Financeiro
- `caixa_sessoes` — abertura/fechamento de caixa.
- `financeiro_saidas` — despesas.
- `financeiro_estornos` — cancelamento de recebimento.
- `financeiro_destinos_pagamento`, `financeiro_formas_pagamento`, `financeiro_tipos_despesa` — listas mestras.
- Entradas NÃO existem como tabela — são derivadas de `atendimento_pagamentos` (constraint arquitetural documentada em memory).

## Convênios (faturamento)
- `convenios` — convênios ativos.
- `convenio_competencias` — mês de fechamento.
- `convenio_faturas`, `convenio_fatura_itens` — fatura mensal por competência.
- `convenio_glosas` — glosas por item.

## Estoque
- `estoque_fornecedores`, `estoque_insumos`, `estoque_lotes`, `estoque_movimentacoes`.

## Integrações (labs de apoio / provedores)
- `integrations` + `integration_credentials` — configuração por tenant.
- `integration_jobs` / `integration_dead_jobs` — fila de envio de exames.
- `integration_requests` / `integration_responses` — payload bruto.
- `integration_results` / `integration_pdfs` — retorno.
- `integration_exam_map` — mapeamento código local → código do parceiro.
- `integration_provider_exams` / `_params` / `_refs` — catálogo do parceiro.
- `integration_sync_state`, `integration_logs`.
- `provider_catalog_import_jobs`, `provider_circuit_state`, `provider_health_metrics` — health & circuit breaker.

## WhatsApp
- `whatsapp_outbox` — fila de envio.
- `whatsapp_mensagens` — histórico.
- `whatsapp_opt_out`, `whatsapp_templates_cache`, `whatsapp_metrics_tenant`.

## Plataforma / SaaS
- `tenants` — cadastro do laboratório-cliente.
- `tenant_registry` (34 col) — control-plane do runtime (shared/dedicated, credenciais do banco dedicado, estado de migração).
- `tenant_lab_config` (23 col) — feature flags operacionais (registrar coleta, etc.).
- `tenant_settings_public` — dados exibidos em páginas públicas.
- `tenant_notification_settings`, `tenant_payment_gateways`, `tenant_pages`.
- `tenant_subscriptions`, `tenant_subscriptions_billing`, `subscription_plans`, `subscription_changes_log`.
- `tenant_rate_limit`, `tenant_blocklist`, `tenant_provision_audit`.
- `tenant_migration_runs`, `tenant_migration_log` — histórico das migrações Shared→Dedicated.
- `saas_settings`, `app_settings`.
- `profiles` (27 col) — perfil do usuário (vincula `auth.users` ↔ `tenant_id`).
- `user_roles` — roles por usuário (`app_role` enum).

## Auditoria
`ai_audit`, `atendimento_audit`, `app_settings_audit`, `audit_logs`, `financeiro_audit`, `operational_audit`, `pdf_override_audit`, `platform_audit`, `storage_audit`, `protocolo_auditoria`. Escritas exclusivamente por triggers `audit_*` ou pelas próprias edges.

## Aquisição
- `inscricoes` — leads/signups.
- `solicitacoes_publicas` — pedidos de exame pelo portal público.
- `signup_attempts`, `public_rate_limits`.

## Infra técnica
- `states`, `cities` — geografia BR (globais).
- `friendly_id_counters`, `guia_sequence`, `protocolo_sequence`, `amostra_sequence` — sequenciadores humanos.
- `cron_health` — heartbeat de crons.
- `comprovante_links` — shortlinks para comprovantes.
