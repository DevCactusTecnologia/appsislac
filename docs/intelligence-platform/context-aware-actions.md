# Context-Aware Actions

## Princípio
O Assistente nunca pergunta o que o sistema já sabe.

## Fonte oficial
`src/lib/ai/contextEngine.ts` (Core, congelado) deriva `{ route, module, focus }` da rota atual via `useLocation` + `useParams`. O AI Shell envia esse envelope a cada mensagem ao `ai-chat`.

## Como cada módulo contribui
| Rota | module | focus |
| --- | --- | --- |
| `/pacientes/:id` | `pacientes` | `pacienteId` |
| `/atendimentos/:id` | `atendimentos` | `atendimentoId` |
| `/resultado/:id` | `resultados` | `resultadoId` |
| `/exames/:id` | `exames` | `exameId` |
| `/soroteca/:id` | `soroteca` | `amostraId` |

## Comportamentos derivados
- Com `pacienteId` no foco: "abra o resultado dela" resolve sem perguntar nome.
- Com `resultadoId` no foco: "salvar", "liberar", "imprimir" agem no próprio resultado.
- Sem foco: o Assistente pede o mínimo necessário em frase única ("Qual paciente?").

## Sugestões contextuais
`getContextualSuggestions(ctx, capabilities)` filtra Capabilities marcadas com `supportsSuggestions` que casem com o foco atual. Máximo 3. Nunca exibidas sem foco.

## Segurança
Cliente sugere, Edge confirma. O `ai-chat` reaplica RLS via `userClient` antes de qualquer mutação. O `tenant_id` do envelope é ignorado — sempre `current_tenant_id()`.
