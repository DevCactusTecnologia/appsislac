# 05 — Skills

## Skills implementadas (3)

### `skills/paciente.ts` — 105 LoC
Tools: `paciente_search`, `paciente_create`, `paciente_exames`.
- Usa `userClient` (RLS aplicada por JWT do usuário). ✅
- Schemas Zod estreitos. ✅
- `paciente_create` é a **única mutação** do domínio e exige `_confirmed: true`. ✅

### `skills/atendimento.ts` — 139 LoC
Tools: `atendimento_count`, `atendimento_summary`. Apenas leitura.
- Mapeamento de período (`hoje`/`semana`/`mes`/`ano`) hardcoded. Aceitável.
- **Não existe `atendimento_open` nem `atendimento_create`** apesar do system prompt mencionar.

### `skills/resultado.ts` — 272 LoC
Tools: `resultado_open`, `resultado_set_valor`, `resultado_set_varios`.
- A skill mais complexa e mais sensível (mutação de resultados).
- `set_valor` e `set_varios` se sobrepõem: `set_varios` é estritamente mais geral.

## Skills declaradas em doc mas inexistentes em código

`docs/intelligence-platform/skill-engine.md` e `architecture-overview.md` prometem:
- soroteca, financeiro, whatsapp, producao, configuracao
- Nenhuma existe. Apenas listadas como categorias em `CapabilityCategory`.

## Sem consumidor direto

Nenhuma Skill é importada fora de `ai-chat/index.ts`. Não há reutilização cruzada — o que é correto para isolamento por domínio.

## Avaliação

- 3 Skills suficientes para o escopo atual.
- `resultado.set_valor` pode ser fundido em `resultado.set_varios` (passar 1 item no array).
- "Skill Engine" como camada abstrata **não existe** — é apenas um `spread` de objetos no `index.ts:38`. Documentação prometeu mais do que código entregou.
