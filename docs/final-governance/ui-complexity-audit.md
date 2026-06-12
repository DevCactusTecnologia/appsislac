# FASE 1 — UI Complexity Audit

Hotspots auditados (linhas medidas com `wc -l` em 2026-06-12, pós Fase 4 do refactor Financeiro).

| Arquivo | Total | useState | useEffect | useMemo | useCallback | handlers | linhas iniciando com JSX |
|---|---:|---:|---:|---:|---:|---:|---:|
| `src/pages/ResultadoDetalhe.tsx` | **2 241** | 39 | 4 | 2 | 6 | 7 | 304 |
| `src/pages/NovoAtendimento.tsx`  | **2 527** | 56 | 12 | 2 | 0 | 3 | 410 |
| `src/pages/Financeiro.tsx`       |   **924** | 4 | 6 | 31 | 0 | 11 | 48 |

## Estimativa por natureza das linhas

Estimativa heurística (contagem visual + ratio padrão React de pages-monstro). Margem ±10%.

### ResultadoDetalhe.tsx — 2 241 linhas
| Categoria | Linhas | % |
|---|---:|---:|
| Estado (useState/refs) + hidratação | ~190 | 8% |
| Lógica de domínio inline (handlers, builders, derivações) | ~620 | 28% |
| Efeitos / subscriptions / sync | ~120 | 5% |
| Renderização (JSX + classes) | ~1 050 | 47% |
| Imports + tipos + constantes UI | ~260 | 12% |

> Observação: lógica clínica pesada já foi extraída para `src/domains/result/services/`. O que resta inline é **orquestração** + **assembly de HTML para impressão** (congelado por constraint).

### NovoAtendimento.tsx — 2 527 linhas
| Categoria | Linhas | % |
|---|---:|---:|
| Estado (56 useState + refs do wizard) | ~310 | 12% |
| Lógica de wizard (validação, navegação entre steps, derivação) | ~520 | 21% |
| Efeitos (12 useEffect — hidratação, autosave, recomputação) | ~180 | 7% |
| Renderização (JSX dos 4 steps + dialogs + resumo) | ~1 220 | 48% |
| Imports + tipos + constantes UI | ~297 | 12% |

### Financeiro.tsx — 924 linhas
| Categoria | Linhas | % |
|---|---:|---:|
| Estado (já externalizado em hooks/context) | ~30 | 3% |
| Lógica derivada (31 useMemo, 11 handlers) | ~380 | 41% |
| Efeitos (boot + sync) | ~70 | 8% |
| Renderização (orquestrador + Tabs) | ~290 | 31% |
| Imports + tipos + constantes UI | ~154 | 17% |

> Pós-refactor: Financeiro virou **orquestrador**. A maior parte do volume residual é **montagem do `FinanceiroContext`** (cálculo dos derivados via `useMemo`).

## Conclusão da Fase 1

- **Financeiro:** UI/estado já desacoplados. Não há mais hotspot estrutural — sobra apenas montagem de contexto.
- **ResultadoDetalhe:** ~47% é JSX puro. Lógica de impressão está congelada por `mem://constraints/layout-impressao-travado`.
- **NovoAtendimento:** ~48% é JSX puro distribuído em steps coesos do wizard — candidato natural a split por step.
