# FASE 2 — SSOT Gains Report

> Inventário de helpers `calculate*`, `build*`, `derive*`, `validate*`, `release*`, `send*` antes vs depois das consolidações.

## Tabela executiva

| Regra | Antes (impl. duplicadas) | Depois (SSOT) | Ganho |
|---|---|---|---|
| `calculateExamPrice` (preço de exame no wizard) | 4 cópias in-line em `NovoAtendimento.tsx` | 1 — `src/domains/appointment/services/pricing.ts` | **−75%**, fim de divergência silenciosa |
| `buildExamesCobranca` (payload p/ create/update) | 2 cópias literais (14 linhas cada) em `NovoAtendimento.tsx` | 1 — `src/pages/NovoAtendimento/buildExamesCobranca.ts` (+ testes) | **−50%**, coberto por unit test |
| `contarEtiquetas` (qtd. etiquetas + flag terceirizados) | inline em `finalizarAtendimento` | 1 — `src/pages/NovoAtendimento/services/contarEtiquetas.ts` | Função pura testável |
| `resyncCobrancaConvenios` (re-sync ao remover convênio) | inline (effect implícito) | 1 — `src/pages/NovoAtendimento/services/resyncCobrancaConvenios.ts` | Comportamento literal extraído |
| `deriveStatusPagamento` (status pagamento) | client-side (atendimentoStore) + DB | 1 — trigger DB `recompute_atendimento_status` | **SSOT autoritativo no DB** |
| `validateCritico` (valores críticos) | espalhado em `lib/` | 1 — `src/domains/result/services/criticoChecker.ts` (shim em `src/lib/criticoChecker.ts`) | Re-export, sem fan-out |
| `releaseLaudo` / liberação | espalhado | 1 — `atendimentoStatus.ts` (SSOT) + `atendimentoStore.liberar*` | Estado central |
| `renderComprovante` (PDF) | monolito `comprovantesHtml` | 4 — `comprovantesHtml` → `Render` + `Validation` + `Upload` + `Whatsapp` | Coesão por responsabilidade |
| `sendWhatsapp` (envio + retry + idempotência) | múltiplas tentativas em edge fns | 1 — `whatsapp-send` + `whatsapp_mensagens.unique` | Idempotência garantida no DB |
| `resolveCobrancaDefault` (default convênio cobrança) | inline em handlers | 1 — `pages/NovoAtendimento/helpers.ts` | Reuso entre wizard e effects |
| `useDicionario` (leitura de select_options) | leitura via stores (8+ pontos) | 1 — hook `src/hooks/use-select-options.ts` + `useDicionario` | Read-path unificado |
| `has_permission` (RBAC) | check no front (vários components) | 1 — RPC DB + check redundante em edges | Defesa em profundidade |
| `current_tenant_id()` (resolução de tenant) | passado por props/headers | 1 — função DB invocada server-side | Frontend não vê mais `tenant_id` |
| `protocoloLookup` (portal) | inline em endpoints públicos | 1 — `src/lib/protocoloLookup.ts` | Reuso server/edge |

## Métricas agregadas

| Métrica | Antes | Depois | Δ |
|---|---|---|---|
| Helpers críticos duplicados | ~14 ocorrências | 1 cada (14 módulos SSOT) | **−93%** duplicação efetiva |
| Stores que reimplementavam dicionário | 8+ | 0 (todos via `useDicionario`) | **−100%** |
| Fontes de "status de pagamento" | 3 (store + view + RPC) | 1 lógica DB → 3 caminhos de leitura derivados | SSOT correto |
| Implementações de preço de exame | 4 | 1 | **−75%** |
| Cópias do payload `examesCobranca` | 2 | 1 | **−50%** |

## Riscos residuais (pré-existentes, ainda não fechados)

- 🟠 **R-01**: legacy A-Receber em `Financeiro.tsx` ainda lê `tabelaPrecoStore` em vez de `atendimento_exames.valor`. Documentado, não introduzido pelo refactor.
- 🟠 **R-05**: forma de pagamento de saída ainda é regex em `descricao`. Documentado.
- 🟡 **Orçamento**: per-item price não persistido em `orcamento_exames`.

## Veredito Fase 2

✅ **Ganho real e mensurável de SSOT.** Os 5 hotspots de duplicação do `NovoAtendimento` foram fechados; o caminho de leitura de dicionários foi unificado; o status de pagamento passou a ser derivado por trigger no DB. Os 2 riscos residuais já estavam documentados antes do programa e não foram regredidos.
