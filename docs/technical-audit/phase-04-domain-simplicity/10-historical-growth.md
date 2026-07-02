# 10 — Historical Growth

Evidências de crescimento incremental (sem concluir, sem propor remoção).

| Sinal | Evidência |
|---|---|
| Refatorações versionadas em nome de pasta | `docs/plataforma-2.0`, `2.1`, `plataforma-3.0-migracao`, `valores-referencia-2.0`, `database-runtime/forensic-review`, `surgery`, `technical-audit/phase-0X` |
| Runtime dedicated com dead code reconhecido | `database-runtime/forensic-review/06-dead-code.md`, `08-complexity-report.md` marca `src/runtime/db/*` e `identity/*` como "NÃO indispensável" |
| Duas gerações de auth (Login vs LoginV2) | `LoginV2.tsx` com sufixo LAB fixado (mem) |
| Document Engine renomeado em fases (Print Engine → Document Engine 3.0) | `docs/PRINT-ENGINE/*` + `docs/DOCUMENT-ENGINE/*` |
| Múltiplas rodadas de auditoria de VR | `docs/valores-referencia-2.0/*` (14 relatórios) |
| Convênio Particular = ID 0 | Convenção herdada mantida por compatibilidade |
| Coluna `runtime_dedicated_enabled`, `db_provider` sem leitores ativos | Fase Forensic |
| Coexistência de `runtime/db.ts` (usado) e `src/runtime/db/*` factory (não usado) | Fase Forensic 08 |
| Edge `tenant-resolve` duplica `tenant-runtime-config` | Fase Forensic 08 |
| 355 migrations acumuladas | Fase 01 |
| `AI-SISLAC` com múltiplos executive/final reports | Consolidações iterativas |
| Mem constraint "layout impressão travado" | Reação a alterações anteriores indesejadas |
| Sequência de "cleanup" já executada (Cleanup 1.0 / 1.1) | Histórico do próprio agente |

Não há classificação de "supérfluo" atribuída aqui — apenas o registro de que o produto passou por múltiplas ondas de consolidação e ainda carrega superfícies reconhecidamente dormentes na camada runtime dedicated.
