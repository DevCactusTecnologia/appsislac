# Inventário do Módulo Financeiro — SISLAC

> Auditoria somente-leitura. Documenta o **estado atual** (não o ideal).
> Data do levantamento: 2026-06-19.

## 1. Páginas (rotas)

| Rota | Arquivo | Função |
|------|---------|--------|
| `/financeiro` | `src/pages/Financeiro.tsx` (924 linhas) | Hub com 4–5 abas: Entradas, A Receber, Saídas, Caixa, Integrações (condicional) |
| `/orcamentos` | `src/pages/Orcamentos.tsx` (899 linhas) | CRUD de orçamentos (não é financeiro stricto sensu, mas alimenta atendimentos) |
| `/convenios` | `src/pages/Convenios.tsx` (19 linhas) | Wrapper fino — UI de gestão fica em `Configuracoes` |

### Subdiretório `src/pages/Financeiro/`

```
Financeiro/
├── FinanceiroContext.tsx        # Provider que distribui state/derivados às abas
├── types.ts                     # TabType, FinanceiroEntry, AReceberRow, CaixaMov, baseTabs, paymentIcons
├── helpers.ts                   # parseDate, maskDateBR, isValidDateBR, saidaToEntry
├── components/
│   ├── EntradasTab.tsx
│   ├── AReceberTab.tsx
│   ├── SaidasTab.tsx
│   ├── CaixaTab.tsx
│   ├── EntradasSaidasTable.tsx
│   └── dialogs/
│       ├── DetailEntryDialog.tsx
│       ├── EditEntryDialog.tsx
│       ├── DeleteEntryDialog.tsx
│       ├── PagarDespesaDialog.tsx
│       └── types.ts
├── hooks/
│   ├── useFinanceiroDialogs.ts
│   └── useFinanceiroFilters.ts
└── services/                    # Funções PURAS (sem React/Supabase)
    ├── FinanceiroService.ts     # 579 linhas — A Receber, KPIs, Caixa, builders HTML
    ├── computeDetailExames.ts
    ├── computeDetailTotals.ts
    ├── computeFinanceiroSummary.ts
    ├── filterEntradasPagas.ts
    ├── periodoRapido.ts
    ├── todayBR.ts
    ├── validatePayment.ts
    └── validateSaidaEdit.ts
```

## 2. Componentes (fora de `pages/Financeiro`)

`src/components/financeiro/`:
- `CriarItemDialog.tsx` — cria item de lista (tipo despesa, destino, forma pgto)
- `FaturaDetalheDialog.tsx` — detalha fatura de convênio (itens, totais)
- `FecharFaturaDialog.tsx` — seleciona itens faturáveis e fecha fatura
- `IntegracoesWebhookPanel.tsx` — painel da aba Integrações
- `SearchableSelect.tsx` — combobox utilitário

`src/components/PagamentoDialog.tsx` (raiz de components) — diálogo de pagamento usado em `/atendimentos` e `/financeiro` (registra em `atendimento_pagamentos`).

`src/components/NovaEntradaSaidaDialog.tsx` — modal único de criação de entrada manual / saída.

## 3. Stores (cache/data layer client-side)

| Store | Arquivo | Tabela/View | Tipo |
|-------|---------|-------------|------|
| `financeiroStore` | `src/data/financeiroStore.ts` (334) | `financeiro_saidas` (CRUD) + `financeiro_entradas` (view, read-only) | Cache síncrono + listeners |
| `financeiroListasStore` | `src/data/financeiroListasStore.ts` (180) | `select_options` (categorias `financeiro_tipo_despesa`, `financeiro_destino_pagamento`, `financeiro_forma_pagamento`) | Cache por categoria |
| `convenioFaturasStore` | `src/data/convenioFaturasStore.ts` (375) | `convenio_faturas`, `convenio_fatura_itens`, joins em `atendimento_exames` / `atendimentos` / `convenios` | Funções async (não cacheadas) |
| `convenioStore` | `src/data/convenioStore.ts` | `convenios` | Cache |
| `orcamentoStore` | `src/data/orcamentoStore.ts` (239) | `orcamentos`, `orcamento_exames` | CRUD |
| `tabelaPrecoStore` | `src/data/tabelaPrecoStore.ts` | `tabela_preco_itens` | Resolução de preço por convênio/tabela |
| `atendimentoStore/*` | `src/data/atendimentoStore/` | `atendimentos`, `atendimento_exames`, `atendimento_pagamentos` | Cache + realtime; **fonte dos pagamentos** |

## 4. Hooks específicos

- `src/hooks/useAReceberPacientes.ts` — chama RPCs `a_receber_pacientes_page` (lista paginada) e `financeiro_resumo` (KPIs de "A Receber").
- `src/hooks/useDicionario.ts` — wrapper sobre `select_options` (usado para listas financeiras).
- `src/hooks/useEnsureStore.ts` — boot lazy das stores.

## 5. Tabelas de banco usadas pelo Financeiro

