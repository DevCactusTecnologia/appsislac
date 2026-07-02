# 11 — Standardization

## Imports
- **Padrão único cliente**: `@/runtime/db` (121 arquivos). Regra ESLint bloqueia import direto do client (`eslint.config.js`).
- **Exceções auditadas**: 4 arquivos (declarados explicitamente na config).
- **Padrão único servidor**: `_shared/runtime/{db,createClient,tenantContext,identity}` (76 edges).

## Estrutura de arquivos
- Camadas fixas: `pages/`, `components/`, `data/`, `domains/`, `hooks/`, `lib/`, `runtime/`, `integrations/`, `contexts/`.
- Edges: 1 diretório por função + `_shared/`.
- Provedores: `src/integrations/providers/<vendor>/` + `supabase/functions/_shared/drivers/<vendor>/` seguem simetria.

## Hooks
- Prefixo `use*` respeitado (100%).
- 20 arquivos; nenhum > 500 LOC.

## Stores
- Padrão `*Store.ts` (48 arquivos, 1 por entidade).
- `atendimentoStore` promovido a subpasta quando cresceu (padrão de escalada).

## Edge Functions
- Nomenclatura verbal (`super-admin-*`, `integration-*`, `provider-*`, `lab-apoio-*`, `tenant-*`).
- `_shared/edgeBoot.ts` disponível — adoção parcial (14 de 74 edges).

## Runtime
- Facade única cliente + servidor. Guardrail CI (`scripts/check-data-plane-routing.sh`).

## Testes
- Vitest para unit (`vitest.config.ts`).
- Playwright para E2E (`playwright.config.ts`).
- Sem padrão único de fixture / mock.

## Configuração
- `tsconfig` estrito (`noImplicitAny`, `strictNullChecks`).
- ESLint com `no-restricted-imports` para governança.
- `scripts/check-file-size.sh` + allowlist.
- `scripts/check-no-mocks.sh`.

## Padronização heterogênea
- Adoção de `edgeBoot`: parcial (14/74).
- Cache client-side: dualidade store custom + TanStack Query.
- Estilo de dialog: consistente, mas sem componente base explícito.
