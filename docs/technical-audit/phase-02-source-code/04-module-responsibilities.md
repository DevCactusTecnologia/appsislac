# 04 — Module Responsibilities

Módulos identificados na Fase 01 mapeados para os artefatos concretos do repositório.

## Convenção

Para cada módulo listamos: páginas de entrada, componentes específicos, stores, hooks, libs, edge functions, migrations relevantes (por prefixo temático — quando aplicável).

---

## M1. Core / Bootstrap

- **Entradas**: `src/main.tsx`, `src/App.tsx`, `src/index.css`.
- **Contextos**: `contexts/AuthContext.tsx`, `contexts/MenuLayoutContext.tsx`, `contexts/SuperAdminPrefsContext.tsx`.
- **Runtime**: `runtime/db.ts`.
- **Libs**: `lib/queryClient.ts`, `lib/routePreload.ts`, `lib/logger.ts`, `lib/favicon.ts`, `lib/featureFlags.ts`, `lib/ttlCache.ts`, `lib/persist.ts`.
- **Data**: `data/storeBoot.ts`, `data/lazyStores.ts`.
- **Componentes**: `AppLayout.tsx`, `AppSidebar.tsx`, `AppTopbar.tsx`, `SuperAdminLayout.tsx`, `ChunkErrorBoundary.tsx`, `PageErrorBoundary.tsx`.

## M2. Auth / Sessão

- **Páginas**: `LoginV2.tsx`, `SuperAdminLogin.tsx`, `ResetPassword.tsx`, `Perfil.tsx`, `Inscricao.tsx`.
- **Contexto**: `AuthContext.tsx`.
- **Componentes**: `RequireSuperAdmin.tsx`, `PermissionDenied.tsx`, `ImpersonationBanner.tsx`.
- **Edge functions**: `admin-invite-user`, `admin-update-user`, `admin-delete-user`, `super-admin-impersonate-tenant`, `super-admin-reset-tenant-password`, `tenant-dedicated-login-gate`.

## M3. Atendimentos (hub central)

- **Páginas**: `NovoAtendimento.tsx` (+ subpasta `NovoAtendimento/`), `Dashboard.tsx`.
- **Stores**: `atendimentoStore/` (7 partes), `atendimentoNormalize.ts`, `pacienteStore.ts`.
- **Domain**: `domains/appointment/services/pricing.ts`.
- **Componentes**: `AtendimentoDetalheDialog.tsx`, `atendimento/FerramentasAvancadasMenu.tsx`, `PagamentoDialog.tsx`, `CadastroPacienteDialog.tsx`, `SolicitarRecoletaDialog.tsx`.
- **Libs**: `lib/atendimentoPolicy.ts`, `lib/atendimentoStatus.ts`, `lib/pricing/pricingEngine.ts`, `lib/pixBrCode.ts`.
- **Edge functions**: `create-atendimento`, `update-atendimento`.

## M4. Coleta / Análise / Rotina

- **Páginas**: `RegistrarColeta.tsx`, `AnalisarAmostra.tsx`.
- **Componentes**: `operacional/*`, `RotinaColetaAnaliseGuard.tsx`, `AlterarResponsavelPopup.tsx`, `LeituraRequisicaoDialog.tsx`.
- **Hooks**: `useHidScanner.ts`, `useRotinaConfig.ts`.

## M5. Resultados / Laudos

- **Páginas**: `Resultados.tsx`, `ResultadoDetalhe.tsx` (+ subpasta `ResultadoDetalhe/`), `ConsultarResultados.tsx`, `ImpressaoGeral.tsx`, `VerificarComprovante.tsx`.
- **Componentes**: `resultado/*`, `ResultadoPopup.tsx`, `ResultadoValidationBar.tsx`, `PdfPreviewDialog.tsx`.
- **Domain**: `domains/result/services/*` (comprovantes, critico, parseVR).
- **Libs**: `lib/laudoTemplate.ts`, `lib/laudoLayout.ts`, `lib/laudoResolver.ts`, `lib/laudoBatchPdf.ts`, `lib/layoutScientificRuntime.ts`, `lib/documentoRenderer.ts`, `lib/documentoTemplatesPadrao.ts`, `lib/printHtml.ts`, `lib/printShell.ts`, `lib/sanitizeHtml.ts`, `lib/watermark.ts`, `lib/comprovantes.ts`.
- **Edge functions**: `sign-resultado`, `comprovante-resolve`, `comprovante-shortlink`.

