# Financeiro 2.0 — Relatório da Fase 2

**Escopo:** apenas os 4 gaps cirúrgicos identificados na Fase 1.
**Princípio:** _frontend lê, backend calcula, nada é destrutivo._

---

## Decisão 1 — Revogação de `DELETE` em `atendimento_pagamentos`

### Antes
- Policy `atpag_delete` permitia DELETE quando `tenant_id = current_tenant_id() AND has_role('admin')`.
- Trigger `trg_block_delete_pagamentos` já barrava no momento da execução (mensagem "Use estorno").
- Resultado: defesa em profundidade existia, mas o caminho RLS continuava _aberto_.

### Depois (esta fase)
- `DROP POLICY atpag_delete` aplicado.
- `atendimento_pagamentos` agora tem **apenas SELECT/INSERT/UPDATE** liberados em RLS para `authenticated`.
- DELETE só é possível via `service_role` (bypass de RLS) — uso técnico excepcional.
- RPC `update_atendimento_tx` já é aditiva (linhas 96-116 mostram `INSERT` puro, sem `DELETE FROM atendimento_pagamentos`).
- UI: `EstornarDialog` substitui qualquer fluxo de "excluir pagamento".

✅ **DELETE operacional eliminado.**

---

## Decisão 2 — Pagamentos aditivos

Já estava implementado em fases anteriores e foi reconfirmado:

- `INSERT` via dialog de pagamento ou RPC.
- `UPDATE` apenas em `observacao` / `status_pagamento` da linha.
- `ESTORNO` via `financeiro_estornar('pagamento', id, motivo)` → grava em `financeiro_estornos`.
- DELETE inexistente em qualquer caminho operacional.

✅ **Histórico de pagamentos é permanentemente íntegro.**

---

## Decisão 3 — Acréscimo, desconto e totais como campos canônicos em `atendimentos`

### Migration aplicada
```sql
ALTER TABLE atendimentos
  ADD COLUMN subtotal         numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN desconto_total   numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN acrescimo_total  numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN total            numeric(12,2) NOT NULL DEFAULT 0;
```

### Como são preenchidos
Função SECURITY DEFINER `recompute_atendimento_totais(_atendimento_id)`:
- `subtotal` = SUM(`valor_original`) dos exames não cancelados (preço cheio).
- `total` = SUM(`valor`) dos exames não cancelados (líquido cobrado).
- `delta = subtotal - total`.
- `desconto_total` = `delta` se `delta > 0`, senão 0.
- `acrescimo_total` = `-delta` se `delta < 0`, senão 0.

Trigger `recompute_totais_on_exame` em `atendimento_exames (AFTER INSERT|UPDATE|DELETE)` chama o recompute. Backfill executado para os 4 atendimentos existentes em produção.

### Garantias
- ✔ Frontend continua **calculando** subtotal/desconto/total para a UI.
- ✔ Banco passa a ser **fonte única de verdade** para auditoria, relatórios e exportações.
- ✔ Acréscimo permanece scalar no atendimento — **não foi criado** `atendimento_exames.acrescimo`.
- ✔ Distribuição proporcional (`distribuirDescontoEntreExames`) continua intocada para cálculo runtime.

✅ **Acréscimo/desconto/subtotal/total persistidos no cabeçalho.**

---

## Decisão 4 — `financeiro_saidas.forma_pagamento`

Já implementado em fase anterior:
- Coluna `forma_pagamento text` existe e é a fonte oficial.
- Backfill rodou: `0` linhas com sufixo `[pgto:X]` em produção.
- Esta fase **removeu o parser legado** `decodePagamentoLegacy` em `src/data/financeiroStore.ts` (helper morto, 0 leitura útil restante).
- O regex `\s*\[pgto:[^\]]+\]\s*$` foi mantido apenas em `addSaida`/`updateSaida` como _sanitização defensiva_ contra entrada manual residual; sem custo e sem ramificação.

✅ **Forma de pagamento é coluna real. Texto-codificado eliminado.**

---

## Decisão 5 — `caixa_sessoes` (apenas auditoria)

