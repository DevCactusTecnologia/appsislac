# SISLAC — Simplification Master Plan (Coremas Inspired)

> **Status:** Plano executivo. **NÃO** altera código, banco, migrations ou telas.
> **Inspiração:** Coremas (Laravel/Sentinel, monolito single-tenant) — usado como espelho de simplicidade, NÃO como destino.
> **Objetivo:** Reduzir complexidade acidental do SISLAC preservando 100% das capacidades SaaS (multi-tenant, RLS, RBAC, portal, WhatsApp, super admin).

---

## 1. Premissas inalteráveis

| Capacidade | Status | Justificativa |
|---|---|---|
| Multi-tenant + RLS | **Preservar** | Diferencial SaaS — Coremas não tem |
| RBAC (`has_permission`, `has_role`) | **Preservar** | Segurança crítica |
| Super Admin via edge functions | **Preservar** | Boundary de plataforma |
| Portal do Paciente | **Preservar** | Receita / diferencial |
| WhatsApp / Z-API | **Preservar** | Operacional crítico |
| Integrações terceirizadas | **Preservar** | DBSync, Hermes-Pardini |
| Auditoria operacional | **Preservar** | Compliance |
| Regras clínicas (críticos, refs, validação) | **Congeladas** | Risco assistencial |
| Regras financeiras (pagamentos, faturas) | **Congeladas** | Risco contábil |

---

## 2. Diagnóstico (resumo das auditorias)

```text
Funcional?          SIM
Arquiteturalmente correto p/ SaaS?  SIM
Precisa reescrever?  NÃO

Problemas reais:
  - Status de atendimento derivado em 5+ lugares
  - Regras de parâmetro de exame em 4+ arquivos
  - 30+ stores Zustand (várias derivam de outras)
  - 10 tabelas de auditoria (sobrepostas)
  - 5 tabelas de dicionário (motivos_*, tipos_*, formas_*)
  - Helpers de formatação reimplementados em N componentes
  - Edge functions com responsabilidade difusa
```

Complexidade essencial estimada: **~75%** do código atual.
Complexidade acidental removível: **~25%** sem perda funcional.

---

## 3. Fases (ordem recomendada por ROI/risco)

| # | Fase | Risco | ROI | Prazo sugerido | Doc detalhado |
|---|---|---|---|---|---|
| 1 | Auditoria essencial vs acidental | — | — | 1 sprint | `essential-vs-accidental-complexity.md` |
| 2 | SSOT `deriveAtendimentoStatus` | Baixo | Alto | 1 sprint | (este doc, §4) |
| 3 | SSOT `ParameterRulesService` | Baixo | Alto | 1 sprint | (este doc, §5) |
| 4 | `src/lib/format.ts` consolidado | Muito baixo | Médio | 0.5 sprint | (este doc, §11) |
| 5 | Domain services (`src/domains/*`) | Médio | Alto | 3 sprints | `domain-services-plan.md` |
| 6 | Store reduction | Médio | Médio | 2 sprints | `store-reduction-plan.md` |
| 7 | Realtime reduction | Baixo | Médio | 1 sprint | `realtime-reduction-plan.md` |
| 8 | Consolidação `select_options` | Baixo | Médio | 1 sprint | `database-consolidation-plan.md` |
| 9 | Audit consolidation | Médio | Médio | 2 sprints | `audit-consolidation-plan.md` |
| 10 | Edge function consolidation | Médio | Baixo | 2 sprints | `edge-function-consolidation-plan.md` |

**Total estimado:** ~14 sprints (3,5 meses) — execução incremental, zero big-bang.

---

## 4. SSOT — Status de Atendimento

**Problema:** status derivado em `atendimentoStore`, `Resultados.tsx`, `Financeiro/helpers.ts`, `Dashboard.tsx`, `ConsultarResultados.tsx`.

**Solução proposta:**

```ts
// src/lib/atendimentoStatus.ts
export type AtendimentoStatus =
  | "aguardando_coleta"
  | "em_coleta"
  | "em_analise"
  | "parcialmente_liberado"
  | "liberado"
  | "cancelado";

export function deriveAtendimentoStatus(at: AtendimentoLike): AtendimentoStatus { ... }
```

**Regras:**
- Lint custom proibindo `if (atendimento.status === ...)` fora de `src/lib/atendimentoStatus.ts`.
- Toda tela importa `deriveAtendimentoStatus`.
- Stores **não** recalculam — apenas armazenam dados crus.

---

## 5. SSOT — Parâmetros de Exame

**Inspiração:** trait `new_parameter` do Coremas centraliza máscara/obrigatório/crítico.

**Hoje (Lovable):**
- `exame_parametros` (DB)
- `valores_referencia` (DB)
- `criticoChecker.ts`
- `parseValorReferencia.ts`
- `ResultadoDetalhe/ParamTypedInput.tsx` (regras de input)
- `ResultadoValidationBar` (regras de UI)

**Proposta:**

```ts
// src/domains/exam/services/ParameterRulesService.ts
export interface ParameterRules {
  mask: InputMask;
  required: boolean;
  critical: { min?: number; max?: number };
  type: "numeric" | "text" | "select";
  decimals: number;
  reference: ReferenceBand[];
  validate(value: string): ValidationResult;
}

export function getParameterRules(
  exameId: string,
  paramId: string,
  ctx: { sexo: Sexo; idadeMeses: number }
): ParameterRules;
```

**Consumidores migrados:** input, validation bar, PDF placeholder resolver, critico audit.

---

## 6 – 10. Demais fases

Ver documentos dedicados:
- `database-consolidation-plan.md`
- `store-reduction-plan.md`
- `realtime-reduction-plan.md`
- `edge-function-consolidation-plan.md`
- `domain-services-plan.md`
- `audit-consolidation-plan.md`
- `coremas-lessons-applied.md`

---

## 11. `src/lib/format.ts`

**Centralizar:** `formatCPF`, `formatCNPJ`, `formatTelefone`, `formatIdade`, `formatData`, `formatHora`, `formatMoeda`, `formatPercentual`.

**Regra:** ESLint custom — proibir `Intl.NumberFormat`, `toLocaleString`, `replace(/\D/g,...)` fora de `src/lib/format.ts`.

---

## 12. Governança (delta em `docs/ENGINEERING_RULES.md`)

Adicionar:

1. **Uma regra de negócio = uma implementação.** Violação → ADR obrigatório.
2. **Nenhuma store nova sem justificativa** documentada em `state-governance.md`.
3. **Nenhum realtime sem valor de negócio mensurável** (refetch é o default).
4. **Nenhuma Edge Function sem dono** (CODEOWNERS + propósito em header).
5. **Toda entidade principal possui domínio** em `src/domains/<entidade>/`.

---

## 13. Métricas de sucesso

| Métrica | Hoje (est.) | Meta |
|---|---|---|
| LOC frontend | ~95k | ~75k (-21%) |
| Stores Zustand | ~30 | ~18 (-40%) |
| Tabelas audit | 10 | 2 |
| Tabelas dicionário | 5 | 1 |
| Locais com derivação de status | 5+ | 1 |
| Canais realtime ativos | ~6 | ~3 |
| Edge functions | ~40 | ~30 |
| Helpers de formatação duplicados | N | 0 |

---

## 14. Regra de parada

Este plano **NÃO autoriza** alteração de código.
Cada fase exige aprovação explícita antes de execução.
Rollback strategy obrigatória por fase (feature flag onde aplicável).
