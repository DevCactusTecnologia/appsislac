# 13 — File Relationship Map

Matriz condensada arquivo × (responsabilidade, consumidores, dependências, classificação). Focada em nós de maior relevância.

| Arquivo | Responsabilidade | Consumidores típicos | Dependências principais | Classificação |
| ------- | ---------------- | -------------------- | ----------------------- | ------------- |
| `src/main.tsx` | Entry Vite | — | React, `App.tsx`, fontes, `favicon.ts`, `logger.ts` | Bootstrap |
| `src/App.tsx` | Routes + providers | root DOM | Router, Query, Auth, layouts, todas as `pages/**` | Apresentação |
| `src/index.css` | Design tokens | tudo | Tailwind | Configuração |
| `src/runtime/db.ts` | Facade Supabase + tenant | stores, hooks, contexts | `integrations/supabase/client.ts` | Infraestrutura |
| `src/integrations/supabase/client.ts` | Cliente Supabase | `runtime/db.ts` | SDK | Infraestrutura |
| `src/contexts/AuthContext.tsx` | Sessão | App, layouts, guards | `runtime/db.ts`, `usuariosStore.ts` | Apresentação/Infra |
| `src/lib/queryClient.ts` | Query client | App + hooks | `@tanstack/react-query` | Infraestrutura |
| `src/lib/logger.ts` | Logger | tudo | — | Infraestrutura |
| `src/lib/ttlCache.ts` | Cache TTL | stores | — | Infraestrutura |
| `src/data/atendimentoStore/index.ts` | Hub de atendimentos | Dashboard, NovoAtendimento, Resultados, Financeiro, Mapa, Producao | `runtime/db.ts`, sub-arquivos internos | Persistência |
| `src/data/pacienteStore.ts` | Pacientes | Muitas telas | `runtime/db.ts` | Persistência |
| `src/data/financeiroStore.ts` | Financeiro (leitura) | `Financeiro.tsx` | `atendimentoStore` | Persistência |
| `src/data/storeBoot.ts` | Boot stores | `App.tsx` | vários stores | Bootstrap |
| `src/lib/pricing/pricingEngine.ts` | Motor pricing | `NovoAtendimento`, `Orcamentos`, `TabelasPreco`, `atendimentoStore` | catálogos | Domínio |
| `src/domains/result/services/parseValorReferencia.ts` | Parser VR | `ResultadoDetalhe`, `laudoResolver.ts` | — | Domínio |
| `src/domains/result/services/criticoChecker.ts` | Valida críticos | `ResultadoDetalhe` | — | Domínio |
| `src/lib/laudoTemplate.ts` | Template laudo | `ResultadoDetalhe`, `laudoBatchPdf` | `printHtml`, `sanitizeHtml`, `watermark` | Utilitário/Infra |
| `src/lib/laudoBatchPdf.ts` | PDF em lote | `ImpressaoGeral.tsx` | Paged.js, `laudoTemplate` | Infraestrutura |
| `src/integrations/providers/registry.ts` | Boot providers | ponto único | UIs de providers | Integração |
| `src/components/AppLayout.tsx` | Layout tenant | todas rotas autenticadas | AuthContext, sidebar/topbar | Apresentação |
| `src/components/SuperAdminLayout.tsx` | Layout super admin | rotas super admin | AuthContext | Apresentação |
| `src/components/AtendimentoDetalheDialog.tsx` | Detalhe do atendimento | Dashboard, Resultados, Financeiro | `atendimentoStore`, UI | Apresentação |
| `src/components/PagamentoDialog.tsx` | Pagamento | NovoAtendimento, Dashboard | pricing, PIX | Apresentação |
| `src/hooks/usePaginatedAtendimentos.ts` | Cursor pagination | Resultados, Financeiro | `atendimentoStore`, `queryClient` | Suporte |
| `src/hooks/useRealtimeChannel.ts` | Realtime wrapper | stores, hooks | `runtime/db.ts` | Suporte |
| `supabase/functions/_shared/runtime/db.ts` | Client resolver server | todas edge functions admin | `_shared/runtime/createClient.ts` | Infraestrutura |
| `supabase/functions/_shared/runtime/createClient.ts` | Único `createClient` server | `_shared/runtime/db.ts` | SDK | Infraestrutura |
| `supabase/functions/_shared/drivers/registry.ts` | Registro drivers | `integration-*` functions | drivers hermes-pardini, dbsync | Integração |
| `supabase/functions/create-atendimento` | Cria atendimento | frontend NovoAtendimento | `_shared/runtime/db.ts` | Integração/Domínio |
| `supabase/functions/update-atendimento` | Atualiza atendimento | frontend edição | `_shared/runtime/db.ts` | Integração/Domínio |
| `supabase/functions/sign-resultado` | Assina laudo | ResultadoDetalhe | crypto, storage | Integração |
| `supabase/functions/integration-dispatch` | Despacha jobs de lab | scheduler + UI | `_shared/drivers/*` | Integração |
| `supabase/functions/ai-chat` | Chat IA | `AssistenteSISLAC.tsx` | Lovable AI Gateway, `_shared/aiAuth.ts` | Integração |
| `supabase/functions/whatsapp-dispatcher` | Envio WhatsApp | `lib/whatsapp/*` | gateway externo | Integração |
| `supabase/functions/super-admin-migration-flip` | Flip runtime | SuperAdminMigration | `_shared/migration/connect.ts` | Integração/Admin |
| `supabase/migrations/2026*.sql` | Schema/RLS/functions Postgres | Supabase CLI | Postgres | Persistência |

## Observação

Esta matriz cobre os nós centrais. Cada arquivo listado em `02-file-inventory.md` pode ser mapeado no mesmo esquema; a construção completa é derivável mecanicamente sem alterar as conclusões deste relatório.
