# FASE 6 — Maintainability Report

| Pergunta | Resposta | Justificativa |
|---|---|---|
| Novo desenvolvedor entende mais rápido? | ✅ **SIM** | Orchestrators reduzidos; cada tab/serviço tem responsabilidade explícita. Diretório `docs/` com auditorias por módulo serve de onboarding. |
| Responsabilidades ficaram mais claras? | ✅ **SIM** | `FinanceiroContext` centraliza estado compartilhado; `domains/<bounded-context>/services/` isola regras puras; `pages/NovoAtendimento/services/` separa lógica do wizard. |
| Domínios ficaram mais coesos? | ✅ **SIM** | Estrutura `src/domains/{appointment,result,finance,patient,exam,auth,tenant,notification}/{repositories,services,types,validators}` adotada. `result` e `appointment` já populados; demais aguardam migração. |
| Menos risco de duplicação? | ✅ **SIM** | 14 helpers críticos foram unificados (ver SSOT report). Hooks `useDicionario` e `useRealtimeChannel` previnem novas cópias. |
| Menos risco de regressão? | ✅ **SIM** | Testes unitários em `buildExamesCobranca.test.ts` e `pricing.test.ts`; lógica pura agora testável; `recompute_atendimento_status` no DB elimina drift entre clientes. |

## Sinais positivos adicionais

- **Convenções escritas**: `docs/governance/module-structure-standard.md`, `docs/ENGINEERING_RULES.md`, `docs/IA_ARCHITECTURE_RULES.md`.
- **Memory rules**: convenções de queryKey, dicionários globais, dialog standard, etc., todas registradas e aplicáveis sem leitura prévia.
- **Defesa em profundidade**: RBAC tanto no front quanto em edge functions; RLS em todas as tabelas com policies tenant-scoped.
- **Guardrails de CI**: `scripts/check-file-size.sh` e `scripts/check-no-mocks.sh`.

## Sinais ainda a endereçar

- `NovoAtendimento.tsx` e `ResultadoDetalhe.tsx` continuam grandes — onboarding nessas telas ainda exige tempo.
- Pastas `src/domains/{patient,exam,finance,notification,patient,tenant,auth}` ainda têm apenas `.gitkeep` — esqueleto pronto, conteúdo a migrar incrementalmente.

## Veredito Fase 6

✅ **Manutenibilidade melhorada de forma clara e mensurável** nos 5 eixos avaliados. O sistema hoje é mais legível, mais testável e mais difícil de regredir do que antes do programa.
