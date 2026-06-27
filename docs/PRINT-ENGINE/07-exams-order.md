# 07 — Ordem dos Exames

## Como a lista é construída

```ts
// src/pages/ResultadoDetalhe.tsx:1141
const printable = exames.filter((e) => canPrint(e.status));
```

Sem `.sort()`, sem reorganização. A ordem do array `printable` é **exatamente** a ordem do array `exames` filtrado.

## De onde vem `exames`?

Hidratado por `atendimentoStore` a partir de `atendimento_exames` no banco:

```ts
// src/data/atendimentoStore/exames.ts:30 e :105
.from("atendimento_exames")
.order("ordem", { ascending: true })
```

Coluna `ordem` é gravada na criação do atendimento (`create_atendimento_tx`) com a sequência em que o operador adicionou os exames.

## Conclusão

| Pergunta | Resposta |
|---|---|
| Ordem do atendimento (sequência de inclusão)? | **SIM** — coluna `atendimento_exames.ordem`. |
| Ordem alfabética? | Não. |
| Ordem do banco (insert order natural)? | Não. Usa coluna explícita `ordem`. |
| Ordem aleatória? | Não. |
| Reordenação no PDF? | Nenhuma. |

## Validação

A ordem só corresponderia à expectativa do usuário se:
1. `ordem` na tabela for atribuída corretamente na criação/edição do atendimento.
2. Reordenações posteriores (via UI) **persistirem** essa coluna.

Auditar `create_atendimento_tx` e `update_atendimento_tx` em outra fase para confirmar — fora do escopo deste relatório.
