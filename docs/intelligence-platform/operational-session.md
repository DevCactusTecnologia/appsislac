# Operational Session — Memória de Trabalho

## Estado atual

**Não existe sessão operacional server-side.** O `ai-chat` recebe `messages[]` a cada turno e nada mais. O conhecimento de "paciente/exame/atendimento foco" vive apenas na **memória conversacional do LLM** (histórico de mensagens), não em slots estruturados.

### O que existe

- `context` no body (`{ module, route, focus: { pacienteId?, atendimentoId? } }`) — derivado da rota do navegador (`useAIContext`).
- `messages[]` reenviado a cada turno (histórico textual).
- `threadId` opcional, gravado em `ai_audit`, mas **não usado** para recuperar contexto.

### O que falta

| Slot | Hoje | Deveria |
|---|---|---|
| Paciente focado | — | `session.paciente_id` persistido por N turnos |
| Atendimento focado | parcial via URL | `session.atendimento_id` |
| Exame focado | — | `session.exame_id` (ex.: HEMOGRAMA aberto) |
| Última ação pendente confirmação | — | `session.pending_action` |
| Modo voz ativo | client-side | espelhado em sessão |

## Sintoma observável

Cenário: usuário diz **"abra o hemograma da Alicia"**, depois **"hemácias 4,5"**.

Hoje: o segundo turno só funciona porque o LLM lê o histórico textual e **infere** que `paciente=Alicia, exame=hemograma`. Se o histórico for limpo (botão "Nova conversa") ou se o LLM "esquecer", a tool é chamada sem esses campos → erro.

Risco: depender da memória conversacional do modelo para **dados clínicos** é frágil e não auditável.

## Recomendado (sem implementar)

- Tabela `ai_sessions(thread_id, user_id, tenant_id, focus jsonb, pending_action jsonb, updated_at)`.
- Edge `ai-chat` injeta `focus` resolvido no `systemPrompt` e expõe tool `session_set_focus`.
- Cada tool que identifica entidades atualiza o focus automaticamente (`paciente_id` resolvido em `resultado_open` vira foco).
- TTL curto (15 min) ou reset explícito por "nova conversa".
