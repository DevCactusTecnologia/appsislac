# 04 — Normalization Analysis

Análise factual do grau de normalização, sem sugerir alterações.

## Grau global
O núcleo transacional (atendimento, amostra, financeiro, faturamento) está em **3FN**. As tabelas de catálogo (`exames_catalogo`, `exame_parametros`, `valores_referencia`) misturam 3FN com colunas semi-estruturadas propositais (`opcoes_select`, `formula`, `formato_exibicao`) — decisão de flexibilidade do domínio clínico.

## Áreas plenamente normalizadas
- Cadeia `atendimentos → atendimento_exames → amostras → amostra_movimentacoes`: cada fato registrado uma única vez.
- Cadeia `convenios → convenio_competencias → convenio_faturas → convenio_fatura_itens → convenio_glosas`.
- Cadeia `estoque_insumos → estoque_lotes → estoque_movimentacoes`.
- Listas mestras isoladas: `select_options`, `materiais_amostra`, `setores_laboratoriais`, `motivos_cancelamento`, `recoletas_motivos`, `financeiro_*` (destinos/formas/tipos).

## Redundâncias intencionais (denormalizações defensivas)
| Local | Redundância | Razão observada |
|---|---|---|
| `atendimento_exames` (46 col) | Snapshot de `preco`, `porte_cbhpm`, `convenio_id`, `unidade_id` no momento da criação | Congela histórico para faturamento e auditoria mesmo se catálogo mudar |
| `atendimento_pagamentos` | `valor`, `forma`, `caixa_sessao_id` copiados | Histórico financeiro imutável |
| `convenio_fatura_itens` | Preço/porte replicado do atendimento_exames | Fatura fechada não pode variar |
| `amostras` | Código humano (`codigo`) + `posicao_id` + `local_id` | Rastreabilidade rápida sem JOIN |
| `resultados_entregas` | Meio de entrega + timestamp | Trilha LGPD |
| `pdf_override_audit`, `storage_audit`, `atendimento_audit` etc. | Cópia integral dos campos alterados | Auditoria imutável (JSON `before/after`) |

## Redundâncias detectadas na auditoria
- `exame_parametros.valor_referencia` (texto livre) **concorre** com `valores_referencia.descricao` (documentado em `docs/valores-referencia-2.0/database-audit.md`). Ambos exibidos, sem canonical.
- `exame_parametros.critico_min/max` duplica `valores_referencia.critico_min/max` (fallback global vs. por faixa).
- `profiles` guarda `tenant_id` (join único) — mas `user_roles` também exige lookup separado; sem duplicação de dados, apenas duplo hop.
- Dicionários redundantes de forma de pagamento: `financeiro_formas_pagamento` (tenant) e `select_options` com categoria equivalente (global). Ambos referenciados pelo frontend em contextos diferentes.

## Colunas textuais que deveriam ser FK/CHECK (sem constraint hoje)
Documentado em `docs/valores-referencia-2.0/`:
- `valores_referencia.sexo` (text, sem CHECK) — deveria ser enum M/F/Ambos.
- `valores_referencia.unidade_idade` (text) — Anos/Meses/Dias sem CHECK.
- `valores_referencia.idade_min/max`, `valor_min/max` como `text` — permite `<`, `>`, `,` mas impede índice/faixa.
- `valores_referencia.unidade` sem normalização (`g/dL` vs `g/dl`).
- `atendimento_exames.status` livremente textual em algumas colunas de status.

## Dependências transitivas
Nenhuma dependência transitiva grave detectada nas tabelas core. As tabelas com muitas colunas (`atendimento_exames` 46, `tenant_registry` 34, `atendimentos` 31, `valores_referencia` 29, `exame_parametros` 28, `profiles` 27, `pacientes` 25, `tenant_lab_config` 23) mantêm relação direta com a PK — não são violações de 3FN, e sim entidades ricas em atributos próprios.

## Formas semi-estruturadas
- `exame_parametros.opcoes_select` (JSON de opções).
- `exame_parametros.formula` (expressão).
- `audit_logs`, `atendimento_audit`, `platform_audit`, `pdf_override_audit`: campos `payload`/`before`/`after` como `jsonb`.
- `integration_requests.payload`, `integration_responses.payload`: JSON bruto do parceiro.
- `tenant_lab_config`, `tenant_settings_public`: usam colunas escalares (não JSON) para configuração — decisão de tipagem forte.
