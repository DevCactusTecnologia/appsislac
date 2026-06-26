# Assistant Experience — Radiografia (somente leitura)

> Metodologia: Olhou → Entendeu → Mapeou → Validou → Recomendou.
> Nenhuma alteração de código foi realizada nesta fase.

## Veredito de uma frase

**Hoje o Assistente está ~70% colaborador e ~30% chatbot.** Já executa ações reais (abre tela, conta atendimentos, grava resultado, fala por voz), mas ainda **perde a sessão operacional entre turnos** e por isso ainda parece "um chat com superpoderes" — não um colega ao lado do biomédico.

## Olhou

- `src/components/ai-shell/AiShell.tsx` (783 linhas) — UI, voz, push-to-talk, hands-free, TTS.
- `supabase/functions/ai-chat/index.ts` — orquestrador (streamText, Gemini, tools).
- `supabase/functions/ai-chat/skills/{paciente,atendimento,resultado}.ts` — capabilities reais.
- `supabase/functions/ai-speak/index.ts` — TTS ElevenLabs (modelo travado `eleven_v3`).
- `supabase/functions/ai-transcribe/index.ts` — STT (Lovable Gateway).
- `src/lib/ai/{contextEngine,manifestClient}.ts` — contexto e registry.

## Entendeu

| Capacidade | Estado | Evidência |
|---|---|---|
| Falar com o usuário em PT-BR humanizado | ✅ | `systemPrompt` em `ai-chat/index.ts` orienta tom natural, voz e brevidade |
| Executar tool calling | ✅ | `streamText({ tools, stopWhen: stepCountIs(5) })` |
| Abrir telas por intenção falada | ✅ | `resultado_open` + `parseNavIntent` no shell |
| Gravar 1 ou N parâmetros em UM exame | ✅ | `resultado_set_valor` / `resultado_set_varios` (exigem `_confirmed`) |
| Sessão operacional persistente entre turnos | ❌ | Cada turno reenvia `messages` mas **não** mantém `paciente/atendimento/exame focado** server-side; modelo precisa redescobrir via tools |
| Confirmações para ações críticas | ⚠️ Parcial | Gravação exige `_confirmed`, mas **não há fluxo explícito de "Liberar" / "Salvar" / "Cancelar"** com mensagem natural |
| Voz contínua estilo Alexa | ✅ Recente | Web Speech API + TTS, com signal no avatar |
| Histórico/auditoria | ✅ | `ai_audit` insere on `onFinish` |

## Validou (cenários ao vivo, conceitual)

1. **"Abra o hemograma da Alicia"** → ✅ funciona via `resultado_open(paciente, exame)`.
2. **"Quatro vírgula cinco em Hemácias"** após abrir → ⚠️ funciona _se_ o modelo reenviar `paciente` e `exame` na tool (não há slot de sessão). O usuário precisa ser ouvido em uma frase clara; transcrições com "vírgula" precisam ser convertidas para "4,5" pelo modelo.
3. **"Salvar"** isolado → ❌ não há tool `resultado_save`. A gravação é o próprio `set_valor`. Funciona, mas a metáfora "salvar" não existe.
4. **"Liberar"** → ❌ não há tool `resultado_release`. Modelo responderá com fala, mas não acionará liberação real.
5. **"Posso ajudar em mais alguma coisa?"** → ❌ não há follow-up automático pós-ação.

## Recomendou (sem implementar)

Ver `simplification-opportunities.md` e `executive-report-assistant-2.0.md`. Prioridades:

1. **Working Memory de sessão operacional** (paciente/exame/atendimento focados, vivem por N turnos).
2. **Capabilities `resultado_save` e `resultado_release`** (esta com `needsApproval`).
3. **Pós-ação obrigatória**: toda tool deve devolver `next_prompt` ("Posso ajudar em mais alguma coisa?") consumido pelo systemPrompt.
4. **Normalizador de fala numérica PT-BR** ("quatro vírgula cinco" → "4.5") no shell antes do envio.
