# 02 — File Inventory

Inventário resumido por diretório. Para cada arquivo listado a responsabilidade é inferida a partir do nome, do diretório e — quando necessário — do conteúdo lido nas fases anteriores. Onde não há evidência suficiente, o campo é marcado como *"Sem evidência suficiente para afirmar"*.

## Convenção de colunas

| Coluna | Significado |
| ------ | ----------- |
| Caminho | Path relativo ao repositório |
| Camada | Ver classificação em `05-file-classification.md` |
| Módulo | Ver `04-module-responsibilities.md` |
| Ativo | SIM / PARCIAL / NÃO IDENTIFICADO |

> Este inventário lista os arquivos raiz de cada subárvore. Diretórios com muitas variações (ex.: `src/components/configuracoes/` com 42 arquivos) são resumidos em bloco no relatório `03-directory-audit.md`.

## Bootstrap / raiz de `src/`

| Caminho | Camada | Módulo | Responsabilidade | Ativo |
| ------- | ------ | ------ | ---------------- | ----- |
| `src/main.tsx` | Bootstrap | Core | Entry Vite, instala fontes, favicon, listeners globais, chunk-reload | SIM |
| `src/App.tsx` | Apresentação | Core | Root React, rotas, providers | SIM |
| `src/index.css` | Configuração | Core | Design tokens Tailwind + globals | SIM |
| `src/vite-env.d.ts` | Configuração | Core | Tipagens Vite | SIM |
| `src/BEST_PRACTICES.md` | Documentação | Core | Guia interno | SIM |

## `src/contexts/`

| Arquivo | Responsabilidade | Ativo |
| ------- | ---------------- | ----- |
| `AuthContext.tsx` | Sessão, perfil, roles | SIM |
| `MenuLayoutContext.tsx` | Estado da sidebar (expand/collapse) | SIM |
| `SuperAdminPrefsContext.tsx` | Preferências do super admin | SIM |

## `src/runtime/`

| Arquivo | Responsabilidade | Ativo |
| ------- | ---------------- | ----- |
| `db.ts` | Facade única para o Supabase client + resolução de tenant | SIM |

## `src/integrations/`

| Arquivo | Responsabilidade | Ativo |
| ------- | ---------------- | ----- |
| `supabase/client.ts` | Cliente Supabase (auto-gerado) | SIM |
| `supabase/types.ts` | Tipagens do banco (auto-gerado) | SIM |
| `contracts/capabilities.ts` | Capacidades por provider | SIM |
| `contracts/providers.ts` | Registro de providers | SIM |
| `contracts/providerUI.ts` | Registro de UIs de provider | SIM |
| `contracts/transport.ts` | Contrato de transporte | SIM |
| `providers/registry.ts` | Boot do registro de UIs (importa hermes-pardini + dbsync) | SIM |
| `providers/hermes-pardini/**` | Adapter Hermes Pardini (UI, DTO, parsers, transports, XML, mocks) | SIM |
| `providers/dbsync/**` | Adapter DB Sync (UI, WSDL, labels, parser, status, transport, XML) | SIM |

## `src/data/` (39 stores + 2 auxiliares)

Cada arquivo `*Store.ts` implementa hidratação, cache e mutations para uma entidade do domínio.

| Arquivo | Entidade | Ativo |
| ------- | -------- | ----- |
| `atendimentoStore/{index,queries,mutations,realtime,exames,terceirizados,types,_internal}.ts` | Atendimentos (hub central) | SIM |
| `atendimentoNormalize.ts` | Normalização de payloads de atendimento | SIM |
| `pacienteStore.ts` | Pacientes | SIM |
| `financeiroStore.ts` + `financeiroListasStore.ts` | Financeiro | SIM |
| `convenioStore.ts`, `convenioFaturasStore.ts`, `convenioCompetenciasStore.ts`, `convenioGlosasStore.ts` | Convênios | SIM |
| `exameCatalogoStore.ts`, `exameParametrosStore.ts`, `exameLayoutsStore.ts` | Catálogo de exames | SIM |
| `valoresReferenciaStore.ts`, `reguasEtariasStore.ts` | Valores de referência | SIM |
| `unidadeStore.ts`, `setoresLaboratoriaisStore.ts`, `materiaisAmostraStore.ts` | Estrutura laboratorial | SIM |
| `usuariosStore.ts`, `especialistaStore.ts` | Pessoas | SIM |
| `orcamentoStore.ts`, `tabelaPrecoStore.ts` | Precificação | SIM |
| `caixaSessoesStore.ts` | Caixa | SIM |
| `estoqueStore.ts` | Estoque | SIM |
| `labApoioStore.ts`, `labConfigStore.ts` | Laboratórios de apoio + configuração | SIM |
| `mapaTrabalhoStore.ts` | Mapas de trabalho | SIM |
| `producaoMetricsStore.ts` | Métricas | SIM |
| `rastreabilidadeStore.ts` | Rastreabilidade | SIM |
| `recoletasStore.ts`, `recoletasMotivosStore.ts` | Recoletas | SIM |
| `sorotecaStore.ts`, `sorotecaEstruturaStore.ts`, `sorotecaExpurgoStore.ts` | Soroteca | SIM |
| `documentoTemplatesStore.ts` | Templates de documento | SIM |
| `auditLogsStore.ts`, `auditoriaStore.ts` | Auditoria | SIM |
| `geoStore.ts` | Cidades/UFs | SIM |
| `selectOptionsStore.ts` | Dicionários globais | SIM |
| `storeBoot.ts` | Boot coordenado dos stores | SIM |
| `lazyStores.ts` | Carregamento sob demanda | SIM |
| `types.ts` | Tipos de domínio compartilhados | SIM |

