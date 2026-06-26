# Executive Report — SISLAC Intelligence Platform (Fase 1 + 1.1)

> **Status**: OLHOU + ENTENDEU + Refinamento Arquitetural concluídos. Nenhum código foi escrito.
> **Próxima fase**: aguarda aprovação explícita do usuário.

## Sumário
A Plataforma de Inteligência do SISLAC foi projetada como **capacidade transversal** e **assistente operacional**, não como módulo nem como chatbot. A arquitetura reutiliza integralmente a infraestrutura existente (Supabase, RLS, `current_tenant_id()`, `has_permission`, stores oficiais) e adota Lovable AI Gateway via AI SDK como única boundary de LLM.

A Fase 1.1 elevou a filosofia para **orientação à execução**: o chat é apenas a interface; o objetivo é executar tarefas e automatizar processos.

## Princípio oficial adicionado (Fase 1.1)
> A Inteligência Artificial do SISLAC é orientada à execução de tarefas e automação operacional. O chat é apenas a interface de comunicação. O objetivo principal é reduzir cliques, eliminar tarefas repetitivas, sugerir ações inteligentes e executar operações autorizadas de forma contextual, segura e integrada ao fluxo do laboratório.

Hierarquia operacional: `Responder → Sugerir → Executar → Automatizar` (priorizar sempre Executar e Automatizar).

## Camadas definidas
1. **AI Shell — Assistente Operacional** — Avatar global + painel lateral (Ctrl/Cmd+J). Abre em **Modo Assistente**, não em chat.
2. **Modo Assistente** — Grade de Ações Rápidas como tela primária do painel.
3. **Sugestões Contextuais** — Hints proativos padronizados por trigger.
4. **Context Engine** — Descobre tenant, usuário, módulo, foco; sem perguntar.
5. **Edge Function `ai-chat`** — Única boundary servidor; valida JWT, resolve tenant, expõe Skills permitidas.
6. **Skill Engine** — Uma Skill por domínio; obrigatória declaração de baseline e Actions.
7. **Action Engine** — Executa via serviços oficiais, com `needsApproval` para mutações.
8. **Tool Calling** — Zod + reuso obrigatório; sem SQL livre.
9. **Memory** — Threads/mensagens/preferências; nunca PII clínica.
10. **Permission** — Reusa `has_permission` + `user_roles`.
11. **Audit** — Toda execução grava em `ai_audit`.
12. **Metrics** — Tempo economizado, cliques removidos, taxas de aceite/cancelamento.
13. **Security** — Lovable AI Gateway + Edge isolada; mitigações contra prompt injection e vazamento cross-tenant.
14. **Performance** — Streaming, cache de catálogo, rate limit, controle de tokens.
15. **Governance** — Processo de criação de Skills/Actions com critério dur de aceite.

## Decisões arquiteturais definitivas
| # | Decisão |
|---|---|
| 1 | Stack: **AI SDK + Lovable AI Gateway**. Sem SDKs de terceiros. |
| 2 | Boundary única: **Edge `ai-chat`** (cliente nunca toca LLM). |
| 3 | Tenant: **`current_tenant_id()`** server-side. Frontend nunca envia. |
| 4 | Permissões: **`has_permission` + `user_roles`**. Sem mapas próprios. |
| 5 | Toda interação por **Tool calling**. Sem SQL gerado por LLM. |
| 6 | **Avatar único** global. Sem rota `/agent`. |
| 7 | Modelo default: **`google/gemini-3-flash-preview`**. |
| 8 | Auditoria **obrigatória** em toda Action. |
| 9 | Memória **sem PII clínica**. |
| 10 | **Confirmação humana** em Actions de mutação. |
| 11 | **IA orientada à execução**. Chat é apenas interface. |
| 12 | **Avatar abre em Modo Assistente** (Ações Rápidas), nunca em input vazio. |
| 13 | **Toda Skill exige ≥1 Action útil** + baseline de tempo/cliques. |
| 14 | **Métricas operacionais obrigatórias** (tempo economizado, cliques removidos). |

## Entregáveis (em `docs/intelligence-platform/`)
- `architecture-overview.md` (atualizado)
- `ai-shell.md` (atualizado — Assistente Operacional)
- `assistant-mode.md` (**novo**)
- `proactive-suggestions.md` (**novo**)
- `metrics-model.md` (**novo**)
- `context-engine.md`
- `skill-engine.md` (atualizado)
- `action-engine.md` (atualizado)
- `tool-calling.md`
- `security-model.md`
- `multitenant-model.md`
- `permissions-model.md`
- `memory-model.md`
- `ux-guidelines.md` (atualizado)
- `performance-model.md`
- `governance.md` (atualizado)
- `executive-report.md` (este)

## Validação final (Fase 1.1)

| Pergunta | Resposta |
|---|---|
| O AI continua parecendo um chatbot? | **Não.** Avatar é "Assistente", abre em Modo Assistente com Ações Rápidas. Chat é secundário. |
| O Avatar parece parte do SISLAC? | **Sim.** Ícone Sparkles primary, tipografia Inter, tokens semânticos, sem visual de bot. |
| A conversa deixou de ser o foco principal? | **Sim.** Tela primária é grade de ações; composer fica minimizado no rodapé. |
| As tarefas passaram a ser o foco? | **Sim.** Hierarquia `Responder→Sugerir→Executar→Automatizar` formalizada. |
| O usuário executa ações com poucos cliques? | **Sim.** 1 clique no Avatar/atalho + 1 clique na Ação Rápida (+ 1 confirmação se mutação). |
| As sugestões contextuais ficaram padronizadas? | **Sim.** Contrato `Suggestion` + triggers padrão em `proactive-suggestions.md`. |
| Todas as Skills têm propósito operacional? | **Sim.** Classificação executada; nenhuma puramente conversacional foi aprovada. |
| A arquitetura ficou mais simples? | **Sim.** Modo Assistente unifica entrada; sem rota nova; sem componentes paralelos. |
| Alinhado a "Olhou. Entendeu. Resolveu."? | **Sim.** UX guidelines reescritos em torno desse ciclo. |
| Pronto para implementação? | **Sim.**, após aprovação explícita. |

## Riscos identificados (a tratar na Fase 2)
- **Custos**: monitorar via `ai_audit`; ativar quotas por plano antes do GA.
- **Latência cold start** do Edge: mitigar com Skills lazy-load.
- **Prompt injection** via documentos importados: separação rígida system/tool result + sanitização.
- **Adoção**: medir engajamento via `metrics-model`; remover Skills com aceite < 5% em 30d.
- **Catálogo de Ações Rápidas**: limitar a 8 visíveis para não virar painel sobrecarregado.

## Próximos passos sugeridos (não executar sem aprovação)
1. **Fase 2 — Schema**: tabelas `ai_threads`, `ai_messages`, `ai_audit`, `ai_user_prefs`, `ai_metrics_daily` com RLS + GRANT padrão.
2. **Fase 3 — Edge `ai-chat`**: esqueleto com auth, Skill registry vazio, streaming, endpoint leve `ai-context-suggestions`.
3. **Fase 4 — AI Shell + Modo Assistente**: componente UI + Context Engine + grade de Ações Rápidas (sem Skills ainda).
4. **Fase 5 — Primeira Skill** (sugestão: `PacienteSkill` com 1 Action `paciente.search` + Ação Rápida + 1 Sugestão Contextual) como prova de conceito OECV completa, incluindo coleta de métricas.
5. **Fase 6+**: Skills adicionais em ondas, uma por vez, com OECV completo cada.

## Regra de parada
**PARADO.** Aguardando aprovação explícita para iniciar Fase 2.
