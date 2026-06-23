# Inventário — Módulo Exames

## Frontend

### Páginas
| Arquivo | Linhas | Função |
|---|---:|---|
| `src/pages/Exames.tsx` | 25 | Wrapper de rota — reusa `ExamesTab` |
| `src/pages/Configuracoes.tsx` | — | Host das tabs administrativas |
| `src/pages/TabelasPreco.tsx` | — | Tabela de preços (lê `exames_catalogo`) |
| `src/pages/LabApoio.tsx` | — | Cadastro de labs de apoio |

### Componentes (`src/components/configuracoes/`)
| Arquivo | Linhas | Papel |
|---|---:|---|
| `ExamesTab.tsx` | 976 | Lista, busca, filtros, abertura de diálogos |
| `NovoExameDialog.tsx` | 659 | Cadastro/edição do exame (UI simplificada) |
| `DetalhesExameDialog.tsx` | 257 | Visão somente leitura |
| `ParametrosDialog.tsx` | 788 | Parâmetros do exame (analítico) |
| `LayoutDialog.tsx` | 354 | Layout científico (CKEditor) |
| `MatrizValoresReferencia.tsx` | 456 | Matriz de VR sexo/idade |
| `GerenciarReguasDialog.tsx` | 290 | Réguas etárias |
| `CoberturaEtariaBar.tsx` | 83 | Visualização de cobertura |
| `MapeamentoExamesDialog.tsx` | 321 | De/Para com apoio |
| `SetoresTab.tsx` | 448 | Setores laboratoriais |
| `TabelasPrecoTab.tsx` | 615 | Editor de tabela de preços |
| `LabsApoioTab.tsx` | — | Labs de apoio |
| `ProviderCatalogImporter.tsx` | — | Importação de catálogos de provider |
| `IntegracoesApoioTab.tsx` | — | Configuração de drivers |

Componentes globais que consomem o catálogo: `ExameListWithFade`,
`ExamesTerceirizadosPanel`, `RoteamentoApoioPanel`, `LabBadge`,
`IntegrationStatusBadge`, `ImpressaoLotePorLab`.

### Hooks
Nenhum hook dedicado a exames — leituras feitas direto via stores
(`getExamesCatalogo`, `getExameCatalogoById`, `getExameCatalogoCompleto`).

### Stores (`src/data/`)
| Arquivo | Linhas | Tabela |
|---|---:|---|
| `exameCatalogoStore.ts` | 399 | `exames_catalogo` |
| `exameParametrosStore.ts` | 239 | `exame_parametros` |
| `exameLayoutsStore.ts` | 157 | `exame_layouts` |
| `valoresReferenciaStore.ts` | 191 | `valores_referencia` |
| `reguasEtariasStore.ts` | — | `reguas_etarias` |
| `setoresLaboratoriaisStore.ts` | 174 | `setores_laboratoriais` |
| `materiaisAmostraStore.ts` | 129 | `materiais_amostra` |
| `labApoioStore.ts` | 133 | `labs_apoio` |
| `tabelaPrecoStore.ts` | 222 | `tabela_preco_itens` |

### Serviços / libs
- `src/lib/exameDefaults.ts` — presets por setor (material, recipiente).
- `src/lib/laboratorioPadroes.ts` — SBPC, materiais, recipientes, validações.
- `src/lib/regulatorio.ts` — TUSS, CBHPM, LOINC sanitização.
- `src/lib/labApoio.ts` — sigla/cor por destino.
- `src/lib/integration/integrationStatus.ts` — status de integração.
- `src/domains/appointment/services/pricing.ts` — fallback CBHPM/TUSS/Própria.

---

## Backend

### Tabelas (públicas)
| Tabela | Linhas | Tamanho | Índices |
|---|---:|---:|---:|
| `exames_catalogo` | 441 | 272 kB | 11 |
| `tabela_preco_itens` | 441 | 48 kB | 5 |
| `valores_referencia` | 164 | 40 kB | 3 |
| `exame_layouts` | 73 | 168 kB | 4 |
| `exame_parametros` | 41 | 16 kB | 5 |
| `setores_laboratoriais` | 13 | — | 3 |
| `materiais_amostra` | 8 | — | 3 |
| `labs_apoio` | 1 | — | 3 |
| `atendimento_exames` | 0 (vazio na ref.) | — | 14 |

### Funções / RPCs
Nenhuma RPC dedicada ao módulo Exames. Apenas triggers `touch_updated_at` e
`trg_audit_atendimento_exames` (auditoria).

### Triggers
- `trg_exames_catalogo_updated_at`
- `touch_exame_parametros_updated_at`
- `touch_exame_layouts_updated_at`
- `trg_valores_referencia_updated_at`
- `trg_tabela_preco_updated_at`
- `trg_labs_apoio_updated_at`
- `sync_amostra_tipo_material` (sincroniza `amostras.tipo_material` ↔ `material_id`)

### RLS
4 policies por tabela (read authenticated / admin insert/update/delete) +
isolamento por `tenant_id` via `current_tenant_id()`.

### Edge functions relacionadas
- `provider-catalog-import` — importa catálogo do provider para `exames_catalogo`.
- `extract-requisicao-exames` — OCR/IA para extrair exames de PDFs.
- `ai-suggest-exames` — sugestão.
- `lab-apoio-adapter`, `lab-apoio-cron-fetch`, `lab-apoio-upload-pdf` — apoio.
- `integration-*` — interfaceamento futuro.
