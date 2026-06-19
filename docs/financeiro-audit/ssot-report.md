# Fonte de Verdade (SSOT) — Financeiro

| Métrica / Conceito | Fonte de verdade | Calculado em |
|--------------------|------------------|--------------|
| Receita realizada (entradas) | `view public.financeiro_entradas` | Banco (UNION de `atendimento_pagamentos` + `convenio_faturas where status='paga'`) |
| Saldo "A Receber" de paciente | `atendimento_exames` (cobranca_destino='paciente') − `atendimento_pagamentos` | RPC `a_receber_pacientes_page` (banco) **ou** `buildAReceberRowsFromAtendimentos` (cliente, fallback) |
| Saldo "A Receber" de convênio | `atendimento_exames` (cobranca_destino='convenio') sem `convenio_fatura_itens` em fatura `paga` | `fetchSaldoEmAbertoPorConvenio` (banco) |
| Status de pagamento do atendimento | `atendimentos.status_pagamento` | Trigger `trg_recompute_on_pagamento_change` (banco) |
| Despesas (saídas) | `financeiro_saidas` (linha) | Banco direto |
| Forma de pagamento de uma saída | Sufixo `[pgto:X]` em `financeiro_saidas.descricao` | Cliente (encode/decode) — **não tem SSOT canônico** |
| Saldo de caixa por dia | `financeiro_entradas` ∪ `financeiro_saidas where foi_pago=true` | Cliente (`buildCaixaMovimentos`+`applyCaixaSaldoAcumulado`) |
| Inadimplência | derivada de A Receber + idade da `atendimentos.data` | Implícita (não há flag/agregação canônica) |
| Faturamento (recebido + a receber) | Σ `atendimento_exames.valor − desconto` − cancelados | Não há SSOT único; reconstruído em telas (KPIs em `computeFinanceiroSummary`) |
| Total faturado convênio | `convenio_faturas.total` (snapshot) | Banco |
| Resumo financeiro do dashboard | RPC `financeiro_resumo` | Banco |
| Protocolo (ATD/FAT/SAI) | Triggers de assinatura HMAC | Banco |

## Conclusões

1. **Entradas têm SSOT clara**: `financeiro_entradas` (view).
2. **Saídas têm SSOT clara**: `financeiro_saidas` — porém com **um campo crítico (forma de pagamento) sem coluna**, codificado em string. Isso compromete relatórios futuros que precisem agrupar por meio de pagamento de despesa.
3. **A Receber tem dupla implementação** (RPC paginado vs. cálculo client) controlada por feature flag — risco de divergência se as fórmulas saírem de sincronia.
4. **Caixa não tem SSOT** — é puramente derivado em runtime no cliente. Não há materialização nem auditoria de saldo histórico.
5. **Inadimplência, ticket médio, mix de receita por convênio**: não têm SSOT — qualquer KPI assim hoje é recomputado on-the-fly.
6. **Faturamento global** (vendido, não necessariamente recebido): não há fonte canônica — só pode ser reconstruído a partir de `atendimento_exames` filtrando cancelados.

## Risco de inconsistência identificado

- A view `financeiro_entradas` **não filtra atendimentos cancelados** explicitamente. Pagamentos de atendimentos cancelados continuam aparecendo como entrada (intencional ou não — não há regra documentada).
- `convenio_faturas` cancelada com `data_pagamento` previamente preenchida: a condição `WHERE cf.status='paga'` da view evita o problema, mas trocar status para `paga` e voltar para `cancelada` não tem trilha clara.
