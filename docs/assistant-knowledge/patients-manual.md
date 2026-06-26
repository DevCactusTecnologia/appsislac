# Manual de Pacientes

## Objetivo
Identificar de forma única e segura cada pessoa atendida pelo laboratório.

## Fluxo
1. **Pesquisa** antes de criar — sempre. Evita duplicidade.
2. **Cadastro** com dados mínimos: nome completo, data de nascimento, sexo, contato.
3. **Documentos** (CPF/RG) aumentam confiabilidade e são exigidos para SUS/BPA e convênios.
4. **Histórico** consolida atendimentos, resultados e financeiro do paciente.

## Duplicidades
- Mesmo nome + mesma data de nascimento = forte suspeita de duplicidade.
- O Assistente **alerta**, nunca mescla automaticamente.

## Restrições
- Menor de idade exige responsável.
- Sem data de nascimento → impossível resolver valores de referência por idade.
- Sem sexo → impossível resolver valores de referência por sexo.

## Principais perguntas que o Assistente entende
- "O que você sabe sobre Marcos Lisboa?"
- "Quantos atendimentos a Alicia tem este mês?"
- "Tem paciente duplicado com o nome João Silva?"
- "Abra o cadastro do paciente em foco."

## Principais ações
| Intenção | Capability |
| --- | --- |
| Buscar paciente | `paciente.buscar` |
| Abrir cadastro | `paciente.abrir` |
| Ver histórico | `paciente.historico` (quando registrada) |

## Erros frequentes
- Cadastrar sem conferir duplicidade.
- Cadastrar paciente sem sexo/data de nascimento.
- Telefone sem WhatsApp impede envio de laudo digital.

## Boas práticas
- Sempre pesquisar por nome + nascimento antes de cadastrar.
- Confirmar contato a cada atendimento.
