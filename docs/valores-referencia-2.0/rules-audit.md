# Auditoria de Regras — Valores de Referência 2.0

## Regras realmente aplicadas hoje

| Regra | Onde vive | Influencia resultado? |
|---|---|---|
| **Sexo** (M/F/Ambos) | `valores_referencia.sexo` | Sim — `resolverReferencia()` em `valoresReferenciaStore.ts`. |
| **Idade** (min/max + unidade) | `valores_referencia.idade_min/max/unidade_idade` | Sim — converte para anos e filtra candidatos. |
| **Crítico/pânico global** | `exame_parametros.critico_min/max` | Sim — `criticoPipeline.avaliarNivelCriticoPure`. |
| **Crítico/pânico por sexo/idade** | `valores_referencia.critico_min/max` | Implementado, **0 dados** → na prática sempre fallback global. |
| **Texto descritivo da faixa** | `valores_referencia.descricao` (ou `exame_parametros.valor_referencia` legado) | Sim — entra no laudo via `##REF_x##`. |

## Regras citadas no escopo que **NÃO** existem hoje

- Gestante — não há flag/coluna.
- Material — `exames_catalogo.recipiente` existe mas não filtra VR.
- Método/Equipamento — não há vínculo entre VR e método/equipamento.
- Convênio — não há vínculo entre VR e convênio.
- Unidade (unidade do laboratório) — `unidades` não é parâmetro de VR.

Conclusão: **5 das 9 regras** citadas no briefing existem apenas como ideia; quem usa o módulo trabalha hoje só com **sexo + idade + crítico**.

## Conflitos / prioridade

`resolverReferencia()` aplica score:
1. Sexo exato +2; "Ambos" +1.
2. Idade dentro da faixa +3 (senão descarta).
3. Maior score vence. Empate: primeiro encontrado.
4. Fallback: primeiro com sexo "Ambos".

Conflitos só ocorrem quando o usuário cadastra duas linhas igualmente válidas; o sistema escolhe a **primeira na ordem de leitura** — não há aviso na UI.

## Regras "que sempre existiram" sem necessidade

- Campo `unidade_idade` quando os dados poderiam ser normalizados em **dias** (como já é feito em `idadeFaixas.toDias`).
- Texto livre `valor_referencia` em `exame_parametros` permanece após introdução da matriz estruturada.
