# 03 — Fluxo de Execução

## A. Modo Texto

```text
1. Usuário digita "abrir pacientes" e clica Enviar
2. AssistenteSISLAC.sendTextMessage
3. runText(text)
4. parseLocalIntent(text)
   ├── MATCH → navigate('/pacientes'); pushAgent("Abrindo pacientes."); RETURN  (≈ 50 ms, zero LLM)
   └── NO MATCH ↓
5. streamAiChat({ messages, routePath })
6. POST /functions/v1/ai-chat (Bearer JWT)
7. ai-chat:
   ├── authenticate() → JWT, tenantId
   ├── resolveAllowedCapabilities() → 1 RPC por Capability (N RPCs!)
   ├── buildPacienteTools/Atendimento/Resultado → toolMap filtrado
   ├── streamText(Gemini 2.5 Flash, system≈2 KB, tools, stepCountIs(5))
   └── onFinish → INSERT ai_audit
8. Frontend lê SSE, atualiza última msg "agent" via setChatMessages
9. Resposta final pintada no painel
```

**Custos por requisição não-trivial**: 1 chamada `auth.getUser` + 1 RPC `current_tenant_id` + **N RPCs `has_permission`** (8 hoje) + 1 LLM streaming + 1 INSERT auditoria. Total: **~10 round-trips DB + 1 LLM**.

## B. Modo Voz

```text
1. Usuário clica Mic → getUserMedia → MediaRecorder.start
2. Usuário fala → clica Stop
3. rec.onstop → Blob webm → POST /functions/v1/ai-transcribe (multipart)
4. ai-transcribe → Lovable Gateway STT → { text }
5. runText(transcript)  ← mesmo pipeline do modo texto
6. Resposta final → POST /functions/v1/ai-speak → mp3 base64
7. new Audio(...).play()
```

**Limitações**:
- Não há streaming de voz (push-to-talk só).
- Sem VAD, sem interrupção, sem barge-in.
- TTS espera resposta inteira do LLM (não usa o stream).
- Latência típica: STT (~1.5s) + LLM (~2-4s) + TTS (~1.5s) = **5-7s** por turno.

## C. Pontos cegos

- `threadId` não é enviado pelo cliente, então `ai_audit.thread_id` é sempre `null` — análise temporal por conversa é impossível.
- `chatMessages.slice(-30)` significa que após 30 turnos a conversa começa a perder contexto silenciosamente.
- Erros do `ai-speak` são engolidos com `console.warn` (linha 294). Usuário não percebe que voz falhou.
- `parseLocalIntent` roda **antes** do LLM, então comandos ambíguos ("abrir auditoria do paciente X") podem ser intercceptados errados (acerta `/auditoria` mas ignora o paciente).
