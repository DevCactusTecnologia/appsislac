# Voice Interaction

## Arquitetura
Voz é **mais uma forma de entrada**, nunca um fluxo paralelo.

```
Microfone → MediaRecorder (webm/mp4) → ai-transcribe (Lovable AI STT) → texto → send() → ai-chat → resposta
```

## Componentes
- **Browser**: `MediaRecorder` captura áudio do `getUserMedia`. Blob enviado como `multipart/form-data` ao Edge.
- **Edge `ai-transcribe`**: autentica via `aiAuth.ts` (mesma SSOT do Core), encaminha ao gateway Lovable AI (`openai/gpt-4o-mini-transcribe`), responde `{ text }`.
- **AiShell**: ao receber texto, chama `send(text)` — idêntico ao envio digitado.

## Garantias
- Áudio < 1.5 KB é descartado (microfone vazio).
- Limite duro de 20 MiB no Edge.
- Tracks do microfone são fechadas em qualquer caminho de saída.
- Nenhum áudio é persistido — somente o texto entra na auditoria via `ai_audit`.

## UX
- Botão de mic ao lado do botão de enviar.
- Estado "Gravando" com indicador pulsante; toque novamente para encerrar.
- Estado "Transcrevendo" enquanto o Edge responde.
- Erros falam em linguagem humana ("Não consegui entender o áudio. Pode repetir?").
