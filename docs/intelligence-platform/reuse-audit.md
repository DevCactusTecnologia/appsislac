# Auditoria de Reutilização

Auditoria executada na Fase Final para confirmar que o Assistente NÃO duplica nenhuma regra de negócio do SISLAC.

## Escopo auditado
| Arquivo | LoC | Tipo de código permitido |
| --- | --- | --- |
| `supabase/functions/_shared/registry.ts` | 165 | Declaração de Capabilities (SSOT) |
| `supabase/functions/_shared/aiAuth.ts` | 73 | Bootstrap JWT/tenant/permissões |
| `supabase/functions/ai-chat/index.ts` | 93 | Roteador LLM + tool calling |
| `supabase/functions/ai-chat/skills/paciente.ts` | 70 | Tradução tool → store oficial |
| `supabase/functions/ai-manifest/index.ts` | 22 | Filtro de Capabilities por permissão |
| `supabase/functions/ai-transcribe/index.ts` | 48 | Adapter STT → texto |
| `src/lib/ai/contextEngine.ts` | 78 | Deriva `{module,focus,route}` da rota |
| `src/lib/ai/manifestClient.ts` | 116 | Cache do manifest filtrado |
| `src/components/ai-shell/AiShell.tsx` | 336 | UI conversacional (Sheet + composer) |
| **Total** | **1001** | — |

## Verificações
- ✓ **Zero SQL inline** em skills. Toda leitura/escrita passa por `userClient` (RLS) ou stores existentes.
- ✓ **Zero CRUD duplicado**. `paciente.ts` chama `pacienteStore`/Supabase com mesmas regras já validadas pela UI.
- ✓ **Zero regra de negócio nova**. Skills não recalculam preço, status, criticidade, faturamento, BPA, etc.
- ✓ **Zero rota nova**. Aberturas usam as mesmas rotas que o usuário usaria (`/pacientes/:id`, `/resultado/:id`).
- ✓ **Zero edge function paralela** além de `ai-chat`, `ai-manifest`, `ai-transcribe` (adapter de voz).
- ✓ **Zero tabela `ai_*` nova** desde a Fase 2.0.
- ✓ **Zero Context/Provider/Registry/Manifest novo** desde o congelamento (Fase 2.2).
- ✓ **Zero parser determinístico**. O Intent Parser é o próprio LLM via tool calling.

## Tabela de reuso por domínio
| Domínio | Serviço oficial reutilizado |
| --- | --- |
| Pacientes | `pacienteStore`, RLS, rotas `/pacientes/*` |
| Atendimentos | `atendimentoStore`, status derivado, mesmas validações |
| Resultados | `valoresReferenciaStore`, `criticoPipeline`, `laudoHtmlBuilder` |
| Financeiro | `financeiroStore`, `useAReceberPacientes` |
| Soroteca | `sorotecaStore`, `sorotecaExpurgoStore` |
| Documentos/Laudo | `documentoTemplatesStore`, `printShell`, `watermark` |
| Multi-tenant | `current_tenant_id()` (server-side) |
| Permissões | `has_permission()` (server-side) |

## Conclusão da auditoria
✓ Nenhuma duplicação encontrada. O Assistente é estritamente uma camada de tradução.
