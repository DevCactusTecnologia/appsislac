# Results Pipeline — Validação ponta a ponta

## Trilha completa (texto)

| Etapa | Status | Evidência |
|---|---|---|
| Intent ("registre 4,5 em Hemácias") | ✅ | LLM gera `tool-input-*` para `resultado_set_valor` |
| Tool call params | ✅ | `{paciente:"Olivia", exame:"Hemograma", parametro:"Hemácias", valor:"4,5", _confirmed:true}` |
| Skill execute | ✅ | Resolve paciente, atendimento (`data` ordenação) e parâmetro (`HEMACI`) |
| UPDATE atendimento_exames.resultados | ✅ | `resultados->>'HEMACI' = '4,5'` (psql confirma) |
| Navegação | ✅ | `navigate: "/resultado/5"` |
| Confirmação | ✅ | "Pronto, gravei 4,5 em Hemácias." |

## Bugs eliminados

1. `_confirmed default=false` + early-return `NEEDS_APPROVAL` → mutação silenciosa.
2. `order("data_atendimento")` → coluna inexistente → `INTERNAL` mesmo com tool call correto.
3. Modelo não chamava tool → trocado para `gemini-2.5-flash`.

## Set vários

Mesma trilha que `set_valor`, aceita `valores: [{parametro, valor}, ...]`. Não testado em produção neste hotfix mas a correção é idêntica (mesmo gate, mesma coluna).
