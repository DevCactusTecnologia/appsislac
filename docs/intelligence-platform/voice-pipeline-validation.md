# Voice Pipeline — Validação

## Causa-raiz

`ai-speak` falhava no boot (503 BOOT_ERROR) por import quebrado:
```ts
import { encode as base64Encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";
//                ^^^^^^ a versão atual exporta encodeBase64, não encode
```
Resultado: **toda** chamada de TTS retornava 503; o Shell engolia o erro silenciosamente e só exibia texto.

## Correção

```ts
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
...
return jsonResponse({ audio: encodeBase64(buf), mime: "audio/mpeg" });
```

## Pipeline pós-fix

| Etapa | Status |
|---|---|
| STT (`ai-transcribe`) — push-to-talk ElevenLabs Scribe | inalterado, OK |
| `send(text, {fromVoice:true})` → `setVoiceMode(true)` | OK |
| `streamText` → resposta + tool result | OK |
| Fallback `toolFeedback` quando LLM não devolve texto | **novo no Hotfix** |
| `speak(spoken)` → `POST /ai-speak` | ✅ 200 com base64 mp3 |
| `new Audio(data:audio/mpeg;base64,...)` no shell | OK |

## Garantia "voz entra → voz sai"

Em `AiShell.send()`:
```ts
const spoken = acc.trim() || toolFeedback;
if (voiceModeRef.current && spoken) speak(spoken);
```
Mesmo se o LLM ficar mudo após uma tool, o shell deriva uma frase do retorno (`output.data.parametro / valor` ou `output.data.aplicados.length`) e a fala.

## Modelo TTS

Travado em `eleven_v3`, voz `7iqXtOF3wl3pomwXFY7G`. Não alterado.