## `src/hooks/` (20 arquivos)

| Arquivo | Responsabilidade | Ativo |
| ------- | ---------------- | ----- |
| `use-mobile.tsx` | Detecção de breakpoint | SIM |
| `use-toast.ts` / `use-body-scroll-lock.ts` / `use-debounced-value.ts` / `use-scroll-fade.ts` | Utilitários UI | SIM |
| `useAReceberPacientes.ts` | Contas a receber por paciente | SIM |
| `useCleanupUtils.ts` | Cleanup manual (super admin) | SIM |
| `useCompliance.tsx` | LGPD compliance | SIM |
| `useConvenioFaturas.ts` | Faturas de convênio | SIM |
| `useDashboardKpis.ts` | KPIs do dashboard | SIM |
| `useDicionario.ts` | Dicionários dinâmicos | SIM |
| `useEnsureStore.ts` | Garante hidratação de stores | SIM |
| `useHidScanner.ts` | Leitor HID (barras) | SIM |
| `useOcorrenciasPage.ts`, `useResultadosPage.ts`, `useRotinaConfig.ts` | Composições de página | SIM |
| `usePaginatedAtendimentos.ts`, `usePaginatedPacientes.ts` | Paginação cursor-based | SIM |
| `useRealtimeChannel.ts` | Wrapper Supabase Realtime | SIM |
| `useSolicitacoesNaoLidas.ts` | Contador de solicitações | SIM |

## `src/domains/`

| Arquivo | Módulo | Ativo |
| ------- | ------ | ----- |
| `appointment/services/pricing.ts` | Atendimento | SIM |
| `result/services/comprovantesHtml.ts` | Resultado | SIM |
| `result/services/comprovantesRender.ts` | Resultado | SIM |
| `result/services/comprovantesUpload.ts` | Resultado | SIM |
| `result/services/comprovantesValidation.ts` | Resultado | SIM |
| `result/services/criticoChecker.ts` | Resultado | SIM |
| `result/services/parseValorReferencia.ts` | Resultado | SIM |
| `tenant/services/operationalAuditReader.ts` | Tenant | SIM |
| `tenant/services/selectOptionsReader.ts` | Tenant | SIM |

## `src/pages/` (78 arquivos)

Cada `.tsx` na raiz de `src/pages/` é uma rota. Diretórios com subarquivos (ex.: `ResultadoDetalhe/`, `NovoAtendimento/`, `Financeiro/`, `superadmin/`, `admin/`, `producao/`) agrupam artefatos internos da mesma rota.

- Rotas principais (raiz): `Landing`, `LandingPageResponsive`, `Index`, `LoginV2`, `SuperAdminLogin`, `Inscricao`, `ResetPassword`, `Perfil`, `Privacidade`, `Dashboard`, `NovoAtendimento`, `RegistrarColeta`, `AnalisarAmostra`, `Resultados`, `ResultadoDetalhe`, `ConsultarResultados`, `ImpressaoGeral`, `Mapa`, `Producao`, `Estoque`, `Soroteca`, `SorotecaEstrutura`, `SorotecaExpurgo`, `SorotecaMateriais`, `SorotecaTriagem`, `Financeiro`, `Convenios`, `Orcamentos`, `TabelasPreco`, `Unidades`, `Usuarios`, `Especialistas`, `Exames`, `Pacientes`, `LabApoio`, `Auditoria`, `RelatorioOcorrencias`, `RelatorioRecoletas`, `SolicitacoesSite`, `Documentos`, `Configuracoes`, `TenantSite`, `TenantSiteContato`, `TenantSiteSobre`, `RedirectShortlink`, `VerificarComprovante`, `NotFound`.
- `pages/superadmin/`: 10 telas do super admin.
- `pages/admin/`: `AuditoriaVR.tsx`, `CKEditorTest.tsx`.
- `pages/ResultadoDetalhe/`: helpers, tipos, `formula.ts`+testes, `ParamTypedInput.tsx`, `LayoutScientificFormRenderer.tsx`, `services/`.
- `pages/NovoAtendimento/`: `pricing.ts`+testes, `buildExamesCobranca.ts`+testes, `helpers.ts`, `highlightMatch.tsx`, `DropdownStatus.tsx`, `types.ts`, `services/`.
- `pages/Financeiro/`: `FinanceiroContext.tsx`, `components/`, `hooks/`, `services/`, `helpers.ts`, `types.ts`.
- `pages/producao/`: `ProducaoChartsLazy.tsx`.

