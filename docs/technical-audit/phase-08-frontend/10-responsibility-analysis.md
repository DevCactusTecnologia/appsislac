# 10 — Responsibility Analysis

## Pergunta central
"O Frontend apenas apresenta informações, ou toma decisões de negócio?"

## Evidências de separação
- **RPCs `*_tx`** concentram lógica transacional server-side (Phase 05/06/07 confirmam 7 transactionals + 221 RPCs no total).
- Stores atuam como **replicadores** do backend + coordenadores de fetch/subscribe.
- Hooks **coordenam** (fetch, debounce, derivação); nenhum implementa regra de negócio autoritativa.
- Guards (`ProtectedRoute`, `RequireSuperAdmin`, `RotinaColetaAnaliseGuard`) são de UX; a permissão real é reforçada por RLS + `has_permission` no banco.

## Evidências de regras de negócio residuais no frontend
- **Precificação dinâmica** (`domains/appointment/services/pricing.ts`, memory) — cálculo CBHPM/TUSS/Própria com fallback é feito no cliente para pré-visualização.
- **Resolução de valor de referência** (`domains/result/services/parseValorReferencia.ts` + `resolucao-de-referencia-clinica` memory) — matching por sexo/idade acontece no cliente ao montar o laudo.
- **Cálculos de KPI** (`useDashboardKpis`, `services/computePainelKpis` no Financeiro) — derivações realizadas em memória.
- **Fórmulas de resultado** (`pages/ResultadoDetalhe/formula.ts` + `.test.ts`) — evaluator local para fórmulas do laudo.
- **Máscaras / classificação crítica** (`criticoChecker.ts`, `ParamTypedInput.tsx`) — validação de digitação.
- **Historico de resultados** (`services/historicoResultados.ts`) — SVG gerado no cliente para inserção no laudo.

Essas regras **existem no frontend por natureza da experiência** (preview, digitação, impressão). Todas são **reprocessadas ou validadas server-side** antes da persistência (RPCs `*_tx` são a fonte da verdade).

## Classificação
| Camada | Papel real |
|---|---|
| Pages/Components | Apresentação + coleta de input |
| Hooks | Coordenação + derivação leve |
| Stores | Cache reativo + orquestração de mutação |
| Runtime (`db.ts`) | Roteamento tenant-aware |
| `domains/*/services/` | Regras de UX espelhadas (preview) |
| RPC/Edge | **Verdade** de negócio |

## Conclusão auditada
O frontend possui **separação de responsabilidades majoritariamente correta**. Regras de negócio no cliente são **espelhadas** (preview/validação de UX) e não substituem o backend. Não foram encontrados componentes gravando direto em tabelas críticas sem intermediação de RPC.
