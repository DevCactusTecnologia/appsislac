# Inventário do Módulo Financeiro — SISLAC

> Auditoria somente leitura. Nada aqui propõe mudanças; apenas documenta o que existe hoje.

## 1. Página principal e sub-componentes

| Caminho | Linhas | Papel |
|---|---:|---|
| `src/pages/Financeiro.tsx` | 924 | Orquestrador da rota `/financeiro` — monta tabs, filtros, contexto, dialogs |
| `src/pages/Financeiro/FinanceiroContext.tsx` | 108 | Context interno usado pelas abas (sem prop drilling) |
| `src/pages/Financeiro/types.ts` | 82 | `TabType`, `FinanceiroEntry`, `AReceberRow`, `AReceberConvenioRow`, `CaixaMov`, `CaixaLinhaComSaldo` |
| `src/pages/Financeiro/helpers.ts` | 63 | `parseDate`, `maskDateBR`, `isValidDateBR`, `saidaToEntry` |
| `src/pages/Financeiro/hooks/useFinanceiroFilters.ts` | 41 | Estado de filtros/UI (tab, busca, datas, convênio, status, etc.) |
| `src/pages/Financeiro/hooks/useFinanceiroDialogs.ts` | 78 | Estado dos dialogs (edit/delete/detail/pagar/receber/criar/fatura) |

### Abas (Tab components)
| Caminho | Linhas | Aba |
|---|---:|---|
| `src/pages/Financeiro/components/EntradasTab.tsx` | 131 | "Entradas" (regime de caixa) |
| `src/pages/Financeiro/components/AReceberTab.tsx` | 275 | "A Receber" — sub-tabs Pacientes / Convênios |
| `src/pages/Financeiro/components/SaidasTab.tsx` | 120 | "Saídas" (despesas) |
| `src/pages/Financeiro/components/CaixaTab.tsx` | 159 | "Livro-Caixa" |
| `src/pages/Financeiro/components/EntradasSaidasTable.tsx` | 271 | Tabela compartilhada Entradas/Saídas |

### Dialogs
| Caminho | Função |
|---|---|
| `EditEntryDialog.tsx` | Editar saída |
| `DeleteEntryDialog.tsx` | Confirmar exclusão de saída |
| `DetailEntryDialog.tsx` | Detalhes de uma entrada/saída (com drill-down em atendimento) |
| `PagarDespesaDialog.tsx` | Marcar despesa como paga |
| `src/components/NovaEntradaSaidaDialog.tsx` | Criar nova entrada (pagamento) ou saída |
| `src/components/financeiro/CriarItemDialog.tsx` | Criar item de dicionário (tipo despesa / destino / forma) |
| `src/components/financeiro/FecharFaturaDialog.tsx` | Fechar fatura de convênio |
| `src/components/financeiro/FaturaDetalheDialog.tsx` | Drill-down de itens de uma fatura |
| `src/components/financeiro/IntegracoesWebhookPanel.tsx` | Histórico de webhooks de gateways de pagamento |

### Outros componentes
- `src/components/financeiro/SearchableSelect.tsx` — combobox para tipos/destinos/formas
- `src/components/PagamentoDialog.tsx` — dialog de pagamento usado pelo NovoAtendimento e por Index (não no /financeiro diretamente)

## 2. Stores (cache + persistência)

| Caminho | Linhas | Responsabilidade |
|---|---:|---|
| `src/data/financeiroStore.ts` | 334 | Saídas (CRUD `financeiro_saidas`) + leitura da view `financeiro_entradas` |
| `src/data/financeiroListasStore.ts` | 180 | Dicionários de tipo de despesa / destino / forma de pagamento (via `select_options`) |
| `src/data/convenioFaturasStore.ts` | 375 | Faturas de convênio (header + itens), itens faturáveis, saldo em aberto por convênio |
| `src/data/atendimentoStore/*` | ~vários | Atendimentos + pagamentos do paciente (fonte de "A Receber" e "Entradas") |
| `src/data/convenioStore.ts` | — | Convênios (nome ↔ id) |

## 3. Serviços puros (sem React/IO)

| Caminho | Função |
|---|---|
| `src/pages/Financeiro/services/FinanceiroService.ts` (579L) | `buildAReceberRowsFromAtendimentos`, `buildAReceberRowsFromRpc`, `buildAReceberConvenioRows`, `filterAReceberRows`, `applyFinanceiroFilters`, `computeEntradaCounts`, `computeAReceberCounts`, `computeSaidaCounts`, `buildCaixaMovimentos`, `filterCaixaMovimentos`, `computeCaixaSaldoInicial`, `applyCaixaSaldoAcumulado`, `computeCaixaTotais`, `buildLivroCaixaHtml`, `buildDetalhadoHtml` |
| `services/computeDetailExames.ts` | Lista de exames cobrados de paciente para drill-down |
| `services/computeDetailTotals.ts` | Totais (totalExames, totalPago, saldo) do detalhe |
| `services/computeFinanceiroSummary.ts` | KPIs do header por aba |
| `services/filterEntradasPagas.ts` | Filtra entradas com `statusPagamento = "Pagamento efetuado"` |
| `services/validateSaidaEdit.ts` | Validação de datas de vencimento/pagamento |
| `services/validatePayment.ts` | Validação do dialog "Pagar despesa" |
| `services/periodoRapido.ts` | Conversão de "hoje/7d/30d/mes/ano" → intervalo |
| `services/todayBR.ts` | Data atual `dd/mm/yyyy` |