| Tabela | Papel |
|--------|-------|
| `atendimentos` | Cabeçalho do atendimento; `status_pagamento` derivado |
| `atendimento_exames` | Item-de-fatura: `valor`, `desconto`, `cobranca_destino` (paciente/convenio), `convenio_cobranca_id` |
| `atendimento_pagamentos` | **Cada recebimento avulso de paciente** (`tipo`, `valor`, `data`, `observacao`) |
| `convenios` | Cadastro; `libera_fluxo_sem_pagamento`, `prazo_faturamento_dias` |
| `convenio_faturas` | Cabeçalho da fatura por convênio: `codigo`, `periodo_*`, `subtotal`, `desconto`, `total`, `status`, `forma_pagamento`, `data_pagamento` |
| `convenio_fatura_itens` | N:1 — vincula `atendimento_exames` → `convenio_faturas` |
| `financeiro_saidas` | Despesas (CRUD direto na UI) |
| `select_options` (categoria `financeiro_*`) | Dicionários: tipo despesa, destino pagamento, forma pagamento (substitui as antigas tabelas dedicadas, removidas em 2026-06-13) |
| `financeiro_destinos_pagamento`, `financeiro_formas_pagamento`, `financeiro_tipos_despesa` | **Tabelas legadas** ainda existentes no schema com RLS, mas o código atual lê/escreve via `select_options` (resíduo histórico). |
| `orcamentos`, `orcamento_exames` | Pré-financeiro (não viram entrada antes de virarem atendimento) |
| `tabela_preco_itens` | Preços por tabela (Própria, CBHPM, TUSS, particulares) |

## 6. Views

- **`financeiro_entradas`** — única view do domínio. UNION:
  - `atendimento_pagamentos` JOIN `atendimentos` → linhas tipo `'pagamento'`
  - `convenio_faturas` (status='paga') JOIN `convenios` → linhas tipo `'fatura_convenio'`
  - Colunas expostas: `pagamento_id`, `atendimento_id`, `fatura_id`, `origem`, `protocolo`, `data`, `cliente`, `convenio`, `payment`, `valor_total`, `observacao`, `unidade_id`, `status_pagamento`, `tenant_id`.

## 7. RPCs / Funções SQL relacionadas

| Função | Uso |
|--------|-----|
| `a_receber_pacientes_page(...)` | Página de saldos abertos por paciente (cursor) |
| `financeiro_resumo(...)` | KPIs de A Receber (parciais/pendentes/total) |
| `atendimento_assign_protocolo`, `atendimento_sign_protocolo`, `protect_atendimento_protocolo`, `validate_protocolo_atendimento` | Geração/proteção do protocolo `ATD-AAAA-NNNNNNN` |
| `convenio_fatura_assign_codigo`, `convenio_fatura_sign_codigo`, `protect_convenio_fatura_codigo`, `protect_convenio_fatura_paga`, `validate_protocolo_fatura`, `touch_convenio_faturas_updated_at` | Geração/proteção do código da fatura e travamento ao virar `paga` |
| `financeiro_saida_assign_protocolo`, `financeiro_saida_sign_protocolo`, `protect_financeiro_saida_protocolo`, `validate_protocolo_saida` | Protocolo `SAI-AAAA-NNNNNNN` |
| `validate_protocolo_orcamento` | Protocolo de orçamento |
| `audit_atendimento_pagamentos` | Trigger de auditoria sobre `atendimento_pagamentos` |
| `trg_recompute_on_pagamento_change` | Recalcula `status_pagamento` em `atendimentos` ao mudar pagamento |
| `seed_default_formas_pagamento_for_tenant` | Seed de dicionário ao criar tenant |
| `create_atendimento_tx` | Cria atendimento + exames + pagamentos iniciais em uma única transação |

> **Não há** RPCs de "abrir caixa" / "fechar caixa" / "estorno" / "glosa" / "centro de custo" / "categoria contábil". O domínio não as possui hoje.

## 8. Edge Functions

Nenhuma edge function tem responsabilidade financeira direta. A função `create-atendimento` apenas envelopa o RPC `create_atendimento_tx` (que insere pagamentos iniciais).

Funções `super-admin-billing` / `super-admin-change-tenant-plan` / `super-admin-tenant-snapshot` etc. tratam **billing de plataforma** (assinaturas SaaS do tenant), não o financeiro do laboratório — são domínio separado.

## 9. Permissões usadas pelo módulo

- `visualizar_financeiro` — leitura das telas/views
- `gestao_financeira` — CRUD de saídas, faturas, dicionários
- `registrar_pagamento` — INSERT/UPDATE em `atendimento_pagamentos`
- `visualizar_atendimentos` — leitura compartilhada (entradas dependem de atendimentos)
- Role `admin` — DELETE em saídas/faturas/convênios

## 10. Feature flags / variantes

- `paginated_atendimentos` (`useFeatureFlag`) controla se "A Receber" usa o RPC paginado ou o cálculo client-side a partir do cache de atendimentos.
- Aba **Integrações** só aparece para `super_admin` ou roles com permissão de integrações.
