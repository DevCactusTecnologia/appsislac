# 08 — Responsibility Analysis

Cada arquivo/grupo é avaliado quanto à responsabilidade única (SRP).

## Convenção

- **SIM**: uma única responsabilidade claramente delimitada.
- **PARCIAL**: responsabilidade dominante bem definida mas convive com secundárias.
- **NÃO**: múltiplas responsabilidades distintas convivendo.

## Avaliação por grupo

### Bootstrap / Core

| Arquivo | SRP | Justificativa |
| ------- | --- | ------------- |
| `main.tsx` | PARCIAL | Entry + limpeza SW + favicon + listeners globais (`error`, `unhandledrejection`, chunk-reload). Justificado por ser entrypoint. |
| `App.tsx` | PARCIAL | Rotas + providers + guards. Padrão comum em SPAs. |
| `runtime/db.ts` | SIM | Facade única para cliente + resolução tenant. |
| `contexts/AuthContext.tsx` | SIM | Sessão + perfil + role. |

### Stores (`src/data/**`)

- **Todos os `*Store.ts` singulares (ex.: `pacienteStore.ts`, `orcamentoStore.ts`)**: SIM — cada arquivo representa uma entidade.
- **`atendimentoStore/`**: SIM em conjunto (dividido em 7 arquivos por responsabilidade — `queries`, `mutations`, `realtime`, `exames`, `terceirizados`, `_internal`, `types`, `index`).
- **`storeBoot.ts`, `lazyStores.ts`**: SIM — orquestração de bootstrap.

### Domínio

| Arquivo | SRP | Justificativa |
| ------- | --- | ------------- |
| `domains/result/services/*` | SIM | Cada arquivo representa um serviço puro (comprovantes, VR, critico). |
| `domains/appointment/services/pricing.ts` | SIM | Serviço puro de pricing. |
| `domains/tenant/services/*` | SIM | Leitura de dicionários/audit. |
| `lib/pricing/pricingEngine.ts` | SIM | Motor único de precificação. |
| `lib/atendimentoPolicy.ts`, `atendimentoStatus.ts` | SIM | Políticas isoladas. |

### Libs (`src/lib/**`)

- **Formatters/validators** (`cpf.ts`, `dateBR.ts`, `idade*.ts`, `masks.ts`, `validation.ts`, `tenantValidation.ts`, `escapeHtml.ts`, `sanitizeHtml.ts`, `htmlSpacing.ts`): SIM.
- **Print/PDF engine** (`printHtml.ts`, `printShell.ts`, `laudoTemplate.ts`, `laudoLayout.ts`, `laudoResolver.ts`, `laudoBatchPdf.ts`, `documentoRenderer.ts`, `layoutScientificRuntime.ts`, `watermark.ts`, `mapa*.ts`, `etiquetaAmostra.ts`, `imprimirEtiquetaPorAtendimentoExame.ts`, `adminReportHeader.ts`): PARCIAL — o conjunto opera como engine; cada arquivo tem função clara mas há overlap entre `documentoRenderer` × `laudoTemplate` × `laudoLayout`.
- **Runtime infra** (`queryClient.ts`, `logger.ts`, `persist.ts`, `ttlCache.ts`, `favicon.ts`, `featureFlags.ts`, `queryPatterns.ts`, `runWithConcurrency.ts`, `routePreload.ts`): SIM.
- **Errors/UX** (`errorHandling.ts`, `showError.ts`, `confetti.ts`): SIM.
- **Tenant site** (`tenantSite/*`): SIM cada arquivo, agrupamento coerente.
- **WhatsApp** (`whatsapp/*`): SIM cada arquivo.

### Componentes

- **`components/ui/*`**: SIM — cada primitivo shadcn tem escopo único.
- **Layouts** (`AppLayout.tsx`, `AppSidebar.tsx`, `AppTopbar.tsx`, `SuperAdminLayout.tsx`): SIM.
- **Diálogos operacionais raiz** (`AtendimentoDetalheDialog.tsx`, `PagamentoDialog.tsx`, `SolicitarRecoletaDialog.tsx`, `LeituraRequisicaoDialog.tsx`, `AlterarResponsavelPopup.tsx`, `NovaEntradaSaidaDialog.tsx`): PARCIAL — normalmente combinam UI + orquestração de mutações via store, o que é padrão do projeto mas mistura camadas.
- **Panels de auditoria/integração** (`AuditoriaPanel.tsx`, `AuditoriaIntegracaoDrawer.tsx`, `IntegrationStatusBadge.tsx`, `IntegrationWarningsList.tsx`): SIM.
- **`components/configuracoes/*`**: SIM por arquivo (cada Tab é uma tela isolada).

### Páginas

- **Listagens** (`Pacientes.tsx`, `Convenios.tsx`, `Usuarios.tsx`, `Especialistas.tsx`, `Exames.tsx`, `Unidades.tsx`, `TabelasPreco.tsx`, `LabApoio.tsx`, `Documentos.tsx`): SIM — cada uma renderiza uma superfície CRUD.
- **`NovoAtendimento.tsx` + subpasta**: PARCIAL — página grande, dividida em helpers/serviços (`pricing.ts`, `buildExamesCobranca.ts`, `helpers.ts`, `services/`). A subdivisão em subpasta indica orquestração de várias responsabilidades (paciente, exames, pricing, pagamento).
- **`ResultadoDetalhe.tsx` + subpasta**: PARCIAL — página + helpers/`services/`/`formula.ts`.
- **`Financeiro.tsx` + subpasta**: PARCIAL — contexto + hooks + componentes internos.
- **Super Admin**: SIM por página.

### Edge Functions

- Em geral SIM — cada função tem missão declarada pelo nome do diretório.
- `_shared/**`: SIM cada arquivo (`runtime/db.ts`, `runtime/createClient.ts`, `drivers/registry.ts`, `drivers/pipeline.ts`, `crypto.ts`, `rateLimit.ts`, `s3.ts`, `integrationLog.ts`, `tenantGuard.ts`, `edgeBoot.ts`, etc.).

## Sumário quantitativo (estimativa)

| Nível SRP | Contagem aproximada |
| --------- | ------------------- |
| SIM       | ~85% dos arquivos    |
| PARCIAL   | ~14% (páginas grandes, orquestradores, engine de print/laudo) |
| NÃO       | Não identificado sem análise linha-a-linha adicional (não afirmado). |
