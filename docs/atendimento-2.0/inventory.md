# Atendimento 2.0 — Fase 1.1 — Inventário Completo

> Modo: SOMENTE LEITURA. Catalogação do núcleo operacional do SISLAC.
> Data: 2026-06-22.

## 1. Tabelas (banco)

### Núcleo do atendimento
| Tabela | Papel | Observação |
|---|---|---|
| `atendimentos` | Cabeçalho do pedido (paciente, convênio, unidade, status agregado, totais) | 26 colunas; `status_atendimento` e `status_pagamento` são derivados por trigger |
| `atendimento_exames` | Linha por exame solicitado; carrega status operacional, datas (coleta/análise/liberação), resultados, snapshot regulatório (metodologia/unidade), terceirização e PDF override | 46 colunas |
| `atendimento_pagamentos` | Pagamentos aditivos (Financeiro 2.0) — DELETE bloqueado, estorno formal | 11 colunas |
| `atendimento_audit` | Auditoria detalhada de mutações (quem, antes, depois, justificativa, pos_finalizacao) | 18 colunas |

### Coleta / amostras
| Tabela | Papel |
|---|---|
| `amostras` | Tubos físicos com código (DV), tipo de material, status, vencimento |
| `amostra_sequence` | Sequenciador anual de códigos de amostra |
| `recoletas` | Solicitações de recoleta com motivo, status, vínculo ao exame |
| `recoletas_motivos` | Catálogo de motivos (sistema + tenant) |

### Resultados, críticos, entrega
| Tabela | Papel |
|---|---|
| `criticos_comunicacoes` | Registro de valores críticos comunicados (RDC 786/2023) |
| `identidade_confirmacoes` | Confirmação de identidade na entrega |
| `orientacoes_entregues` | Orientações pré/pós exame entregues |
| `resultados_entregas` | Trilha de entrega física/digital do laudo |
| `valores_referencia` | VR por sexo/idade (resolvidos por paciente) |
| `exame_layouts` | Layout científico congelado por exame |
| `exame_parametros` | Parâmetros e fórmulas do exame |
| `exame_pops` | POPs vinculados ao exame |
| `mapas_trabalho` / `mapa_exames` | Mapas de bancada |

### Suporte
| Tabela | Papel |
|---|---|
| `pacientes` | Paciente (CPF único por tenant) |
| `convenios` | Convênio + tabela vinculada |
| `unidades` | Unidade (sede/filial/ponto) |
| `especialistas` | Solicitantes |
| `protocolo_sequence` / `protocolo_auditoria` | Sequência atômica de protocolo + reservas |
| `motivos_cancelamento` | Catálogo de motivos |
| `audit_logs` / `operational_audit` | Auditoria genérica (alimentada por triggers + forwarders) |
| `pdf_override_audit` | Trilha de override manual de PDF de apoio |
| `transporte_remessas` | Remessas para lab apoio |
| `labs_apoio` | Laboratórios terceirizados |

### Integração / lab apoio
`integration_*` (jobs, dead_jobs, logs, requests, responses, results, exam_map, sync_state, credentials, provider_*). Acoplam-se a `atendimento_exames` quando `tipo_processo = 'TERCEIRIZADO'`.

## 2. Views públicas relevantes
- (Operacional não publica views próprias hoje — paginação é via RPC `atendimentos_page` / `resultados_page`).
- Financeiro: `convenio_fatura_resumo`, `convenio_competencia_resumo`, `financeiro_a_receber_v2` (Fase 7 do Financeiro).

## 3. RPCs (extraídas de `pg_proc` no schema `public`)
Diretamente operacionais:
- `create_atendimento_tx(_atendimento, _exames, _pagamentos)` — transacional, chamada pela edge `create-atendimento`.
- `update_atendimento_tx(...)` — transacional, chamada pela edge `update-atendimento`.
- `update_atendimento_exame_tx(...)` — patch de uma linha de exame (status, resultados, datas, analista, retificado).
- `recompute_atendimento_status(_atendimento_id)` — recalcula `status_atendimento` agregando os exames.
- `recompute_atendimento_totais(_atendimento_id)` — recalcula totais financeiros.
- `atendimento_assign_protocolo` / `atendimento_sign_protocolo` / `protect_atendimento_protocolo` / `validate_protocolo_atendimento` — geração e proteção do protocolo.
- `atendimentos_page(_filters)` / `atendimentos_kpis(...)` — listagem paginada e KPIs.
- `resultados_page(...)` — listagem paginada da tela Resultados.
- `gerar_codigo_amostra` / `_calc_dv_amostra` / `proxima_amostra_seq` / `marcar_amostras_vencidas` — ciclo de amostras.
- `ensure_recoleta_motivo_nome` / `seed_default_recoletas_motivos_for_tenant` / `protect_recoletas_motivos_sistema`.
- `set_audit_justificativa(_text)` — GUC de sessão lido pelo trigger `require_justificativa_pos_finalizacao`.
- `has_permission(_user, _perm)` — núcleo RBAC.

