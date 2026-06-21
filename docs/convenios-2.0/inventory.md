# Convênios 2.0 — Inventário Completo

> Modo: somente leitura. Levantamento exaustivo do que existe hoje no domínio Convênios.
> Data: 2026-06-21.

## 1. Tabelas (banco)

| Tabela | Papel | Colunas-chave | RLS |
|---|---|---|---|
| `convenios` | Cadastro mestre do convênio (1 linha por convênio do tenant). | `id`, `nome`, `registro_ans`, `tipo`, `tabela`, `dias_retorno`, `ativo`, `libera_fluxo_sem_pagamento`, `prazo_faturamento_dias`, `tenant_id` | 4 policies (select aberto a super_admin + tenant; insert/update/delete restritos a `admin`) |
| `convenio_faturas` | Cabeçalho de fatura (lote agrupando exames de UM convênio em UM período). | `id`, `codigo` (FAT-AAAA-NNNNNNN), `convenio_id`, `periodo_inicio`, `periodo_fim`, `subtotal`, `desconto`, `total`, `status` (`aberta`/`paga`/`cancelada`), `forma_pagamento`, `data_pagamento`, `observacao`, `assinatura_protocolo`, `tenant_id` | 4 policies (cf_*) — escrita exige `gestao_financeira`; delete só `admin` |
| `convenio_fatura_itens` | Vínculo N:N entre fatura e exames (`atendimento_exames`). | `id`, `fatura_id`, `atendimento_exame_id`, `valor`, `tenant_id` | 4 policies (cfi_*) idem acima |
| `tabela_preco_itens` | Catálogo de preço por convênio/tabela (CBHPM/TUSS/Própria/personalizada). | `convenio_id`, `exame`, `valor`, etc. | 5 policies |
| `convenios` (id=0 "Particular") | Linha protegida — não aparece na fatura por convênio. | id fixo `0` | trigger `protect_particular_convenio` |

> Não existem tabelas para: glosa, reapresentação, lote regulatório (TISS/SADT), competência, recoleta-fatura, ajuste de fatura, recebimento parcial.

## 2. Views

| View | Papel |
|---|---|
| `financeiro_entradas` | UNION ALL de `atendimento_pagamentos` (origem=`pagamento`) + `convenio_faturas WHERE status='paga'` (origem=`fatura_convenio`). É como o módulo Financeiro "vê" o recebimento de fatura. |

Não há views específicas como `convenios_a_receber`, `faturamento_competencia`, `glosas`, etc.

## 3. RPCs / Funções (schema public)

| Função | Tipo | Uso no domínio |
|---|---|---|
| `financeiro_a_receber_v2(p_tipo, p_search, p_date_from, p_date_to, p_status, p_cursor_data, p_cursor_id, p_limit)` | SQL stable | **SSOT** do A Receber. Para `p_tipo='convenio'` agrega exames `cobranca_destino='convenio'` ainda não vinculados a `convenio_fatura_itens` por convênio. |
| `financeiro_a_receber_totais()` | SQL stable | KPI agregado (paciente + convênio) — usado por dashboards. Reusa a CTE de v2. |
| `convenio_fatura_assign_codigo()` | trigger BEFORE INSERT | Gera `FAT-AAAA-NNNNNNN` via `generate_protocolo_sequencial`. |
| `convenio_fatura_sign_codigo()` | trigger AFTER INSERT | Assina HMAC e grava em `protocolo_auditoria`. |
| `validate_protocolo_fatura(_codigo)` | função | Verifica autenticidade da fatura emitida. |
| `protect_convenio_fatura_paga()` | trigger BEFORE UPDATE | Em fatura `paga`, bloqueia mudança em `subtotal/desconto/total/periodo_*` (só `cancelada` é permitida). |
| `protect_particular_convenio()` | trigger BEFORE UPDATE/DELETE | Impede excluir/renomear/desativar Particular (id=0). |
| `touch_convenio_faturas_updated_at()` | trigger BEFORE UPDATE | Atualiza `updated_at`. |

> Não existem RPCs específicas de domínio convênio (`convenio_fechar_lote`, `convenio_glosa_aplicar`, `convenio_reapresentar`, `convenio_competencia_close`).

## 4. Triggers ativas

