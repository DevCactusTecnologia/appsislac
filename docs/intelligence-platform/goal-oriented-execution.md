# Execução Orientada ao Objetivo

## Princípio
O Assistente não responde apenas à última mensagem. Ele compreende o objetivo completo do usuário e o executa até concluir.

## Fluxo oficial
```
Entender → Localizar → Executar → Validar → Responder
```
Nunca: responder primeiro, executar depois.

## Como é alcançado sem nova arquitetura
- **Multi-step nativo**: `streamText({ maxSteps: 5 })` no `ai-chat/index.ts` permite ao LLM encadear chamadas de Capabilities até concluir o objetivo.
- **Contexto operacional**: `contextEngine` entrega `{ module, focus, route }` em toda mensagem — o LLM herda o "Objetivo Atual" implicitamente.
- **Histórico da thread**: `messages` enviadas ao `ai-chat` carregam toda a conversa; o LLM mantém o objetivo entre turnos.
- **System prompt oficial**: instrui o Assistente a usar SEMPRE ferramentas para executar, nunca apenas descrever.

## Sessão de Trabalho (Objetivo Atual)
Implementada de forma emergente — não como nova camada:
1. Usuário diz: "Abra o hemograma da Alicia."
2. `paciente.buscar` → `resultado.abrir` → `focus.resultadoId` passa a existir via `contextEngine`.
3. Mensagens subsequentes ("Hemácias 4,5", "Salvar", "Liberar") são interpretadas no contexto desse `resultadoId`.
4. Ao liberar/imprimir, o foco muda naturalmente — sessão encerrada sem flag explícita.

## Exemplo: "Gere um PDF das despesas deste mês e destaque as contas pagas e pendentes."
Plano executado pelo LLM em uma única conversa:
1. `financeiro.listarDespesas({ periodo: "mes_atual" })` → dados.
2. `financeiro.gerarPdf({ destacar: ["pago","pendente"] })` → arquivo.
3. Resposta humana com link/confirmação.

Nenhum passo intermediário pedido ao usuário; nenhum código de fluxo dedicado.

## Garantias
- Cada tool exposta tem `inputSchema` Zod → execução validada.
- `needsApproval` em ações críticas (liberar resultado, faturar, expurgar) → confirmação humana antes da Action.
- Auditoria completa em `ai_audit` com `skill`, `capability`, `action`, `duration_ms`.
