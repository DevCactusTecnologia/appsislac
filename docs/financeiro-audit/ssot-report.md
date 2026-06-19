# Single Source of Truth (SSOT) — Financeiro SISLAC

> Para cada métrica/conceito, qual é a **única** fonte da verdade hoje.

| Métrica / Conceito | Fonte da verdade | Onde é calculada | Observação |
|---|---|---|---|
| Recebimento individual de paciente | `atendimento_pagamentos` (tabela) | DB | Toda entrada de paciente é literal aqui |
| `status_pagamento` do atendimento | Trigger `trg_recompute_on_pagamento_change` | DB | Recalculado em INSERT/UPDATE/DELETE de pagamento. Cliente NÃO deve calcular. |
| Valor faturado de convênio | `convenio_faturas.total` + `convenio_fatura_itens.valor` | DB | `total = max(0, subtotal − desconto)` |
| "Entradas" (regime de caixa, exibição) | View `financeiro_entradas` (UNION ALL) | DB | Read-only. Nunca escrever direto. |
| "A Receber" (paciente, paginado) | RPC `a_receber_pacientes_page` | DB | Quando flag `paginated_atendimentos` ON e `USE_LEGACY_STORE` OFF. |
| "A Receber" (paciente, fallback legacy) | `buildAReceberRowsFromAtendimentos` em `FinanceiroService.ts` | Cliente | Lê de `getAtendimentos()` (cache de até 100 atendimentos). **Inconsistente em volume grande**. Ver complexity. |
| "A Receber" (convênio, saldo em aberto) | `fetchSaldoEmAbertoPorConvenio` | Cliente (mas com query SQL única) | Calcula sobre `atendimento_exames` filtrando os já-faturados. |
| Resumo financeiro agregado (KPIs do header) | RPC `financeiro_resumo` | DB | Quando RPC mode ON. Caso contrário, derivações em cliente sobre os mesmos dados. |
| Despesa / Saída | Tabela `financeiro_saidas` | DB | Forma de pagamento codificada na descrição. |
| Caixa (saldo, lançamentos) | **Cliente — derivado** (`buildCaixaMovimentos` + `applyCaixaSaldoAcumulado`) | Cliente | **Não persistido**. Não existe SSOT no banco para caixa. |
| Dicionários (tipo/destino/forma) | `select_options` (categorias `financeiro_*`) | DB | Cache local com listeners no `financeiroListasStore`. |
| Convênios (nome ↔ id) | `convenios` | DB | Via `convenioStore`. |
| Numeração de documentos (ATD/FAT/SAI) | Triggers PG | DB | Cliente nunca define o número final. |

## Múltiplas fontes para "A Receber" — observação crítica

Existe um **branch dual** controlado por feature flags em `Financeiro.tsx`:

```
ffPaginated && !ffLegacy
   → useAReceberPacientes() → RPC a_receber_pacientes_page  (DB)
   → useFinanceiroResumo()  → RPC financeiro_resumo         (DB)
caso contrário
   → buildAReceberRowsFromAtendimentos(getAtendimentos())   (cliente, cache de 100)
```

Quando o branch legacy estiver ativo num tenant com mais de 100 atendimentos no cache, **A Receber e os KPIs ficam subestimados**. A RPC é a única fonte fiel ao banco em volume.

## Dupla fonte para "Forma de pagamento" de despesa

- **Banco:** sufixo serializado em `financeiro_saidas.descricao` (`[pgto:PIX]`).
- **Cliente:** dicionário `financeiro_forma_pagamento` (`select_options`).

A primeira é a fonte da verdade do **valor lançado**; a segunda é a fonte da verdade do **conjunto de opções permitidas**. As duas só se mantêm coerentes se o usuário não excluir uma forma já em uso (não há FK).

## "Status de atendimento" e o financeiro

- A RPC `financeiro_resumo` filtra `a.status_atendimento <> 'Cancelado'`.
- A view `financeiro_entradas` **não filtra** por status do atendimento. Pagamentos lançados em atendimentos depois cancelados continuam aparecendo em "Entradas" pela view. Documentado em complexity-report como ponto de atenção.

## Caixa — ausência de SSOT

- Não existe abertura/fechamento de caixa, snapshot de saldo, hash de fechamento ou lacre temporal.
- Cada navegador recalcula o caixa do zero a cada render da aba, lendo entradas + saídas pagas.
- Saldo final é determinístico (mesmo input ⇒ mesmo output), mas **não é auditável historicamente**: se um pagamento de ontem for editado hoje, o livro-caixa de ontem muda.
