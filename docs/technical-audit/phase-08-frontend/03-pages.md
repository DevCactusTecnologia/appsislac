# 03 — Pages Inventory

**Total:** 114 arquivos em `src/pages/` (inclui subpastas `NovoAtendimento/`, `ResultadoDetalhe/`, `Financeiro/`, `superadmin/`, `admin/`, `producao/`).

## Classificação por finalidade

### Públicas
| Page | Objetivo |
|---|---|
| `Landing.tsx` | Landing pública SISLAC (rota `/`) |
| `LandingPageResponsive.tsx` | Variante responsiva (referenciada por Landing) |
| `Inscricao.tsx` | Cadastro de laboratório / lead |
| `LoginV2.tsx` | Autenticação de tenant |
| `SuperAdminLogin.tsx` | Autenticação do super admin |
| `ResetPassword.tsx` | Recuperação de senha |
| `Privacidade.tsx` | Política de privacidade |
| `VerificarComprovante.tsx` | Verificação pública de comprovante PIX |
| `RedirectShortlink.tsx` | Encurtador `/p/:codigo` |
| `TenantSite*.tsx` (3) | Site institucional público por tenant |

### Operacionais (tenant)
| Page | Responsabilidade |
|---|---|
| `Dashboard.tsx` | KPIs operacionais (usa `useDashboardKpis`) |
| `Index.tsx` | Lista de atendimentos + filtros/contadores |
| `NovoAtendimento.tsx` (156 KB, +subpasta) | Wizard de criação/edição de atendimento |
| `RegistrarColeta.tsx` (59 KB) | Registro de coleta com scanner HID |
| `AnalisarAmostra.tsx` (53 KB) | Análise técnica |
| `Resultados.tsx` + `ResultadoDetalhe.tsx` (160 KB) | Liberação/edição de laudos |
| `ConsultarResultados.tsx` | Consulta de laudos liberados |
| `LabApoio.tsx` | Roteamento e monitoramento de apoio (usa Realtime) |
| `Mapa.tsx` (54 KB) | Mapa de trabalho por setor/analista |
| `Producao.tsx` | Métricas de produção |
| `ImpressaoGeral.tsx` | Impressão em lote |

### Cadastros / Configurações
`Pacientes`, `Especialistas`, `Exames`, `Convenios`, `Unidades`, `Documentos`, `TabelasPreco`, `Estoque`, `Configuracoes` (12 tabs).

### Financeiro
`Financeiro.tsx` (orquestrador) + `Financeiro/` (contexto, hooks, componentes, services, types) + `Orcamentos.tsx`.

### Soroteca
`Soroteca`, `SorotecaEstrutura`, `SorotecaTriagem`, `SorotecaMateriais`, `SorotecaExpurgo`.

### Relatórios / Auditoria
`RelatorioOcorrencias`, `RelatorioRecoletas`, `Auditoria.tsx`, `admin/AuditoriaVR.tsx`.

### Super Admin (`src/pages/superadmin/`)
`SuperAdminDashboard`, `SuperAdminTenants`, `SuperAdminNovoLab`, `SuperAdminTenantDetalhe` (59 KB), `SuperAdminMigration`, `SuperAdminInscricoes`, `SuperAdminPlanos`, `SuperAdminAuditoria`, `SuperAdminConfiguracoes`, `SuperAdminNotificacoes`.

### Utilitárias
`NotFound.tsx`, `Perfil.tsx`, `admin/CKEditorTest.tsx`, `SolicitacoesSite.tsx`, `producao/ProducaoChartsLazy.tsx`.

## Top-10 páginas por tamanho (LOC-proxy, bytes)
1. `ResultadoDetalhe.tsx` — 160.614
2. `NovoAtendimento.tsx` — 156.734
3. `Index.tsx` — 61.157
4. `RegistrarColeta.tsx` — 59.455
5. `superadmin/SuperAdminTenantDetalhe.tsx` — 58.656
6. `SorotecaEstrutura.tsx` — 56.944
7. `Mapa.tsx` — 54.271
8. `AnalisarAmostra.tsx` — 53.208
9. `Soroteca.tsx` — 51.024
10. `Pacientes.tsx` — 50.513

## Dependências típicas
Uma page consome: 1) hooks (`useEnsureStore`, `use*Page`, `useRealtimeChannel`), 2) stores in-memory correspondentes, 3) componentes de `components/<domínio>/`, 4) `src/runtime/db.ts` indiretamente via store/hook, 5) primitivas shadcn de `components/ui/`.
