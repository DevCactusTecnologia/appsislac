# AI Agent 1.0 — Auditoria de UX

## Resultado

O AI é um **módulo isolado**, não uma capacidade do sistema.

## Evidências

- Para usar, o usuário precisa navegar até `/agent` (rota **sem entrada em menu/sidebar** — usuário não descobre).
- Tela é uma janela de chat full-screen separada do trabalho.
- Não aparece no contexto do paciente, do atendimento, do resultado, nem no Dashboard.
- Não recebe contexto da tela atual; o usuário precisa **digitar tudo**, inclusive nome de paciente / data, em português livre.
- Excesso de opções na UI: checkbox "Voz Premium ElevenLabs" exposto ao usuário final com preço em R$ — vazamento de detalhe de implementação.
- Design fora do sistema: cores hardcoded (`bg-blue-500`, `bg-blue-50`, `text-gray-900`, `bg-white`) — violam a regra "No hardcoded color utilities", e o tema oficial Indigo `#4D41F3`.
- Botões e dialog não seguem o padrão flat do SISLAC.

## Cliques / fricção

Para responder "Quantos exames hoje?":
1. Sair da tela atual.
2. Localizar `/agent` (não há link — precisa digitar URL).
3. Aguardar carregar.
4. Digitar pergunta em PT-BR livre.
5. Aguardar resposta (que hoje é erro 500).

Comparado ao Dashboard, que já mostra esse KPI **sem perguntar**, o agente acrescenta trabalho em vez de remover.

## Personas

| Persona | Usaria? | Por quê |
|---|---|---|
| Recepcionista | Não | Precisa de cliques rápidos, não de chat. |
| Biomédico | Não | Quer ver/validar resultados, não conversar sobre eles. |
| Técnico | Não | Sem affordance, sem entrada de menu. |
| Admin de TI | Talvez | Único perfil capaz de interpretar erros e formular perguntas SQL-shaped. |

## Conclusão

Falha nos princípios SISLAC: *contexto automático*, *poucas telas*, *interface intuitiva*. O AI **interrompe** o fluxo em vez de auxiliá-lo.
