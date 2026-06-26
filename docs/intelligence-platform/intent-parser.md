# Intent Parser

O Intent Parser oficial do SISLAC é o próprio **LLM via ai-chat com tool-calling**. Não há parser determinístico paralelo.

## Fluxo
```
Texto (digitado ou transcrito)
  → ai-chat (system prompt + contexto + capabilities autorizadas)
  → LLM escolhe tool (Capability/Action) ou responde em linguagem natural
  → Skill executa via serviço oficial
  → Resposta humana ao usuário
```

## Por que não há parser próprio
- Duplicaria o trabalho do LLM.
- Criaria nova camada arquitetural (proibido na Fase 2.4).
- Tornaria a manutenção dupla: regras regex + prompt.

## Como o LLM acerta a intenção
1. Recebe **contexto operacional** (`{ module, focus, route }`) — sabe onde o usuário está.
2. Recebe lista filtrada de **Capabilities autorizadas** com `title` e `description`.
3. Recebe tools com `inputSchema` Zod — o gateway força argumentos válidos.
4. `maxSteps: 5` permite encadear tools (ex.: buscar paciente → abrir resultado).

## Exemplos resolvidos sem novo código
| Frase do usuário | Resolução |
| --- | --- |
| "O que você sabe sobre Marcos Lisboa?" | `paciente_buscar` → resposta resumida |
| "Abra o resultado da Alicia" | `paciente_buscar` → `resultado_abrir` |
| "Quanto foi faturado este mês?" | Capability financeira (quando registrada) |
| "Salvar" (com resultado aberto) | Context Engine entrega `resultadoId`; tool `resultado_salvar` é invocada |

## Limites
- Capability inexistente → o LLM responde em texto explicando o que sabe fazer.
- Ação crítica (`needsApproval: true`) → tool retorna pedido de confirmação antes de executar.
