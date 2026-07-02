# 14 — Source Code Score

Pontuação puramente descritiva por eixo. Escala 0–10.

## Eixos

| Eixo | Nota | Evidência |
| ---- | ---: | --------- |
| Modularização | 8 | 21 subdiretórios em `components/`, 41 stores por entidade, drivers de provider isolados, edge functions atômicas. |
| Coesão de diretórios | 7 | Diretórios de escopo estreito (contexts, runtime, domains) com máxima coesão; `src/lib/` e raiz de `src/components/` concentram muitos arquivos flats. |
| SRP (arquivo) | 8 | Majoritariamente SIM; PARCIAL em páginas orquestradoras e engine de laudo. |
| Nomenclatura | 9 | Convenções uniformes (`*Store.ts`, `use*.ts`, `super-admin-*`, `integration-*`, `lab-apoio-*`). |
| Testes | 4 | Cobertura pontual; 1 spec E2E, poucos `.test.ts` unitários, 1 teste SQL. |
| Documentação | 8 | 112 arquivos `.md` em 9 subdiretórios; múltiplas iterações de auditoria formal. |
| Consistência de runtime | 8 | Chokepoints únicos (`runtime/db.ts` no cliente, `_shared/runtime/createClient.ts` no server). |
| Isolamento de camadas | 6 | Stores misturam I/O + cache + realtime; dialogs orquestram store calls diretamente. |
| Duplicidade | 7 | Uma sobreposição notável (`domains/appointment/services/pricing.ts` × `lib/pricing/pricingEngine.ts`); duas landings coexistem (`Landing.tsx`, `LandingPageResponsive.tsx`). |
| Governança de configuração | 8 | Guards em CI (`scripts/check-*`), file-size allowlist, runtime freeze rules em `docs/database-runtime/surgery/11-core-freeze-rules.md`. |

## Nota agregada

Média aritmética simples dos 10 eixos: **7.3/10** — organização coerente com pontos localizados de heterogeneidade (libs raiz, testes).

## Considerações objetivas

- 168.829 LOC totais.
- 78 páginas, 41 stores, 74 edge functions, 355 migrations.
- Facades centrais operacionais tanto no cliente (`runtime/db.ts`) quanto no server (`_shared/runtime/db.ts`).
