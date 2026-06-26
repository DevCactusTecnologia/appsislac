# Capability Discovery — Fase 2.1

## Pergunta canônica
> "Quais Capabilities estão disponíveis para este contexto?"

## API
```ts
discoverCapabilities(manifest, {
  module?: AIModule,
  quickActionOnly?: boolean,
  suggestionsOnly?: boolean,
}): ManifestItem[]
```

## Critérios aplicados (em ordem)
1. `visibility !== "hidden"`
2. `enabled === true` (permissão concedida pelo Edge ai-manifest)
3. Se `quickActionOnly`: `quickAction === true`
4. Se `suggestionsOnly`: `supportsSuggestions === true`
5. Se `visibility === "contextual"`: `category` deve bater o `module` da rota
6. Ordenação final: `priority` ascendente

## Quem chama
- **Quick Actions** (AiShell): `discoverCapabilities(manifest, { module, quickActionOnly: true })`
- **Sugestões** (`contextEngine.getContextualSuggestions`): recebe lista filtrada por `suggestionsOnly`
- **Tool Calling** (ai-chat): filtra `CAPABILITIES` por permissão direto no servidor (mesma lógica, sem expor manifest)

Nenhum consumidor mantém lista hardcoded.
