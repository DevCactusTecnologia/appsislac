# 02 — Directory Structure

Mapeamento imparcial dos diretórios encontrados em `/dev-server`. Cada entrada lista responsabilidade, principais conteúdos, dependências e consumidores observados.

## Raiz do projeto

| Item | Responsabilidade | Evidência |
|---|---|---|
| `index.html` | Entrypoint HTML da SPA, SEO base, JSON-LD | contém `<title>` e `og:*` |
| `src/` | Código-fonte da aplicação | 469 arquivos `.ts/.tsx`; 124.915 LOC |
| `supabase/` | Backend gerenciado (functions + migrations + tests) | 74 functions, 355 migrations |
| `public/` | Ativos estáticos servidos por Vite | — |
| `docs/` | Documentação técnica acumulada (design system, runtime, plataforma 3.0, valores de referência) | pastas listadas no comando de mapeamento |
| `scripts/` | Scripts de CI locais (`check-no-mocks.sh`, `check-file-size.sh`) | referenciados em `package.json > scripts.ci` |
| `e2e/` | Testes Playwright de ponta-a-ponta | `@playwright/test` em devDependencies |
| `src/__tests__/` e `src/lib/__tests__/` | Testes Vitest | `vitest.config.ts`; `test`/`test:watch` scripts |
| `vite.config.ts` | Bundler config | React SWC, alias `@` → `src/`, `dedupe: react/react-dom` |
| `tailwind.config.ts` + `postcss.config.js` + `src/index.css` | Design system | Tailwind v3, tokens HSL |
| `eslint.config.js` | Lint | flat config |
| `tsconfig*.json` | TS config split (`app` + `node`) | build info persistido |
| `next.config.js` | Arquivo presente na raiz | **Não referenciado** por scripts de build; SPA usa Vite exclusivamente |
| `validate-security.cjs`, `deploy-compliance.sh`, `GUIA-*`, `LGPD_*` | Documentos/utilitários de compliance/deploy | referências manuais |
| `vercel.json` | Config Vercel (fallback SPA) | — |
| `playwright.config.ts` + `playwright-fixture.ts` | Config E2E | — |
| `.lovable/` | Metadados Lovable (plan.md) | — |
| `bun.lock` + `package-lock.json` | **Ambos presentes** (bun e npm) | fato observado |

## `src/`

| Pasta | Arquivos | Responsabilidade | Dependências principais | Consumidores |
|---|---:|---|---|---|
| `pages/` | 114 | Telas montadas pelo Router. Alguns módulos (Financeiro, NovoAtendimento, ResultadoDetalhe) têm subpastas `services/`, `hooks/`, `components/` | React Router, contexts, hooks, stores, componentes | `src/App.tsx` |
| `components/` | 160 | UI reutilizável. Subpastas por domínio (`configuracoes`, `ui`, `tenant-site`, `soroteca`, `financeiro`, `superadmin`, `rastreabilidade`, `mapa`, `estoque`, `shared`, `editor`, `whatsapp`, `resultado`, `operacional`, `dashboard`, `caixa`, `atendimento`, `assistente`, `auditoria`) + 34 componentes na raiz | shadcn/radix, framer-motion, stores, lib | Pages e outros components |
| `contexts/` | 3 | `AuthContext`, `MenuLayoutContext`, `SuperAdminPrefsContext` | Supabase client | Consumidos globalmente |
| `data/` | 42 | Stores in-memory + `atendimentoStore/` (subpasta), `storeBoot.ts`, `lazyStores.ts`, `types.ts`, `atendimentoNormalize.ts` | Supabase client, TanStack Query | Pages, hooks, components |
| `hooks/` | 20 | Hooks de UI (`use-*`) + hooks de página (`usePaginatedAtendimentos`, `useResultadosPage`, `useDashboardKpis`, `useCompliance`, etc.) | Stores, `queryClient`, Supabase | Pages |
| `integrations/` | — | `supabase/client.ts` + `supabase/types.ts` (auto-gen), `contracts/` (transport/providers/capabilities/providerUI), `providers/dbsync/*`, `providers/hermes-pardini/*`, `providers/registry.ts` | Supabase JS | `src/lib/integration/*`, edge functions |
| `lib/` | ~60 | Utilitários + serviços transversais (`queryClient`, `logger`, `errorHandling`, `printHtml`, `laudoTemplate`, `laudoBatchPdf`, `mapaPrint`, `pixBrCode`, `pricing/*`, `integration/*`, `tenantSite/*`, `whatsapp/*`) | Depende de `runtime/db`, Supabase client, dom libs | Pages, stores, components |
| `runtime/` | 1 | `db.ts` — resolvedor de client Supabase por tenant (`getUserTenantClient`) | Supabase client | Stores e services que atravessam runtime |
| `domains/` | 9 arquivos | Sub-domínios extraídos: `appointment/services/pricing.ts`, `result/services/comprovantes*`, `result/services/criticoChecker.ts`, `result/services/parseValorReferencia.ts`, `tenant/services/operationalAuditReader.ts`, `tenant/services/selectOptionsReader.ts` | Stores e client Supabase | Pages e stores |
| `assets/` | — | Imagens, logos, SVGs | Importados por components/pages | — |
| `types/` | — | Tipos compartilhados | — | Diversos |
| `test/` | — | Setup Vitest | — | Vitest |
| `App.tsx` | 474 LOC | Router + composição de providers + boot pós-auth | Todas as pages | `main.tsx` |
| `main.tsx` | — | Bootstrap, fontes @fontsource, favicon, cleanup de service workers legados | — | Vite |
| `index.css` | — | Tokens HSL + camadas Tailwind | Tailwind | Global |

## `supabase/`

| Pasta | Conteúdo | Observação |
|---|---|---|
| `functions/` | 74 subdiretórios (edge functions Deno) + `_shared/` com `aiAuth`, `canonical`, `cronHealth`, `crypto`, `drivers`, `edgeBoot`, `hardening`, `integrationLog`, `migration`, `neonProvider`, `protocols`, `rateLimit`, `registry`, `resolveExamIntegration`, `runtime`, `s3`, `tenantGuard` | Ver `03-module-map.md` para agrupamento |
| `migrations/` | 355 arquivos SQL versionados por timestamp | Do range `20260417*` até `20260702*` — números indicam versão futura (convenção do projeto) |
| `tests/` | Testes SQL/edge (existente) | Ver conteúdo específico |
| `config.toml` | Config do projeto Supabase | Auto-gerenciado |

## `docs/`

Subpastas encontradas:
- `AI-SISLAC/`
- `DOCUMENT-ENGINE/`
- `PRINT-ENGINE/`
- `database-per-tenant-audit/`
- `database-runtime/` (`forensic-review/`, `surgery/`)
- `design-system/`
- `plataforma-3.0-migracao/`
- `valores-referencia-2.0/`

Nenhum novo diretório foi criado além de `technical-audit/phase-01-architecture/` (esta fase).

## Importância relativa (por volume e centralidade)

1. `src/pages/` + `src/components/` — 274 arquivos combinados → superfície UI (crítico).
2. `supabase/functions/` — 74 functions, 16.298 LOC → toda a lógica privilegiada e integrações.
3. `supabase/migrations/` — 355 arquivos → schema histórico.
4. `src/data/` — 39 stores → coluna vertebral do estado de domínio.
5. `src/lib/` — hub de serviços/utilitários; alta reutilização.
6. `src/runtime/db.ts` — pequeno em volume, alto em criticidade (roteamento de tenant).