## 4. Triggers (snapshot pg_trigger)
**`atendimentos`**: `audit_atendimentos`, `touch_atendimentos_updated_at` (+ trilha `audit_atendimento_*` específica).

**`atendimento_exames`**:
- `atendimento_exames_rbac_check_trg` (BEFORE UPDATE) — revalida permissão por transição.
- `recompute_status_on_exame` (AFTER) → `recompute_atendimento_status`.
- `recompute_totais_on_exame` (AFTER) → `recompute_atendimento_totais`.
- `trg_atendimento_exames_snapshot_regulatorio` (BEFORE INS/UPD) — congela `metodologia_snapshot`, `unidade_snapshot` (RDC 786).
- `trg_snapshot_exame_terceirizado` (BEFORE INSERT) — copia `tipo_processo` e `lab_apoio_id` do catálogo.
- `trg_require_just_atex` (BEFORE UPD/DEL) — exige justificativa pós-finalização.
- `audit_atendimento_exames` + `trg_audit_atendimento_exames` (AFTER) — escrita em `audit_logs` e `atendimento_audit`.
- `touch_atendimento_exames_updated_at`.

**`atendimento_pagamentos`**:
- `recompute_status_on_pagamento` (AFTER) → recompute status agregado.
- `trg_atpag_attach_caixa` (BEFORE INSERT) — vincula sessão de caixa aberta.
- `trg_block_delete_pagamentos` — DELETE bloqueado, força estorno.
- `trg_financeiro_audit`, `audit_atendimento_pagamentos`, `trg_audit_atendimento_pagamentos`.
- `trg_require_just_atpag` — justificativa pós-finalização.

**`amostras`**: `amostras_updated_at`, `audit_amostras`.

## 5. Edge Functions operacionais
- `create-atendimento` — wrap RBAC + RPC `create_atendimento_tx`.
- `update-atendimento` — wrap RBAC + RPC `update_atendimento_tx`.
- `ai-suggest-exames` — IA clínica (sugestão de exames, justificativa).
- `extract-requisicao-exames` — OCR/IA de requisição.
- `lab-apoio-adapter` / `lab-apoio-cron-fetch` / `lab-apoio-upload-pdf` — integração com apoio.
- `integration-*` (12 functions) — ciclo de jobs com provedores (dispatch, runner, poll, pdf-resolve, etc.).
- `assinatura-url`, `upload-assinatura`, `upload-pdf`, `upload-image`, `image-url` — laudo + assinatura.
- `comprovante-resolve`, `comprovante-shortlink`, `verifica-comprovante` (frontend) — comprovantes.

## 6. Stores (frontend, `src/data/`)
| Store | Cobertura |
|---|---|
| `atendimentoStore/` (split em 7 arquivos) | Boot, paginação, mutations transacionais, exames, terceirizados, realtime |
| `pacienteStore` | CRUD de pacientes |
| `convenioStore` | Convênios + tabelas vinculadas |
| `exameCatalogoStore` | Catálogo de exames (snapshot regulatório de origem) |
| `exameLayoutsStore` / `exameParametrosStore` | Layout científico + parâmetros |
| `valoresReferenciaStore` | VR por sexo/idade |
| `recoletasStore` / `recoletasMotivosStore` | Recoleta |
| `mapaTrabalhoStore` | Mapas de bancada |
| `producaoMetricsStore` | Métricas operacionais |
| `rastreabilidadeStore` | Críticos, entrega, identidade, orientações |
| `sorotecaStore` | Soroteca |
| `labApoioStore` | Lab apoio + roteamento |
| `auditoriaStore` / `auditLogsStore` | Auditoria |

