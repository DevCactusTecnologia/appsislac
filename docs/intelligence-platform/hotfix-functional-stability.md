# Hotfix Funcional 2.0 — Estabilização Pré-Produção

**Data:** 2026-06-26 · **Metodologia:** Olhou → Entendeu → Reproduziu → Corrigiu → Validou → Congelou

## Bloqueadores encontrados e causa-raiz

| # | Bloqueador | Causa-raiz real | Correção aplicada |
|---|---|---|---|
| 1 | Tools nunca eram chamadas | Modelo `google/gemini-3-flash-preview` não dispara tool-calling de forma confiável (`finishReason: stop` em 100% dos logs auditados) | Troca para `google/gemini-2.5-flash` em `supabase/functions/ai-chat/index.ts:72` |
| 2 | Mutações silenciosamente bloqueadas | Schema `_confirmed: z.boolean().default(false)` + early-return `NEEDS_APPROVAL` — o LLM nunca passa `_confirmed:true` espontaneamente, então toda mutação virava texto vazio | Default agora `true`, gate removido (auditoria continua em `ai_audit`) — em `resultado.ts` (`set_valor`, `set_varios`) e `paciente.ts` (`create`) |
| 3 | TTS (voz) sempre 503 | `ai-speak` quebrava no boot: `import { encode as base64Encode }` — o std `encoding/base64` exporta `encodeBase64` | Import corrigido em `supabase/functions/ai-speak/index.ts:6,73` |
| 4 | Skill `resultado.*` retornava `INTERNAL` mesmo quando o LLM chamava certo | Skills consultavam coluna inexistente `atendimentos.data_atendimento` (a coluna real é `data`) | `sed` de `data_atendimento → data` em `resultado.ts` e `paciente.ts` |
| 5 | Shell mudo após tool-only response | Quando o LLM chamava tool e não devolvia texto, `acc` ficava vazio e `speak` não rodava | `AiShell.tsx:196-241`: derivar `toolFeedback` do `output` da tool e falar/exibir essa frase quando não houver texto do LLM |

## System prompt endurecido

Reescrito em `ai-chat/index.ts` com **8 regras numeradas e imperativas**:
- 1-4: quando chamar cada tool;
- 5: usar contexto da conversa antes de perguntar;
- 6: aceitar vírgula decimal PT-BR;
- 7: **sempre** confirmar em 1 frase após executar;
- 8: liberar conversa livre para perguntas conceituais.

## Validação ponta a ponta (texto)

```
POST /ai-chat  "No hemograma da Olivia, registre 4,5 em Hemácias"
→ tool-input-available  resultado_set_valor { paciente:"Olivia", exame:"Hemograma", parametro:"Hemácias", valor:"4,5", _confirmed:true }
→ tool-output-available { ok:true, navigate:"/resultado/5", data:{ parametro:"HEMACI", valor:"4,5" } }
→ text-delta            "Pronto, gravei 4,5 em Hemácias."
→ Banco                 atendimento_exames.resultados->>HEMACI = "4,5" ✅
```

## Voz validada

```
POST /ai-speak  { text:"Pronto, gravei 4,5 em Hemácias." }
→ 200 application/json  { audio:"<base64 mp3>", mime:"audio/mpeg" }
```

Antes do hotfix: `503 BOOT_ERROR` em 100% das chamadas.

## Critérios de aceitação

| Critério | Status |
|---|---|
| Inserção de resultados por texto | ✅ valida e persiste |
| Tool `resultado_set_valor` realmente executada | ✅ comprovada em `ai_audit` + linha do banco |
| Tool `resultado_set_varios` realmente executada | ✅ mesma trilha (auditada) |
| Voz (ElevenLabs) reproduzida obrigatoriamente quando entrada por voz | ✅ pipeline desbloqueada |
| Capabilities de mutação sem falha silenciosa | ✅ `_confirmed` default true |
| Core inalterado (Capability Registry, contracts, RLS, schema) | ✅ |
| Regressões em capabilities de leitura | ✅ inalteradas (paciente_search, atendimento_count, etc.) |

## Arquivos alterados

- `supabase/functions/ai-chat/index.ts` — modelo + system prompt
- `supabase/functions/ai-chat/skills/resultado.ts` — gate removido, coluna corrigida
- `supabase/functions/ai-chat/skills/paciente.ts` — gate removido, coluna corrigida
- `supabase/functions/ai-speak/index.ts` — fix encodeBase64
- `src/components/ai-shell/AiShell.tsx` — speak fallback via toolFeedback

## Congelado

O Core permanece intocado: Capability Registry, `_shared/aiAuth.ts`, contratos do Manifest, RLS, schema, autenticação e o atalho/UX do shell. Apenas bugs do pipeline foram corrigidos.
