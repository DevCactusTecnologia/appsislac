# Auditoria de UX — Cadastro de Valores de Referência

## Fluxo atual

1. Catálogo de exames → "Ver detalhes" → aba **Valores de referência**.
2. Três sub-abas: **Filtro** (lista plana), **Matriz** (sexo × faixa etária), **Lista** (CRUD linha a linha).
3. Botões de ação à direita: "Gerenciar réguas", "Adicionar", "Salvar/Fechar".

## Avaliação "30 segundos"

Um biomédico **não** consegue entender a tela em menos de 30 segundos. Motivos:

| Problema | Onde |
|---|---|
| 3 modos visuais distintos para o mesmo dado (Filtro/Matriz/Lista) sem indicação de qual é canônico. | `FiltrosDialog.tsx` |
| "Régua etária" é um conceito novo, sem onboarding/tooltip. | `MatrizValoresReferencia.tsx` |
| Campos `idadeMin/Max` aceitam string em diferentes unidades — risco de erro silencioso. | mesmo |
| Texto "p/ laudo" é opcional e sobrescreve min–max sem aviso de prioridade. | `MatrizValoresReferencia.tsx` linha 17–26 |
| Crítico/pânico vive em **2 lugares** (ParâmetrosDialog × célula da matriz). | confusão |
| `exame_parametros.valor_referencia` (texto livre) existe e pode aparecer no laudo, **mas não tem campo visível na matriz**. | ambiguidade |
| Sem barra de cobertura agregada por exame (só por sexo). | falta visão macro |

## Campos que geram dúvida

- `unidade_idade` quando a régua já está em dias.
- `descricao` vs `valor_min/valor_max`.
- Sexo "Ambos" não aparece na matriz (que só tem M e F), mas pode existir nos dados.

## Campos que poderiam desaparecer / ficar escondidos

- `qtd_caracteres`, `exibir_anterior`, `obrigatorio` em ParametrosDialog (legado).
- `valor_referencia` (texto livre por parâmetro) — substituível por `descricao` na matriz.

## Campos que deveriam ser automáticos

- `unidade` → herdada do parâmetro (já é feito em parte, mas pode ser readonly).
- `unidade_idade` → fixo em **dias** internamente.
- `descricao` default ("Masculino • 12a+") já é gerado, mas exposto ao usuário como se fosse texto editável.
