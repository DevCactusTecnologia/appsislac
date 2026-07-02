# 01 — System Overview

> Auditoria imparcial. Todas as afirmações abaixo referem-se ao estado do código no repositório no momento desta fase.

## O que é o SISLAC (evidência)

- `index.html`: `<title>SISLAC — Plataforma para laboratórios de análises clínicas</title>` e `<meta name="description">` descrevendo "plataforma completa para gestão laboratorial: atendimentos, coleta, resultados, financeiro e site público".
- `package.json` → SPA construída sobre **Vite 5 + React 18 + TypeScript 5**, sem framework server-side (Next apenas presente como `next.config.js` isolado em raiz; **não** é usado pelo build — `scripts.build` = `vite build`).
- Backend acessado exclusivamente via Supabase JS (`@supabase/supabase-js ^2.103.3`) apontando para instância gerenciada.

## Como o sistema está organizado

A base é uma **SPA multi-tenant** com:

1. **Bootstrap único** em `src/main.tsx` → `createRoot(...).render(<App/>)`.
2. **Roteador central** em `src/App.tsx` (474 linhas, ~120 `<Route>` declaradas) usando `react-router-dom@6` com `lazy` + `Suspense` para code splitting por página.
3. **Providers globais** empilhados no topo: `HelmetProvider` → `QueryClientProvider` → `TooltipProvider` → `AuthProvider` → `MenuLayoutProvider` → `BrowserRouter`.
4. **Duas experiências principais** sob o mesmo bundle:
   - **App do laboratório** (`AppLayout` + `AppSidebar`) — rotas protegidas por `ProtectedRoute` + `permissao`.
   - **Console Super Admin** (`SuperAdminLayout` + `RequireSuperAdmin`) — rotas sob `/super-admin/*`.
5. **Rotas públicas paralelas**: `/` (Landing), `/login`, `/inscricao`, `/verificar/:codigo`, `/p/:codigo` (shortlinks), `/site/:slug` (sites públicos por tenant), `/privacidade`.

## Grandes camadas identificadas

| Camada | Localização física | Papel |
|---|---|---|
| Apresentação | `src/pages/**`, `src/components/**` | UI, formulários, dialogs, layouts |
| Estado UI | `src/contexts/*` | Auth, layout do menu, prefs super admin |
| Estado de domínio | `src/data/*Store.ts` (39 stores) | Fonte da verdade in-memory + sincronização com Supabase |
| Data-fetching / cache | `src/lib/queryClient.ts` + TanStack Query | Cache reativo, `installQueryClientTenantReset` |
| Serviços de domínio | `src/domains/**` e `src/lib/**` | Regras de precificação, comprovantes, resolução de VR, layout de laudo |
| Adapters de integração | `src/integrations/**`, `src/lib/integration/**` | Providers de labs de apoio (`dbsync`, `hermes-pardini`), contracts, transporte |
| Runtime resolver | `src/runtime/db.ts` | Roteamento de client Supabase por tenant (shared vs isolated_db) |
| Backend gerenciado | `supabase/functions/**` (74 functions), `supabase/migrations/**` (355 migrations) | Regras server-side, operações privilegiadas, provisionamento, IA, migração |
| Auth | Supabase Auth + `src/contexts/AuthContext.tsx` + `user_roles`/`profiles` | Identidade e roles |
| Storage | Buckets Supabase (assinaturas, PDFs, requisições, comprovantes, laudos de apoio) | Ativos binários |
| Impressão / Documentos | `src/lib/print*`, `src/lib/laudo*`, `src/lib/mapa*`, `src/domains/result/services/comprovantes*` | Geração HTML → PDF (paged.js, html2pdf, jspdf) |

## Módulos funcionais (visão macro)

Derivados das rotas em `src/App.tsx` e da árvore de `src/components/*`:

- Atendimentos (`NovoAtendimento`, `Index`, `AtendimentoDetalheDialog`)
- Coleta (`RegistrarColeta` + `RotinaColetaAnaliseGuard`)
- Análise (`AnalisarAmostra`)
- Resultados (`Resultados`, `ResultadoDetalhe`, `ConsultarResultados`)
- Laboratório de Apoio (`LabApoio`, providers `dbsync`/`hermes-pardini`)
- Pacientes / Especialistas
- Orçamentos
- Financeiro (`src/pages/Financeiro/**` com `services/`, `hooks/`, `components/`)
- Mapa de Trabalho / Produção
- Soroteca (estrutura, triagem, materiais, expurgo)
- Estoque
- Configurações (42 componentes em `src/components/configuracoes/`)
- Site público do tenant (`TenantSite*`)
- Assistente IA (`src/components/assistente/AssistenteSISLAC.tsx`)
- Super Admin (dashboard, tenants, inscrições, planos, auditoria, migração, notificações, configurações)
- Auditoria / Compliance (LGPD)
- Impressão em lote / Documentos / Templates
- Rastreabilidade

## Como as camadas se comunicam (macro)

```
Página (src/pages) → Hook (src/hooks) / Store (src/data) → Client Supabase (src/integrations/supabase/client) → runtime/db.ts → PostgreSQL (RLS) | Edge Function → Storage | Serviços externos
```

Detalhes em `05-architecture-flow.md`.
