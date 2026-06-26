# Conversation Flow

## Fluxo atual (texto e voz)

```
Usuário ─► AiShell.send(text) ─► POST /functions/v1/ai-chat
                                       │
                                       ├─ Auth (aiAuth)
                                       ├─ allowed = resolveAllowedCapabilities()
                                       ├─ toolMap = filter(allTools, allowed)
                                       └─ streamText({ model, system, messages, tools, stopWhen: stepCountIs(5) })
                                              │
                                              ├─ delta tokens ─► UI (text-delta)
                                              ├─ tool.execute() ─► output {navigate?, data, ok}
                                              └─ onFinish ─► ai_audit + (voz) speak(acc)
```

## Comparação com o roteiro alvo (Alexa-like)

| # | Turno alvo | Resposta atual | Gap |
|---|---|---|---|
| 1 | "Abra o hemograma da Alicia." | ✅ `resultado_open` abre rota | OK |
| 2 | "Localizei e já abri." | ⚠️ depende de o LLM resumir o `data` da tool | falta `spoken_ack` padronizado |
| 3 | "Quatro vírgula cinco em Hemácias." | ⚠️ chama `resultado_set_valor` — mas precisa repetir paciente+exame **toda vez** | falta sessão operacional |
| 4 | "Hemácias preenchidas." | ⚠️ depende do LLM | OK funcional, frágil |
| 5 | "Salvar." | ❌ não há tool de "salvar" | falta capability |
| 6 | "Liberar." | ❌ não há tool de "liberar" | falta capability |
| 7 | "Essa ação libera oficialmente…" | ❌ confirmação por voz não estruturada | falta yes/no captor |
| 8 | "Posso ajudar em mais alguma coisa?" | ❌ não acontece | falta follow-up |

## Texto vs Voz — paridade

| Aspecto | Texto | Voz |
|---|---|---|
| Acesso a todas as tools | ✅ | ✅ |
| Confirmação de ação crítica | ✅ via UI futura | ❌ não há captor sim/não |
| Resposta humanizada | ✅ | ✅ |
| Latência de feedback | <1 s | 2.5–5 s |
| Persistência de contexto | ❌ | ❌ |

**Conclusão:** paridade conceitual existe, paridade prática ainda não.
