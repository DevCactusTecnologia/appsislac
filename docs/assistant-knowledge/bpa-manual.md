# Manual de BPA (SUS)

## Objetivo
Produzir o Boletim de Produção Ambulatorial para faturamento SUS.

## Fluxo
```
Atendimentos SUS do mês → Validação → Fechamento → Geração do arquivo → Exportação
```

## Conceitos
- **Competência**: mês de referência.
- **Produção**: conjunto de procedimentos faturáveis.
- **Validação**: checagem de CNS, CID, procedimento.
- **Fechamento**: bloqueia edição daquela competência.

## Principais perguntas
- "Quantos atendimentos SUS este mês?"
- "Tem inconsistência no BPA?"
- "Emita o BPA."

## Principais ações
| Intenção | Capability |
| --- | --- |
| Validar produção | `bpa.validar` (quando registrada) |
| Emitir | `bpa.emitir` (needsApproval) |

## Erros frequentes
- CNS ausente.
- CID incompatível com procedimento.
- Paciente sem data de nascimento.

## Boas práticas
- Validar semanalmente, não só no fim do mês.
- Conferir inconsistências antes do fechamento.
