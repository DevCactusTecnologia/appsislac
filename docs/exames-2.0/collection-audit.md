# Auditoria — Coleta

## Campos no catálogo que descrevem coleta
`material`, `recipiente`, `cor_tampa`, `volume_minimo_ml`, `estabilidade`,
`requer_jejum`, `horas_jejum`, `preparo_paciente`, `grupo_etiquetas`,
`quantidade_etiquetas`, `informacoes_coleta`, `temperatura_transporte`,
`protegido_luz`, `observacoes_coleta`.

## Diagnóstico
- A coleta deve permanecer **dinâmica** (regra do produto). Hoje, o
  `exames_catalogo` carrega os **defaults**, mas a fonte de verdade
  operacional para alterações por lote vive no Layout Científico
  (`exame_layouts`).
- Campos `temperatura_transporte`, `protegido_luz`, `observacoes_coleta`
  têm **0 consumidores** — preenchidos, nunca lidos.
- O campo `material` é uma **string livre** no exame, mas existe
  `materiais_amostra` (8 registros, canônico). Duplicação.

## Recomendação
| Permanece no exame | Migra para Layout |
|---|---|
| `material` (referência ao `materiais_amostra.id`) | `temperatura_transporte` |
| `recipiente`, `cor_tampa` (defaults) | `protegido_luz` |
| `volume_minimo_ml` (default) | `observacoes_coleta` |
| `requer_jejum`, `horas_jejum` | `estabilidade` |
| `grupo_etiquetas`, `quantidade_etiquetas` | — |
| `informacoes_coleta` (pacientes) | — |

Substituir a coluna string `material` por FK para `materiais_amostra.id`
elimina duplicação e dá ao soroteca / coleta uma única tabela de domínio.
