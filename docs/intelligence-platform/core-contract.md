# Core Contract — Plataforma de Inteligência do SISLAC

Contrato oficial que rege a relação entre **Core** e **extensões** (Capabilities, Skills, Actions).
Versão: 1.0.0 — congelada em Fase 2.2, formalizada em Fase 2.3.

## 1. Composição do Core
O Core é **fechado** e contém exatamente 7 arquivos:

| Componente | Arquivo | Responsabilidade |
| --- | --- | --- |
| AI Shell | `src/components/ai-shell/AiShell.tsx` | Avatar global + Drawer + Modo Assistente |
| Context Engine | `src/lib/ai/contextEngine.ts` | Deriva `{ module, focus, route }` da rota atual |
| Manifest Client | `src/lib/ai/manifestClient.ts` | Carrega/caches o Manifest derivado |
| Capability Registry | `supabase/functions/_shared/registry.ts` | SSOT de Capabilities + `buildManifest()` |
| Edge Bootstrap | `supabase/functions/_shared/aiAuth.ts` | JWT, tenant, permissões |
| Edge ai-chat | `supabase/functions/ai-chat/index.ts` | Roteador LLM + tool-calling |
| Edge ai-manifest | `supabase/functions/ai-manifest/index.ts` | Entrega Manifest filtrado |

Total: **790 LoC**. Qualquer mudança nestes arquivos exige **nova Fase formal do Core**.

## 2. Garantias oferecidas pelo Core
O Core garante a toda Skill/Action/Capability:

- Sessão autenticada (`auth.userId`).
- Tenant resolvido server-side (`current_tenant_id()`).
- Permissões resolvidas via `has_permission()`.
- Manifest derivado automaticamente do Registry.
- Auditoria automática em `ai_audit`.
- Contexto operacional (`{ module, focus, route }`) entregue ao LLM.
- Streaming SSE para o cliente.
- CORS + rate awareness (429/402).

## 3. Obrigações de quem estende o Core

### 3.1 Capability
- Declarada **exclusivamente** em `_shared/registry.ts`.
- Possui: `id`, `title`, `description`, `category`, `visibility`, `priority`, `permission`, `baselineSeconds`, `baselineClicks`, `needsApproval`, `quickAction`, `supportsSuggestions`, `icon`, `color`, `actions[]`.
- **Não contém lógica.** É puro metadado.
- Valida-se no cold-start (`validateRegistry()`).

### 3.2 Skill
- Arquivo único em `supabase/functions/ai-chat/skills/<dominio>.ts`.
- Exporta uma função `build<Dominio>Tools(client, ctx)` que retorna tools `ai@4.3.16`.
- **Permitido importar:** `npm:ai`, `npm:zod`, `@supabase/supabase-js` (cliente recebido), serviços oficiais (`_shared/<service>.ts`).
- **Proibido importar:** outra Skill, `AiShell`, `contextEngine`, `manifestClient`, módulos React.

### 3.3 Action
- Vive **dentro** de uma Skill como `tool({...})`.
- Uma responsabilidade.
- Reusa serviço oficial (store/RPC/Edge dedicado) — nunca duplica `INSERT`/`UPDATE`.
- Declara `permission` e `needsApproval`.
- Auditada automaticamente pelo Core.

## 4. Fluxo único oficial
```
Usuário → AiShell → Edge ai-chat → Skill → Action → Serviço Oficial → DB (RLS)
                ↘ Edge ai-manifest → Registry (SSOT) ↗
```
Nenhum fluxo paralelo é permitido.

## 5. Proibições absolutas
- Criar Edge Function de IA fora de `ai-chat` / `ai-manifest`.
- Importar SDK de LLM em componente React.
- Criar tabela `ai_*` adicional.
- Declarar Capability fora de `_shared/registry.ts`.
- Skill executando SQL livre ou tocando tabela não-oficial.
- Cliente enviando `tenant_id` no payload.
- Cache de Manifest fora de `manifestClient`.

## 6. Quebra de contrato
Qualquer PR que viole este contrato é **rejeitado automaticamente** em revisão. A correção é obrigatória antes do merge — não há exceção.
