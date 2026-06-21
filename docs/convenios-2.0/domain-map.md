# Convênios 2.0 — Mapa de Domínio

## Entidades existentes hoje

```text
              ┌─────────────────┐
              │   convenios     │  (1 cadastro = 1 linha; id=0 = Particular)
              └────────┬────────┘
                       │ 1
                       │
                       │ N
              ┌────────▼─────────┐
              │ tabela_preco_itens│  (preço por convênio/exame/tabela)
              └──────────────────┘

              ┌─────────────────┐         ┌──────────────────────┐
              │   atendimentos  │ 1───N ▶ │  atendimento_exames  │
              └─────────────────┘         │  + cobranca_destino  │
                                          │  + convenio_cobranca │
                                          └──────────┬───────────┘
                                                     │ N
                                                     │
                                                     │ 1 (opcional)
                                          ┌──────────▼───────────┐
                                          │ convenio_fatura_itens│
                                          └──────────┬───────────┘
                                                     │ N
                                                     │
                                                     │ 1
                                          ┌──────────▼───────────┐
                                          │   convenio_faturas   │
                                          │  (aberta│paga│cancel)│
                                          └──────────┬───────────┘
                                                     │
                                            (status='paga')
                                                     │
                                                     ▼
                                          financeiro_entradas (view)
                                          origem='fatura_convenio'
```

## Tabela ↔ Domínio

| Conceito de domínio | Implementação atual | Existe formalmente? |
|---|---|---|
| **Convênio** | `convenios` | ✅ |
| **Plano do convênio** | — (somente `convenios.tipo`) | ❌ não modelado |
| **Tabela de preços** | `tabela_preco_itens` + `convenios.tabela` | ✅ |
| **Guia / autorização** | — | ❌ |
| **Lote / remessa** | parcialmente, via `convenio_faturas` (lote = fatura) | ⚠️ implícito |
| **Fatura** | `convenio_faturas` + `convenio_fatura_itens` | ✅ |
| **Item faturável** | `atendimento_exames WHERE cobranca_destino='convenio' AND NOT EXISTS fatura_itens` | ✅ implícito (sem flag, calculado) |
| **Glosa** | — | ❌ |
| **Reapresentação** | — | ❌ |
| **Pagamento recebido** | UPDATE em `convenio_faturas.status='paga'` | ✅ (não é registro separado) |
| **Recebimento parcial** | — (fatura é tudo-ou-nada) | ❌ |
| **Competência (mês de faturamento)** | implícito em `periodo_inicio`/`periodo_fim` | ⚠️ não há fechamento |

## Relacionamentos (cardinalidades reais)

- `convenios` 1—N `convenio_faturas` (1 convênio tem várias faturas).
- `convenio_faturas` 1—N `convenio_fatura_itens` 1—1 `atendimento_exames` (cada exame só pode estar em UMA fatura — não há FK, mas é a regra de negócio do `fetchItensFaturaveis`).
- `atendimentos` 1—N `atendimento_exames` (um exame pertence a um atendimento; `cobranca_destino` decide se entra no fluxo paciente ou convênio).
- `convenios.id=0` (Particular) **nunca** entra em `convenio_faturas` (filtrado em `financeiro_a_receber_v2` e por convenção do `cobranca_destino='paciente'`).

## Fluxo do "exame" como entidade-âncora

`atendimento_exames` é a unidade atômica do faturamento. Suas colunas decisivas:

- `cobranca_destino`: `'paciente'` | `'convenio'` (decide o lado).
- `convenio_cobranca_id`: ponteiro para `convenios.id` quando convênio.
- `valor`: valor unitário (snapshot).
- `status`: `pendente`/`coletado`/`em_analise`/`finalizado`/`cancelado`.
- Não existe coluna `glosado`, `valor_glosado`, `reapresentado_em`, `competencia` — todas são inexistentes.

## Identidade visual no domínio

- Particular (id=0) é uma "pseudo-entidade convênio" usada apenas para preenchimento de UI; em todo lugar sensível ele é filtrado (`c.id <> 0` em `financeiro_a_receber_v2`).
