# 10 — ElevenLabs / ElevenAgents

## Status atual: **REMOVIDO**

Evidências:
- Dependência `@elevenlabs/react` removida do `package.json`.
- Edge functions `elevenlabs-conversation-token` e `sync-elevenlabs-tools` deletadas (não aparecem em `supabase/functions/`).
- Migração `20260627012632_drop_elevenlabs_config.sql` aplicada.
- Única menção restante: comentário "Zero dependência de ElevenLabs" em `AssistenteSISLAC.tsx:5`.
- Aba de configuração de ElevenLabs removida de `SuperAdminConfiguracoes.tsx`.

## Resíduos
- `docs/intelligence-platform/voice-audit.md`, `voice-interaction.md`, `voice-pipeline-validation.md`, `executive-report-assistant-2.0.md`, `phase24-natural-conversation.md` — todos descrevem arquitetura ElevenLabs que não existe mais. **Documentação fantasma**.
- Migração `20260626203301_*.sql` (1 dia antes do drop) provavelmente criou colunas ElevenLabs em `saas_settings` — confirmar via supabase para garantir limpeza total.

## Conflito com Capability Registry?
- **Não existe mais conflito**: ElevenAgent não orquestra nada. Toda a orquestração voltou para `ai-chat` (Gemini + tools). SSOT restaurado.

## Conclusão
- **Não há mais ElevenAgent ativo**. As perguntas da auditoria sobre "duplicação de contexto/memória/decisões" com ElevenAgent estão **respondidas pela própria remoção**.
- Resta apenas limpar documentação obsoleta.
