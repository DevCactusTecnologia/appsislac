# Auditoria — Laboratórios de Apoio

## Tabelas
- `labs_apoio` — cadastro de laboratórios terceirizados (1 linha hoje).
- `exames_catalogo.lab_apoio_id` — destino padrão.
- `exames_catalogo.tipo_processo` — INTERNO | TERCEIRIZADO.
- `exames_catalogo.integracao_ativa` — habilita driver.

## Campos `*_apoio` no catálogo
| Campo | Leituras |
|---|---:|
| `codigo_exame_apoio` | 7 (driver, badges) |
| `provider_integracao` | 6 |
| `permite_envio_apoio` | 0 |
| `exige_protocolo_externo` | 0 |
| `prazo_apoio_dias` | 0 |
| `material_apoio` | 0 |
| `recipiente_apoio` | 0 |
| `volume_apoio_ml` | 0 |
| `preparo_apoio` | 0 |

## Diagnóstico
- Os campos `material_apoio`, `recipiente_apoio`, `volume_apoio_ml`,
  `preparo_apoio`, `prazo_apoio_dias` **duplicam** dados que o **provider
  driver** já carrega (Hermes/Pardini/DBSync).
- Roteamento dinâmico já existe via `RoteamentoApoioPanel` (override por
  atendimento) — bom.
- `MapeamentoExamesDialog` permite De/Para entre o catálogo local e o
  catálogo do provider — bom.

## Recomendação
1. Manter no catálogo: `tipo_processo`, `lab_apoio_id`, `integracao_ativa`,
   `codigo_exame_apoio`, `provider_integracao`.
2. Remover bloco `*_apoio` duplicado.
3. Quando o operador precisar de info pré-analítica do apoio, o driver
   devolve essa informação on-demand.
