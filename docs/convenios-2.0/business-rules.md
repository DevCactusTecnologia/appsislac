# Convênios 2.0 — Regras de Negócio

> Mapeia onde cada regra mora hoje (banco, trigger, RPC, frontend).

## 1. Cadastro / identidade do convênio

| Regra | Onde vive |
|---|---|
| Particular (id=0) é único e não pode ser excluído/renomeado/desativado. | Trigger `protect_particular_convenio` (banco) + checagem em `convenioStore` (front). |
| Convênio precisa de `tabela` (CBHPM/TUSS/Própria). | Default no banco (`convenios.tabela = 'Própria'`). Validação amena no front. |
| `prazo_faturamento_dias` (default 30). | Coluna em `convenios`; **lida apenas em UI**, não usada para alertas/automação. |
| `libera_fluxo_sem_pagamento`. | Coluna usada por `atendimentoPolicy.ts` no front para liberar coleta sem pagamento. |
| Apenas `admin` cria/edita/remove convênio. | RLS (`conv_insert/update/delete`). |

## 2. Elegibilidade do exame para faturamento

| Regra | Onde vive |
|---|---|
| Exame conta para convênio se `cobranca_destino='convenio' AND convenio_cobranca_id IS NOT NULL`. | RPC `financeiro_a_receber_v2` + `fetchItensFaturaveis` (front). |
| Exame `cancelado` não conta. | Filtro `status <> 'cancelado'` em `financeiro_a_receber_v2`. |
| Para fatura, exige `status='finalizado'`. | **Apenas no front** (`fetchItensFaturaveis`). A RPC SSOT considera todos não-cancelados → divergência potencial entre "saldo em aberto" e "itens faturáveis". |
| Atendimento `Cancelado` não conta. | Filtro `a.status_atendimento <> 'Cancelado'` em v2 e em `fetchItensFaturaveis` indireto. |
| Exame não pode aparecer em duas faturas. | NOT EXISTS contra `convenio_fatura_itens` (sem FK exclusiva no banco — regra implícita). |
| Particular (id=0) nunca entra. | Filtro `c.id <> 0` em v2; cobranca_destino=paciente por convenção. |

## 3. Faturamento (criação de fatura)

| Regra | Onde vive |
|---|---|
| Código `FAT-AAAA-NNNNNNN` é gerado pelo banco. | Trigger `convenio_fatura_assign_codigo` + `generate_protocolo_sequencial`. |
| Assinatura HMAC em `protocolo_auditoria`. | Trigger `convenio_fatura_sign_codigo`. Validável via `validate_protocolo_fatura(codigo)`. |
| `subtotal = Σ valor` dos itens; `total = subtotal − desconto`. | Calculado pelo front (`criarFatura`). Banco aceita qualquer valor (sem trigger validando). |
| `status` inicial = `aberta`. | Default no banco. |
| Permissão: `gestao_financeira` para criar/editar; `admin` para deletar. | RLS `cf_*` / `cfi_*`. |
| Não há recebimento parcial. | Convenção do front: `marcarFaturaPaga` define total integral. |
| Não há limite mínimo/máximo de itens. | Front exige ≥ 1 item. |

## 4. Pagamento da fatura

| Regra | Onde vive |
|---|---|
| Marcar paga = UPDATE `status='paga'`, `forma_pagamento`, `data_pagamento`. | Front (`marcarFaturaPaga`). |
| Após paga, é proibido alterar `subtotal/desconto/total/periodo_*`. Só permite `status='cancelada'`. | Trigger `protect_convenio_fatura_paga`. |
| Aparece em `financeiro_entradas` como `origem='fatura_convenio'`. | View `financeiro_entradas`. |
| **NÃO entra em `caixa_sessoes`** mesmo se PIX/Dinheiro. | Decisão arquitetural Fase 5 — gatilho de caixa só em `atendimento_pagamentos`. |
| Não passa por `atendimento_pagamentos` (não é pagamento aditivo). | Convenção do domínio. |

## 5. Cancelamento

| Regra | Onde vive |
|---|---|
| Cancelar = DELETE itens + UPDATE status='cancelada'. | Front (`cancelarFatura`). |
| Itens voltam a ser elegíveis para nova fatura (NOT EXISTS). | Implícito. |
| Cancelamento de fatura paga é permitido pelo trigger. | `protect_convenio_fatura_paga` bloqueia tudo menos transição para `cancelada`. |
| Não há registro de "motivo do cancelamento". | Coluna `observacao` é livre. |
| Não há trigger de auditoria em `convenio_faturas`/`convenio_fatura_itens`. | Documentado em `docs/financeiro-audit/security-map.md` (linhas 87-92). |

## 6. Glosa

> Não existe regra formal. Operação manual via cancelar+refaturar ou desconto manual.

## 7. Reapresentação

> Não existe. Reapresentar = criar nova fatura com os mesmos itens (após cancelar a original).

## 8. Competência

> Não existe fechamento. Competência ≈ `periodo_inicio`/`periodo_fim` da fatura. Sem trigger, sem coluna `competencia` em `atendimento_exames`.

## 9. Recoletas / exames repetidos

| Regra | Onde vive |
|---|---|
| Recoleta cria novo registro em `recoletas` mas não duplica `atendimento_exames`. | Domínio Recoletas (separado). |
| Não há regra "recoleta não pode ser refaturada". | Inexistente. O exame original continua na fatura, recoleta não vira item de fatura. |

## 10. Pagamentos múltiplos no mesmo período

| Regra | Onde vive |
|---|---|
| Um exame só pode estar em uma fatura. | Implícito (NOT EXISTS). |
| Um convênio pode ter N faturas em um mesmo período. | Não há restrição. |
| Sem detecção de overlap entre faturas (mesmo período → 2 faturas separadas se feitas em momentos distintos). | Inexistente. |

## 11. RLS (resumo)

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `convenios` | super_admin OR mesmo tenant | admin | admin | admin |
| `convenio_faturas` | super_admin OR (tenant + `visualizar_financeiro`) | tenant + `gestao_financeira` | tenant + `gestao_financeira` | tenant + admin |
| `convenio_fatura_itens` | idem | idem | idem | idem |

## 12. Onde a regra mora? (resumo)

| Camada | Regras concentradas |
|---|---|
| Banco/trigger | proteção Particular, código FAT, assinatura, proteção pós-paga, updated_at. |
| RPC | SSOT do A Receber (v2 + totais). Nenhuma RPC de mutação. |
| Frontend | criar/cancelar/marcar paga, cálculo de subtotal/total, filtro `status='finalizado'`, validação de elegibilidade. |
| Sem dono claro | Glosa, reapresentação, recoleta-fatura, competência. |
