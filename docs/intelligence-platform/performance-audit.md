# Performance Audit (Assistant 2.0)

## Tempo de resposta estimado

| Cenário | Etapas | Tempo total estimado |
|---|---|---|
| Navegação por voz ("abra atendimentos") | Web Speech → `parseNavIntent` → `navigate()` | **< 200 ms** ✅ |
| Pergunta simples por texto | `ai-chat` → LLM 1 step | 600 ms – 1.5 s |
| Pergunta com 1 tool call | `ai-chat` → tool → LLM resumindo | 1.2 – 2.5 s |
| Comando por voz com tool + TTS | STT → `ai-chat` → tool → LLM → TTS pós-stream | **2.5 – 5 s** ⚠️ |
| Push-to-talk Scribe (fallback) | upload áudio → STT → … | +500 ms a +1.5 s extras |

## Gargalos identificados

1. **TTS é "all-or-nothing":** só toca após `acc.trim()` final. Sentenças completas poderiam tocar conforme chegam.
2. **Cold boot de Edge:** primeira chamada em ~5 min ociosa custa 100–150 ms extra.
3. **Manifest TTL 5 min em memória do client:** OK, mas cache invalidado em cada reload completo do app (sem persistência).
4. **`atendimento_summary` faz `select … limit(5000)` e agrega em JS:** para tenants grandes vira problema. Migrar para RPC com `group by`.
5. **`resultado_set_varios` faz N + 3 round-trips** (find paciente, list atendimentos, list params, update). Funciona, mas há margem para 2 round-trips.

## Custo (ordem de grandeza)

- Modelo atual: `google/gemini-3-flash-preview` (barato).
- TTS ElevenLabs `eleven_v3`: ~$0.30 / 1 K chars. Respostas longas custam mais.
- STT ElevenLabs Scribe / Lovable Gateway: bilhetagem por minuto.

## Recomendações de baixo risco

- TTS por sentença (split em `[.!?]\s`).
- Cachear o áudio TTS por hash do texto (frases curtas como "Pronto." e "Salvo." repetem muito).
- Migrar `atendimento_summary` para função SQL.
- Warm-up periódico das edges via cron leve a cada 4 min.
