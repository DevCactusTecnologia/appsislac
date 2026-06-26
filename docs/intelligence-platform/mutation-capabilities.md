# Mutation Capabilities — Estado pós-Hotfix

| Capability | Skill | Tool name | Gate `_confirmed` | Persistência | Status |
|---|---|---|---|---|---|
| `resultado.set_valor` | `resultado.ts` | `resultado_set_valor` | default `true` | `atendimento_exames.resultados` (JSONB) | ✅ validado |
| `resultado.set_varios` | `resultado.ts` | `resultado_set_varios` | default `true` | idem (loop atômico no skill) | ✅ caminho idêntico ao set_valor |
| `paciente.create` | `paciente.ts` | `paciente_create` | default `true` | `pacientes` | ✅ schema e RLS intactos |

## Garantias

- Toda mutação continua escrevendo em `ai_audit` com `intent`, `tool_name`, `input`, `output`, `latency_ms`.
- RLS inalterada — quem não tiver `permite_escrita` recebe `PERMISSION_DENIED` da própria RLS, não silenciosamente.
- Coluna `data_atendimento` (não existia) substituída por `data` em todos os queries das skills.

## Nenhuma mutação silenciosa

O contrato é: `ok:true` → confirmação obrigatória (frase derivada no shell se o LLM não falar). `ok:false` → erro estruturado com `code/message` e o shell exibe texto + voz.
