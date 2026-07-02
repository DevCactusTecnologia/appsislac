# 06 — Dependency Map

## Direção geral das dependências (nível de camada)

```
pages ──▶ components ──▶ ui (shadcn)
   │           │
   ├──▶ hooks ─┴──▶ data (stores)
   │                    │
   │                    ├──▶ lib/**
   │                    ├──▶ integrations/supabase/client
   │                    └──▶ runtime/db
   │
   └──▶ lib/** (direto quando necessário: printHtml, laudoTemplate...)

runtime/db ──▶ integrations/supabase/client
integrations/providers/** ──▶ integrations/contracts/**
supabase/functions/** ──▶ _shared/**
supabase/functions/** ◀── (invocadas por) stores, lib/integration, pages superadmin
```

## Quem depende de quem (mapa observado)

| Alvo (fornecedor) | Consumidores principais |
|---|---|
| `integrations/supabase/client` | Todos os stores, `runtime/db.ts`, contextos, várias `lib/*` |
| `runtime/db.ts` | Stores multi-tenant, services em `lib/integration/*`, hooks paginados |
| `lib/queryClient.ts` | `App.tsx` e hooks que usam TanStack Query |
| `data/atendimentoStore/` | `pages/Index`, `pages/NovoAtendimento`, `pages/RegistrarColeta`, `pages/AnalisarAmostra`, `pages/Resultados*`, `pages/Financeiro/**`, `pages/Mapa`, `pages/Producao`, `components/AtendimentoDetalheDialog` |
| `data/pacienteStore` | Atendimentos, Resultados, Orçamentos, Pacientes |
| `data/exameCatalogoStore` / `exameParametrosStore` / `exameLayoutsStore` / `valoresReferenciaStore` / `reguasEtariasStore` | Resultados, Configurações, Atendimentos |
| `data/labConfigStore` | `RotinaColetaAnaliseGuard`, sidebar (redirects condicionais), Coleta/Análise |
| `data/financeiroStore` | Financeiro (leitura), `PagamentoDialog`, Atendimentos (escrita) |
| `contexts/AuthContext` | `App.tsx`, `ProtectedRoute`, `RequireSuperAdmin`, headers de layout, quase todas as pages |
| `contexts/MenuLayoutContext` | `AppLayout`, `AppSidebar`, `AppTopbar` |
| `lib/laudoTemplate` / `laudoResolver` / `laudoBatchPdf` / `printHtml` / `printShell` | Resultados, Impressão |
| `lib/mapa*` | Mapa, Impressão em lote |
| `integrations/providers/*` | Lab de apoio + edge functions `lab-apoio-*` |
| `_shared/aiAuth` | Todas as edge functions IA |
| `_shared/tenantGuard`, `_shared/registry`, `_shared/runtime/*` | Todas as edge functions que operam com tenant |
| `_shared/migration/*` | `super-admin-migrate-*`, `super-admin-migration-*`, `super-admin-purge-tenant-from-shared` |
| `super-admin-*` edge functions | Páginas `pages/superadmin/**` |

## Dependência circular
- Não foram identificados ciclos de import estáticos entre pastas de nível superior (pages ↔ components ↔ hooks ↔ data ↔ lib). O grafo observado é unidirecional (topo→base).
- Em nível de arquivo, alguns stores (`atendimentoStore`, `financeiroStore`) trocam eventos via `queryClient.invalidateQueries` e listeners de Realtime — acoplamento por evento, não por import.

## Excesso de acoplamento
- **Stores como hub**: 39 stores em `src/data` funcionam como camada intermediária obrigatória. Muitas pages importam de 3–6 stores simultaneamente (evidência: `pages/NovoAtendimento`, `pages/ResultadoDetalhe`, `pages/Financeiro/**`, `pages/Mapa`). Isso concentra dependência.
- **AuthContext**: importado em virtualmente toda página protegida (esperado, mas alto grau de fan-out).
- **`integrations/supabase/client`**: fan-in extremo — praticamente todo store e toda função em `lib/*` que acessa dados o importa.
- **`_shared/edgeBoot` + `_shared/tenantGuard`**: importados por quase todas as 74 edge functions (padrão).

## Módulo centralizador
- **`src/data/`** (stores) — coluna vertebral do estado.
- **`src/App.tsx`** — orquestrador do bundle inteiro (474 LOC, ~120 rotas).
- **`supabase/functions/_shared/`** — centraliza cross-cutting concerns server-side.

## Módulos isolados
- `src/pages/RedirectShortlink.tsx`, `pages/VerificarComprovante.tsx`, `pages/Privacidade.tsx` — dependências mínimas; entradas públicas isoladas do restante do app autenticado.
- `pages/Landing.tsx`, `pages/Inscricao.tsx` — dependem apenas de `leads-manager` (edge) e componentes de marketing; não tocam stores operacionais.
- Providers de lab de apoio (`hermes-pardini`, `dbsync`) — encapsulados atrás de `integrations/contracts/*`; consumidos majoritariamente por edge functions.
- `src/pages/admin/CKEditorTest.tsx` — página utilitária isolada.
