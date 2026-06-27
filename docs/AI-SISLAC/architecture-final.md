# Architecture Final — AI-SISLAC 2.0

Ver `Architecture.md` para a visão completa. Este documento resume o estado **congelado**.

## Inventário definitivo

- 1 componente UI: `AssistenteSISLAC.tsx`.
- 1 Edge Function de chat: `ai-chat`.
- 2 Edge Functions auxiliares: `ai-transcribe`, `ai-speak`.
- 3 arquivos de skills: `paciente.ts`, `atendimento.ts`, `resultado.ts`.
- 2 arquivos compartilhados: `registry.ts`, `aiAuth.ts`.
- 1 tabela de domínio: `ai_audit`.
- 7 documentos em `docs/AI-SISLAC/`.

## Caminho operacional (único permitido)

```
Usuário → Texto/Voz → AssistenteSISLAC.tsx → ai-chat → Skills → Tools → Banco → Resposta
```

Qualquer componente fora deste caminho **não existe** após a fase 2.0.
