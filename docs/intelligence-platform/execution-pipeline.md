# Execution Pipeline

## O ciclo desejado

```
Entende → Planeja → Executa → Valida → Responde → Pergunta o próximo
```

## O que acontece hoje

| Etapa | Acontece? | Como |
|---|---|---|
| Entende | ✅ | LLM (Gemini) + parser de navegação no shell |
| Planeja | ⚠️ | `stopWhen: stepCountIs(5)` permite encadear até 5 steps, mas não há planner explícito |
| Executa | ✅ | `tool.execute()` com RLS via `userClient` |
| Valida | ⚠️ | Apenas validação de schema Zod + `_confirmed`. Não há regra clínica (ex.: "valor crítico → confirma 2x") |
| Responde | ✅ | Streaming texto + TTS pós-stream |
| Próximo turno | ❌ | Não pergunta "mais alguma coisa?", não mantém modo voz com prompt aberto |

## Anti-padrão observado

A maior parte do raciocínio fica no `systemPrompt` ("USE SEMPRE…", "Não peça confirmação para abrir telas"). Isso funciona com Gemini Flash mas é frágil:

- Se o modelo for trocado, o comportamento muda.
- Regras críticas (ex.: "liberar exige confirmação dupla") deveriam estar **no código da tool**, não no prompt.

## Recomendado

- Mover regra de confirmação para **camada de tool** (já está em `_confirmed`).
- Adicionar `validation_hooks` por tool (ex.: `resultado_set_valor` → se valor cai em faixa crítica do `valores_referencia`, força `_double_confirmed`).
- Adicionar campo `follow_up: string | null` no retorno padrão de tool, consumido pelo shell para pedir o próximo comando em voz.