## `src/components/`

Ver `03-directory-audit.md` (bloco `components/`) para lista completa. Sumário:

| Subdiretório | Nº arquivos | Ativo |
| ------------ | ----------- | ----- |
| `ui/` (shadcn) | 23 | SIM |
| `configuracoes/` | 42 | SIM |
| `soroteca/` | 7 | SIM |
| `tenant-site/` | 8 | SIM |
| `financeiro/` | 6 | SIM |
| `estoque/` | 4 | SIM |
| `mapa/` | 4 | SIM |
| `rastreabilidade/` | 4 | SIM |
| `superadmin/` | 4 | SIM |
| `shared/` | 3 | SIM |
| `editor/` | 3 | SIM |
| `dashboard/`, `operacional/`, `caixa/`, `resultado/`, `whatsapp/` | 2 cada | SIM |
| `atendimento/`, `auditoria/`, `assistente/`, `seo/`, `usuarios/` | 1 cada | SIM |
| Raiz `components/` (dialogs/panels transversais) | ~37 | SIM |

## `src/lib/` (65 entradas)

Utilitários agrupados por domínio funcional. Blocos:

- **HTML/PDF/print**: `printHtml.ts`, `printShell.ts`, `sanitizeHtml.ts`, `escapeHtml.ts`, `htmlSpacing.ts`, `watermark.ts`, `laudoTemplate.ts`, `laudoLayout.ts`, `laudoResolver.ts`, `laudoBatchPdf.ts`, `documentoRenderer.ts`, `documentoTemplatesPadrao.ts`, `mapaA4Preview.ts`, `mapaLotePreview.ts`, `mapaPlaceholders.ts`, `mapaPrint.ts`, `mapaSharedStyles.ts`, `mapaTemplates.ts`, `layoutScientificRuntime.ts`, `imprimirEtiquetaPorAtendimentoExame.ts`, `etiquetaAmostra.ts`, `adminReportHeader.ts`.
- **Rastreabilidade/Audit**: `criticoAudit.ts`, `dossieRastreabilidade.ts`, `regulatorio.ts`, `regulatorioResolver.ts`, `lgpdReport.ts`, `gatewayWebhookHistory.ts`.
- **Domínio Atendimento/Cobrança/Comprovantes**: `atendimentoPolicy.ts`, `atendimentoStatus.ts`, `comprovantes.ts`, `comprovanteCaixa.ts`, `pricing/pricingEngine.ts`, `pixBrCode.ts`.
- **Formatters e validações**: `cpf.ts`, `dateBR.ts`, `idade.ts`, `idadeFaixas.ts`, `idadeFormat.ts`, `masks.ts`, `validation.ts`, `tenantValidation.ts`, `validarCredenciaisAnalista.ts`, `showError.ts`, `errorHandling.ts`.
- **Runtime/infra**: `favicon.ts`, `featureFlags.ts`, `logger.ts`, `persist.ts`, `queryClient.ts`, `queryPatterns.ts`, `routePreload.ts`, `runWithConcurrency.ts`, `ttlCache.ts`, `constants.ts`, `utils.ts`, `exameDefaults.ts`, `labApoio.ts`, `laboratorioPadroes.ts`, `protocoloLookup.ts`, `sanitizeHtml.ts`, `confetti.ts`.
- **Integrations**: `integration/integrationStatus.ts`.
- **Tenant site**: `tenantSite/{blocks,seoHelpers,store,themePresets,uploadAsset,vitrineStore}.ts`.
- **WhatsApp**: `whatsapp/{enqueueNotification,getWhatsappActionByDocument,notificationPolicy,notifyRecoleta,notifyResultadoPronto}.ts`.
- **Testes internos**: `lib/__tests__/`.

## `src/types/`

| Arquivo | Responsabilidade | Ativo |
| ------- | ---------------- | ----- |
| `common.ts` | Tipos transversais | SIM |
| `domain.ts` | Tipos de domínio compartilhados | SIM |

## `src/test/`

