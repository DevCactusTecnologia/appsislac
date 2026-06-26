# Context Engine

## Princípio
A IA **descobre** o contexto. O usuário **nunca informa** manualmente "estou no paciente X".

## Fontes de contexto (browser)
| Fonte | O que extrai |
|---|---|
| `useLocation()` (react-router) | rota atual + params (ex.: `/atendimentos/:id`, `/resultados/:id`) |
| `AuthContext` | `user.id`, nome, papéis carregados |
| `tenantResolver.getTenantContext()` | `tenant_id`, nome do tenant (cache) |
| Query string | filtros ativos, busca |
| Stores Zustand/react-query | snapshots leves (sem PII além do necessário) |
| DOM hints | `data-ai-context="..."` em containers raiz de cada página |

## Envelope de contexto (formato canônico)
```ts
type AIContext = {
  route: { path: string; params: Record<string, string>; query: Record<string, string> };
  user: { id: string; nome: string };          // sem email/CPF aqui
  tenant: { id: string; nome: string };         // id NUNCA chega ao LLM como texto livre
  module: "pacientes" | "atendimentos" | "exames" | "resultados" | "soroteca" | "financeiro" | "whatsapp" | "producao" | "configuracoes" | "outro";
  focus?: {                                     // ENTIDADE atual em foco, somente IDs/labels
    pacienteId?: string;
    atendimentoId?: string;
    exameId?: string;
    resultadoId?: string;
    amostraId?: string;
    documentoId?: string;
  };
  hints?: string[];                             // pistas curtas geradas por hooks
};
```

## Regras
1. **Server-side wins**: o Edge `ai-chat` valida que `focus.*` pertence ao tenant via RLS antes de qualquer tool. Cliente sugere, Edge confirma.
2. **Sem PII no envelope**: nenhuma string com nome de paciente, CPF, resultado, valor financeiro vai junto do contexto. O LLM recebe apenas IDs+labels neutros; dados completos vêm via tool calls.
3. **Tamanho fixo**: envelope < 2 KB. Hints truncados.
4. **Sem trustar tenant**: tenant_id do envelope é ignorado pelo Edge — sempre `current_tenant_id()` na sessão.
5. **Reatividade**: envelope é recomputado on-route-change e on-focus-change; AI Shell envia o último envelope ao despachar mensagem.

## Como cada módulo contribui
Cada página declara um único hook canônico `useAIContextProvider({ module, focus })` no topo. Sem isso, o módulo aparece como `"outro"`. Sem invasão: hook é opt-in.

## O que NUNCA entra no contexto
- Lista de resultados.
- Valores financeiros.
- Snippets de conversa WhatsApp.
- Senhas, tokens, JWT.
- Conteúdo de laudos.

Tudo isso é buscado via Tool quando (e somente quando) necessário.
