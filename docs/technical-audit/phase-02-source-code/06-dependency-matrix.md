# 06 — Dependency Matrix

Matriz simplificada de dependências. Cada linha descreve um **hub** e a onda de consumidores/dependentes observados no repositório.

## Hubs de dependência

### Hub 1 — `src/integrations/supabase/client.ts`
- **Importado por**: `src/runtime/db.ts` (facade), stores individuais (histórico), edge functions apenas indiretamente (via `_shared/runtime/createClient.ts`).
- **Depende de**: SDK `@supabase/supabase-js`.
- **Consumidores efetivos**: ~toda leitura de dados no frontend (via `runtime/db.ts`).

### Hub 2 — `src/runtime/db.ts`
- **Importado por**: stores em `src/data/**`, hooks (`useRealtimeChannel`, `usePaginated*`), páginas com queries diretas, contexts.
- **Depende de**: `integrations/supabase/client.ts`, `integrations/supabase/types.ts`.
- **Efeito**: chokepoint frontend para o cliente Supabase e resolução de tenant.

### Hub 3 — `src/contexts/AuthContext.tsx`
- **Importado por**: `App.tsx`, layouts (`AppLayout`, `SuperAdminLayout`), guards (`RequireSuperAdmin`, `RotinaColetaAnaliseGuard`), hooks e páginas que dependem de user/role.
- **Depende de**: `runtime/db.ts`, `data/usuariosStore.ts`.

### Hub 4 — `src/data/atendimentoStore/index.ts`
- **Importado por**: páginas `Dashboard`, `NovoAtendimento`, `Resultados`, `Financeiro`, `Mapa`, `Producao`, `RegistrarColeta`, `AnalisarAmostra`, componentes `AtendimentoDetalheDialog`, `PagamentoDialog`, hooks `usePaginatedAtendimentos`.
- **Depende de**: `runtime/db.ts`, `data/pacienteStore.ts`, `data/atendimentoNormalize.ts`, sub-arquivos internos (`queries.ts`, `mutations.ts`, `realtime.ts`, `exames.ts`, `terceirizados.ts`, `_internal.ts`, `types.ts`).

### Hub 5 — `src/lib/queryClient.ts`
- **Importado por**: `App.tsx`, muitos hooks e stores que criam queries.
- **Depende de**: `@tanstack/react-query`.

### Hub 6 — `src/lib/laudoTemplate.ts` + `laudoLayout.ts` + `laudoResolver.ts`
- **Importado por**: `pages/ResultadoDetalhe.tsx`, `pages/ImpressaoGeral.tsx`, `lib/laudoBatchPdf.ts`, `lib/documentoRenderer.ts`.
- **Depende de**: `lib/printHtml.ts`, `lib/sanitizeHtml.ts`, `lib/watermark.ts`, `lib/htmlSpacing.ts`, `lib/escapeHtml.ts`.

### Hub 7 — `src/integrations/providers/registry.ts`
- **Importado por**: bootstrap de integrações (uma vez, geralmente em `App.tsx` ou ao carregar as telas de configuração).
- **Depende de**: `hermes-pardini/ui`, `dbsync/ui`, `contracts/providerUI`.

### Hub 8 — `supabase/functions/_shared/runtime/db.ts`
- **Importado por**: todas as edge functions que resolvem tenant + service-role.
- **Depende de**: `_shared/runtime/createClient.ts` (única fonte de `@supabase/supabase-js` no server).

### Hub 9 — `supabase/functions/_shared/drivers/registry.ts`
- **Importado por**: `_shared/drivers/index.ts` (barrel), functions `integration-dispatch`, `integration-jobs-runner`, `integration-poll-results`, `lab-apoio-adapter`.
- **Depende de**: drivers `hermes-pardini` e `dbsync` em `_shared/drivers/`.

## Componentes com maior número de consumidores (evidência qualitativa)

| Arquivo | Consumidores típicos |
| ------- | -------------------- |
| `components/ui/button.tsx`, `dialog.tsx`, `input.tsx`, `select.tsx`, `table.tsx`, `card.tsx`, `badge.tsx` | Praticamente todas as páginas e dialogs |
| `components/AppLayout.tsx` | Todas as rotas autenticadas do tenant |
| `components/SuperAdminLayout.tsx` | Todas as rotas do super admin |
| `components/AtendimentoDetalheDialog.tsx` | Páginas Dashboard, Financeiro, Resultados |
| `components/StatusBadge.tsx` | Múltiplas listagens de atendimentos |

## Isolamento observado

- **Landing/Login/Reset/Inscrição**: dependem apenas de `components/ui/*`, `components/seo/SEO.tsx`, `lib/utils.ts`. Não importam `runtime/db.ts` diretamente (fluxo público).
- **`AssistenteSISLAC.tsx`**: consumidor único da edge function `ai-chat`.

## Observação metodológica

A matriz completa arquivo-a-arquivo excederia dezenas de milhares de linhas (124k LOC × imports médios). Este relatório documenta os **hubs** (pontos de acoplamento máximo) e os **isolamentos** relevantes — os dois extremos com maior valor investigativo. A construção completa arquivo-por-arquivo pode ser derivada mecanicamente de `import` grep, mas não altera as conclusões estruturais aqui documentadas.
