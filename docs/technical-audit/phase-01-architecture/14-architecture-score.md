# 14 — Architecture Score (métricas)

## Quantidades observadas

| Métrica | Valor |
|---|---:|
| Módulos funcionais identificados | **20** (ver `03-module-map.md`) |
| Camadas identificadas | **11** (ver `04-layer-analysis.md`) |
| Diretórios principais em `src/` | **13** (`pages`, `components`, `hooks`, `contexts`, `data`, `lib`, `runtime`, `domains`, `integrations`, `assets`, `types`, `test`, `__tests__`) |
| Subdiretórios em `src/components/` | **21** |
| Subdiretórios em `src/pages/` | **7** (`Financeiro`, `NovoAtendimento`, `ResultadoDetalhe`, `admin`, `producao`, `superadmin`, além da raiz) |
| Pages | **114** |
| Components | **160** |
| Hooks | **20** |
| Stores (arquivos `*Store.ts` em `src/data`) | **39** |
| Contextos globais | **3** |
| Serviços em `src/domains/**` | **9** |
| Arquivos em `src/lib/` (raiz + subpastas) | **60+** |
| Rotas React Router declaradas em `App.tsx` | **~120** |
| Componentes críticos identificados | **~25** (ver `10-critical-components.md`) |
| Guards / Boundaries | **5** (`ProtectedRoute`, `RequireSuperAdmin`, `RotinaColetaAnaliseGuard`, `ChunkErrorBoundary`, `PageErrorBoundary`) |
| Providers globais em `App.tsx` | **6** (`HelmetProvider`, `QueryClientProvider`, `TooltipProvider`, `AuthProvider`, `MenuLayoutProvider`, `BrowserRouter`) |
| Edge functions | **74** |
| LOC total (edge functions) | **16.298** |
| Módulos `_shared/` em edges | **17** (arquivos/pastas listados em `supabase/functions/_shared`) |
| Migrations SQL | **355** |
| Providers de lab de apoio | **2** (`dbsync`, `hermes-pardini`) + `registry.ts` |
| Contracts de integração | **4** (`capabilities`, `providers`, `providerUI`, `transport`) |
| Buckets/adapters de storage referenciados | Ao menos 5 conjuntos (assinaturas, comprovantes, requisições, laudos de apoio, imagens genéricas) |
| Pastas em `docs/` | **9** |
| Arquivos totais TS/TSX em `src/` | **469** |
| LOC total `src/` | **124.915** |

## Pontos de entrada

- `src/main.tsx` (bootstrap único)
- `src/App.tsx` (Router)
- `index.html` (SEO / JSON-LD)
- Rotas públicas: `/`, `/login`, `/super-admin/login`, `/inscricao`, `/verificar/:codigo`, `/p/:codigo`, `/site/:slug`, `/privacidade`, `/reset-password`
- Sub-domínio Super Admin: `/super-admin/**`

## Pontos de saída (comunicação para fora da SPA)

- Supabase JS → PostgreSQL, Auth, Realtime, Storage (Lovable Cloud) — múltiplos por store
- Edge functions Deno (74 endpoints)
- Lovable AI Gateway (via edges IA)
- Providers externos (dbsync, hermes-pardini)
- Webhook PIX / QR code
- Deep-links WhatsApp
- Sitemap / SEO / OG / Twitter cards (index.html + edge `sitemap`)
- Vercel (deploy) / Lovable publish domain

## Composição em uma tabela

| Camada | Elementos | Quantidade |
|---|---|---:|
| UI | Pages + Components | 274 |
| Estado | Stores + Contextos + Hooks | 62 |
| Serviços de domínio | `src/domains` + `src/lib` (excluindo utilitários) | ~40 |
| Runtime | `runtime/db.ts` | 1 |
| Integrações client | providers + contracts + supabase client | 3 grupos |
| Backend | Edge functions + Migrations + `_shared` | 74 + 355 + 17 |
