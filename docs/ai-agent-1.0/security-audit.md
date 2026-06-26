# AI Agent 1.0 — Auditoria de Segurança

## Findings críticos

### CRIT-1 — Chave de terceiro no frontend
`src/hooks/agent/useVoice.ts:79` lê `import.meta.env.VITE_ELEVENLABS_KEY`. Qualquer variável `VITE_*` é **embarcada no bundle do cliente**. Mesmo que hoje não exista valor, o padrão é proibido. Remover.

### CRIT-2 — Cross-tenant trivial
Cliente envia `tenant_id` arbitrário no body (`useAgent.ts:34`). A edge function **confia** no valor e o injeta no system prompt (`chat-agent/index.ts:53`). Um usuário autenticado em qualquer tenant pode passar outro `tenant_id` e obter respostas escopadas a esse tenant. Vetor cross-tenant clássico.

### CRIT-3 — Bypass de permissões
`validators.ts` define roles próprios (`admin/operador/leitor`) que não existem no SISLAC. Se essa lógica fosse plugada, qualquer usuário sem entrada no mapa receberia `undefined.includes(...)` → `false` (fechado) **OU**, dependendo de como fosse chamado, contornaria `has_permission()` real.

### HIGH-1 — RLS frouxo na auditoria
`agent_audit_log` policy: `USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin')`. O claim `role` não vem populado com o papel da aplicação no SISLAC; a cláusula é inerte. Sem `GRANT`, a tabela é inacessível pela Data API mesmo para o próprio dono.

### HIGH-2 — Service-role com escopo amplo
`chat-agent/index.ts` cria client com `SUPABASE_SERVICE_ROLE_KEY` e executa qualquer query que o LLM eventualmente derive. Não há sandboxing: o roteiro previsto é o próprio LLM gerar SQL → executar. Em produção isso é exfiltração de qualquer tabela.

### MED-1 — Logs sem isolamento
Auditoria armazena `prompt` e `response` truncados, sem hash, com PII potencial (nomes de paciente em perguntas). Sem retenção definida. LGPD pendente.

### MED-2 — Validador SQL ingênuo
`validators.ts:34-56` confia em substring matching para bloquear `DROP/DELETE`. Trivialmente contornável (`/**/DELETE`, `delete /*x*/from`, `CTE`s). Apenas SELECT também não impede exfiltração.

## Secrets observados

- `ANTHROPIC_API_KEY` — ausente, deveria ser substituída por `LOVABLE_API_KEY` (já gerenciada).
- `VITE_ELEVENLABS_KEY` — proibida (frontend).
- `SUPABASE_SERVICE_ROLE_KEY` — usada onde service-role não é necessário.

## Conclusão

A combinação CRIT-2 + CRIT-3 + HIGH-2 torna o módulo **inseguro para produção**. Como nada está em runtime (a function 500-eia), o risco efetivo hoje é **baixo**; o risco se "consertado por cima" é **alto**.
