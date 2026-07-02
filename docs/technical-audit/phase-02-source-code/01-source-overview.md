# 01 — Source Overview

**Phase:** 02 — Source Code Inventory & Responsibility Audit
**Data-base:** contagem via `find`/`wc` no repositório congelado.

## Totais absolutos

| Categoria                          | Contagem |
| ---------------------------------- | -------- |
| Arquivos totais em `src/`          | 483      |
| Arquivos `.ts` em `src/`           | 227      |
| Arquivos `.tsx` em `src/`          | 242      |
| Edge Functions (`.ts`)             | 107 (74 diretórios em `supabase/functions/`) |
| Migrations SQL                     | 355      |
| Scripts (`scripts/`)               | 8        |
| Testes E2E (`e2e/`)                | 1        |
| Documentação (`docs/**/*.md`)      | 112      |
| Assets estáticos (`public/`)       | 4        |

## Linhas de código (LOC brutas — `wc -l`)

| Bucket                              | LOC     |
| ----------------------------------- | ------- |
| `src/**` (TS + TSX)                 | 124.915 |
| `src/**/*.tsx`                      | 80.540  |
| `src/**/*.ts` (excluindo `.d.ts`)   | 44.374  |
| `supabase/functions/**/*.ts`        | 16.298  |
| `supabase/migrations/**/*.sql`      | 27.616  |

## Superfícies principais em `src/`

- `App.tsx`, `main.tsx`, `index.css`, `vite-env.d.ts` — bootstrap.
- `assets/`, `components/`, `contexts/`, `data/`, `domains/`, `hooks/`, `integrations/`, `lib/`, `pages/`, `runtime/`, `test/`, `types/`, `__tests__/`.

## Superfícies principais fora de `src/`

- `supabase/functions/` — 74 funções + `_shared/`.
- `supabase/migrations/` — 355 arquivos (todos com prefixo `2026`).
- `supabase/tests/` — 1 arquivo SQL de teste (`update_atendimento_tx_preserves_state.sql`).
- `scripts/` — 8 utilitários de verificação / seed.
- `e2e/` — 1 spec Playwright.
- `docs/` — 9 subdiretórios, 112 documentos.
- Configuração raiz: `vite.config.ts`, `tailwind.config.ts`, `tsconfig*.json`, `eslint.config.js`, `postcss.config.js`, `playwright.config.ts`, `vitest.config.ts`, `vercel.json`, `next.config.js`, `components.json`, `validate-security.cjs`, `.env`.

## Observação

Este relatório é puramente descritivo: nenhum arquivo foi movido, renomeado ou alterado durante a coleta.
