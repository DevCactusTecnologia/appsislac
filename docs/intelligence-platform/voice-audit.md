# Voice Audit

## Pipelines existentes

```
[Web Speech API contínua] ──┐
                            ├─► send(text, fromVoice:true) ─► ai-chat ─► streamText
[MediaRecorder → ai-transcribe (ElevenLabs Scribe)] ──┘                       │
                                                                              ▼
                                                                      ai-speak (TTS eleven_v3)
```

## Pontos fortes

- **Dois caminhos de STT** com fallback automático: Web Speech (hands-free Alexa-like) e push-to-talk (ElevenLabs Scribe) para navegadores sem suporte.
- **TTS travado em `eleven_v3`** e voz fixa (`7iqXtOF3wl3pomwXFY7G`), respostas saem com prosódia natural.
- **Avatar com sinalizador visual** quando o microfone está ativo (anel pulsante, sem precisar abrir o painel).
- **Palavras de parada** ("parar", "obrigado", "tchau") encerram a escuta sem clique.
- **Interim text bubble** flutuando acima do avatar mostra o que o usuário está dizendo.

## Lacunas críticas

| # | Lacuna | Impacto |
|---|---|---|
| V1 | Números falados em PT-BR ("quatro vírgula cinco") chegam crus ao modelo. Modelo geralmente acerta, mas é frágil para casos como "ponto cinco", "meio", unidades. | Grava valor errado em laboratório → risco clínico |
| V2 | Não há **eco confirmatório curto** ("Hemácias preenchidas") padronizado por tool. Hoje depende do LLM resumir o resultado. | Fluxo perde cadência tipo Alexa |
| V3 | Não há **modo "burst" hands-free com auto-confirmação para ações críticas** — usuário precisa dizer "sim" mas não há captura explícita de yes/no. | Liberação por voz fica truncada |
| V4 | TTS roda **após** todo o stream do LLM terminar (`if (voiceModeRef.current && acc.trim()) speak(acc)`), não em sentenças. | Latência percebida alta (1–3s extras) |
| V5 | Não há **barge-in** (interromper a fala do assistente começando a falar). | Quebra a sensação Alexa |
| V6 | `interimText` só aparece no avatar quando painel está fechado; ao abrir o painel some. | Inconsistência |

## Latência medida (estimada por inspeção)

| Etapa | Tempo típico |
|---|---|
| Web Speech final → `send()` | <50 ms |
| `ai-chat` cold boot | 100–150 ms |
| LLM (Gemini Flash) primeiro token | 400–900 ms |
| Streaming até `acc` final | 800–2500 ms |
| `ai-speak` (cold + síntese) | 600–1400 ms |
| Áudio começa a tocar | **≈ 2.5–5 s** após o usuário parar de falar |

**Alvo Alexa-like:** < 1.5 s. Gap principal: TTS após resposta completa, não por sentença.

## Recomendações (sem implementar)

1. **TTS por sentença** (stream parser quebra em `. ! ?` e dispara `ai-speak` em pipeline).
2. **Normalização numérica PT-BR no shell** antes do `send`.
3. **Confirmação ouvida** (`sim/não/confirma/cancela`) tratada no shell sem ida ao LLM quando há pendência de confirmação.
4. **Microcopy padronizada por tool** (`tool.result.spoken_ack`) — string curta dita pela voz, distinta do texto exibido.
5. **Barge-in**: ao detectar start de fala enquanto `audioElRef` toca, pausar áudio imediatamente.
