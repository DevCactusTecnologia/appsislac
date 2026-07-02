# 01 — Codebase Overview

## Inventário
| Categoria | Contagem |
|---|---|
| Arquivos TS/TSX em `src/` | 469 |
| Páginas (`src/pages/**`) | 114 |
| Componentes (`src/components/**`) | 160 |
| Hooks (`src/hooks/**`) | 20 |
| Stores (`src/data/**`) | 48 |
| Edge Functions | 74 |
| Migrations SQL | 355 |
| Docs `.md` (`docs/**`) | 247 |
| LOC total `src/` | 124.915 |
| LOC total edges | 16.298 |
| LOC `src/integrations/supabase/types.ts` (gerado) | 9.041 |

## Distribuição por diretório
- `src/pages/` concentra as maiores unidades (7 páginas > 1.000 LOC).
- `src/components/` tem 41 arquivos > 400 LOC.
- `src/data/` mantém 1 arquivo/entidade; 2 stores > 800 LOC (`sorotecaStore`, `sorotecaEstruturaStore`).
- `src/hooks/` é enxuto (20 arquivos, 2.890 LOC).
- `supabase/functions/_shared/` reutilizado por 76 edges (chokepoint intencional).

## Padrão geral
- Roteamento de dados unificado: 121 arquivos importam `@/runtime/db`; apenas 4 arquivos ainda importam `@/integrations/supabase/client` (exceções auditadas em `eslint.config.js`).
- Convenções de nomenclatura estáveis: `*Store.ts`, `use*.ts(x)`, `super-admin-*`, `_shared/*`.

## Conclusão factual
Base grande, com evolução visivelmente coerente ao longo do tempo (chokepoints, guards em CI, allowlist de tamanho). Densidade de LOC alta em páginas operacionais críticas.
