# 11 — Standardization

## Padrões consistentes (evidências)

| Área | Padrão | Evidência |
|---|---|---|
| Rotas | `<Route>` + `ProtectedRoute permissao=` | `App.tsx` (80 rotas seguem o padrão) |
| Layout tenant | `AppLayout` com `AppSidebar`/`AppTopbar` alternáveis via `MenuLayoutContext` | `AppLayout.tsx` |
| Layout super admin | `SuperAdminLayout` + `RequireSuperAdmin` | bundle `/super-admin/*` |
| Code splitting | Todas as pages são `React.lazy` | `App.tsx` |
| Fetch de dados | Store in-memory + `useEnsureStore` + `subscribe` | 37 stores em `src/data/` |
| Realtime | `useRealtimeChannel` wrapper | 6 assinantes |
| Cliente Supabase | `getUserTenantClient` (dados) + `supabase` (auth/realtime) | `src/runtime/db.ts` |
| Query cache | queryKeys `["tenant", tenantId, ...]` | memory + `queryClient.ts` |
| Design tokens | Semantic HSL vars + shadcn variants (memory) | `index.css`, `tailwind.config.ts` |
| Badges de status | `StatusBadge`, `LabBadge`, `OrigemBadge` | reuso em várias pages |
| Dialogs | Flat + backdrop-blur 6px (memory) | `components/ui/dialog.tsx` |
| Impressão | Paged.js + html2pdf + `laudoHtmlBuilder` | `docs/PRINT-ENGINE/*` |

## Padrões inconsistentes (evidências)

| Área | Inconsistência |
|---|---|
| Fetch | Coexistência de TanStack Query (6 arquivos) com stores in-memory (37) — dois padrões para o mesmo problema |
| Formulários | Sem `react-hook-form`/`zod`; cada dialog implementa validação inline |
| Landing | `Landing.tsx` **e** `LandingPageResponsive.tsx` coexistem |
| Tamanho de arquivo | 10 pages ≥50 KB, 10 componentes ≥30 KB — divergem do padrão de componentes pequenos observado em `ui/` e badges |
| Configurações | Tabs de `configuracoes/` variam entre pattern controlado e imperativo dentro do mesmo diretório |

## Wizards
Padrão observado: state machine local com `useReducer`/`useState` (ex.: `NovoAtendimento/`, `ResultadoDetalhe/`). Não há framework de wizard compartilhado.

## Tabelas
Uso direto de `<table>` shadcn + paginação por hooks (`usePaginated*`) — padronizado nas principais listas (Atendimentos, Pacientes, Resultados, Financeiro).

## Modais
100% shadcn `Dialog`/`AlertDialog`; padronizado. Confirmação destrutiva usa `AlertDialog` (memory: substituição de `confirm()` em SuperAdminMigration).
