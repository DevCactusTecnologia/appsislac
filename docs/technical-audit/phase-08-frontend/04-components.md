# 04 — Components

**Total:** 160 arquivos em `src/components/` (37 no root + 20 subpastas de domínio).

## Classificação

### Genéricos / Design System (`components/ui/`)
Primitivas shadcn/Radix (`button`, `dialog`, `dropdown`, `input`, `select`, `table`, `tabs`, `alert-dialog`, etc.). Reuso máximo — usados em praticamente todas as pages.

### Layout / Chrome
- `AppLayout.tsx` (layout tenant), `AppSidebar.tsx`, `AppTopbar.tsx`, `SuperAdminLayout.tsx`.
- `ImpersonationBanner.tsx`, `PageErrorBoundary.tsx`, `ChunkErrorBoundary.tsx`.

### Guards / Infra
- `RequireSuperAdmin.tsx`, `RotinaColetaAnaliseGuard.tsx`, `PermissionDenied.tsx`.

### Domínio – root (`src/components/*.tsx`)
- Atendimento: `AtendimentoDetalheDialog`, `AlterarResponsavelPopup`, `AvaliacaoIADialog`, `LeituraRequisicaoDialog`, `PagamentoDialog` (47 KB), `PdfPreviewDialog`, `SolicitarRecoletaDialog`, `NovaEntradaSaidaDialog`.
- Cadastros: `CadastroPacienteDialog`, `CadastroEspecialistaDialog`, `EstadoCidadeFields`, `PacienteTelefoneInline`.
- Rotina/Resultado: `ResultadoPopup`, `ResultadoValidationBar`, `CelebracaoLiberacaoDialog`, `ExameListWithFade`, `ExamesTerceirizadosPanel`, `ImpressaoLotePorLab`.
- Badges/Status: `StatusBadge`, `LabBadge`, `OrigemBadge`, `RecemNascidoBadge`, `IntegrationStatusBadge`.
- Integrações/Auditoria: `AuditoriaIntegracaoDrawer`, `AuditoriaPanel`, `IntegrationWarningsList`, `RoteamentoApoioPanel`.
- Utilitários UX: `SuccessOverlay`.

### Domínio – subpastas
| Pasta | Foco |
|---|---|
| `assistente/` | Assistente IA SISLAC |
| `atendimento/` | Fragmentos do wizard |
| `auditoria/` | Painéis técnicos / VR |
| `caixa/` | Fluxo de caixa |
| `configuracoes/` | 12 tabs (largest: `ExamesTab` 48 KB, `ParametrosDialog` 46 KB, `ValoresReferenciaPanel` 43 KB) |
| `dashboard/` | Widgets de KPI |
| `editor/` | CKEditor 5 oficial |
| `estoque/` | Movimentações |
| `financeiro/` | Painéis específicos |
| `mapa/` | Cards e filtros do mapa |
| `operacional/` | Coleta/análise reutilizáveis |
| `rastreabilidade/` | Timeline de amostras |
| `resultado/` | Sub-componentes de laudo |
| `seo/` | Meta tags helpers |
| `shared/` | Componentes cross-domain |
| `soroteca/` | Grades e triagem |
| `superadmin/` | Painéis do console (largest: `TenantDatabaseConfig` 36 KB) |
| `tenant-site/` | Site institucional |
| `usuarios/` | Convites e RBAC |
| `whatsapp/` | Central WhatsApp (memory rule) |

## Top-10 componentes por tamanho
1. `configuracoes/ExamesTab.tsx` — 48.319
2. `PagamentoDialog.tsx` — 46.983
3. `configuracoes/ParametrosDialog.tsx` — 46.277
4. `configuracoes/ValoresReferenciaPanel.tsx` — 43.166
5. `configuracoes/SiteTab.tsx` — 36.008
6. `superadmin/TenantDatabaseConfig.tsx` — 35.987
7. `configuracoes/NovoExameDialog.tsx` — 35.615
8. `auditoria/AuditoriaTecnicaTab.tsx` — 35.504
9. `configuracoes/LaboratorioTab.tsx` — 32.189
10. `configuracoes/IntegracoesApoioTab.tsx` — 31.653

## Reutilização — evidências
- **Alto** para primitivas `ui/` e badges (`StatusBadge`, `LabBadge`, `OrigemBadge`) — importados por dezenas de pages.
- **Alto** para dialogs de domínio (`AtendimentoDetalheDialog`, `PagamentoDialog`, `CadastroPacienteDialog`) — consumidos por múltiplas pages operacionais.
- **Médio** para painéis de configurações (tabs específicas usadas apenas em `Configuracoes.tsx`).

## Duplicação — evidências
- Não foi observada duplicação estrutural entre subpastas (`whatsapp/` é centralizado — memory rule).
- Existe **duplicação de conteúdo** entre `Landing.tsx` e `LandingPageResponsive.tsx` (variantes paralelas). Nenhuma outra dupla foi identificada por inspeção de nomes/tamanhos.
- Componentes root e subpastas coexistem: alguns wrappers root (`ExamesTerceirizadosPanel`) delegam para subpastas de domínio.

## Componentes excessivamente grandes (evidência)
7 componentes ≥30 KB, todos em `configuracoes/`, `superadmin/`, `auditoria/` ou dialogs principais. `PagamentoDialog` é o único dialog root >45 KB.
