# Tool Calling Audit — Hotfix 2.0

## Sintoma

100% dos registros recentes em `ai_audit` mostravam `finishReason: "stop"` com tokens de saída <100 — **nenhuma** `tool-call` emitida pelo modelo, mesmo em prompts inequívocos ("inserir 4,5 em hemácias do paciente X").

## Pipeline auditada

```
Shell.send()
 → POST /ai-chat (UIMessage[] com parts:[{type:text}])
 → authenticate() → resolveAllowedCapabilities()  ✅ tools anexadas (admin tem liberar_resultado)
 → streamText({ model, tools: toolMap, stopWhen: stepCountIs(5) })
 → SSE  text-delta | tool-input-* | tool-output-available
 → Shell parse  text-delta (acc) + output (navigate)
```

## Pontos validados

- [x] Tools entregues ao SDK (`toolMap` populado: 8 ferramentas para perfil admin).
- [x] Schema Zod válido (sem união discriminada quebrada).
- [x] `stepCountIs(5)` permite o ciclo tool→reply.
- [x] SSE chega íntegro ao navegador (validado com `curl_edge_functions`).

## Falha identificada

Modelo `google/gemini-3-flash-preview` não dispara tools de forma confiável neste pipeline. Troca para `google/gemini-2.5-flash` restaura comportamento esperado.

## Evidência pós-fix

Frase de teste: *"No hemograma da Olivia, registre 4,5 em Hemácias"*

SSE recebido:
```
tool-input-start    resultado_set_valor
tool-input-delta    {"_confirmed":true,"exame":"Hemograma","paciente":"Olivia","parametro":"Hemácias","valor":"4,5"}
tool-input-available
tool-output-available  {ok:true, navigate:"/resultado/5", data:{parametro:"HEMACI", valor:"4,5"}}
text-delta          "Pronto, gravei 4,5 em Hemácias."
finish              stop
```