## M6. Configurações do Laboratório

- **Páginas**: `Configuracoes.tsx`, `Exames.tsx`, `Convenios.tsx`, `TabelasPreco.tsx`, `Unidades.tsx`, `LabApoio.tsx`, `Especialistas.tsx`, `Documentos.tsx`, `Usuarios.tsx`.
- **Componentes**: `components/configuracoes/*` (42 arquivos).
- **Stores**: `convenioStore.ts` + `convenioFaturasStore.ts` + `convenioCompetenciasStore.ts` + `convenioGlosasStore.ts`, `exameCatalogoStore.ts`, `exameParametrosStore.ts`, `exameLayoutsStore.ts`, `valoresReferenciaStore.ts`, `reguasEtariasStore.ts`, `unidadeStore.ts`, `setoresLaboratoriaisStore.ts`, `materiaisAmostraStore.ts`, `labConfigStore.ts`, `labApoioStore.ts`, `especialistaStore.ts`, `usuariosStore.ts`, `documentoTemplatesStore.ts`, `tabelaPrecoStore.ts`.

## M7. Financeiro

- **Páginas**: `Financeiro.tsx` (+ subpasta `Financeiro/`), `Orcamentos.tsx`.
- **Stores**: `financeiroStore.ts`, `financeiroListasStore.ts`, `orcamentoStore.ts`, `caixaSessoesStore.ts`.
- **Componentes**: `financeiro/*`, `caixa/*`, `NovaEntradaSaidaDialog.tsx`.
- **Hooks**: `useAReceberPacientes.ts`, `useConvenioFaturas.ts`.
- **Libs**: `lib/comprovanteCaixa.ts`.

## M8. Mapa de Trabalho / Produção

- **Páginas**: `Mapa.tsx`, `Producao.tsx` (+ `producao/ProducaoChartsLazy.tsx`).
- **Stores**: `mapaTrabalhoStore.ts`, `producaoMetricsStore.ts`.
- **Componentes**: `mapa/*`.
- **Libs**: `lib/mapa*.ts` (`A4Preview`, `LotePreview`, `Placeholders`, `Print`, `SharedStyles`, `Templates`).

## M9. Estoque

- **Página**: `Estoque.tsx`.
- **Store**: `estoqueStore.ts`.
- **Componentes**: `estoque/*`.

## M10. Soroteca

- **Páginas**: `Soroteca.tsx`, `SorotecaEstrutura.tsx`, `SorotecaExpurgo.tsx`, `SorotecaMateriais.tsx`, `SorotecaTriagem.tsx`.
- **Stores**: `sorotecaStore.ts`, `sorotecaEstruturaStore.ts`, `sorotecaExpurgoStore.ts`.
- **Componentes**: `soroteca/*`.
- **Edge functions**: `soroteca-reorganizar-galeria`, `soroteca-sugerir-posicao`.

## M11. Rastreabilidade / Auditoria

- **Páginas**: `Auditoria.tsx`, `admin/AuditoriaVR.tsx`, `RelatorioOcorrencias.tsx`, `RelatorioRecoletas.tsx`.
- **Componentes**: `rastreabilidade/*`, `auditoria/AuditoriaTecnicaTab.tsx`, `AuditoriaPanel.tsx`, `AuditoriaIntegracaoDrawer.tsx`.
- **Stores**: `auditoriaStore.ts`, `auditLogsStore.ts`, `rastreabilidadeStore.ts`, `recoletasStore.ts`, `recoletasMotivosStore.ts`.
- **Hooks**: `useOcorrenciasPage.ts`.
- **Libs**: `lib/criticoAudit.ts`, `lib/dossieRastreabilidade.ts`, `lib/regulatorio.ts`, `lib/regulatorioResolver.ts`, `lib/lgpdReport.ts`.

## M12. Integrações Laboratoriais (labs de apoio)

- **UI**: `components/configuracoes/IntegracoesApoioTab.tsx`, `LabsApoioTab.tsx`, `ProviderCatalogImporter.tsx`, `ProviderConfigCard.tsx`, `MapeamentoExamesDialog.tsx`, `AuditoriaIntegracaoDrawer.tsx`, `ExamesTerceirizadosPanel.tsx`, `RoteamentoApoioPanel.tsx`, `IntegrationStatusBadge.tsx`, `IntegrationWarningsList.tsx`.
- **Frontend integrations**: `src/integrations/contracts/*`, `src/integrations/providers/hermes-pardini/*`, `src/integrations/providers/dbsync/*`, `src/integrations/providers/registry.ts`.
- **Libs**: `lib/integration/integrationStatus.ts`, `lib/labApoio.ts`, `lib/laboratorioPadroes.ts`.
- **Edge functions**: `integration-*`, `lab-apoio-*`, `dbsync-test-connection`, `provider-catalog-import`, `provider-health-aggregator`.

