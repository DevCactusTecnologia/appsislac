# 09 — Voz

## Pipeline atual
- **STT**: `ai-transcribe` → Lovable Gateway → `openai/gpt-4o-mini-transcribe`.
- **TTS**: `ai-speak` → Lovable Gateway → `openai/gpt-4o-mini-tts` (voz `alloy`, mp3).
- **Captura**: `MediaRecorder` push-to-talk (clica mic, fala, clica stop).
- **Reprodução**: `new Audio('data:audio/mpeg;base64,...').play()`.

## Características
| Recurso | Estado |
|---|---|
| Push-to-talk | ✅ |
| Streaming STT | ❌ (envia blob completo) |
| Streaming TTS | ❌ (espera resposta inteira do LLM) |
| VAD / detecção de fim de fala | ❌ |
| Barge-in (interrupção do TTS) | ❌ |
| Sessão contínua / hands-free | ❌ (versão anterior tinha; foi removida com ElevenLabs) |
| Confirmação de comandos críticos por voz | Apenas verbal, via prompt |
| Persistência de transcrição | ❌ |

## Latência típica medida (estimativa por logs)
- STT: 1.0-2.0 s
- LLM (Gemini 2.5 Flash, ≤2048 tokens): 1.5-4.0 s
- TTS: 1.0-2.0 s
- **Total turno**: 4-8 s.

## Problemas
- Erros do TTS são silenciados com `console.warn` (`AssistenteSISLAC.tsx:294`). O usuário não sabe que a voz falhou.
- `data:` URL base64 inflacionário (mp3 ~30 KB vira ~40 KB em base64); para frases longas o `Audio.play()` pode estourar memória.
- Sem `AudioContext`, não há controle de volume, equalização, ou interrupção.

## Avaliação
A integração atual de voz é **funcional e mínima**. Faz sentido para validar uso, mas é claramente push-to-talk de chatbot, não experiência "Alexa-like" prometida nas fases anteriores. Aumenta complexidade marginalmente em relação ao modo texto (3 arquivos vs 0).
