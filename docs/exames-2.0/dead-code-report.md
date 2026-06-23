# Código Morto — Módulo Exames

> Documentação apenas. **NADA é removido nesta fase.**

## Colunas sem consumidores (`exames_catalogo`)
Grep em `src/` excluindo o próprio store e os diálogos de cadastro/detalhes:

| Coluna | Leituras |
|---|---:|
| `codigo_loinc` | 0 |
| `codigo_sus` | 0 |
| `exame_calculado` | 0 |
| `exame_oculto` | 0 |
| `exige_protocolo_externo` | 0 |
| `grupo_impressao` | 0 |
| `idade_minima_meses` | 0 |
| `idade_maxima_meses` | 0 |
| `material_apoio` | 0 |
| `observacoes_coleta` | 0 |
| `ordem_coleta` | 0 |
| `ordem_impressao` | 0 |
| `ordem_setor` | 0 |
| `prazo_apoio_dias` | 0 |
| `preparo_apoio` | 0 |
| `protegido_luz` | 0 |
| `recipiente_apoio` | 0 |
| `sexo_aplicavel` | 0 (persistido, nunca validado) |
| `temperatura_transporte` | 0 |
| `template_laudo_id` | 0 |
| `texto_interpretativo_padrao` | 0 |
| `tipo_mapa` | 0 |
| `tuss_sem_equivalente` | 0 |
| `urgencia_padrao` | 0 |
| `volume_apoio_ml` | 0 |

**Total: 25 colunas.**

## Componentes / hooks / stores órfãos
- Nenhum hook dedicado a Exames — não há órfãos.
- Nenhuma RPC dedicada — não há órfãos.
- Stores: todas as 9 stores do módulo têm consumidores.

## Triggers redundantes
- Não detectados. Cada tabela tem apenas `touch_updated_at` + a sincronia
  esperada (`sync_amostra_tipo_material`).

## Índices redundantes
- `idx_tabela_preco_tabela_nome` (tabela, nome_exame) — útil para busca
  por nome. Junto com `exame_id` cobre os casos.
- Nenhum índice claramente redundante.

## Achados estruturais
- **R7 — acoplamento string-based em VR:** `valores_referencia` referencia
  exames por `exame_nome` (texto) em vez de FK. Quebra ao renomear o exame.
  Recomendação futura: migrar para `exame_id` + `parametro_id` (FKs).
- **R8 — duplicação `categoria` vs `setor_id`:** dupla referência ao setor.
- **R9 — duplicação `material` (string) vs `materiais_amostra`:** materiais
  do soroteca não são referenciados pelo catálogo de exames.