| Arquivo | Responsabilidade | Ativo |
| ------- | ---------------- | ----- |
| `setup.ts` | Setup do Vitest | SIM |

## `src/__tests__/`

| Arquivo | Responsabilidade | Ativo |
| ------- | ---------------- | ----- |
| `validation.spec.ts` | Testes de validação | SIM |

## `supabase/functions/`

74 diretórios. Categorias:

- **Admin usuários**: `admin-delete-user`, `admin-invite-user`, `admin-update-user`.
- **AI**: `ai-chat`, `ai-speak`, `ai-suggest-exames`, `ai-transcribe`.
- **Uploads/URLs**: `assinatura-url`, `image-url`, `upload-assinatura`, `upload-image`, `upload-pdf`.
- **Comprovantes**: `comprovante-resolve`, `comprovante-shortlink`.
- **Atendimentos**: `create-atendimento`, `update-atendimento`.
- **Integrações laboratoriais**: `integration-dispatch`, `integration-job-action`, `integration-jobs-runner`, `integration-pdf-resolve`, `integration-pdf-url`, `integration-poll-results`, `integration-save-credentials`, `integration-test-connection`, `dbsync-test-connection`, `lab-apoio-adapter`, `lab-apoio-cron-fetch`, `lab-apoio-upload-pdf`, `provider-catalog-import`, `provider-health-aggregator`.
- **AI de laudos/exames**: `extract-requisicao-exames`, `ai-suggest-exames`.
- **Assinatura**: `sign-resultado`.
- **Soroteca**: `soroteca-reorganizar-galeria`, `soroteca-sugerir-posicao`.
- **Marketing/site público**: `leads-manager`, `sitemap`, `tenant-domain-verify`, `tenant-resolve`.
- **Compliance**: `lgpd-auditoria-relatorio`, `lgpd-consentimento`, `lgpd-deletar-paciente`.
- **Super Admin — plataforma**: `super-admin-billing`, `super-admin-change-tenant-plan`, `super-admin-check-tenant-schema`, `super-admin-create-tenant`, `super-admin-delete-tenant`, `super-admin-impersonate-tenant`, `super-admin-import-tenant-admin`, `super-admin-list-tenants`, `super-admin-metrics`, `super-admin-plans`, `super-admin-reset-tenant-password`, `super-admin-tenant-backup`, `super-admin-tenant-snapshot`, `super-admin-test-integration`, `super-admin-test-tenant-anon-key`, `super-admin-test-tenant-db`, `super-admin-update-tenant`, `super-admin-update-tenant-admin`, `super-admin-update-tenant-db-config`.
- **Super Admin — migração runtime**: `super-admin-migrate-tenant-auth`, `super-admin-migrate-tenant-data`, `super-admin-migrate-tenant-storage`, `super-admin-migration-flip`, `super-admin-migration-rollback`, `super-admin-migration-smoke-test`, `super-admin-provision-tenant-schema`, `super-admin-provision-tenant-schema-full`, `super-admin-purge-tenant-from-shared`, `tenant-dedicated-login-gate`.
- **WhatsApp**: `whatsapp-dispatcher`, `whatsapp-template-sync`, `whatsapp-webhook`.
- **Shared**: `_shared/` — runtime, drivers, auth AI, crypto, rate limit, S3, tenant guard, etc.

## `scripts/`

| Arquivo | Responsabilidade | Ativo |
| ------- | ---------------- | ----- |
| `backup-sql.ts` | Backup SQL | SIM |
| `check-data-plane-routing.sh` | Verifica separação shared/dedicated | SIM |
| `check-file-size.sh` + `file-size-allowlist.txt` | Guard de tamanho | SIM |
| `check-no-mocks.sh` | Impede mocks fora de dev | SIM |
| `test-rls.js`, `test-rls-integration.js` | Testes RLS | SIM |
| `test-validacoes.js` | Testes de validação | SIM |

## `e2e/`

| Arquivo | Responsabilidade | Ativo |
| ------- | ---------------- | ----- |
| `mapa-preview-cell-formatting.spec.ts` | Spec Playwright único | SIM |

## `public/`

`llms.txt`, `placeholder.svg`, `robots.txt`, `sitemap.xml`.

## Raiz do projeto (config)

`vite.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `eslint.config.js`, `postcss.config.js`, `playwright.config.ts`, `playwright-fixture.ts`, `vitest.config.ts`, `vercel.json`, `next.config.js`, `components.json`, `validate-security.cjs`, `package.json`, `package-lock.json`, `.env`, `.github/workflows/ci.yml`, `deploy-compliance.sh`, `GUIA-FINAL-DEPLOYMENT.md`, `GUIA_COMPLIANCE_IMPLEMENTACAO.md`, `LGPD_RDC_MIGRACAO_AUTOMATICA.md`.
