# 09 — Persistence Lifecycle

Onde cada informação nasce, muda e termina.

## Paciente
- **Nasce**: `pacienteStore.upsertPaciente` ou edge `create-atendimento` (busca-ou-cria).
- **Muda**: telas de cadastro; nunca em fluxo operacional.
- **Encerra**: soft delete via `deleted_at` (arquivamento LGPD). Registros históricos preservados.
- **Histórico**: `audit_pacientes` trigger grava `before/after`.

## Atendimento
- **Nasce**: RPC `create_atendimento_tx` (único caminho). Cria `atendimentos` + N `atendimento_exames` + `atendimento_pagamentos` iniciais em transação.
- **Muda**: RPC `update_atendimento_tx` (edição), transições de status derivadas dos exames.
- **Encerra**: cancelado (`cancel_atendimento_tx` com motivo obrigatório) ou finalizado.
- **Histórico**: `atendimento_audit` guarda cada mudança. Auditoria dupla em resultados: Analisado / Liberado.

## Exame do atendimento (`atendimento_exames`)
- **Nasce**: junto do atendimento.
- **Muda**: coleta → análise → resultado → laudo → assinado. Cada transição via RPC (`update_atendimento_tx`, `sign_resultado_tx`).
- **Encerra**: `assinado` (imutável) ou `cancelado`. Recoleta cria novo `atendimento_exames` vinculado.

## Pagamento
- **Nasce**: `PagamentoDialog` ou webhook PIX → INSERT em `atendimento_pagamentos`.
- **Muda**: **nunca** (imutável por design).
- **Encerra**: estorno registrado em `financeiro_estornos` (não deleta o pagamento original).

## Amostra
- **Nasce**: `move_amostra_tx` / criação junto ao registro de coleta. Código humano gerado por `amostra_sequence`.
- **Muda**: alocação em `posicoes_galeria` (`amostra_alocacoes`), movimentações (`amostra_movimentacoes` insert-only), empréstimos.
- **Encerra**: expurgo controlado (`expurgar_amostras_tx` → `expurgo_lotes` + `expurgo_itens`). Registro permanece — só marca status.

## Caixa
- **Nasce**: `open_caixa_tx` cria `caixa_sessoes` em aberto.
- **Muda**: pagamentos e saídas referenciam a sessão.
- **Encerra**: `close_caixa_tx` fecha com saldo calculado; imutável após fechamento.

## Fatura de convênio
- **Nasce**: `fechar_fatura_convenio_tx` cria `convenio_faturas` + `convenio_fatura_itens` a partir dos exames do período.
- **Muda**: glosas via `registrar_glosa_tx` → `convenio_glosas`.
- **Encerra**: status `paga` ou `cancelada`.

## Configuração de tenant
- **Nasce**: edge `super-admin-create-tenant` cria `tenants` + `tenant_registry` + `tenant_lab_config` + `tenant_subscriptions`.
- **Muda**: UI Super Admin ou UI do próprio tenant (`tenant_lab_config`).
- **Encerra**: `tenant_registry.runtime_status='suspended'` bloqueia acesso; não deleta dados.

## Migração Shared → Dedicated
- **Nasce**: UI Super Admin dispara `tenant_migration_runs`.
- **Muda**: cada fase (`auth`, `data`, `storage`, `flip`) grava linha em `tenant_migration_log`.
- **Encerra**: `runtime_mode='isolated_db'` + `frozen_at` timestamp. Purge posterior remove dados do Shared.

## Integração com labs de apoio
- **Nasce**: job em `integration_jobs` a partir de exame terceirizado.
- **Muda**: `integration_requests` (envio) + `integration_responses` (retorno) + `integration_results` (parsed) + `integration_pdfs`. Falhas persistentes migram para `integration_dead_jobs`.
- **Encerra**: job `concluded` → resultado propagado ao `atendimento_exames`.

## WhatsApp
- **Nasce**: `whatsapp_outbox` (fila).
- **Muda**: worker envia, grava `whatsapp_mensagens`.
- **Encerra**: `whatsapp_mensagens` mantido para métricas (`whatsapp_metrics_tenant`).

## Auditoria universal
Tabelas `*_audit` recebem `INSERT` de triggers `audit_<tabela>` a cada `INSERT/UPDATE/DELETE`. **Nunca são alteradas nem apagadas** — RLS bloqueia UPDATE/DELETE e a policy `<prefix>_select` restringe leitura ao tenant + super_admin.

## Presença de histórico/auditoria
| Domínio | Histórico dedicado? | Auditoria trigger? |
|---|---|---|
| Paciente | Não (soft delete) | Sim (`audit_pacientes`) |
| Atendimento | Sim (transições + audit) | Sim |
| Pagamento | Sim (imutável) | Sim |
| Amostra | Sim (movimentações) | Sim |
| Caixa | Sim (fechamento) | Sim |
| Fatura | Sim (imutável após fechada) | Sim |
| Assinatura SaaS | Sim (`subscription_changes_log`) | Sim (`platform_audit`) |
| Storage | — | Sim (`storage_audit`) |
| PDF override | — | Sim (`pdf_override_audit`) |
| Migração | Sim (`tenant_migration_log`) | Sim (`tenant_provision_audit`) |

**Cobertura de histórico: praticamente total** para dados sensíveis (LGPD/RDC 302).
