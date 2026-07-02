# 12 — Dependency Matrix

## Cadeia canônica
```
Route (App.tsx)
  → Guard (ProtectedRoute | RequireSuperAdmin | RotinaColetaAnaliseGuard)
    → Layout (AppLayout | SuperAdminLayout | público)
      → Page (React.lazy)
        → Hooks (src/hooks/*)          ┐
        → Components (src/components/*)│
        → Stores (src/data/*Store*)    ├→ Runtime (src/runtime/db.ts)
        → domains/*/services           │     → Supabase (RPC | Edge | Realtime | Storage | Auth)
        → integrations/providers/*     ┘
```

## Matriz Page → dependências (amostras representativas)

| Page | Hooks principais | Stores | Componentes-chave | Backend |
|---|---|---|---|---|
| `Dashboard.tsx` | `useDashboardKpis`, `useEnsureStore` | `atendimentoStore`, `financeiroStore`, `pacienteStore` | `dashboard/*` | RPC via stores |
| `Index.tsx` (Atendimentos) | `usePaginatedAtendimentos`, `useEnsureStore` | `atendimentoStore/*` | `AtendimentoDetalheDialog`, `StatusBadge` | RPC + Realtime |
| `NovoAtendimento.tsx` | wizard local + `useDicionario` | `atendimentoStore`, `pacienteStore`, `convenioStore`, `exameCatalogoStore`, `unidadeStore` | `CadastroPacienteDialog`, `LeituraRequisicaoDialog`, `PagamentoDialog` | `create_atendimento_tx`, `update_atendimento_tx` |
| `Resultados.tsx` | `useResultadosPage` | `atendimentoStore`, `valoresReferenciaStore` | `ResultadoPopup`, `ResultadoValidationBar` | RPC |
| `ResultadoDetalhe.tsx` | `hydrateAtendimentoForLaudo`, `criticoPipeline`, `historicoResultados` | `atendimentoStore`, `valoresReferenciaStore`, `reguasEtariasStore` | `resultado/*`, `editor/*`, `PdfPreviewDialog` | RPCs de resultado + `sign-resultado` edge |
| `LabApoio.tsx` | `useRealtimeChannel` | `labApoioStore`, `atendimentoStore` | `RoteamentoApoioPanel`, `AuditoriaIntegracaoDrawer` | Edge `lab-apoio-*`, `integration-*` |
| `Financeiro.tsx` | `useConvenioFaturas`, `useAReceberPacientes`, `useDicionario` | `financeiroStore`, `caixaSessoesStore`, `convenioFaturasStore` | `Financeiro/*` | RPC financeira |
| `Mapa.tsx` | `useEnsureStore` | `mapaTrabalhoStore`, `setoresLaboratoriaisStore` | `mapa/*` | RPC |
| `Configuracoes.tsx` | `useDicionario`, `useRotinaConfig` | `labConfigStore`, `selectOptionsStore`, `usuariosStore`, `exameParametrosStore` | 12 tabs em `configuracoes/` | RPC + edge `assinatura-url` |
| `SuperAdminMigration.tsx` | — | — | `AlertDialog`, timeline | Edges `super-admin-*-migration` |
| `SolicitacoesSite.tsx` | `useRealtimeChannel`, `useSolicitacoesNaoLidas` | store dedicado | listas | Realtime + RPC |

## Matriz Store → consumidores (amostras)
| Store | Consumido por |
|---|---|
| `atendimentoStore/*` | Dashboard, Index, NovoAtendimento, Resultados, RegistrarColeta, AnalisarAmostra, Mapa, Financeiro |
| `pacienteStore` | Pacientes, NovoAtendimento, Dashboard |
| `financeiroStore` | Financeiro, Dashboard, Orcamentos |
| `valoresReferenciaStore` + `reguasEtariasStore` | ResultadoDetalhe, AuditoriaVR, Exames |
| `exameCatalogoStore`/`exameParametrosStore`/`exameLayoutsStore` | Exames, NovoAtendimento, ResultadoDetalhe |
| `convenioStore`/`convenioFaturasStore`/`convenioCompetenciasStore`/`convenioGlosasStore` | Convenios, Financeiro, NovoAtendimento |
| `unidadeStore` | Unidades, NovoAtendimento, Configuracoes |
| `labConfigStore` | Configuracoes, AppSidebar (via `useRotinaConfig`), Guards |

## Hook → Store → Runtime
- `useEnsureStore(key)` → `ensureLazyStore` (`data/lazyStores.ts`) → `storeBoot.ts` → store-específico → `getUserTenantClient` → RPC.
- `usePaginated*` → store cursor pagination → runtime → RPC.
- `useRealtimeChannel` → `supabase.channel` (client canônico) → store subscriber → re-render.
