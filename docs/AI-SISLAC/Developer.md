# Developer — Guia para extensão

## Estrutura

```
supabase/functions/
  _shared/
    registry.ts        # Capability Registry (SSOT)
    aiAuth.ts          # auth + tenant + permissões
  ai-chat/
    index.ts           # streaming + tool calling + auditoria
    skills/
      paciente.ts
      atendimento.ts
      resultado.ts
  ai-transcribe/       # STT
  ai-speak/            # TTS
src/components/assistente/
  AssistenteSISLAC.tsx # UI única (texto + voz)
```

## Adicionando uma Capability

1. **Tool** — em `skills/<dominio>.ts`:
   ```ts
   export function buildXTools(userClient) {
     return {
       x_acao: tool({
         description: "...",
         inputSchema: z.object({ ... }),
         execute: async (input) => { ... },
       }),
     };
   }
   ```
2. **Registry** — em `_shared/registry.ts`:
   ```ts
   { id: "x.acao", tool: "x_acao", permission: "minha_perm", category: "x", needsApproval: false, description: "..." }
   ```
3. **Wire** — em `ai-chat/index.ts`, incluir `...buildXTools(userClient)` no `allTools`.

## Proibições

- Não criar novos contexts, providers, manifests, discovery layers, quick actions, suggestion engines.
- Não armazenar mensagens/threads — `ai_audit` é o único log.
- Não acessar `supabase.functions.invoke("ai-manifest")` (função removida).
- Não importar `@/lib/ai/*` (diretório removido).

## Verificação local

```bash
bunx tsgo --noEmit -p tsconfig.app.json
```
