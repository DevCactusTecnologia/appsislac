# Convênios 2.0 — Fluxos Reais

## Fluxo 1 — Atendimento de Convênio (entrada do exame na fila de faturamento)

```text
Paciente
  │
  ▼
NovoAtendimento.tsx
  │
  ▼
buildExamesCobranca.ts ──▶ atendimento_exames
                            cobranca_destino='convenio'
                            convenio_cobranca_id=<id>
  │
  ▼
create-atendimento (edge fn) — INSERT no banco
  │
  ▼
exame fica "elegível para fatura"
  (não faturado = NOT EXISTS em convenio_fatura_itens)
```

Observações:
- Se o usuário trocar de convênio depois, `resyncCobrancaConvenios.ts` devolve o exame para `cobranca_destino='paciente'` quando o convênio é removido.
- Não há geração de guia/autorização — o exame é registrado direto.

## Fluxo 2 — Fechamento de Convênio (fatura)

```text
/financeiro ▶ aba "Convênios" ▶ "Em aberto"
  │
  │  (lista vinda de financeiro_a_receber_v2 p_tipo='convenio')
  ▼
botão "Fechar fatura"  ──▶  FecharFaturaDialog
  │
  │  período (default: 1º do mês até hoje)
  ▼
fetchItensFaturaveis(convenioId, ini, fim)
   = SELECT em atendimento_exames
      WHERE cobranca_destino='convenio'
        AND convenio_cobranca_id = X
        AND status='finalizado'
        AND NOT EXISTS (convenio_fatura_itens)
        AND atendimento.data BETWEEN ini..fim
  │
  ▼
criarFatura()
   ├─ INSERT convenio_faturas (status='aberta', codigo=FAT-TMP-..., subtotal, desconto, total)
   │   trigger BEFORE INSERT → assigna codigo FAT-AAAA-NNNNNNN
   │   trigger AFTER  INSERT → assina HMAC, registra em protocolo_auditoria
   └─ INSERT convenio_fatura_itens (N linhas)
  │
  ▼
opcional: marcarFaturaPaga(formaPagamento, dataPagamento)
   └─ UPDATE convenio_faturas SET status='paga', forma_pagamento, data_pagamento
      ↑ trigger protect_convenio_fatura_paga: trava edição estrutural
      ↑ view financeiro_entradas passa a expor a fatura como entrada agregada
```

Pontos críticos:
- O critério "elegível" exige `status='finalizado'` em **todos** os exames do período. Exames em coleta/em_analise ficam fora.
- A criação da fatura **não recalcula** nada em `atendimentos` — não há trigger em `convenio_fatura_itens`.
- Cancelamento (`cancelarFatura`) faz DELETE dos itens e UPDATE para `status='cancelada'`. Os exames voltam a ser "faturáveis" automaticamente (regra implícita do NOT EXISTS).

## Fluxo 3 — Glosa

```text
(não existe)
```

Hoje a operação prática (descrita em `docs/financeiro-audit/business-rules.md`):
1. Convênio paga menos do que a fatura. 
2. Operador **cancela** a fatura (status='cancelada') ou aplica desconto manual em `convenio_faturas.desconto` antes de marcar `paga`.
3. Refatura os itens (que voltam a ser elegíveis). 
4. Não há rastreamento de "este exame foi glosado por motivo X".

Risco: histórico de glosa é **perdido** entre cancelamentos.

## Fluxo 4 — Reapresentação

```text
(não existe)
```

Mesma situação da glosa. Reapresentação = nova fatura sobre os mesmos itens. Como não há `glosa` formal, não há tampouco `reapresentado_em`, nem distinção entre "fatura original" e "reapresentação".

## Fluxo 5 — Recebimento de fatura

```text
FecharFaturaDialog (após criar) ──▶ marcarFaturaPaga
   │
   │  forma_pagamento (PIX, Dinheiro, Cartão, Boleto, ...)
   │  data_pagamento
   ▼
UPDATE convenio_faturas SET status='paga', forma_pagamento, data_pagamento
   │
   ▼
view financeiro_entradas (UNION ALL) emite 1 linha
   origem='fatura_convenio', payment=forma_pagamento, valor_total=total
   │
   ▼
aparece em /financeiro ▶ Entradas (livro caixa)
```

Pontos críticos:
- **Não passa por `atendimento_pagamentos`.** O recebimento é só um UPDATE.
- **Não vincula a `caixa_sessoes`.** Faturas pagas (mesmo PIX/Dinheiro) **não entram no Caixa Operacional** — caixa só pega `atendimento_pagamentos` (Fase 5).
- Não há recebimento parcial. Marcar como paga = receber 100% do `total`.

## Fluxo 6 — Cancelamento

```text
cancelarFatura(faturaId)
  ├─ DELETE em convenio_fatura_itens   ← libera os exames
  └─ UPDATE convenio_faturas SET status='cancelada'
```
Se a fatura já estava `paga`, o trigger `protect_convenio_fatura_paga` permite a transição para `cancelada` (mas barra qualquer outra edição). Não há registro de "estorno" formal — o lançamento na view `financeiro_entradas` desaparece, sem deixar histórico.

## Fluxo 7 — Cadastro / cobertura de tabelas

```text
/configuracoes ▶ aba Convênios
   │
   ├─ CRUD convenios (admin)
   │
   └─ ConvenioExamesPanel
        ↑ leitura de tabela_preco_itens via tabelaPrecoStore
```

## Fluxo 8 — Competência

```text
(não existe)
```

Não há "fechamento de competência mensal". A operação que mais se aproxima é o filtro `periodo_inicio/periodo_fim` ao criar a fatura. Não há `competencia` denormalizada no banco.
