# WhatsApp 2.0 — Envio Contextual de Documentos

Escopo: diálogo **Detalhes do Atendimento** (`AtendimentoDetalheDialog`).
Tipo de ajuste: UX. **Nenhuma** alteração em Meta / Outbox / Dispatcher /
Opt-Out / Rate Limit / Auditoria / Templates / Política automático-manual.

## Ambiguidade identificada

A tela exibia três documentos possíveis — **Comp. Pagamento**,
**Comp. Atendimento**, **Comparecimento** — e um único botão genérico
"Enviar WhatsApp". O operador não tinha como saber qual documento seria
enviado: o decisor `getBestWhatsappAction()` escolhia internamente, sem
sinal visual. Resultado: dúvida operacional e risco de envio errado.

## Como a aba passou a controlar a ação

- Três botões viraram **tabs** (`role="tablist"`/`role="tab"`).
- Estado `docTab: "pagamento" | "atendimento" | "comparecimento"` é a
  **fonte única da verdade**.
- Default: `pagamento` se há pagamento registrado, caso contrário
  `atendimento`. Aba `pagamento` fica desabilitada quando não há
  pagamentos.
- Subtítulo abaixo das tabs: **"Documento selecionado: <Título>"**.
- Ações da aba ativa: **Imprimir** + `WhatsappActionButton` com label
  contextual.

Aba ativa = Documento exibido = Documento enviado = Texto do botão.

## Mapeamento único

Centralizado em `src/lib/whatsapp/getWhatsappActionByDocument.ts`:

```ts
DOCUMENT_ACTIONS = {
  pagamento:     { tabLabel: "Comp. Pagamento",  title: "Comprovante de Pagamento",     buttonLabel: "Enviar Comprovante de Pagamento" },
  atendimento:   { tabLabel: "Comp. Atendimento", title: "Comprovante de Atendimento",   buttonLabel: "Enviar Comprovante de Atendimento" },
  comparecimento:{ tabLabel: "Comparecimento",    title: "Declaração de Comparecimento", buttonLabel: "Enviar Declaração de Comparecimento" },
}
```

Helper único `sendDocumentWhatsapp(doc, atendimento, ctx)` enfileira pelo
pipeline canônico (`enqueueNotification` → outbox → dispatcher → Meta):

- `pagamento`     → template `comprovante_atendimento`, `tipo="comprovante_pagamento"`
- `atendimento`   → template `comprovante_atendimento`, `tipo="comprovante_atendimento"`
- `comparecimento`→ template `comprovante_atendimento`, `tipo="declaracao_comparecimento"`

> Templates Meta não foram alterados (regra). A diferenciação semântica
> usa o campo `tipo` já suportado por `enqueue_whatsapp`.

## Componente canônico

`WhatsappActionButton` continua sendo o **único** componente de envio
manual. Ganhou apenas uma prop opcional `idleLabel` para permitir o
rótulo contextual da aba ativa — estados `loading/success/error`
permanecem 100% padronizados.

```tsx
<WhatsappActionButton
  onSendAsync={handleSendWhatsapp}
  idleLabel={DOCUMENT_ACTIONS[docTab].buttonLabel}
  title={`Enviar ${DOCUMENT_ACTIONS[docTab].title} pelo WhatsApp`}
/>
```

## Limpeza

- Removido: import e uso de `getBestWhatsappAction` neste diálogo
  (continua existindo e é usado por `ResultadoDetalhe`).
- Removido: cálculo `todosLiberadosExames` (só servia ao decisor antigo).
- Removidos: três botões duplicados e o botão genérico isolado.
- Zero `if (aba === ...)` espalhados — toda a decisão vive no mapa
  `DOCUMENT_ACTIONS` + helper `sendDocumentWhatsapp`.

## Auditoria

| Pergunta | Resposta |
|---|---|
| Texto genérico restante? | Não. O botão sempre exibe o documento ativo. |
| Duplicação removida? | Sim — 3 botões + 1 WhatsApp viraram 3 tabs + 1 ação contextual. |
| Código morto removido? | `getBestWhatsappAction` e `todosLiberadosExames` removidos deste diálogo. |
| Houve regressão? | Não — pipeline, templates e política intactos. Type-check OK. |
| Comportamento previsível? | Sim — aba ativa = documento enviado. |
| Operador entende o que será enviado? | Sim — subtítulo + label do botão indicam explicitamente. |
| UX consistente com o padrão SISLAC? | Sim — `WhatsappActionButton` canônico, pt-BR, verde WhatsApp. |

## Critério de sucesso

```
O que está vendo  =  O que será enviado  =  Texto do botão
```

Atingido. Nenhum clique adicional, nenhum menu, nenhum diálogo de escolha.