- `convenio_faturas`: `convenio_fatura_assign_codigo` (BEFORE INSERT), `convenio_fatura_sign_codigo` (AFTER INSERT), `protect_convenio_fatura_paga` (BEFORE UPDATE), `touch_convenio_faturas_updated_at` (BEFORE UPDATE).
- `convenios`: `protect_particular_convenio` (BEFORE UPDATE/DELETE).
- `convenio_fatura_itens`: nenhuma trigger própria (sem audit, sem recompute do atendimento — é o gancho que falta para fechamento de competência).

## 5. Edge Functions

Nenhuma edge function dedicada a convênios/faturas. Tocam tangencialmente:
- `create-atendimento` / `update-atendimento`: gravam `convenio_cobranca_id` em `atendimento_exames`.
- `super-admin-tenant-backup`: faz dump das tabelas de convênio.

## 6. Stores (frontend)

| Arquivo | Papel |
|---|---|
| `src/data/convenioStore.ts` | CRUD de `convenios` + cache síncrono `getConvenios()`/`getConveniosAtivos()`. Inclui `getTabelaByConvenioNome`. Particular protegido. |
| `src/data/convenioFaturasStore.ts` | CRUD/queries de faturas: `fetchFaturas`, `fetchFaturasDoConvenio`, `fetchItensFatura`, `fetchItensFaturaveis`, `fetchSaldoEmAbertoPorConvenio` (legado), `criarFatura`, `marcarFaturaPaga`, `cancelarFatura`. |
| `src/data/tabelaPrecoStore.ts` | Tabelas de preço por convênio (cobertura, etc.). |

## 7. Hooks

| Hook | Papel |
|---|---|
| `useConvenioFaturas(enabled)` | React Query — lista cabeçalhos de fatura para a aba `Convênios` em `/financeiro`. |
| `useAReceberConvenios(filters)` (em `useAReceberPacientes.ts`) | Consome `financeiro_a_receber_v2(p_tipo='convenio')` — SSOT do saldo a faturar. |
| `useAReceberTotais` | Consome `financeiro_a_receber_totais()` — total agregado paciente+convênio. |

## 8. Componentes

- `src/components/financeiro/FecharFaturaDialog.tsx` (313 linhas) — dialog de criação de fatura: define período, lista itens faturáveis, cria fatura, opcionalmente marca paga.
- `src/components/financeiro/FaturaDetalheDialog.tsx` (91 linhas) — drill-down (itens da fatura).
- `src/pages/Financeiro/components/ConveniosTab.tsx` (280 linhas) — aba "Convênios" do `/financeiro` com 2 sub-tabs (`Em aberto`, `Faturas`).
- `src/components/configuracoes/ConveniosTab.tsx` (571 linhas) — CRUD do cadastro de convênios.
- `src/components/configuracoes/ConvenioExamesPanel.tsx` (539 linhas) — painel de cobertura de preços por convênio.

## 9. Páginas

- `/convenios` (`src/pages/Convenios.tsx`) — wrapper do `ConveniosTab` de Configurações.
- `/financeiro` aba **Convênios** — operação de fatura (`ConveniosTab` financeiro).
- `/financeiro` aba **A Receber** — saldo a faturar do convênio (via SSOT v2).
- `/configuracoes` aba **Convênios** — cadastro + cobertura.

## 10. Pontos de uso espalhados

- `src/pages/NovoAtendimento/services/resyncCobrancaConvenios.ts` — recalcula `cobranca_destino` quando o usuário troca convênios no atendimento.
- `src/pages/NovoAtendimento/buildExamesCobranca.ts` — define `cobranca_destino`/`convenio_cobranca_id` por exame.
- `src/data/financeiroStore.ts` — leitura da view `financeiro_entradas` (linhas com `origem='fatura_convenio'`).
- `src/pages/Dashboard.tsx`, `src/components/dashboard/RecepcionistaDashboard.tsx` — consomem totais SSOT (Fase 7).

## 11. Relatórios / Exportações

- Não existem relatórios dedicados (PDF/CSV) de fatura, glosa, competência ou produção por convênio.
- Impressão de fatura: **não existe** (apenas dialog em tela).
- "Livro caixa" em `/financeiro` mistura fatura paga junto com os pagamentos avulsos via view.

## 12. Tabelas residuais (legado financeiro tangencial)

- `financeiro_tipos_despesa`, `financeiro_destinos_pagamento`, `financeiro_formas_pagamento`: ainda existem mas não são mais consumidas pelo código (resíduo histórico, citado em `docs/financeiro-audit/business-rules.md`).
