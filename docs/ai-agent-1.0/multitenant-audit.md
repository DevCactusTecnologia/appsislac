# AI Agent 1.0 — Auditoria Multi-Tenant

## Resultado

**Não conforme.** Viola a regra core do SISLAC.

## Evidências

1. `tenant_id` é parâmetro do frontend (`useAgent.ts:34`, `AgentPage.tsx:19`) — deveria ser resolvido por `current_tenant_id()` no servidor.
2. Nenhuma chamada ao agente passa pelos stores oficiais que já encapsulam o isolamento por tenant.
3. A edge function usa `SUPABASE_SERVICE_ROLE_KEY` — **ignora RLS por construção**. Qualquer SQL gerado pelo LLM rodaria sem isolamento.
4. `agent_audit_log` não tem `tenant_id` em nenhuma policy (a única policy usa `user_id`), permitindo, se a tabela existisse, que o `service_role` da function gravasse logs com tenant arbitrário sem checagem.
5. Cache / histórico: não há TTL nem chaveamento por tenant — `useAgent` mantém mensagens em estado de componente; ok por enquanto, mas se for persistido sem `["tenant", tenantId, ...]` quebra a governança de cache.

## Caminho conforme (referência)

`ai-suggest-exames/index.ts` faz certo: valida JWT, extrai `userId`, aplica rate-limit por `userId|ip`, e quando precisa de dados específicos do tenant usa o client autenticado do usuário (que respeita RLS). Esse é o modelo a replicar.
