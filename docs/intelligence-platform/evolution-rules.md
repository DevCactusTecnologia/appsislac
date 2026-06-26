# Evolution Rules — Como evoluir o Assistente sem tocar no Core

## Regra Zero
> **"Esta alteração precisa modificar o Core?"**
> Se a resposta for "não", a mudança vai para Capability, Skill, Action ou Serviço Oficial.
> Se for "sim", **pare** e abra nova Fase formal do Core.

## Matriz de decisão

| Alteração desejada | Altera o Core? | Onde vive |
| --- | :---: | --- |
| Nova Skill | Não | `supabase/functions/ai-chat/skills/<dominio>.ts` |
| Nova Capability | Não | `supabase/functions/_shared/registry.ts` (entrada em `CAPABILITIES`) |
| Nova Action | Não | Dentro da Skill correspondente |
| Novo Serviço Oficial | Não | `src/data/<store>.ts` ou `supabase/functions/_shared/<service>.ts` |
| Novo Prompt / system message | Não | Configuração da Skill (não da Edge `ai-chat`) |
| Novo Manifest item | Não | Derivado do Registry — basta nova Capability |
| Novo módulo do SISLAC integrado ao Assistente | Não | Página expõe `useAIContextProvider({ module, focus })`; cria Skill |
| Mudança de modelo LLM | Não | Variável de ambiente / configuração da Edge `ai-chat` |
| Novo idioma de UI | Não | Tradução de strings em `registry.ts` |
| Mudança de arquitetura (novo provider, nova boundary, novo contexto global) | **Sim** | Nova **Fase formal do Core** |
| Novo storage de auditoria | **Sim** | Nova Fase formal |
| Nova Edge Function de IA | **Sim** | Nova Fase formal |

## Fluxo padrão para adicionar uma Skill
1. **RFC curto** em `docs/intelligence-platform/skills/<dominio>.md` com: tarefas eliminadas, `baselineSeconds`, `baselineClicks`, categoria, classificação Responder/Sugerir/Executar/Automatizar, Tools previstas.
2. **Aprovação humana** (OECV — Entendeu).
3. **Criar Capability(ies)** em `_shared/registry.ts` apontando para as tools.
4. **Implementar Skill** em `supabase/functions/ai-chat/skills/<dominio>.ts`.
5. **Registrar Skill** no roteador do `ai-chat` (próxima a `buildPacienteTools`).
6. **Testes** unitários das Tools + smoke contra DB de teste.
7. **OECV — Validou**: fluxo completo no AI Shell, auditoria conferida.

## Critérios automáticos de rejeição
Skill/Action é **rejeitada** se:
- Não declara `baselineSeconds`/`baselineClicks`.
- Skill puramente conversacional (sem Action útil).
- Não economiza ≥2 cliques ou ≥15 segundos vs. fluxo manual.
- Duplica lógica de store/serviço oficial.
- Introduz componente global, contexto ou rota nova.
- Toca qualquer arquivo do Core.
- Não reusa `has_permission` / `current_tenant_id`.

## Versionamento
- Skills seguem **SemVer**. Tools carregam `since`.
- Breaking change em Tool exige **30 dias de deprecation** com warning em `ai_audit`.
- Manifest carrega `MANIFEST_VERSION` (`registry.ts`). Bump:
  - **patch** — nova Capability sem quebra.
  - **minor** — novo campo opcional no `ManifestItem`.
  - **major** — campo obrigatório novo ou remoção (exige nova Fase).

## Revisão periódica (trimestral)
- Skills/Tools com baixo uso → candidatas a remoção.
- Conferir baseline (`core-baseline.md`). Crescimento >10% de LoC do Core exige justificativa formal.
- Rodar OECV completo no fluxo crítico.
