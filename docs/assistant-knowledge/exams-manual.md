# Manual de Exames

## Objetivo
Catalogar exames realizados pelo laboratório, com parâmetros, valores de referência, layout e regras de cálculo.

## Estrutura
- **Exame** (ex.: HEMOGRAMA COMPLETO)
  - **Parâmetros** (Hemácias, Hemoglobina, VCM, ...) — tipos: número, texto, lista, fórmula, tempo.
  - **Valores de referência** por sexo + faixa etária (modelo Padrão + Variações).
  - **Layout científico** (opcional) para apresentação no laudo.
  - **Críticos** (faixa de pânico) por parâmetro.

## Valores de referência
- Modelo oficial: **Padrão + Variações** (`categoria`, `prioridade`).
- Resolução server-side via `resolverReferencia(sexo, idade_em_dias)`.
- Faixas etárias usam unidades humanas (dia/mês/ano) com conversão para dias.

## Parâmetros do tipo Fórmula
Calculados a partir de outros parâmetros (ex.: VLDL = Triglicerídeos/5). Avaliados em runtime e na impressão.

## Críticos
Resultado fora da faixa crítica gera alerta e exige conduta documentada.

## Principais perguntas
- "Quais parâmetros tem o exame X?"
- "Mostre os valores de referência de Hemoglobina."
- "Esse resultado é crítico?"

## Principais ações
| Intenção | Capability |
| --- | --- |
| Abrir exame no catálogo | `exame.abrir` (quando registrada) |
| Mostrar parâmetros | `exame.parametros` (quando registrada) |

## Boas práticas
- Nunca duplicar parâmetro com nome diferente.
- Toda fórmula deve ter unidade explícita.
- Toda faixa crítica deve ter conduta documentada.
