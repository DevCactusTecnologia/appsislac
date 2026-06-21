# Convênios 2.0 — Relatório Executivo (Fase 1)

> Radiografia completa do domínio Convênios. Nenhuma alteração de código, banco, RLS, RPC, trigger ou UI foi feita.

## Como o domínio Convênios funciona hoje

1. **Cadastro**: `convenios` (com Particular como id=0 protegido). Cada convênio aponta para uma `tabela` (CBHPM/TUSS/Própria/...) que casa com `tabela_preco_itens`.
2. **Atendimento**: ao registrar um exame, o front grava `atendimento_exames.cobranca_destino='convenio'` + `convenio_cobranca_id`. O exame fica "elegível" implicitamente (NOT EXISTS em `convenio_fatura_itens`).
3. **Fechamento**: na aba `/financeiro` → Convênios → Em aberto, o operador clica "Fechar fatura", escolhe período, vê itens elegíveis (`status='finalizado'` + período do atendimento), aplica desconto opcional e cria a fatura. Triggers atribuem código `FAT-AAAA-NNNNNNN` e assinatura HMAC.
4. **Recebimento**: o operador marca a fatura como `paga` com `forma_pagamento` e `data_pagamento`. A view `financeiro_entradas` expõe a fatura paga como uma linha `origem='fatura_convenio'` no livro-caixa.
5. **Cancelamento**: `cancelarFatura` apaga itens e troca status para `cancelada`. Itens voltam a ser elegíveis. Trigger `protect_convenio_fatura_paga` permite a transição mesmo se já estava paga.

## Existe SSOT?

Parcialmente.
- ✅ A Receber convênios (RPC `financeiro_a_receber_v2`) e KPIs (`financeiro_a_receber_totais`) — Fase 7.
- ✅ Cabeçalhos de fatura no banco com triggers de proteção e assinatura.
- ✅ View `financeiro_entradas` é fonte única do livro-caixa.
- ⚠️ Itens faturáveis por período só vivem no front.
- ⚠️ Cálculo de `subtotal/total` é client-side, sem revalidação no banco.

## Existe duplicação?

Sim, pontual:
- `fetchSaldoEmAbertoPorConvenio` (legado) ↔ `financeiro_a_receber_v2` (SSOT). Mesma informação, dois caminhos.
- Página `/convenios` ↔ aba Convênios em `/configuracoes`. Mesmo componente em dois pontos de entrada.

## Existe cálculo paralelo?

Sim:
- Front recalcula `subtotal/total/desconto` ao criar fatura; banco não revalida.
- Critérios de elegibilidade divergem: SSOT usa `status <> 'cancelado'`, fechamento exige `status='finalizado'`.

## Existe legado?

Sim, identificado mas não removido:
- Tabelas `financeiro_tipos_despesa`, `financeiro_destinos_pagamento`, `financeiro_formas_pagamento` (sem callers).
- `fetchSaldoEmAbertoPorConvenio` ainda exportado.
- Colunas órfãs: `convenios.prazo_faturamento_dias`, `convenios.dias_retorno`.
- Função `validate_protocolo_fatura` sem UI.

## Existe glosa formal?

❌ **Não.** Glosa é tratada como cancelamento + refaturamento manual. Sem coluna `valor_glosado`, sem motivo, sem histórico. Operador perde rastreio entre tentativas.

## Existe reapresentação formal?

❌ **Não.** É uma nova fatura sobre os mesmos itens, sem vínculo com a original.

## Existe faturamento por competência?

⚠️ **Implícito.** Competência ≈ `convenio_faturas.periodo_inicio`/`periodo_fim`. Não há "fechar competência mensal". `atendimento_exames` não tem coluna `competencia`. Sem trigger ou painel para fechamento.

## Existe risco operacional?

| Risco | Impacto | Mitigação atual |
|---|---|---|
| Cancelamento de fatura paga sem auditoria. | 🔴 Alto — perde-se lançamento financeiro. | Apenas trigger que limita campos; sem audit trail. |
| Critério "elegível" divergente entre RPC e fechamento. | 🟠 Médio — KPI vs operação podem diferir. | Nenhuma. |
| Recebimento de fatura PIX/Dinheiro não entra em Caixa Operacional. | 🟠 Médio — confusão de conferência. | Decisão de design (Fase 5). |
| Cálculo no client. | 🟡 Baixo — front controlado. | Triggers de proteção cobrem o pós-pagamento. |
| Tenant leakage. | 🟢 Baixo. | RLS estrito + super_admin só leitura. |

## Prioridades sugeridas para Fase 2

> Apenas sugestão; nenhuma decisão será executada nesta fase.

1. **Auditoria formal de fatura** (espelho de `atendimento_audit`) e **estorno em vez de DELETE** em `convenio_fatura_itens`. Resolve o risco mais alto.
2. **Glosa formal**: coluna `valor_glosado` + motivo + tabela `convenio_fatura_glosas`. Permite reapresentação rastreada.
3. **Unificar critério de elegibilidade**: front e RPC concordando em `status='finalizado'` (ou outro consenso).
4. **Recálculo no banco** de `subtotal/total` via trigger BEFORE INSERT/UPDATE em `convenio_fatura_itens` + `convenio_faturas`.
5. **Recebimento parcial** opcional (`atendimento_pagamentos`-equivalente para convênios) — discussão.
6. **Limpeza**: remover `fetchSaldoEmAbertoPorConvenio` do código, decidir destino da página `/convenios` redundante.

## Critério de sucesso desta Fase 1

✅ Inventário completo (`inventory.md`).
✅ Mapa de domínio (`domain-map.md`).
✅ Fluxos reais (`business-flows.md`).
✅ Regras (`business-rules.md`).
✅ SSOT (`ssot-report.md`).
✅ Segurança (`security-map.md`).
✅ UX operacional (`operational-ux.md`).
✅ Complexidade (`complexity-report.md`).
✅ Executivo (este).

**PARADA**: nenhuma migration, nenhuma alteração de UI, nenhuma alteração de stores. Aguardando sinal explícito para Fase 2.
