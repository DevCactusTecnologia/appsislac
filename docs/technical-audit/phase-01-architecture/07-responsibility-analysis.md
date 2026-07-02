# 07 — Responsibility Analysis

Escala: **SIM** = responsabilidade única e clara. **PARCIAL** = responsabilidade coesa com desvios documentáveis. **NÃO** = múltiplas responsabilidades relevantes convivendo.

| Módulo | SRP | Justificativa (evidência) |
|---|---|---|
| `src/runtime/db.ts` | **SIM** | Único arquivo em `runtime/`, dedicado a resolver client Supabase por tenant. |
| `src/integrations/supabase/client.ts` | **SIM** | Instancia o client Supabase; arquivo auto-gerado. |
| `src/contexts/AuthContext.tsx` | **SIM** | Sessão + roles + hidratação de perfil. |
| `src/contexts/MenuLayoutContext.tsx` | **SIM** | Prefs do layout do menu. |
| `src/contexts/SuperAdminPrefsContext.tsx` | **SIM** | Prefs específicas do console super admin. |
| `src/lib/queryClient.ts` | **SIM** | Configura `QueryClient` + reset por tenant. |
| `src/lib/logger.ts`, `errorHandling.ts`, `showError.ts` | **SIM** | Utilitários pontuais. |
| `src/lib/pixBrCode.ts`, `escapeHtml.ts`, `sanitizeHtml.ts`, `masks.ts`, `dateBR.ts`, `cpf.ts`, `idade*.ts` | **SIM** | Funções puras com escopo estreito. |
| `src/lib/laudoTemplate.ts`, `laudoResolver.ts`, `laudoLayout.ts`, `laudoBatchPdf.ts`, `layoutScientificRuntime.ts` | **PARCIAL** | Cada arquivo tem tema definido, porém orquestram HTML, tokens (`##GRAFICOHIST##`, `##REF_X##`), resolução clínica e conversão a PDF — pipeline integrado com múltiplas responsabilidades encadeadas. |
| `src/lib/mapa*.ts` (`mapaPrint`, `mapaA4Preview`, `mapaLotePreview`, `mapaTemplates`, `mapaSharedStyles`, `mapaPlaceholders`) | **PARCIAL** | Divididos por aspecto, mas cross-import frequente entre eles. |
| `src/lib/integration/**`, `src/integrations/providers/**` + contracts | **SIM** | Boundary claro por provider; contracts abstraem transport/capabilities. |
| `src/data/atendimentoStore/` | **NÃO** | Único store expandido para subpasta; concentra criação, edição, coleta, análise, financeiro-derivado, eventos Realtime, invalidação de cache. É o hub operacional. |
| Demais `src/data/*Store.ts` | **SIM/PARCIAL** | A maioria (`pacienteStore`, `especialistaStore`, `estoqueStore`, `orcamentoStore`, `unidadeStore`, `convenioStore`, `tabelaPrecoStore`, stores de soroteca) trata uma entidade. Alguns (`financeiroStore`, `mapaTrabalhoStore`, `producaoMetricsStore`) misturam agregações/derivações. |
| `src/pages/NovoAtendimento.tsx` + `pages/NovoAtendimento/services/*` | **PARCIAL** | Wizard multi-etapas com bastante lógica local; parte foi extraída para `services/`. |
| `src/pages/ResultadoDetalhe.tsx` + `pages/ResultadoDetalhe/services/*` | **PARCIAL** | Digitação, validação, auditoria dupla, template de laudo, VR — extração parcial para `services/`. |
| `src/pages/Financeiro/**` | **SIM** | Melhor exemplo de segmentação (components/hooks/services/dialogs). |
| `src/pages/Index.tsx` (`/atendimentos`) | **PARCIAL** | Lista + filtros + ações rápidas + contadores. |
| `src/pages/Configuracoes.tsx` + `components/configuracoes/*` (42) | **PARCIAL** | Coleção de painéis; cada componente é focado, mas a página agrega muitos domínios. |
| `pages/superadmin/*` | **SIM** | Cada tela mapeia a um recorte (dashboard, tenants, planos, inscrições, auditoria, migração, notificações, configurações). |
| `components/SuperAdminLayout.tsx` / `AppLayout.tsx` / `AppSidebar.tsx` | **SIM** | Layout dedicado. |
| `components/AppSidebar.tsx` | **PARCIAL** | Layout + navegação + resolução condicional de rotas conforme `labConfigStore` (memory: `Rotina` redireciona quando coleta/análise está desativada). |
| `components/AtendimentoDetalheDialog.tsx` | **PARCIAL** | Dialog rico com múltiplas seções (financeiro, coleta, análise). |
| `components/PagamentoDialog.tsx` | **SIM** | Pagamento (QR PIX, quitação, impressão). |
| `components/assistente/AssistenteSISLAC.tsx` | **SIM** | Shell da IA. |
| `hooks/usePaginatedAtendimentos.ts`, `usePaginatedPacientes.ts` | **SIM** | Cursor pagination + cache. |
| `hooks/useCompliance.tsx`, `useDicionario.ts`, `useHidScanner.ts` | **SIM** | Escopo estreito. |
| `supabase/functions/_shared/aiAuth.ts`, `tenantGuard.ts`, `edgeBoot.ts`, `rateLimit.ts`, `hardening.ts`, `crypto.ts`, `s3.ts`, `integrationLog.ts`, `cronHealth.ts`, `resolveExamIntegration.ts` | **SIM** | Um concern por arquivo. |
| Edge functions `super-admin-*` | **SIM** | Uma operação privilegiada por function (com exceção de families como `super-admin-provision-tenant-schema` vs `-full`). |
| Edge functions `integration-*`, `lab-apoio-*`, `provider-*` | **SIM** | Cada uma cobre uma etapa do pipeline (dispatch, jobs runner, poll, resolve, url, upload, cron). |
| Edge functions `ai-*`, `extract-requisicao-exames` | **SIM** | Cada function = um endpoint IA. |
| Edge function `create-atendimento` | **PARCIAL** | Composição transacional (validações + persistência) — natural para RPC-like. |
| Edge functions `lgpd-*` | **SIM** | Um caso de uso LGPD por function. |
