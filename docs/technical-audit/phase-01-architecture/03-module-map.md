# 03 — Module Map

Módulos identificados a partir das rotas (`src/App.tsx`), páginas (`src/pages/**`), stores (`src/data/*Store.ts`), pastas de componentes (`src/components/**`) e edge functions (`supabase/functions/**`).

## Módulos de domínio

### 1. Atendimentos
- **Objetivo**: registrar/editar atendimentos e ciclo operacional inicial.
- **Arquivos**: `pages/NovoAtendimento.tsx`, `pages/NovoAtendimento/services/*`, `pages/Index.tsx`, `components/AtendimentoDetalheDialog.tsx`, `components/atendimento/*`, `data/atendimentoStore/`, `data/atendimentoNormalize.ts`, `domains/appointment/services/pricing.ts`, edge function `create-atendimento`.
- **Depende de**: pacientes, convênios, exames, tabelas de preço, fluxo (coleta/análise).
- **Consumido por**: Resultados, Financeiro, Mapa, Produção, Impressão.

### 2. Coleta
- **Arquivos**: `pages/RegistrarColeta.tsx`, `components/RotinaColetaAnaliseGuard.tsx`, `data/labConfigStore.ts` (short-circuit `tenant_lab_config`), `components/operacional/*`.
- **Depende de**: `atendimentoStore`, `unidadeStore`.

### 3. Análise
- **Arquivos**: `pages/AnalisarAmostra.tsx`, `data/atendimentoStore/`.

### 4. Resultados
- **Arquivos**: `pages/Resultados.tsx`, `pages/ResultadoDetalhe.tsx`, `pages/ResultadoDetalhe/services/*`, `pages/ConsultarResultados.tsx`, `components/resultado/*`, `components/ResultadoValidationBar.tsx`, `components/ResultadoPopup.tsx`, `data/valoresReferenciaStore.ts`, `data/reguasEtariasStore.ts`, `data/exameParametrosStore.ts`, `data/exameLayoutsStore.ts`, `lib/laudoTemplate.ts`, `lib/laudoBatchPdf.ts`, `lib/laudoLayout.ts`, `lib/laudoResolver.ts`, `lib/layoutScientificRuntime.ts`, `domains/result/services/*`, edge function `sign-resultado`.

### 5. Impressão / Documentos
- **Arquivos**: `pages/ImpressaoGeral.tsx`, `pages/Documentos.tsx`, `components/ImpressaoLotePorLab.tsx`, `components/PdfPreviewDialog.tsx`, `lib/printHtml.ts`, `lib/printShell.ts`, `lib/mapaPrint.ts`, `lib/mapaA4Preview.ts`, `lib/mapaLotePreview.ts`, `lib/mapaTemplates.ts`, `lib/documentoRenderer.ts`, `lib/documentoTemplatesPadrao.ts`.

### 6. Financeiro
- **Arquivos**: `pages/Financeiro/**` (`components/`, `components/dialogs/`, `hooks/`, `services/`), `pages/Financeiro.tsx` (wrapper), `data/financeiroStore.ts`, `data/financeiroListasStore.ts`, `data/caixaSessoesStore.ts`, `data/convenioFaturasStore.ts`, `data/convenioGlosasStore.ts`, `data/convenioCompetenciasStore.ts`, `components/financeiro/*`, `components/caixa/*`, `components/PagamentoDialog.tsx`, `lib/comprovanteCaixa.ts`, `lib/pixBrCode.ts`.

### 7. Orçamentos
- **Arquivos**: `pages/Orcamentos.tsx`, `data/orcamentoStore.ts`.

### 8. Pacientes / Especialistas
- **Arquivos**: `pages/Pacientes.tsx`, `pages/Especialistas.tsx`, `components/CadastroPacienteDialog.tsx`, `components/CadastroEspecialistaDialog.tsx`, `components/PacienteTelefoneInline.tsx`, `data/pacienteStore.ts`, `data/especialistaStore.ts`, `hooks/usePaginatedPacientes.ts`.

### 9. Mapa de Trabalho / Produção
- **Arquivos**: `pages/Mapa.tsx`, `pages/Producao.tsx`, `pages/producao/*`, `components/mapa/*`, `data/mapaTrabalhoStore.ts`, `data/producaoMetricsStore.ts`, `lib/mapa*`.

### 10. Soroteca
- **Arquivos**: `pages/Soroteca*.tsx` (Estrutura, Triagem, Materiais, Expurgo), `components/soroteca/*`, `data/soroteca*Store.ts`, `data/materiaisAmostraStore.ts`, edge functions `soroteca-reorganizar-galeria`, `soroteca-sugerir-posicao`.

### 11. Estoque
- **Arquivos**: `pages/Estoque.tsx`, `components/estoque/*`, `data/estoqueStore.ts`.

### 12. Configurações
- **Arquivos**: `pages/Configuracoes.tsx` + páginas dedicadas (`Exames`, `Convenios`, `Unidades`, `Documentos`, `TabelasPreco`, `Usuarios`) e `components/configuracoes/*` (42 componentes) + stores `exameCatalogoStore`, `exameParametrosStore`, `exameLayoutsStore`, `convenioStore`, `unidadeStore`, `tabelaPrecoStore`, `usuariosStore`, `selectOptionsStore`, `documentoTemplatesStore`, `labApoioStore`, `labConfigStore`, `setoresLaboratoriaisStore`, `recoletasMotivosStore`, `reguasEtariasStore`, `materiaisAmostraStore`.

