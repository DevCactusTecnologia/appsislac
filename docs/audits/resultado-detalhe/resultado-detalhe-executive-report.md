# ResultadoDetalhe — Executive Report
> Audit date: 2025-07 | Read-only audit | Scope: `src/pages/ResultadoDetalhe.tsx` + helpers + RPCs

## 1. How it really works

```
Atendimento → atendimento_exames (1:N) → exame_parametros (template) →
  edição em ParamTypedInput → autosave (debounce) → RPC salvar_resultado_param →
  validação clínica (limites por sexo/idade via valores_referencia + reguasEtariasStore) →
  liberação individual ou em lote → assinatura digital (analista + senha validada por validarCredenciaisAnalista) →
  status: pendente → digitado → validado → liberado →
  geração PDF (laudoTemplate + laudoLayout, layout travado conforme constraint) →
  consulta via Resultados / Portal do paciente / shortlink /p/:codigo
```

Evidências: `src/pages/ResultadoDetalhe.tsx:1–2619`, `src/pages/ResultadoDetalhe/helpers.ts`, `src/lib/laudoTemplate.ts`, `src/lib/criticoChecker.ts`, `src/lib/validarCredenciaisAnalista.ts`.

## 2. Riscos consolidados

| ID | Severidade | Evidência | Resumo |
|----|------------|-----------|--------|
| R1 | 🔴 P0 | `ResultadoDetalhe.tsx:629–677` | Liberação em lote pode pular checagem de valores críticos / autosave pendente |
| R2 | 🟠 P1 | `ResultadoDetalhe.tsx` autosave | Janela entre digitação e persistência permite perda em refresh |
| R3 | 🟠 P1 | layout travado em CSS de impressão | Mudanças exigem aprovação explícita (constraint registrada) |
| R4 | 🟡 P2 | monolito 2.619 LOC | Manutenção difícil; risco operacional médio |
| R5 | 🟢 baixo | RLS + RPC | Cross-tenant bloqueado em todas as operações inspecionadas |

## 3. Veredito

- **Lógica correta:** ✅ Sim, regras clínicas e de status corretas.
- **Seguro:** ✅ Multi-tenant via RLS + assinatura validada por senha real do analista.
- **Risco clínico:** 🟠 Médio — R1 (bypass crítico em lote) requer hardening antes de alto volume.
- **Pronto para produção:** ✅ com mitigação de R1.

## 4. Classificação

**Production Ready — Needs Hardening (R1, R2).**
