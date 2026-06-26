# Human Interaction

## ETAPA 7 — Diálogo: natural ou prompt?

**Misto.** Em interações curtas e diretas ("abra a Alicia") soa natural. Em interações com tool result, o modelo às vezes derrama o objeto JSON em texto ("Encontrei o paciente com ID a3f8…") em vez de falar como um humano.

### Exemplos colhidos por inspeção do código

✅ Natural:
- "Pronto, abri os atendimentos." (gerado pelo systemPrompt)
- "Tive um problema de conexão. Pode tentar de novo?"
- "Tudo bem, estou aqui se precisar." (ao dizer "parar")

⚠️ Pode soar prompt:
- "Localizei o paciente Alicia Lisboa (id: ...) com 12 atendimentos…" — quando o LLM lê o `data` da tool e não filtra IDs.
- Confirmações genéricas ("Deseja prosseguir?") sem contextualizar o que será feito.

## ETAPA 8 — Confirmações

| Ação | Hoje | Deveria |
|---|---|---|
| Abrir tela | execução imediata ✅ | ✅ |
| Buscar paciente | imediata ✅ | ✅ |
| Criar paciente | exige `_confirmed` ✅ | ✅ |
| Gravar valor de resultado | exige `_confirmed` ✅ | ⚠️ deveria ser silencioso para valores normais e confirmar **apenas para valores críticos/pânico** |
| Salvar | **não existe** | confirmação leve "Salvo." |
| Liberar resultado | **não existe** | confirmação **explícita por voz** ("Diga 'confirmar' para liberar") |
| Cancelar atendimento | **não existe** | confirmação explícita |

## ETAPA 11 — Comparação Alexa

| Critério Alexa | Assistente SISLAC |
|---|---|
| Recebe instrução | ✅ |
| Executa imediatamente | ✅ |
| Confirma com fala curta | ⚠️ depende do LLM |
| Pergunta "algo mais?" | ❌ |
| Mantém sessão sem reiniciar | ❌ |
| Barge-in (interromper a fala) | ❌ |

## ETAPA 15 — Plantão completo

**Hoje, ainda não.** Um biomédico em plantão perceberá que está usando uma IA assim que:

1. Tiver que repetir o nome do paciente em cada turno.
2. Não conseguir dizer "salvar" / "liberar" e ver acontecer.
3. Esperar 3–5 s pela voz responder.
4. Tentar interromper a fala do assistente e não conseguir.

Resolvendo Working Memory + tools de save/release + TTS por sentença + barge-in, a percepção muda de "chatbot" para "colega".