### 13. Laboratório de Apoio
- **Arquivos**: `pages/LabApoio.tsx`, `data/labApoioStore.ts`, `components/RoteamentoApoioPanel.tsx`, `components/ExamesTerceirizadosPanel.tsx`, `src/integrations/providers/dbsync/*`, `src/integrations/providers/hermes-pardini/*`, `src/integrations/providers/registry.ts`, `src/integrations/contracts/*`, `src/lib/integration/*`, `src/lib/labApoio.ts`, edge functions `lab-apoio-adapter`, `lab-apoio-cron-fetch`, `lab-apoio-upload-pdf`, `integration-*`, `provider-*`.

### 14. Rastreabilidade / Auditoria / Compliance
- **Arquivos**: `pages/Auditoria.tsx`, `pages/RelatorioOcorrencias.tsx`, `pages/RelatorioRecoletas.tsx`, `components/AuditoriaPanel.tsx`, `components/AuditoriaIntegracaoDrawer.tsx`, `components/rastreabilidade/*`, `data/auditoriaStore.ts`, `data/auditLogsStore.ts`, `data/rastreabilidadeStore.ts`, `data/recoletasStore.ts`, `hooks/useCompliance.tsx`, `lib/dossieRastreabilidade.ts`, `lib/lgpdReport.ts`, `lib/regulatorio.ts`, `lib/regulatorioResolver.ts`, `lib/criticoAudit.ts`, edge functions `lgpd-auditoria-relatorio`, `lgpd-consentimento`, `lgpd-deletar-paciente`.

### 15. Site público / Landing
- **Arquivos**: `pages/Landing.tsx`, `pages/LandingPageResponsive.tsx`, `pages/Inscricao.tsx`, `pages/TenantSite.tsx`, `pages/TenantSiteSobre.tsx`, `pages/TenantSiteContato.tsx`, `components/tenant-site/*`, `lib/tenantSite/*`, edge function `sitemap`, `leads-manager`.

### 16. Verificação pública de comprovantes
- **Arquivos**: `pages/VerificarComprovante.tsx`, `pages/RedirectShortlink.tsx`, `components/OrigemBadge.tsx`, edge functions `comprovante-resolve`, `comprovante-shortlink`, `assinatura-url`, `image-url`.

### 17. Assistente IA
- **Arquivos**: `components/assistente/AssistenteSISLAC.tsx`, edge functions `ai-chat`, `ai-speak`, `ai-transcribe`, `ai-suggest-exames`, `extract-requisicao-exames`, `_shared/aiAuth.ts`.

### 18. Super Admin
- **Pages**: `pages/superadmin/SuperAdminDashboard.tsx`, `SuperAdminTenants.tsx`, `SuperAdminTenantDetalhe.tsx`, `SuperAdminNovoLab.tsx`, `SuperAdminInscricoes.tsx`, `SuperAdminPlanos.tsx`, `SuperAdminAuditoria.tsx`, `SuperAdminConfiguracoes.tsx`, `SuperAdminNotificacoes.tsx`, `SuperAdminMigration.tsx`.
- **Components**: `components/SuperAdminLayout.tsx`, `components/RequireSuperAdmin.tsx`, `components/superadmin/*`, `components/ImpersonationBanner.tsx`.
- **Contextos**: `contexts/SuperAdminPrefsContext.tsx`.
- **Edge functions** (24): `super-admin-billing`, `-change-tenant-plan`, `-check-tenant-schema`, `-create-tenant`, `-delete-tenant`, `-impersonate-tenant`, `-import-tenant-admin`, `-list-tenants`, `-metrics`, `-migrate-tenant-auth`, `-migrate-tenant-data`, `-migrate-tenant-storage`, `-migration-flip`, `-migration-rollback`, `-migration-smoke-test`, `-plans`, `-provision-tenant-schema`, `-provision-tenant-schema-full`, `-purge-tenant-from-shared`, `-reset-tenant-password`, `-tenant-backup`, `-tenant-snapshot`, `-test-integration`, `-test-tenant-anon-key`.

### 19. Runtime / Identity / Cloud governance
- **Arquivos**: `src/runtime/db.ts`, `src/lib/queryClient.ts` (`installQueryClientTenantReset`), `src/contexts/AuthContext.tsx`, `supabase/functions/_shared/tenantGuard.ts`, `_shared/registry.ts`, `_shared/runtime/*`, `_shared/migration/*`, `_shared/canonical/*`, `_shared/drivers/*`, `_shared/neonProvider.ts`.

### 20. Assinatura digital / PIX / QR / WhatsApp
- **Arquivos**: `lib/pixBrCode.ts`, `components/PagamentoDialog.tsx`, `components/whatsapp/*`, `lib/whatsapp/*`, `qrcode` package.

## Relações entre módulos (macro)

- **Atendimentos** é o hub operacional. Financeiro, Coleta, Análise, Resultados, Mapa e Produção consomem estado do `atendimentoStore`.
- **Resultados** consome Configurações (parâmetros, layouts, VR, réguas etárias) e Pacientes (sexo/idade).
- **Financeiro** consome Atendimentos e Convênios (regra do memory: "Entradas" é read-only, dirigida pelo `atendimentoStore`).
- **Super Admin** opera fora do `tenant_id`; comunica-se com o app via edge functions privilegiadas.
- **Site público** e **Verificação de comprovantes** vivem em bundles com rotas fora dos `ProtectedRoute`.
- **Assistente IA** é uma camada horizontal invocada por atalho global.

Ver diagramas em `12-communication-diagrams.md`.
