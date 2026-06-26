# Governance

## Decisões definitivas (não reabrir sem RFC)
1. Stack: AI SDK + Lovable AI Gateway. Sem SDKs de terceiros (Anthropic, OpenAI direto).
2. Boundary única: Edge Function `ai-chat`.
3. Tenant: `current_tenant_id()` server-side. Sem exceção.
4. Permissão: `has_permission` + `user_roles`. Sem mapa próprio.
5. Tool calling obrigatório. Sem SQL/HTTP livre.
6. Auditoria 100%. Sem opt-out.
7. Avatar único. Sem rota dedicada.
8. Modelo default: `google/gemini-3-flash-preview`.
9. Memória: nunca PII clínica/financeira em `ai_messages`.
10. **Toda Skill precisa de ≥1 Action útil**. Skill puramente conversacional é rejeitada em revisão.
11. **Toda Skill declara métricas de baseline** (`baselineSeconds`, `baselineClicks`, `category`). Sem isso não entra (ver `metrics-model.md`).
12. **Avatar abre em Modo Assistente** (Ações Rápidas), nunca diretamente em input de chat (ver `assistant-mode.md`).
13. **Hierarquia operacional**: `Responder → Sugerir → Executar → Automatizar`. Priorizar Executar e Automatizar.
14. **O Assistente é percebido como colaborador do laboratório**, não como IA (ver `persona.md`). Nenhum texto visível, label ou microcopy pode usar "IA", "Chat", "Bot", "Copilot".
15. **Métrica soberana**: **tempo operacional economizado**. Todas as demais métricas são secundárias.

## Processo: criar nova Skill
1. Abrir RFC curto em `docs/intelligence-platform/skills/<dominio>.md` com:
   - **Tarefas eliminadas** (lista concreta).
   - **Baseline operacional** (`baselineSeconds`, `baselineClicks`).
   - **Categoria** (`automation` / `write` / `read`).
   - **Classificação Responder/Sugerir/Executar/Automatizar**.
   - Tools previstas (nome, descrição, input/output, permissão, needsApproval).
   - Actions previstas (≥1 obrigatória).
   - Ações Rápidas e Sugestões Contextuais.
   - Reuso de serviços existentes.
2. Aprovação humana (OECV — etapa Entendeu).
3. Implementação em `supabase/functions/ai-chat/skills/<dominio>.ts`.
4. Registro em `supabase/functions/ai-chat/skills/index.ts`.
5. Testes: unit das Tools + smoke contra DB de teste.
6. Validação (OECV — Validou): fluxo completo no AI Shell, com auditoria conferida e métricas iniciais coletadas.

## Critério obrigatório de aceite (rejeição automática)
Uma Skill é **rejeitada** se:
- Não declara `metrics.baseline*`.
- Não possui pelo menos uma Action útil.
- Sua única categoria é `conversational` (apenas responde perguntas ou apenas gera texto).
- Não economiza ao menos 2 cliques OU 15 segundos vs. fluxo manual.
- Não reutiliza serviços oficiais do SISLAC (duplica lógica de store/serviço).
- Aumenta a complexidade da interface (novos componentes globais, novas rotas, novos modos visuais).
- Não produz ganho operacional mensurável em `ai_time_saved_seconds`.

## Processo: criar nova Action
- Vive dentro de uma Skill existente.
- Mutações exigem `needsApproval: true`, exceto se já existir confirmação na UI chamadora.
- Reuso obrigatório do serviço oficial; nunca duplicar `INSERT`/`UPDATE`.
- Auditoria automática (`ai_audit`).
- Declara `baselineSeconds`/`baselineClicks` próprios.

## Processo: integrar IA a um módulo novo
1. Módulo expõe um hook `useAIContextProvider({ module, focus })` na página raiz.
2. Cria Skill com Tools de read básicas primeiro.
3. Só depois adiciona Actions mutadoras, uma por vez.

## Anti-arquiteturas paralelas
Proibido:
- Criar outro endpoint que fale com LLM (`/functions/v1/chat-*` etc.).
- Importar SDK de LLM em componente React.
- Hardcode de papéis ou permissões em arquivo de Skill.
- Tabelas paralelas de auditoria de IA.

Qualquer PR que introduza um dos itens acima é rejeitado.

## Versionamento
- Skills: SemVer (`1.0.0`). Tools carregam `since`.
- Breaking change em Tool exige deprecation period de 30 dias com warning no audit.

## Revisão periódica
- A cada trimestre: revisar Skills/Tools menos usadas → candidatas a remoção.
- A cada release: rodar OECV completo (smoke do fluxo crítico via AI Shell).

## Métricas mínimas que devem existir antes de GA
- Taxa de erro por Tool.
- Latência p50/p95 por Skill.
- Taxa de aprovação em Actions críticas.
- Custo por tenant.
- Mensagens rejeitadas por permissão.

## Documentação
- Toda Skill tem um `.md` em `docs/intelligence-platform/skills/`.
- Toda decisão arquitetural muda **este diretório** (não memórias soltas).
- Mudança em camada core (Context/Skill/Action/Tool) exige update no `architecture-overview.md`.