## M13. Super Admin

- **Páginas**: `pages/superadmin/*` (10 telas).
- **Componentes**: `superadmin/*`, `RequireSuperAdmin.tsx`, `ImpersonationBanner.tsx`.
- **Contexto**: `SuperAdminPrefsContext.tsx`.
- **Hooks**: `useCleanupUtils.ts`.
- **Edge functions**: todas as `super-admin-*` (23 funções).

## M14. Migração Runtime Shared → Dedicated

- **Página**: `pages/superadmin/SuperAdminMigration.tsx`.
- **Componente**: `superadmin/TenantDatabaseConfig.tsx`.
- **Edge functions**: `super-admin-migrate-tenant-auth`, `super-admin-migrate-tenant-data`, `super-admin-migrate-tenant-storage`, `super-admin-migration-flip`, `super-admin-migration-rollback`, `super-admin-migration-smoke-test`, `super-admin-provision-tenant-schema`, `super-admin-provision-tenant-schema-full`, `super-admin-purge-tenant-from-shared`, `tenant-dedicated-login-gate`.
- **Shared**: `supabase/functions/_shared/migration/connect.ts`, `_shared/runtime/db.ts`, `_shared/runtime/createClient.ts`.

## M15. IA (Chat, Voz, Sugestões)

- **Componente**: `assistente/AssistenteSISLAC.tsx`, `AvaliacaoIADialog.tsx`.
- **Edge functions**: `ai-chat`, `ai-speak`, `ai-transcribe`, `ai-suggest-exames`, `extract-requisicao-exames`.
- **Shared**: `_shared/aiAuth.ts`.

## M16. WhatsApp

- **Componentes**: `whatsapp/WhatsappActionButton.tsx`, `whatsapp/WhatsappTimeline.tsx`.
- **Libs**: `lib/whatsapp/*` (5 arquivos), `lib/gatewayWebhookHistory.ts`.
- **Edge functions**: `whatsapp-dispatcher`, `whatsapp-template-sync`, `whatsapp-webhook`.

## M17. Tenant Site (site público do laboratório)

- **Páginas**: `TenantSite.tsx`, `TenantSiteSobre.tsx`, `TenantSiteContato.tsx`, `SolicitacoesSite.tsx`.
- **Componentes**: `components/tenant-site/*` (LandingTemplate, PageRenderer, TenantSiteShell, blocks/).
- **Libs**: `lib/tenantSite/*` (6 arquivos).
- **Edge functions**: `tenant-resolve`, `tenant-domain-verify`, `leads-manager`, `sitemap`.

## M18. LGPD / Compliance

- **Página**: `Privacidade.tsx`.
- **Hook**: `useCompliance.tsx`.
- **Libs**: `lib/lgpdReport.ts`.
- **Edge functions**: `lgpd-auditoria-relatorio`, `lgpd-consentimento`, `lgpd-deletar-paciente`.
- **Guias**: `LGPD_RDC_MIGRACAO_AUTOMATICA.md`, `GUIA_COMPLIANCE_IMPLEMENTACAO.md`, `deploy-compliance.sh`.

## M19. Landing / Marketing público

- **Páginas**: `Landing.tsx`, `LandingPageResponsive.tsx`, `Index.tsx`, `Inscricao.tsx`, `RedirectShortlink.tsx`.
- **Componentes**: `components/seo/SEO.tsx`.

## M20. Utilitários compartilhados (não módulo funcional)

- **Libs transversais**: `lib/utils.ts`, `lib/constants.ts`, `lib/cpf.ts`, `lib/dateBR.ts`, `lib/idade*.ts`, `lib/masks.ts`, `lib/validation.ts`, `lib/tenantValidation.ts`, `lib/confetti.ts`, `lib/errorHandling.ts`, `lib/showError.ts`, `lib/exameDefaults.ts`, `lib/protocoloLookup.ts`, `lib/runWithConcurrency.ts`, `lib/queryPatterns.ts`.
- **Types**: `types/common.ts`, `types/domain.ts`.
- **UI base**: `components/ui/*` (23 componentes shadcn).
