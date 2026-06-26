# Tool Calling

## Regra fundamental
O LLM **só** interage com o sistema via Tools. Proibido:
- Gerar SQL.
- Acessar Supabase diretamente.
- Inventar regras de negócio (preço, faixas, status).
- Retornar dados fabricados quando uma Tool falhar.

## Contrato (AI SDK)
```ts
import { tool } from "ai";
import { z } from "zod";

export const pacienteSearch = tool({
  description: "Busca pacientes do tenant atual por nome, CPF ou telefone.",
  inputSchema: z.object({
    query: z.string().min(2).max(80),
    limit: z.number().int().min(1).max(20).default(10),
  }),
  execute: async ({ query, limit }, { abortSignal }) => {
    // chama serviço oficial; RLS aplica; sem tenant_id explícito
  },
});
```

## Princípios de design de Tool
1. **Input mínimo**: só os campos necessários; tipos estritos.
2. **Saída compacta**: máximo 20 itens; campos curtos; sem HTML.
3. **Idempotente quando possível**: read tools sempre; write tools com `client_request_id` opcional.
4. **Tenant-implícito**: nunca aceitar `tenant_id` no input.
5. **Sem PII excedente**: retornar apenas o necessário para a tarefa.
6. **Erros tipados**: `{ ok, data?, error? }` consistente.

## Exposição condicional
- Antes de chamar `streamText`, o Edge filtra Tools por `has_permission()`.
- Skills sem nenhuma Tool permitida não entram no system prompt.
- Reduz custo de tokens e elimina prompt injection cross-papel.

## Validação
- Zod no `inputSchema` (constrained decoding).
- Re-validação server-side antes de `execute` (defesa em profundidade).
- Strings longas são truncadas; números fora do range rejeitados com erro amigável.

## Limites
- Catálogo total exposto por chamada: **≤ 40 tools**. Acima disso, usar tool deferral (ver `ai-sdk-tool-deferral` knowledge).
- Tamanho de saída por tool: **≤ 8 KB serializado**.
- Tempo máximo de `execute`: **15s** (abort via `abortSignal`).

## Erros e mensagens
| Erro | Comportamento |
|---|---|
| Zod parse fail | Devolve `{ ok:false, error:{code:"INVALID_INPUT"} }`; LLM corrige |
| Permission denied | `{ code:"FORBIDDEN" }`; LLM informa usuário, sem retry |
| RLS retorna vazio | `{ ok:true, data:[] }` — não é erro |
| Service throw | log server-side; `{ code:"INTERNAL" }` para o LLM |

## Anti-padrões proibidos
- Tool genérica `run_sql(query)`.
- Tool `call_api(url, body)`.
- Tool que aceita `tenant_id` ou `user_id`.
- Tool que retorna HTML pronto.
- Tool com side-effect sem `needsApproval`.
