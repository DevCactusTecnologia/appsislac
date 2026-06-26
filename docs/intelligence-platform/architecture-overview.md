# SISLAC Intelligence Platform — Architecture Overview

> Fase 1 — OLHOU + ENTENDEU. Nenhum código nesta fase.
> Aprovação explícita é obrigatória antes de iniciar implementação.

## Filosofia

A Inteligência Artificial **não é um módulo do SISLAC**. É uma **capacidade transversal** que atravessa todos os domínios (Pacientes, Atendimentos, Exames, Resultados, Soroteca, Financeiro, WhatsApp, Produção). O usuário nunca pensa "vou abrir o AI"; ele percebe que "o sistema ficou mais inteligente".

Princípios obrigatórios (não negociáveis):
- **OECV** (Olhou • Entendeu • Configurou • Validou) — toda evolução respeita o ciclo.
- **SSOT** — uma única fonte de verdade por conceito; stores existentes (`atendimentoStore`, `pacienteStore`, etc.) são a verdade operacional.
- **Domain Driven** — uma Skill por domínio; sem orquestrador onisciente.
- **Multi-Tenant** — `current_tenant_id()` resolve tenant server-side; frontend nunca envia.
- **Interface Canônica** — um único AI Shell, um único Context Engine, um único Action Engine.
- **Zero Duplicação** — IA usa os mesmos serviços, RLS, validações e auditoria que o resto do sistema.
- **Código Enxuto** — toda Skill/Action precisa eliminar complexidade existente; senão não entra.

## Camadas (visão macro)

```text
┌──────────────────────────────────────────────────────────────┐
│  AI SHELL  (Avatar global, painel lateral, atalhos Ctrl+J)    │
│  - React-only, sem rota dedicada                              │
└────────────┬─────────────────────────────────────────────────┘
             │  (UI events, mensagens do usuário)
┌────────────▼─────────────────────────────────────────────────┐
│  CONTEXT ENGINE  (browser)                                    │
│  - Lê route, AuthContext, query params, store snapshots       │
│  - Monta "envelope de contexto" enxuto e tipado               │
└────────────┬─────────────────────────────────────────────────┘
             │  POST /functions/v1/ai-chat (Authorization: JWT)
┌────────────▼─────────────────────────────────────────────────┐
│  EDGE FUNCTION  ai-chat  (Deno, Lovable AI Gateway)           │
│  - Resolve auth.uid(), current_tenant_id(), has_permission()  │
│  - Carrega Skills permitidas → expõe como Tools                │
│  - streamText() + tool calling + stopWhen(stepCountIs(50))    │
└────┬──────────────────────────┬────────────────────────┬──────┘
     │                          │                        │
     ▼                          ▼                        ▼
┌──────────┐            ┌───────────────┐        ┌──────────────┐
│ SKILL    │            │ ACTION ENGINE │        │ MEMORY       │
│ ENGINE   │            │ - confirm     │        │ - conv state │
│ - registry│           │ - audit       │        │ - prefs      │
│ - schemas │           │ - reuse stores│        │ - per-tenant │
└─────┬────┘            └──────┬────────┘        └──────────────┘
      │                        │
      └────────┬───────────────┘
               ▼
     ┌─────────────────────┐
     │  STORES OFICIAIS    │  (SSOT já existentes)
     │  pacienteStore, ... │
     │  + RPCs / RLS       │
     └─────────────────────┘
               ▼
     ┌─────────────────────┐
     │  AUDIT LOG          │  (auditLogsStore + ai_audit)
     └─────────────────────┘
```

## Responsabilidades por camada

| Camada | Responsabilidade única | Onde roda |
|---|---|---|
| **AI Shell** | Apresentar avatar/painel; receber input; renderizar mensagens, sugestões e confirmações. | Browser (React) |
| **Context Engine** | Coletar contexto operacional do usuário (rota, paciente atual, atendimento aberto, etc.) sem perguntar. | Browser |
| **Edge Function `ai-chat`** | Único ponto de contato com o LLM. Autenticação, resolução de tenant, montagem de tools, streaming. | Deno Edge |
| **LLM Gateway** | Lovable AI Gateway (`google/gemini-3-flash-preview` default). Nunca chamado do browser. | Lovable infra |
| **Skill Engine** | Catálogo de Skills por domínio; cada Skill exporta Tools + prompts curtos. | Edge |
| **Action Engine** | Executa tools que mutam estado; aplica `needsApproval`; grava auditoria. | Edge |
| **Memory** | Conversa atual (curta), preferências do usuário, contexto recente do tenant. Nunca dados clínicos. | DB (`ai_threads`, `ai_messages`, `ai_user_prefs`) |
| **Permission** | Reusa `has_permission()` / `user_roles` / `is_super_admin()`. Sem mapa próprio. | DB (RLS + RPC) |
| **Audit** | Toda chamada de tool grava em `ai_audit` (Quem, Tenant, Skill, Tool, Args sanitizados, Status, Tempo). | DB |

## O que esta plataforma NÃO faz

- Não gera SQL.
- Não consulta tabelas diretamente.
- Não duplica regras de negócio (preço, status, validação clínica, RLS).
- Não recebe `tenant_id` do frontend.
- Não navega o usuário (sem `useNavigate` forçado).
- Não cria seu próprio sistema de papéis.
- Não persiste dados clínicos em "memória".
- Não roda dois LLMs paralelos; só Lovable AI Gateway.

## Decisões definitivas

1. **Stack oficial**: AI SDK (`ai`, `@ai-sdk/openai-compatible`) + Lovable AI Gateway. Sem Anthropic SDK direto, sem ElevenLabs no MVP.
2. **Boundary única**: Edge Function `ai-chat`. Demais módulos não chamam LLM.
3. **Tool calling obrigatório**: toda ação ou consulta passa por Tool registrada por Skill.
4. **Domain ownership**: cada domínio é dono da sua Skill; sem god-skill.
5. **Avatar único global**: um componente em `AppShell`, sem rota `/agent`.
6. **Auditoria 100%**: toda tool execution loga; sem exceção.
7. **Multi-tenant via DB**: tenant é resolvido por `current_tenant_id()` no Edge; nunca pelo cliente.
8. **Memória mínima**: apenas thread de conversa + preferências; nunca registros de pacientes/resultados.

Detalhes por área: ver demais documentos deste diretório.