## 7. Hooks
`usePaginatedAtendimentos`, `useResultadosPage`, `useOcorrenciasPage`, `useEnsureStore`, `useRealtimeChannel`, `use-debounced-value`, `useDicionario`, `useDashboardKpis`, `useAReceberPacientes`, `usePaginatedPacientes`, `useSolicitacoesNaoLidas`, `useConvenioFaturas`.

## 8. Páginas (rotas operacionais)
| Página | Linhas | Função |
|---|---|---|
| `NovoAtendimento.tsx` | 2801 | Wizard/single-page de criação e edição de atendimento |
| `ResultadoDetalhe.tsx` | 2648 | Edição clínica do exame, laudo, liberação, retificação |
| `RegistrarColeta.tsx` | 1197 | Tela de coleta (recepção/coletor) |
| `AnalisarAmostra.tsx` | 994 | Tela de bancada (analista/biomédico) |
| `Resultados.tsx` | 644 | Listagem global de resultados |
| `Producao.tsx` | 413 | Painel de produção / métricas |
| `Mapa.tsx` | — | Mapa de trabalho |
| `ConsultarResultados.tsx` | — | Consulta pública de resultado |
| `ImpressaoGeral.tsx` | — | Impressão consolidada |
| `LaudoPrintPage.tsx` | — | Layout de impressão do laudo |

## 9. Componentes operacionais
- `src/components/atendimento/FerramentasAvancadasMenu.tsx`
- `src/components/operacional/PacienteHeaderCard.tsx`
- `src/components/resultado/{ExameAcoesMenu, MaisAcoesMenu}.tsx`
- `src/components/rastreabilidade/{ConfirmarIdentidade,RegistrarCritico,RegistrarEntrega,RegistrarOrientacoes}Dialog.tsx`
- `src/components/mapa/{AnalistaAutocomplete, MapaConstants, MapaDatePicker, MapaPreviewDialog}.tsx`
- `src/components/{AtendimentoDetalheDialog, AlterarResponsavelPopup, AvaliacaoIADialog, CelebracaoLiberacaoDialog, ExameListWithFade, ExamesTerceirizadosPanel, ImpressaoLotePorLab, IntegrationStatusBadge, LabBadge, LeituraRequisicaoDialog, PdfPreviewDialog, ResultadoPopup, ResultadoValidationBar, RoteamentoApoioPanel, SolicitarRecoletaDialog, StatusBadge}.tsx`
- `ResultadoDetalhe/{LayoutScientificFormRenderer, ParamTypedInput, formula, helpers, statusHelpers, services/{auditLogBuilder, criticoPipeline, laudoHtmlBuilder}}`.

## 10. Relatórios / impressões / etiquetas
- `src/lib/{laudoLayout, laudoResolver, laudoTemplate, layoutScientificRuntime}.ts` — pipeline do laudo.
- `src/lib/{mapaA4Preview, mapaLotePreview, mapaPlaceholders, mapaPrint, mapaSharedStyles, mapaTemplates}.ts` — mapa de trabalho.
- `src/lib/{etiquetaAmostra, imprimirEtiquetaPorAtendimentoExame, comprovantes, comprovanteCaixa, dossieRastreabilidade}.ts`.
- `src/lib/{adminReportHeader, printHtml, printShell, sanitizeHtml, escapeHtml}.ts`.
- Páginas: `LaudoPrintPage.tsx`, `ImpressaoGeral.tsx`, `Mapa.tsx`.

## 11. Produção / coleta / resultados (por papel funcional)
- **Coleta**: `RegistrarColeta.tsx` + `amostras` + `etiquetaAmostra` + `recoletas`.
- **Produção/bancada**: `AnalisarAmostra.tsx` + `Mapa.tsx` + `mapasTrabalho` + `producaoMetricsStore`.
- **Resultados**: `Resultados.tsx` + `ResultadoDetalhe.tsx` + `valoresReferencia` + `criticos_comunicacoes` + `resultados_entregas`.

## 12. Quantitativo (alto nível)
- 7 RPCs operacionais críticas + 5 utilitárias (amostra/recoleta/protocolo).
- ~20 triggers nas tabelas de atendimento.
- 4 tabelas centrais + 11 tabelas de suporte direto.
- 2 edge functions transacionais (`create-atendimento`, `update-atendimento`) + 12 de integração.
- 13 stores frontend tocam o domínio.
- 4 páginas com >1000 linhas (NovoAtendimento, ResultadoDetalhe, RegistrarColeta).

— FIM —
