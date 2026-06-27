# Security Final — AI-SISLAC 2.0

Ver `Security.md` para o modelo. Este documento certifica a auditoria pós-consolidação.

## Validações

| Verificação                                                                 | Status |
|------------------------------------------------------------------------------|--------|
| JWT obrigatório em `ai-chat`                                                 | OK |
| Tenant resolvido server-side via `current_tenant_id()`                       | OK |
| Tools filtradas por `has_permission` antes de exposição ao LLM               | OK |
| Tools usam `userClient` (RLS aplica)                                         | OK |
| `needsApproval` declarado no Registry                                        | OK |
| Auditoria estruturada em `ai_audit` por execução de Tool                     | OK |
| Tabelas órfãs (`ai_threads`, `ai_messages`, `ai_user_preferences`, `ai_metrics_daily`) removidas | OK |
| Nenhuma Tool aceita SQL livre                                                 | OK |

## Gate de confirmação

`needsApproval=true` no Registry sinaliza ao prompt que o modelo deve solicitar confirmação. **A confiança real está na UI**: o `AssistenteSISLAC.tsx` é o ponto onde botões de confirmação devem ser apresentados antes de re-emitir o comando. Nunca depender só do prompt.