## 4. Hooks dedicados

| Caminho | Função |
|---|---|
| `src/hooks/useAReceberPacientes.ts` | RPC `a_receber_pacientes_page` (paginado) + `useFinanceiroResumo` → RPC `financeiro_resumo` |

## 5. Tabelas e views (Postgres / Supabase)

| Objeto | Tipo | Papel |
|---|---|---|
| `atendimento_pagamentos` | tabela | Recebimentos (parciais ou totais) de paciente vinculados a um atendimento |
| `atendimentos` | tabela | Cabeçalho do atendimento (cliente, convênio, status) |
| `atendimento_exames` | tabela | Cobrança por exame (`cobranca_destino` paciente/convenio, `valor`, `status`) |
| `convenio_faturas` | tabela | Cabeçalho de fatura de convênio (período, subtotal, desconto, total, status, forma_pagamento, data_pagamento) |
| `convenio_fatura_itens` | tabela | Vínculo fatura ↔ `atendimento_exame_id` + valor congelado |
| `financeiro_saidas` | tabela | Despesas/saídas (vencimento, pagamento, tipo, destino, forma codificada na descrição) |
| `select_options` (categorias `financeiro_tipo_despesa`, `financeiro_destino_pagamento`, `financeiro_forma_pagamento`) | tabela | Dicionários do financeiro |
| `financeiro_entradas` | view | UNION ALL de `atendimento_pagamentos` + `convenio_faturas (status='paga')` — fonte única da aba "Entradas" |
| `convenios` | tabela | Convênios |
| `tenant_payment_gateways` / `whatsapp_*` / `comprovante_links` | tabelas | Integrações (gateways, comprovantes) — visíveis pela aba Integrações |

> Tabelas legadas `financeiro_tipos_despesa`, `financeiro_destinos_pagamento`, `financeiro_formas_pagamento` foram **removidas** na migration C.3 (2026-06-13). A leitura/escrita unificada é via `select_options`.

## 6. RPCs (Postgres)

| RPC | Uso |
|---|---|
| `create_atendimento_tx` | Cria atendimento + exames + pagamentos transacional |
| `update_atendimento_tx` | Atualiza atendimento, exames e pagamentos transacional (BEGIN/COMMIT pelo PG) |
| `a_receber_pacientes_page(p_search, p_date_from, p_date_to, p_status, p_cursor_data, p_cursor_id, p_limit)` | A Receber (pacientes) paginado por cursor |
| `financeiro_resumo(p_date_from, p_date_to, p_convenio)` | Resumo agregado: total_recebido, qtd_recebido, total_a_receber, qtd_a_receber, total_saidas_pagas/pendentes |
| `convenio_fatura_assign_codigo` / `convenio_fatura_sign_codigo` / `protect_convenio_fatura_codigo` / `protect_convenio_fatura_paga` / `validate_protocolo_fatura` | Triggers de proteção/atribuição de código `FAT-AAAA-NNNNNNN` e bloqueio de fatura paga |
| `financeiro_saida_assign_protocolo` / `financeiro_saida_sign_protocolo` / `protect_financeiro_saida_protocolo` | Atribuição/proteção de protocolo `SAI-AAAA-NNNNNNN` |
| `protect_financeiro_listas_sistema` | Bloqueia exclusão de itens de dicionário com `sistema=true` |
| `seed_default_formas_pagamento_for_tenant` | Semente de formas de pagamento ao criar tenant |
| `touch_convenio_faturas_updated_at` / `touch_financeiro_listas_updated_at` | Timestamps |
| `trg_recompute_on_pagamento_change` | Trigger sobre `atendimento_pagamentos` recalcula `status_pagamento` do atendimento |
| `audit_atendimento_pagamentos` | Trigger de auditoria |
| `current_tenant_id`, `is_super_admin`, `has_permission`, `has_role` | Helpers de RLS (não específicos do financeiro, mas usados por toda policy) |

## 7. Edge Functions

Não existe edge function dedicada ao Financeiro. As mutações financeiras passam por:

| Edge Function | Papel |
|---|---|
| `supabase/functions/create-atendimento` | Cria atendimento + exames + pagamentos iniciais |
| `supabase/functions/update-atendimento` | Atualiza atendimento e/ou registra pagamentos novos / cancela tudo (inclui RBAC: `registrar_pagamento`, `editar_atendimento`, `cancelar_atendimento`) |

Faturas de convênio e saídas são gravadas **direto via PostgREST** pela tabela (com RLS), sem edge function.

## 8. Permissões mencionadas no código

`gestao_financeira`, `visualizar_financeiro`, `registrar_pagamento`, `editar_atendimento`, `cancelar_atendimento`, `visualizar_atendimentos`.
