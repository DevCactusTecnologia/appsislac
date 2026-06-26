# Manual Financeiro

## Objetivo
Controlar recebimentos, despesas, convênios, faturamento e inadimplência.

## Princípios
- **Entradas são read-only** no módulo Financeiro — criadas exclusivamente a partir de Atendimentos.
- Saídas (despesas) podem ser lançadas manualmente.
- Convênio "Particular" é padrão (id `0`).

## Convênios
- Cada convênio tem tabela de preço própria (CBHPM, TUSS, Própria).
- Faturamento por competência mensal.
- Glosa = item recusado pelo convênio, exige recurso ou ajuste.

## Inadimplência
- Paciente com saldo em aberto após vencimento.
- Hook oficial: `useAReceberPacientes`.

## Principais perguntas
- "Quanto recebi hoje?"
- "Quais pacientes estão inadimplentes?"
- "Gere um PDF das despesas deste mês."
- "Qual a fatura aberta do convênio X?"

## Principais ações
| Intenção | Capability |
| --- | --- |
| Listar inadimplentes | `financeiro.inadimplentes` (quando registrada) |
| Relatório do período | `financeiro.relatorio` (quando registrada) |
| Abrir fatura de convênio | `financeiro.faturaConvenio` (quando registrada) |

## Regras de segurança
- Nunca editar entrada — sempre orientar a editar o atendimento de origem.
- Nunca expor valores agregados de outros tenants.

## Boas práticas
- Conciliar caixa diariamente.
- Fechar competência de convênio dentro do prazo contratual.
