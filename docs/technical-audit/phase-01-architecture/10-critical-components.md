# 10 — Critical Components

Componentes indispensáveis identificados por: (a) fan-in observado no repositório, (b) papel no boot ou no fluxo transacional, (c) impacto conhecido pelas memories do projeto.

## Arquivos centrais

| Arquivo | Papel | Por que é crítico |
|---|---|---|
| `src/main.tsx` | Bootstrap | Único entrypoint; instala fontes, favicon e cleanup de SWs legados |
| `src/App.tsx` | Router + composição de providers | Contém quase todas as ~120 rotas e a árvore de providers |
| `src/contexts/AuthContext.tsx` | Sessão + roles | Toda página protegida depende dele |
| `src/integrations/supabase/client.ts` | Client Supabase | Ponto único de acesso ao backend |
| `src/runtime/db.ts` | Runtime resolver | Direciona entre banco shared e dedicated por tenant |
| `src/lib/queryClient.ts` | TanStack Query config | Reset por tenant + convenção de queryKey |
| `src/components/AppLayout.tsx`, `AppTopbar.tsx`, `AppSidebar.tsx` | Chassi da UI autenticada | Toda tela `/dashboard` e derivadas |
| `src/components/SuperAdminLayout.tsx`, `RequireSuperAdmin.tsx` | Console super admin | Isolamento do bundle privilegiado |
| `src/components/ChunkErrorBoundary.tsx`, `PageErrorBoundary.tsx` | Resiliência | Contêm falhas de chunk lazy e páginas |
| `src/components/RotinaColetaAnaliseGuard.tsx` | Guard operacional | Short-circuit de coleta/análise conforme `tenant_lab_config` |
| `src/data/atendimentoStore/` | Estado central operacional | Consumido por atendimentos, coleta, análise, resultados, financeiro, mapa, produção |
| `src/data/pacienteStore.ts` | Entidade base | Consumido por praticamente todo fluxo clínico |
| `src/data/exameParametrosStore.ts`, `exameLayoutsStore.ts`, `valoresReferenciaStore.ts`, `reguasEtariasStore.ts` | Configuração clínica | Sem eles não há laudo |
| `src/data/labConfigStore.ts` | Config do laboratório | Controla rotas, guards e sidebar |
| `src/lib/laudoTemplate.ts` + `laudoResolver.ts` + `laudoBatchPdf.ts` | Motor de laudo | Núcleo do produto |
| `src/lib/printHtml.ts` + `printShell.ts` | Motor de impressão | Reutilizado em laudos, comprovantes, mapa |
| `supabase/functions/_shared/tenantGuard.ts` + `_shared/registry.ts` + `_shared/runtime/*` | Runtime server-side | Espelham `src/runtime/db.ts` |
| `supabase/functions/_shared/aiAuth.ts` | Autorização IA | Gate de todos os endpoints IA |
| `supabase/functions/create-atendimento` | Transação primária | Cria atendimento com validações |
| `supabase/functions/sign-resultado` | Liberação de resultado | Publica laudo assinado |
| `supabase/functions/super-admin-migration-*` (7 functions) | Migração runtime | Executa transição shared → dedicated |

## Componentes críticos de UI

- `AtendimentoDetalheDialog.tsx` — usado a partir de várias telas para inspeção rápida.
- `PagamentoDialog.tsx` — único ponto de quitação/PIX/impressão de comprovante.
- `CadastroPacienteDialog.tsx` / `CadastroEspecialistaDialog.tsx` — porta de entrada de cadastros críticos.
- `LeituraRequisicaoDialog.tsx` — IA de OCR de requisição.
- `AssistenteSISLAC.tsx` — atalho global de IA.
- `ImpressaoLotePorLab.tsx` — produção de PDFs em lote.
- `ImpersonationBanner.tsx` — sinaliza sessão impersonada.

## Fluxos principais indispensáveis

1. Autenticação → hidratação de perfis/roles → boot de stores → navegação.
2. Criação de atendimento → geração automática de entrada financeira.
3. Registro de coleta → análise → digitação de resultados → auditoria dupla → liberação → laudo.
4. Roteamento a lab de apoio → jobs assíncronos → recepção de PDFs → anexo ao resultado.
5. Pagamento (PIX/manual) → quitação → impressão de comprovante.
6. Impressão em lote (`laudoBatchPdf`).
7. Provisionamento e migração de tenant (super admin).

## Módulos indispensáveis

- `AuthContext`, `runtime/db`, `queryClient`, `atendimentoStore`, `pacienteStore`, motor de laudo/impressão, edge `_shared/*`, edge `super-admin-*` (para operações de plataforma).
