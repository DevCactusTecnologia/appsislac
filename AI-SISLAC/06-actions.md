# 06 — Actions

## Conceito prometido (docs/intelligence-platform/action-engine.md)

"Action Engine" deveria:
- Executar tools mutáveis.
- Aplicar `needsApproval` com UX de confirmação no frontend.
- Gravar auditoria por Action.
- Reusar stores oficiais (`atendimentoStore`, etc.).

## Realidade

- **Não existe Action Engine como módulo**. As "Actions" são apenas o `execute` dentro de cada `tool()` da AI SDK.
- **Confirmação humana não tem UX**: o campo `needsApproval` existe no registry mas o frontend não exibe diálogo de confirmação. A "confirmação" é puramente verbal, instruída via prompt ao LLM ("Confirme apenas ações irreversíveis").
- **Auditoria por Action não existe**: só há 1 INSERT em `ai_audit` por turno do LLM (com `skill: "router"`), não por tool. `ai_audit.skill/capability/action` ficam null/genéricos.
- **Reuso de stores oficiais**: as skills falam direto com `userClient.from(...)` em vez de chamar `atendimentoStore` ou outros — porque estão em Deno, não em React. Aceitável e até mais simples.

## Actions duplicadas / órfãs

- `resultado.set_valor` ⊂ `resultado.set_varios`. Duplicação real.
- `CapabilityActionRef[]` (`actions:` em cada Capability) — estrutura prevista para múltiplas Actions por Capability; sempre tem exatamente 1 elemento. Indireção morta.

## Conclusão

"Action Engine" é vocabulário, não código. O que existe é apenas tool calling do AI SDK, o que basta. A camada de aprovação humana é vaporware.
