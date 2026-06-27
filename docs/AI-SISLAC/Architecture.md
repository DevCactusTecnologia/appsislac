# Architecture — Assistente SISLAC 2.0

## Caminho operacional oficial (único permitido)

```
Usuário
  ↓ texto ou voz
AssistenteSISLAC.tsx      (src/components/assistente/)
  ↓ POST /functions/v1/ai-chat
ai-chat (Edge Function)   (supabase/functions/ai-chat/)
  ↓
Skills                    (supabase/functions/ai-chat/skills/)
  ↓
Tools (Vercel AI SDK)
  ↓
Serviços oficiais (Supabase client com RLS do usuário)
  ↓
Banco
  ↓
Resposta streamada (SSE)
  ↓ texto na UI  ou  ai-speak (TTS) → áudio
```

## Componentes vivos

| Camada     | Arquivo                                                       | Responsabilidade |
|------------|---------------------------------------------------------------|------------------|
| UI         | `src/components/assistente/AssistenteSISLAC.tsx`              | Único componente do Assistente. Texto + voz. |
| Edge       | `supabase/functions/ai-chat/index.ts`                         | Streaming, system prompts, tool calling, auditoria. |
| Skills     | `supabase/functions/ai-chat/skills/{paciente,atendimento,resultado}.ts` | Tools agrupadas por domínio. |
| Registry   | `supabase/functions/_shared/registry.ts`                      | Capability Registry mínimo (SSOT). |
| Auth       | `supabase/functions/_shared/aiAuth.ts`                        | JWT + tenant + permissões. |
| STT        | `supabase/functions/ai-transcribe/`                           | Speech-to-text. |
| TTS        | `supabase/functions/ai-speak/`                                | Text-to-speech. |
| Auditoria  | tabela `public.ai_audit`                                      | Log estruturado por execução de Tool. |

## Eliminado nesta fase

- `src/lib/ai/manifestClient.ts`, `src/lib/ai/contextEngine.ts` (consumidor zero).
- `src/lib/ai/capabilityRegistry.ts` (espelho).
- `supabase/functions/ai-manifest/` (sem consumidor após remoção do manifestClient).
- Tabelas `ai_threads`, `ai_messages`, `ai_user_preferences`, `ai_metrics_daily` (vazias, sem consumidor).
- `docs/intelligence-platform/`, `docs/ai-agent-1.0/`, `docs/ai-agent-rollback/`, `docs/assistant-knowledge/`, `AI-SISLAC/` (radiografia antiga consolidada aqui).
- Tools duplicadas `resultado_set_valor` + `resultado_set_varios` fundidas em `resultado_set`.

## Regra Zero

Toda evolução futura deve ocorrer **exclusivamente** por novas Capabilities/Skills/Tools dos módulos do SISLAC. É proibido criar novos Engines, Registries, Contexts, Providers, Pipelines, Manifestos ou Discovery Layers.