Documento dedicado: [`caixa-sessoes-audit.md`](./caixa-sessoes-audit.md).

Resumo:
- Em uso? **Não** (0 referências no frontend).
- Dados? **0 linhas**.
- RLS? **Sim**, com 4 policies corretas (tenant + permissions, DELETE só super_admin).
- Triggers? **Nenhuma** (esperado — Fase 5 adicionará `updated_at` + unique parcial).
- Estrutura: pronta para Fase 5.

⛔ Conforme regra de parada: **não foi implementada abertura/fechamento de caixa.**

---

## Limpeza efetuada

| Item                                                            | Status     |
|-----------------------------------------------------------------|------------|
| Função morta `decodePagamentoLegacy` em `financeiroStore.ts`    | removida   |
| Cast `(row as SaidaRow & { forma_pagamento?: string \| null })` | removido   |
| Cast `(row as SaidaRow & { status?: string \| null })`          | removido   |
| Comentários explicando o fallback legado                        | atualizados|
| Policy `atpag_delete`                                           | removida   |

Nenhuma tabela foi removida do banco (decisão original do usuário).

---

## Validação

| Cenário                       | Resultado esperado                                                      |
|-------------------------------|-------------------------------------------------------------------------|
| Pagamento à vista             | `INSERT` em `atendimento_pagamentos`, totais recalculados via trigger   |
| Pagamento complementar        | Novo `INSERT`, sem afetar pagamentos anteriores                         |
| Desconto aplicado             | `atendimentos.desconto_total` preenchido pelo trigger                   |
| Acréscimo aplicado            | `atendimentos.acrescimo_total` preenchido pelo trigger                  |
| Estorno de pagamento          | Linha em `financeiro_estornos`; pagamento original preservado           |
| Convênio / fatura             | Inalterado                                                              |
| Saída financeira              | `forma_pagamento` lida da coluna; sem parsing                           |
| Contas a receber              | Inalterado (lê `financeiro_a_receber_v2`)                               |
| Tentativa de DELETE pagamento | RLS rejeita (sem policy) **antes** mesmo do trigger                     |

Sem regressão funcional esperada.

---

## Respostas às 10 perguntas-checklist

1. **DELETE foi eliminado?** Sim — policy revogada e trigger continua de cinto.
2. **Pagamentos ficaram aditivos?** Sim — INSERT-only via RPC e UI.
3. **Estorno virou fluxo oficial?** Sim — `financeiro_estornar` + `EstornarDialog` cobrem pagamento, fatura e saída.
4. **Acréscimo ficou persistido?** Sim — coluna `acrescimo_total` em `atendimentos`, alimentada por trigger.
5. **Forma de pagamento virou coluna?** Sim — `financeiro_saidas.forma_pagamento` é fonte exclusiva, parser legado removido.
6. **Há código morto removido?** Sim — `decodePagamentoLegacy` e casts auxiliares.
7. **Há tabelas órfãs removidas?** Não — conforme decisão do usuário, banco intocado; legado documentado em `financial-ssot-final.md`.
8. **`caixa_sessoes` está pronta para Fase 5?** Sim, estruturalmente; faltam apenas trigger `updated_at`, unique parcial e RPCs (Fase 5).
9. **Existe alguma regressão?** Nenhuma identificada; lógica de cálculo runtime (frontend) inalterada; novas colunas têm DEFAULT 0 e backfill aplicado.
10. **O sistema ficou mais simples?** Sim — uma policy a menos, um helper a menos, 4 colunas que substituem cálculos espalhados por relatórios.

---

## Próximas fases (não executadas)

- Fase 5: caixa operacional (abrir/fechar por unidade, dinheiro+PIX presencial).
- Fase 6: RPCs `caixa_abrir` / `caixa_fechar` + comprovante de fechamento.
- Fase 7: confirmar `financeiro_a_receber_v2` como SSOT único.
- Fase 8: UX por papel (recepção / financeiro / gestor).
- Fase 9: limpeza de código frontend órfão remanescente.
- Fase 10: relatório final consolidado.

⛔ **Parada respeitada.** Nada além dos 4 gaps foi tocado.
