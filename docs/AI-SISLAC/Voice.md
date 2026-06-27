# Voice — Pipeline de voz

Texto e voz compartilham **exatamente o mesmo pipeline** de execução. A única diferença é a entrada (transcrição) e a saída (síntese).

```
Microfone → MediaRecorder → ai-transcribe (STT) → texto
                                                ↓
                                          runText(transcript, "voice")
                                                ↓
                                          ai-chat   (system prompt = PROMPT_VOICE)
                                                ↓
                                          Skills/Tools  (idênticas ao modo texto)
                                                ↓
                                          resposta textual
                                                ↓
                                          ai-speak (TTS) → áudio
```

## Diferenças do modo voz

- O `ai-chat` recebe `context.mode = "voice"` e seleciona `PROMPT_VOICE`.
- Respostas obrigatoriamente curtas (≤ 8 palavras), sem markdown, sem listas.
- Em ditados (`resultado_set` com múltiplos parâmetros), confirma só o nome do parâmetro.

## Mesma chain de Tools

Nenhuma Tool é exclusiva de voz. Qualquer Capability autorizada no modo texto está autorizada no modo voz.
