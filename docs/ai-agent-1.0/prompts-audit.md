# AI Agent 1.0 — Auditoria de Prompts

## Inventário

| Local | Uso |
|---|---|
| `src/lib/agent/prompts.ts` — `SYSTEM_PROMPT`, `SQL_GENERATION_PROMPT`, `ACTION_CONFIRMATION_PROMPT` | **Nenhum consumidor** (morto) |
| `supabase/functions/chat-agent/index.ts:46-62` — `systemPrompt` inline | Único prompt efetivamente usado |

## Findings

1. **Duplicação**: O system prompt foi escrito duas vezes — uma vez em `prompts.ts` (cliente) e outra vez inline na edge function. A versão do cliente nunca é enviada (boa coisa, pois system prompts devem ficar no servidor), mas o arquivo continua no repositório.
2. **Prompt morto**: `SQL_GENERATION_PROMPT` e `ACTION_CONFIRMATION_PROMPT` não têm callsite.
3. **Prompt hardcoded**: schema é embutido no prompt com colunas que não existem (`pacientes.nome`, `atendimentos.protocolo`...) — ver `architecture-audit` §2.
4. **Sem modularização**: instruções, schema, exemplos, e regras de segurança estão concatenados; impossível atualizar uma seção sem reescrever tudo.
5. **Sem versionamento**: nenhum `version` ou `id` no prompt — auditoria de regressão impraticável.

## Recomendação

Quando reimplementar (fora do escopo desta auditoria):
- 1 SSOT para system prompt, no servidor.
- Schema vem da `information_schema` ou de um manifesto gerado, nunca colado no prompt.
- Modularizar por seção (`identity`, `safety`, `tools`, `context`).
