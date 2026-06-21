# Financeiro 2.0 — SSOT Final

> Fase 1 da missão "Financeiro 2.0". Documento somente-leitura.
> Consolida `docs/financeiro-audit/ssot-report.md` e `docs/financeiro/ssot.md`
> com o estado real do banco em 2026-06-21.

## 1. Princípio único

> **Frontend lê. Backend calcula. Nada é destrutivo.**

Toda movimentação financeira é **aditiva** (INSERT) ou **anulada por estorno**
(linha em `financeiro_estornos`). DELETE não é caminho operacional.

## 2. Tabela única de fontes de verdade

| Conceito | SSOT (oficial) | Onde calcula | Status |
|---|---|---|---|
| Receita realizada (entradas) | `view public.financeiro_entradas` | Banco — UNION de `atendimento_pagamentos` + `convenio_faturas where status='paga'` | ✅ implantado |
| Recebimento de paciente | `atendimento_pagamentos` (1 linha = 1 recebimento) | Banco | ✅ implantado |
| Status de pagamento do atendimento | `atendimentos.status_pagamento` | Banco — `trg_recompute_on_pagamento_change` | ✅ implantado |
| Recebimento de convênio | `convenio_faturas.status='paga'` + `data_pagamento` + `forma_pagamento` | Banco — protegido por `protect_convenio_fatura_paga` | ✅ implantado |
| A Receber (paciente + convênio) | RPC `financeiro_a_receber_v2` | Banco | ✅ implantado |
| Despesas (saídas) | `financeiro_saidas` | Banco | ✅ implantado |
| Forma de pagamento de saída | sufixo `[pgto:X]` em `financeiro_saidas.descricao` | Cliente (encode/decode) | ⚠️ sem coluna canônica — decisão pendente |
| Estorno (pagamento, fatura, saída) | `financeiro_estornos` + RPC `financeiro_estornar(p_id, p_motivo, p_tipo)` | Banco | ✅ tabela + RPC + UI `EstornarDialog` |
| Caixa operacional (sessão) | `caixa_sessoes` | Banco | ⚠️ tabela existe, **0 uso no frontend** — Fases 5–6 |
| Livro-caixa (relatório derivado) | `financeiro_entradas` ∪ `financeiro_saidas where foi_pago=true` | Cliente — `buildCaixaMovimentos` | ✅ implantado, vira "relatório" pós-Fase 5 |
| Subtotal / Desconto / Acréscimo / Total do atendimento | `atendimento_exames.valor` − `atendimento_exames.desconto` | Cliente — recomputado on-the-fly | ⚠️ não persistido no `atendimentos` — Fase 4 |
| Protocolos (ATD/FAT/SAI) | Triggers `*_assign_protocolo` + `*_sign_protocolo` (HMAC) | Banco | ✅ implantado |
| Multi-tenancy | `tenant_id = current_tenant_id()` em todas as queries + RLS | Banco | ✅ implantado |

## 3. O que JÁ É SSOT único hoje

1. **Entradas** — view `financeiro_entradas` é a única leitura de receita realizada.
2. **A Receber** — RPC `financeiro_a_receber_v2` é a única origem para pacientes e convênios.
3. **Status de pagamento** — derivado em banco por trigger; cliente apenas lê.
4. **Estorno** — `financeiro_estornos` + `financeiro_estornar()` cobrem os 3 tipos.
5. **Protocolos** — gerados e assinados em banco; impossível duplicar.
6. **Faturamento de convênio** — `convenio_faturas` imutável após `paga`.

## 4. O que ainda NÃO É SSOT (gaps a fechar)

| Gap | Impacto | Fase que resolve |
|---|---|---|
| `atendimento_pagamentos` ainda permite DELETE para `admin` | Histórico financeiro pode sumir sem trilha | Fase 2 (depende de decisão #1) |
| Pagamento estornado não tem flag canônica em `atendimento_pagamentos` | Estorno hoje só vive em `financeiro_estornos`, sem retroação clara na view de entradas | Fase 2 |
| `subtotal / desconto / acrescimo / total` do atendimento não persistem | Relatórios reconstroem on-the-fly; acréscimo nem existe formalmente | Fase 4 |
| Forma de pagamento de saída codificada em string `[pgto:X]` | Não é agrupável em SQL puro | decisão #4 |
| Caixa não tem sessão operacional | Sem responsável, sem fechamento, sem divergência registrada | Fases 5–6 |
| Tabelas legadas (`financeiro_tipos_despesa`, `financeiro_destinos_pagamento`, `financeiro_formas_pagamento`) | Schema poluído | Fase 9 — apenas documentar (usuário pediu **não dropar**) |

## 5. Riscos identificados (não-bloqueantes)

- View `financeiro_entradas` não filtra atendimentos cancelados — hoje é intencional (recebimento prévio continua sendo receita), mas precisa estar documentado.
- `useFinanceiroResumo` ainda usa caminho separado da v2 — risco de divergência de KPI vs. lista. Unificar na Fase 7.
- `paginated_atendimentos` feature flag ainda referenciada em pontos residuais.

## 6. Decisões pendentes para destravar Fase 2+

1. **DELETE em `atendimento_pagamentos`**: revogar para `admin` (forçando estorno) ou manter como escape hatch técnico?
2. **Acréscimo**: persistir como escalar em `atendimentos.acrescimo_total` ou distribuir em `atendimento_exames.acrescimo`?
3. **Caixa operacional**: 1 sessão `aberta` por unidade, com múltiplos operadores lançando nela (assumido), ou 1 sessão por operador?
4. **Forma de pagamento de saída**: migrar para coluna dedicada agora (Fase 2) ou postergar (manter `[pgto:X]`)?

## 7. Fora de escopo (regra de parada da missão)

Plano de contas, DRE, centro de custo, conciliação bancária, glosa estruturada, recurso, recebimento parcial de fatura de convênio, comissão de solicitante. Nenhum deles entra no Financeiro 2.0.

---

**Status da Fase 1:** concluída. Aguardando respostas das 4 decisões para iniciar Fase 2 (pagamentos aditivos + remoção de DELETE da UI).
