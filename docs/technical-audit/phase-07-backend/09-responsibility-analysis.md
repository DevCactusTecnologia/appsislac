# 09 — Análise de Responsabilidade (SRP)

## Edge Functions
- **74 funções analisadas.**
- Nome = ação → responsabilidade única na esmagadora maioria (72/74 ≈ 97%).
- Exceções:
  - `integration-jobs-runner` — orquestra claim + dispatch + logging (multi-responsabilidade justificada pelo papel de scheduler).
  - `super-admin-migrate-tenant-data` — combina export + transform + load (natural do pipeline de migração).

## RPCs
- **221 funções**, sufixos padronizam responsabilidade:
  - `_tx` → transação de domínio.
  - `_page/_kpis` → leitura paginada.
  - `audit_*` → trigger de auditoria.
  - `circuit_*` → engine breaker.
  - `is_/has_/current_*` → contexto de segurança.
- Auditoria confirma: cada RPC executa **uma ação canônica**; nenhuma RPC combina domínios distintos.

## Pipelines
| Pipeline | Responsabilidade única? |
|---|---|
| Integração (`runPipeline`) | ✅ Executar 1 job, aplicar circuit+retry+DLQ |
| Migração | ✅ Cada fase é uma edge function isolada |
| IA | ✅ 1 edge por modalidade (chat/voz/vision) |
| Financeiro | ✅ RPCs atômicas |
| PDF | ✅ Cada edge trata 1 tipo (upload, resolve, url) |

## Módulos `_shared`
- `pipeline.ts` — pipeline execution only.
- `circuit.ts`, `dlq.ts`, `health.ts` — cada arquivo cobre 1 preocupação.
- `runtime/createClient.ts` — chokepoint.
- `runtime/db.ts` — resolução de client (4 helpers, sem lógica de domínio).
- `edgeBoot.ts` — bootstrap (CORS + auth + tenant + logger).

## Score
| Camada | SRP |
|---|---|
| Edge Functions | 97% |
| RPCs | ~99% |
| Pipelines | 100% |
| Shared modules | 100% |
