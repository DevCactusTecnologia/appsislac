# 13 — Coupling Analysis

Sem recomendações. Somente classificação dos acoplamentos observados.

## Alto acoplamento (fan-in/fan-out elevado observado)

| Ponto | Natureza | Evidência |
|---|---|---|
| `src/integrations/supabase/client.ts` | Fan-in global: importado por virtualmente todos os stores, contextos e vários utilitários | Convenção documentada (`@/integrations/supabase/client`); auto-gerado |
| `src/runtime/db.ts` | Todos os stores que precisam de per-tenant routing chamam `getUserTenantClient` | Único arquivo em `src/runtime/` |
| `src/contexts/AuthContext.tsx` | Utilizado por `ProtectedRoute`, `RequireSuperAdmin`, layouts e a maioria das páginas | Grep em pages: uso disseminado |
| `src/data/atendimentoStore/` | Consumido por Atendimentos, Coleta, Análise, Resultados, Financeiro, Mapa, Produção, Dashboard | Ver `06-dependency-map.md` |
| `src/data/pacienteStore.ts` | Consumido em todo fluxo clínico + Orçamentos + Pacientes + Resultados | idem |
| `supabase/functions/_shared/edgeBoot.ts` e `_shared/tenantGuard.ts` | Importados por praticamente todas as 74 edge functions | Convenção |
| `src/lib/queryClient.ts` | Único ponto de configuração de cache; imports em `App.tsx` e hooks |  |
| `src/App.tsx` | Concentra ~120 rotas + composição de providers |  |

## Acoplamento aceitável

| Ponto | Justificativa |
|---|---|
| Pages ↔ Componentes de UI | Direção unidirecional; UI é código de apresentação sem estado global compartilhado |
| Stores ↔ TanStack Query | Convenção de queryKey `["tenant", ...]` mantém consistência; reset por tenant centralizado |
| Providers (`dbsync`, `hermes-pardini`) ↔ Contracts | Interface bem definida em `contracts/*` reduz acoplamento a detalhes internos dos providers |
| Edge functions ↔ `_shared/*` | Reuso legítimo de infraestrutura transversal (auth, rate limit, boot, guard) |
| `runtime/db.ts` ↔ `_shared/registry.ts` | Espelho front/back necessário para runtime multi-tenant |
| Sidebar ↔ `labConfigStore` | Sidebar precisa refletir configuração do laboratório em tempo real |

## Baixo acoplamento

| Ponto | Justificativa |
|---|---|
| Rotas públicas (`Landing`, `Inscricao`, `Privacidade`, `VerificarComprovante`, `RedirectShortlink`, `TenantSite*`) | Não importam stores operacionais; dependência mínima em componentes de marketing e edges pontuais |
| `components/assistente/AssistenteSISLAC.tsx` | Comunica-se com o app apenas por edges IA; pouco acoplado ao domínio |
| `components/whatsapp/*` | Deep-links, sem estado compartilhado |
| `pages/admin/CKEditorTest.tsx` | Página utilitária isolada |
| Utilitários puros em `src/lib/*` (masks, dateBR, cpf, escapeHtml, sanitizeHtml, idade) | Sem dependências além de tipos |
| Sub-domínios em `src/domains/*` | Serviços puros com fronteira clara |

## Formas de acoplamento presentes

- **Import direto** (mais comum): pages → stores/lib; edges → `_shared/*`.
- **Convenção nomeada** (queryKey `["tenant", tenantId, ...]`): acoplamento por contrato de string.
- **Eventos (Realtime + listeners de store + `invalidateQueries`)**: acoplamento por evento, não por import.
- **Guards / HOCs de rota**: acoplamento comportamental.
- **Feature Flags** (`src/lib/featureFlags.ts`): acoplamento de configuração.
- **Impersonação** (`ImpersonationBanner` + `super-admin-impersonate-tenant`): acoplamento cross-camada limitado ao super admin.
