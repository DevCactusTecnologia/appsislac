# Compatibility Matrix — Contrato obrigatório de toda Skill futura

Toda Skill deve ser compatível com os 4 componentes do Core abaixo **sem exigir alteração neles**.

## Matriz

| Componente do Core | O que a Skill DEVE fazer | O que a Skill NÃO PODE fazer |
| --- | --- | --- |
| **AI Shell** (`AiShell.tsx`) | Aparecer apenas via Manifest (Quick Actions/Suggestions derivadas). Respeitar `promptTemplate`. | Importar `AiShell`. Renderizar UI própria. Abrir Drawer/Modal global. Criar atalhos de teclado paralelos. |
| **Context Engine** (`contextEngine.ts`) | Consumir `{ module, focus, route }` recebido no payload. Declarar `module` esperado em `getContextualSuggestions` via Capability. | Importar `contextEngine`. Reler `useLocation` / `useParams`. Manter estado de rota próprio. |
| **Manifest Client** (`manifestClient.ts`) | Aparecer no Manifest exclusivamente via Capability registrada. | Hardcodear Capabilities no frontend. Cache paralelo. Bypass do `useManifest`. |
| **Capability Registry** (`registry.ts`) | Declarar Capability com todos os campos obrigatórios. Apontar `actions[].tool` para tool real da Skill. | Declarar Capability em outro arquivo. Inserir lógica no Registry. |
| **aiAuth** (`aiAuth.ts`) | Receber `SupabaseClient` autenticado do Core. Confiar em `has_permission()` resolvido server-side. | Criar `createClient` próprio. Ler JWT manualmente. Resolver tenant client-side. |
| **ai-chat** (`index.ts`) | Exportar `build<Dominio>Tools(client, ctx)` retornando tools `ai@4.3.16`. | Adicionar nova rota HTTP. Modificar streaming. Tocar `convertToModelMessages`/`streamText`. |
| **ai-manifest** (`index.ts`) | Ser descoberta automaticamente via Registry. | Adicionar endpoint próprio. Servir Manifest customizado. |

## Checklist de aceite (PR de nova Skill)

- [ ] Skill vive em arquivo único sob `supabase/functions/ai-chat/skills/`.
- [ ] Não importa: `AiShell`, `contextEngine`, `manifestClient`, outra Skill, React, react-router.
- [ ] Toda Tool tem `permission` declarada via Capability.
- [ ] Toda Tool mutadora tem `needsApproval: true` na Capability.
- [ ] Toda Tool reusa serviço oficial; nenhum `INSERT`/`UPDATE`/`DELETE` direto duplicado.
- [ ] Capability(ies) registrada(s) em `_shared/registry.ts` com `baselineSeconds` + `baselineClicks`.
- [ ] RFC publicado em `docs/intelligence-platform/skills/<dominio>.md`.
- [ ] Nenhum arquivo do Core foi modificado no diff.
- [ ] Smoke test cobrindo: sem permissão → bloqueio; com permissão + needsApproval → exige confirmação; execução → registra `ai_audit`.

## Verificação automática sugerida
Pré-merge (CI), regra simples:
```
git diff --name-only origin/main... | grep -E '^(src/components/ai-shell/|src/lib/ai/|supabase/functions/_shared/(aiAuth|registry)\.ts|supabase/functions/ai-(chat|manifest)/index\.ts)$'
```
Se houver match **e** o PR não estiver marcado `core-phase: true` → **falha**.

## Garantia formal
Qualquer Skill que respeite esta matriz é, por construção, **plugável sem alterar o Core**.
