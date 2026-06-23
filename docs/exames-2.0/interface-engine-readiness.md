# Preparação para Interface Engine (Equipamentos)

## Estado atual
| Capacidade | Status |
|---|---|
| Suporte ASTM | ❌ |
| Suporte HL7 | ❌ |
| Worklist (LIS → equipamento) | ❌ |
| Resultado automático (equipamento → LIS) | ❌ |
| Código único por equipamento | ❌ |
| Código LOINC consumido | ❌ (coluna existe, 0 leituras) |
| Código LIS interno (`mnemonico`) | ✔ usado como proxy |

## Lacunas para Interface Engine

| Necessidade | Campo proposto | Tipo |
|---|---|---|
| Código interno canônico | `codigo_interfaceamento` | `text` (único por tenant) |
| Mapeamento por equipamento | `codigo_equipamento` | `jsonb` `{ "cobas-c311": "ACUR", "alinity-i": "URI-AC" }` |
| Identidade LOINC | `codigo_loinc` | ✔ já existe (usar de fato) |
| Identidade HL7 OBR | `codigo_hl7` | `text` |
| Bidirecionalidade ASTM | metadado em `equipamentos` | tabela futura |

## Diagnóstico
- O catálogo já tem `mnemonico` (usado como código curto LIS) e
  `codigo_loinc` (não consumido). Falta o **eixo de equipamentos**: hoje
  não há nenhuma tabela `equipamentos`, `equipamento_exame_map` ou
  `worklist`.
- O `codigo_exame_apoio` é tratado hoje como código de **outro LIS** (apoio),
  semanticamente diferente de **código de equipamento**.

## Recomendação (sem implementar)
1. Adicionar 2 colunas: `codigo_interfaceamento text`, `codigo_equipamento jsonb`.
2. Promover `codigo_loinc` a campo de primeira classe (usar em export HL7/FHIR).
3. Criar tabela `equipamentos` (futuro Interface Engine).
4. Manter o catálogo como **identidade lógica** — equipamentos referenciam,
   não o contrário.
