# Executive Report — SISLAC Intelligence Platform (Fase 1)

> **Status**: OLHOU + ENTENDEU concluídos. Nenhum código foi escrito.
> **Próxima fase**: aguarda aprovação explícita do usuário.

## Sumário
A Plataforma de Inteligência do SISLAC foi projetada como **capacidade transversal**, não módulo. A arquitetura reutiliza integralmente a infraestrutura existente (Supabase, RLS, `current_tenant_id()`, `has_permission`, stores oficiais) e adota Lovable AI Gateway via AI SDK como única boundary de LLM.

## Camadas definidas
1. **AI Shell** — Avatar global flutuante + painel lateral (Ctrl/Cmd+J). Sem rota dedicada.
2. **Context Engine** — Descobre tenant, usuário, módulo, foco; sem perguntar.
3. **Edge Function `ai-chat`** — Única boundary servidor; valida JWT, resolve tenant, expõe Skills permitidas.
4. **Skill Engine** — Uma Skill por domínio (Paciente, Atendimento, Exames, etc.).
5. **Action Engine** — Executa via serviços oficiais, com `needsApproval` para mutações.
6. **Tool Calling** — Zod + reuso obrigatório; sem SQL livre.
7. **Memory** — Threads/mensagens/preferências; nunca PII clínica.
8. **Permission** — Reusa `has_permission` + `user_roles`. Zero duplicação.
9. **Audit** — Toda execução grava em `ai_audit`.
10. **Security** — Lovable AI Gateway + Edge isolada; mitigações contra prompt injection e vazamento cross-tenant.
11. **Performance** — Streaming, cache de catálogo, rate limit, controle de tokens.
12. **Governance** — Processo de criação de Skills/Actions documentado.

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

## Entregáveis desta fase (em `docs/intelligence-platform/`)
- `architecture-overview.md`
- `ai-shell.md`
- `context-engine.md`
- `skill-engine.md`
- `action-engine.md`
- `tool-calling.md`
- `security-model.md`
- `multitenant-model.md`
- `permissions-model.md`
- `memory-model.md`
- `ux-guidelines.md`
- `performance-model.md`
- `governance.md`
- `executive-report.md` (este)

## Validação da arquitetura

| Pergunta | Resposta |
|---|---|
| A arquitetura reutiliza a infraestrutura atual do SISLAC? | **Sim.** Stores oficiais, RLS, `current_tenant_id`, `has_permission`, `auditLogsStore`, Edge Functions, AuthContext. |
| Existe alguma duplicação de regras? | **Não.** Skills chamam serviços canônicos; permissões e tenant resolvem via funções DB já existentes. |
| O AI depende de SQL? | **Não.** Sem tool `run_sql`; Tools chamam serviços/stores. |
| O AI depende de contexto informado pelo usuário? | **Não.** Context Engine descobre tudo (rota, foco, papel). |
| O avatar funciona em todas as páginas? | **Sim**, exceto públicas/impressão (lista explícita em `ai-shell.md`). |
| O isolamento multi-tenant está garantido? | **Sim.** Tenant resolvido server-side; RLS em todas as tabelas de IA; LLM nunca vê `tenant_id`. |
| As permissões reutilizam o sistema oficial? | **Sim.** `has_permission` + `user_roles`. |
| A arquitetura é escalável? | **Sim.** Skills plugáveis; tool deferral para >40 tools; cache em camadas. |
| Novas Skills podem ser adicionadas sem alterar o núcleo? | **Sim.** Registry estático; 1 arquivo novo + 1 entry. |
| O projeto está pronto para iniciar a implementação? | **Sim**, após aprovação explícita. |

## Riscos identificados (a tratar na Fase 2)
- **Custos**: monitorar via `ai_audit`; ativar quotas por plano antes do GA.
- **Latência cold start** do Edge: mitigar com Skills lazy-load.
- **Prompt injection** via documentos importados: separação rígida system/tool result + sanitização.
- **Adoção**: AI Shell discreto demais pode ser invisível; medir engajamento e ajustar hints.

## Próximos passos sugeridos (não executar sem aprovação)
1. **Fase 2 — Schema**: criar tabelas `ai_threads`, `ai_messages`, `ai_audit`, `ai_user_prefs` com RLS + GRANT padrão.
2. **Fase 3 — Edge `ai-chat`**: esqueleto com auth, Skill registry vazio, streaming.
3. **Fase 4 — AI Shell**: componente UI + Context Engine.
4. **Fase 5 — Primeira Skill** (sugestão: `PacienteSkill` read-only) como prova de conceito OECV completa.
5. **Fase 6+**: Skills adicionais em ondas, uma por vez, com OECV completo cada.

## Regra de parada
**PARADO.** Aguardando aprovação explícita para iniciar Fase 2.
