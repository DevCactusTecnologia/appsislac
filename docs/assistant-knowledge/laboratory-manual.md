# Manual do Laboratório — Visão Geral

> Base oficial de conhecimento de domínio do Assistente do SISLAC. Não é documentação técnica; é a forma como o Assistente **entende** o laboratório.

## O que é um laboratório clínico
Um laboratório clínico recebe pacientes, coleta amostras biológicas, processa exames, libera resultados e entrega laudos. Cada passo é regulado, rastreado e auditado.

## Fluxo macro (forma como o Assistente raciocina)
```
Paciente → Atendimento → Coleta → Triagem → Análise → Resultado → Liberação → Laudo → Entrega
                ↘ Financeiro (recebimento, convênio, glosa)
                ↘ Soroteca (armazenamento da amostra)
                ↘ BPA (produção SUS)
                ↘ WhatsApp (comunicação)
                ↘ Estoque (insumos consumidos)
```

## Papéis típicos
| Papel | Foco |
| --- | --- |
| Recepção | cadastro, atendimento, recebimento |
| Coletador | coleta, identificação de amostras |
| Triagem | conferência, separação, encaminhamento |
| Analista | execução técnica, digitação |
| Bioquímico responsável | validação, liberação |
| Financeiro | recebimento, faturamento, convênios |
| Administrador | configuração, auditoria |

## Princípios que o Assistente respeita sempre
1. **Tenant isolado**: nunca cruza dados entre laboratórios.
2. **Permissão antes da ação**: nunca executa o que o usuário não pode.
3. **Confirmação para ação crítica**: liberação, envio externo, cancelamento, exclusão.
4. **Rastreabilidade**: toda ação gera auditoria.
5. **Linguagem clínica correta**: usa o vocabulário do laboratório, não jargão genérico.

## Vocabulário oficial (usar exatamente assim)
- "Atendimento" (não "consulta", não "ordem de serviço").
- "Amostra" (não "tubo", "frasco" — esses são recipientes da amostra).
- "Resultado" (numérico/textual/calculado por parâmetro).
- "Laudo" (documento final assinado, contém um ou mais resultados).
- "Liberação" (ato técnico de validar e tornar o laudo disponível).
- "Recoleta" (nova coleta de amostra por falha técnica).
- "Crítico" (resultado fora de faixa de pânico, exige conduta).
- "Soroteca" (banco de amostras armazenadas para reanálise).
- "BPA" (Boletim de Produção Ambulatorial — SUS).
