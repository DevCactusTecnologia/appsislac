# 04 — Capability Registry

`supabase/functions/_shared/registry.ts` declara **8 Capabilities**.

| ID | Tool | Skill | Usada pelo LLM? | Usada como Quick Action? | Status |
|---|---|---|---|---|---|
| `paciente.search` | `paciente_search` | paciente | Sim | Marcada `quickAction:true` — **mas Quick Actions UI não existe** | Parcial |
| `paciente.create` | `paciente_create` | paciente | Sim (needsApproval) | idem | Parcial |
| `paciente.exames` | `paciente_exames` | paciente | Sim | Não | OK |
| `atendimento.count` | `atendimento_count` | atendimento | Sim | Não | OK |
| `atendimento.summary` | `atendimento_summary` | atendimento | Sim | Não | OK |
| `resultado.open` | `resultado_open` | resultado | Sim | Não | OK |
| `resultado.set_valor` | `resultado_set_valor` | resultado | Sim (needsApproval) | Não | OK |
| `resultado.set_varios` | `resultado_set_varios` | resultado | Sim (needsApproval) | Não | OK |

## Órfãos

- **Manifest público inteiro**: `ai-manifest` entrega `Manifest` com `quickAction`, `supportsSuggestions`, `promptTemplate`, `priority`, `color`, `icon` — nada disso é renderizado em UI. Custo morto.
- **`quickAction:true`** em duas Capabilities: zero efeito visível.
- **`supportsSuggestions:true`** em várias: `getContextualSuggestions` existe mas não é chamado.
- **`needsApproval`**: campo declarado no servidor; nenhum UX de confirmação (toast de confirmação) está implementado. O system prompt apenas pede ao LLM que confirme verbalmente.

## Duplicações

- A coluna "Action" da `CapabilityMeta` aponta para a mesma string do `id` em todos os casos. A indireção `actions: CapabilityActionRef[]` foi prevista para fan-out (1 Capability → N Actions), mas nunca aconteceu. Estrutura desnecessária.
- `findCapability()` em `registry.ts:223` — nenhum consumidor.

## Conclusão

Das 8 Capabilities, **todas são usadas pelo LLM**. Da estrutura de Manifest (priority/color/icon/quickAction/baselineSeconds/baselineClicks), **nada é consumido**. ~60% do `registry.ts` é metadado morto.
