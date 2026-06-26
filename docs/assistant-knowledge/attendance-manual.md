# Manual de Atendimento

## Objetivo
Registrar a solicitação de exames de um paciente, com preço, convênio, coletador e prioridade.

## Fluxo
```
Novo atendimento → Seleção de exames → Convênio/preço → Coleta → Triagem → Análise → Resultado → Liberação
```

## Status (oficial, sem sinônimos)
- **Aguardando coleta**
- **Coletado**
- **Em análise**
- **Pendente** (falta amostra, falta dado, recoleta)
- **Liberado**
- **Entregue**
- **Cancelado**

A transição entre status é automática; o Assistente nunca força status fora da regra.

## Cancelamento
Sempre exige motivo (lista pré-definida). O Assistente pede confirmação explícita.

## Pendências comuns
- Amostra insuficiente → recoleta.
- Jejum não cumprido → recoleta ou nota.
- Dados ausentes (sexo/idade) → bloqueia validação clínica.

## Principais perguntas
- "Quantos atendimentos pendentes hoje?"
- "Quais atendimentos estão aguardando coleta?"
- "Abra o atendimento em foco."

## Principais ações
| Intenção | Capability |
| --- | --- |
| Abrir atendimento | `atendimento.abrir` |
| Listar pendentes | `atendimento.listarPendentes` (quando registrada) |
| Cancelar | `atendimento.cancelar` (needsApproval) |

## Boas práticas
- Sempre confirmar jejum no momento da coleta.
- Atendimentos urgentes devem ser sinalizados na criação, não depois.
