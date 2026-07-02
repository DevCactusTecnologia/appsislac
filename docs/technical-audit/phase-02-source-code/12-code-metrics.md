# 12 — Code Metrics

Métricas objetivas do repositório, coletadas via `find` + `wc -l`.

## Contagem de arquivos

| Categoria | Contagem |
| --------- | -------- |
| Arquivos totais em `src/` | 483 |
| TS (`src/**/*.ts` excl. `.d.ts`) | 227 |
| TSX (`src/**/*.tsx`) | 242 |
| Testes unitários (`.test.ts`/`.spec.ts` em `src/`) | ver §Testes |
| Edge Functions (arquivos `.ts` em `supabase/functions/`) | 107 |
| Diretórios de Edge Functions | 74 (+ `_shared/`) |
| Migrations SQL | 355 |
| Scripts | 8 |
| E2E specs | 1 |
| Docs Markdown | 112 |
| Assets `public/` | 4 |

## Linhas de código (`wc -l`)

| Bucket | LOC |
| ------ | --- |
| `src/**` (TS + TSX) | 124.915 |
| `src/**/*.tsx` | 80.540 |
| `src/**/*.ts` (excl. `.d.ts`) | 44.374 |
| `supabase/functions/**/*.ts` | 16.298 |
| `supabase/migrations/**/*.sql` | 27.616 |
| **Total código auditado** | **~168.829 LOC** |

## Stores, hooks, componentes, páginas

| Categoria | Contagem |
| --------- | -------- |
| Stores (`src/data/*Store.ts` + subpasta `atendimentoStore/` como 1 store composto) | 39 stores + 2 auxiliares (`storeBoot`, `lazyStores`, `types`, `atendimentoNormalize`) |
| Hooks (`src/hooks/`) | 20 |
| Componentes (raiz + subpastas em `src/components/`) | 21 subdiretórios; ~37 na raiz; ~155 total estimado |
| Páginas (`src/pages/**`) | 78 arquivos (raiz + `superadmin/` + `admin/` + `NovoAtendimento/` + `ResultadoDetalhe/` + `Financeiro/` + `producao/`) |
| Serviços de domínio (`src/domains/**/services/*.ts`) | 9 |
| Libs (`src/lib/**`) | 65 entradas (arquivos e subpastas) |

## Testes

- `src/__tests__/validation.spec.ts`
- `src/lib/__tests__/` (múltiplos testes de utilitários)
- `src/pages/NovoAtendimento/pricing.test.ts`
- `src/pages/NovoAtendimento/buildExamesCobranca.test.ts`
- `src/pages/ResultadoDetalhe/formula.test.ts`
- `src/test/setup.ts` (setup Vitest)
- `supabase/functions/_shared/drivers/__tests__/registry_test.ts`
- `supabase/tests/update_atendimento_tx_preserves_state.sql`
- `e2e/mapa-preview-cell-formatting.spec.ts`
- `scripts/test-rls.js`, `test-rls-integration.js`, `test-validacoes.js`

## Configurações (raiz)

15 arquivos: `vite.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `eslint.config.js`, `postcss.config.js`, `playwright.config.ts`, `playwright-fixture.ts`, `vitest.config.ts`, `vercel.json`, `next.config.js`, `components.json`, `validate-security.cjs`, `supabase/config.toml`, `src/index.css`, `.env`, `.github/workflows/ci.yml`.

## Documentação

112 arquivos Markdown distribuídos em 9 subdiretórios:

- `docs/AI-SISLAC/` — 12
- `docs/DOCUMENT-ENGINE/` — 6
- `docs/PRINT-ENGINE/` — 13
- `docs/database-per-tenant-audit/` — 15
- `docs/database-runtime/` — 6 (raiz) + `forensic-review/` (15) + `surgery/` (11)
- `docs/design-system/` — 1
- `docs/plataforma-3.0-migracao/` — 2
- `docs/technical-audit/phase-01-architecture/` — 15 + 1 `.mmd`
- `docs/valores-referencia-2.0/` — 14

## Densidade média

| Bucket | Arquivos | LOC | LOC/arquivo médio |
| ------ | -------- | --- | ----------------- |
| `src/**/*.tsx` | 242 | 80.540 | ~333 |
| `src/**/*.ts` | 227 | 44.374 | ~195 |
| `supabase/functions/**/*.ts` | 107 | 16.298 | ~152 |
| `supabase/migrations/**/*.sql` | 355 | 27.616 | ~78 |
