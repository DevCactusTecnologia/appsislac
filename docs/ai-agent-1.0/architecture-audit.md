# AI Agent 1.0 — Auditoria de Arquitetura

## Veredito

**A implementação NÃO segue a arquitetura do SISLAC.** É um módulo paralelo construído fora dos padrões oficiais e que, no estado atual, **não funciona em runtime**.

## Evidências (bloqueantes)

### 1. Stack divergente — não usa Lovable AI Gateway
`supabase/functions/chat-agent/index.ts:4-7` importa `@anthropic-ai/sdk` e exige `ANTHROPIC_API_KEY`. O padrão oficial do SISLAC (ver `supabase/functions/ai-suggest-exames/index.ts`) é **Lovable AI Gateway** com `LOVABLE_API_KEY` (gerenciada, sem ação do usuário). Resultado: a função aborta com 500 porque `ANTHROPIC_API_KEY` não está configurada.

### 2. Schema fictício
`chat-agent/index.ts:38-44` consulta `from("usuarios")` — **tabela inexistente**. O SISLAC usa `profiles` + `user_roles` (regra oficial em `mem://architecture/saas-multi-tenant`). Mesmo se a key Anthropic existisse, a função quebra em "Unauthorized" para qualquer requisição.

### 3. Multi-tenant violado no transporte
`useAgent.ts:34-36` envia `tenant_id` do **frontend** no body. Regra core do SISLAC: *"Frontend NUNCA envia/confia em tenant_id — resolvido server-side por `current_tenant_id()`"*. A edge function deveria resolver tenant via JWT + `current_tenant_id()` / `auth.getClaims`, como faz `ai-suggest-exames`.

### 4. Migration não-executada e incorreta
`20240126_agent_tables.sql`:
- `INSERT ... FROM laboratorios` — tabela inexistente (correto seria `tenants`).
- `CREATE POLICY` checa `auth.jwt() ->> 'role' = 'admin'` — papel não vive no JWT; o SISLAC armazena em `user_roles` e checa via `has_role()` / `is_super_admin()`.
- Falta `GRANT` na tabela `public.agent_audit_log` → mesmo se criada, a Data API retornaria erro de permissão.
- Recria `feature_flags` com schema diferente do `src/lib/featureFlags.ts`.

Confirmado: `agent_audit_log` **não consta** na listagem de tabelas do projeto.

### 5. Autenticação cliente quebrada
`useAgent.ts:32` chama `fetch('/functions/v1/chat-agent')` — caminho relativo inválido em produção, sem `Authorization`, sem `apikey`. Padrão SISLAC: `supabase.functions.invoke()`.

### 6. Permissões duplicadas
`validators.ts:46-71` define um mapa de papéis (`admin/operador/leitor`) **hardcoded** — duplica o sistema oficial de `user_roles` + `has_permission()`. Roles aqui (`operador`, `leitor`) **nem existem** no SISLAC (oficiais: `super_admin`, `admin`, `manager`, `user`).

### 7. Domain Driven / SSOT — não respeitado
Nenhum dos stores oficiais (`atendimentoStore`, `pacienteStore`, etc.) é consultado. O agente foi projetado para escrever SQL contra um schema fantasia, em vez de chamar serviços canônicos via tool-calling (padrão do `ai-suggest-exames`).

## Acoplamento / dependências

- Acoplamento interno **baixo** (módulo isolado).
- Acoplamento ao restante do sistema **zero** — o que é justamente o problema: não é uma capacidade, é um silo.
- Sem dependências circulares.

## Conformidade OECV

| Princípio | Status |
|---|---|
| Olhou (contexto do tenant/usuário) | ❌ recebe tudo do cliente |
| Entendeu (schema real) | ❌ assume schema inexistente |
| Configurou (segue padrões) | ❌ stack/edge/migration fora do padrão |
| Validou (testes passariam contra DB real) | ❌ migration nunca rodou |
