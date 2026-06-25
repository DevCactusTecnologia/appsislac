# Auditoria de Valores de Referência

## Estrutura de dados

Tabela `valores_referencia` armazena **uma linha por faixa** (sexo × idade × parâmetro × exame). 16 colunas, todas em `text` exceto datas, id e tenant_id.

## Tipos suportados pela UI

A modelagem atual aceita SOMENTE faixas numéricas (`valor_min`, `valor_max`) **OU** texto livre (`descricao`).

Tipos do briefing × suporte real:

| Tipo | Suporte | Como |
|---|---|---|
| Numérico (intervalo) | ✅ | `valor_min`/`valor_max`. |
| Texto livre | ✅ | `descricao` (sobrescreve preview do laudo). |
| Qualitativo (Positivo/Negativo, Reagente/Não reagente) | ⚠️ Indireto | só via `descricao` ou `opcoes_select` no parâmetro. Sem semântica. |
| Escalas / categorias graduadas | ❌ | Não há campo. |
| Faixas múltiplas com texto interpretativo por faixa | ✅ parcial | Texto cabe em `descricao`, mas não há "tag" (ex.: Normal/Alterado/Crítico). |

## Dados reais

- 165 VRs · todos preenchidos (zero `valor_min/max/descricao` simultaneamente vazios).
- 1 exame com VRs — **abrangência muito baixa**, indicando que o cadastro é considerado trabalhoso (UX).
- 0 linhas com `critico_min/max` por faixa.

## Conclusão

- Modelo é **numérico-cêntrico**. Resultados qualitativos não têm faixa estruturada → dependem do parâmetro `Select` + texto livre, sem regra "valor X = alterado".
- Falta uma classificação semântica por faixa (Normal / Limítrofe / Alterado / Crítico).
