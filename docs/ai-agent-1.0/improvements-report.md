# AI Agent 1.0 — Melhorias propostas

> Esta fase é de auditoria. Itens abaixo ficam **registrados** para uma futura reimplementação, fora do escopo de AI Agent 1.0.

## Princípios para a reimplementação (quando autorizada)

1. **Stack oficial**: Lovable AI Gateway + AI SDK (`streamText` / `toUIMessageStreamResponse`), `LOVABLE_API_KEY` gerenciada. Modelo padrão: `google/gemini-3-flash-preview`. Referência: `supabase/functions/ai-suggest-exames/index.ts`.
2. **Tenant server-side**: derivar `tenant_id` de `current_tenant_id()` / JWT. **Nunca** aceitar do body.
3. **Sem service-role para queries de leitura**: usar client autenticado do usuário; RLS é a fronteira.
4. **Tool-calling, não SQL textual**: tools tipadas (Zod) que envolvem stores existentes (`atendimentoStore`, `pacienteStore`, KPIs do Dashboard). O LLM **não** escreve SQL.
5. **Contexto automático**: a chamada do agente injeta automaticamente paciente/atendimento/tela atuais — usuário não digita contexto.
6. **Capacidade contextual, não rota dedicada**: botão "Pergunte ao AI" em locais relevantes (cabeçalho global Ctrl+K, dialog do paciente, etc.) — sem página `/agent` separada.
7. **Permissões via `has_permission()`** — zero duplicação do mapa de roles.
8. **Auditoria com `tenant_id`** + `GRANT` + RLS por `current_tenant_id()`.
9. **Design tokens** (Indigo `#4D41F3`, sem `bg-blue-500` hardcoded).
10. **Rate-limit** (20 req / 5 min por `userId|ip`, como `ai-suggest-exames`).

## O que NÃO fazer

- Não criar nova página de chat.
- Não recriar tabela `agent_audit_log` sem `tenant_id` e `GRANT`.
- Não reutilizar `validators.ts` (roles fictícios).
- Não usar Anthropic SDK direto.
- Não voltar a usar `VITE_*` para chaves privadas.
