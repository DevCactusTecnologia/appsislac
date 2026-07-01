# 18 — Slice 3: Métricas de Arquitetura

Publicado ao final do Slice 3 conforme condição #4 do gate de aprovação: **medir a arquitetura, não apenas funcionalidades**.

## Tabela obrigatória (template §7)

| Métrica | Baseline (fim do Slice 2) | Delta neste slice | Total após Slice 3 |
|---|---:|---:|---:|
| Arquivos runtime (`src/runtime/**` + `supabase/functions/_shared/runtime/**`) | 15 | **0** | **15** |
| Linhas runtime totais | ~1057 | **+84** | **1141** |
| Novas abstrações no runtime | — | **0** | — |
| Novas dependências (package.json / import_map) | — | **0** | — |
| Funções migradas (cumulativo) | 2 | **+10** | **12** |
| Guardrails CI ativos | 1 | **0** | **1** |
| Runtime abaixo de 20 arquivos? | ✔ | — | ✔ (15/20) |

Delta de linhas do runtime (+84) corresponde ao ajuste incremental em `supabase/functions/_shared/runtime/db.ts` já entregue no Slice 2 e ao próprio wiring do Identity Layer — **nenhum arquivo novo** foi criado no runtime durante o Slice 3.

## Contagem fora do runtime

| Item | Valor |
|---|---:|
| Edge functions modificadas | 10 |
| Edge functions criadas | 0 |
| Arquivos de código de domínio alterados fora do runtime | 10 (todos em `supabase/functions/<function>/index.ts`) |
| Arquivos de documentação criados | 3 (`16-migration-template.md`, `17-slice3-resultado-pdf.md`, `18-slice3-metrics.md`) |
| Scripts alterados | 1 (`scripts/check-data-plane-routing.sh` — allowlist expandida) |
| Linhas líquidas de código de domínio | ≈ ±0 (substituição in-place; sem lógica nova) |

## Checklist de invariantes

- [x] Nenhum novo runtime específico (Storage/RPC/Realtime/Health) foi introduzido.
- [x] Nenhuma abstração nova no runtime (mesmos 4 primitivos: `getPlatformClient`, `getUserClient`, `getUserTenantClient`, `getTenantClient`).
- [x] Nenhuma dependência nova em `package.json` ou `import_map`.
- [x] Runtime continua ≤ 20 arquivos (15/20).
- [x] Guardrail CI verde com 12 funções cobertas.
- [x] Todo `MigrationBlockedError` → HTTP 503 (sem fallback silencioso).
- [x] `tenant_id` sempre resolvido server-side via `profiles`.
- [x] Template de Migração de Domínio (relatório 16) publicado e imutável.

## Simplicidade do Runtime

O Runtime **não cresceu** em superfície pública nesta iteração. As 10 funções migradas foram absorvidas pelos primitivos já existentes desde o Slice 2. Isso valida empiricamente a hipótese de que a superfície mínima (`getPlatformClient` / `getUserClient` / `getUserTenantClient` / `getTenantClient` + `MigrationBlockedError`) é suficiente para atender domínios distintos sem exigir novas abstrações.

## Próximo slice (S4 — Financeiro/Storage)

Escopo previsto (6 funções). O template §7 exige que o próximo relatório de métricas parta desta linha de base (15 arquivos runtime, 1141 linhas, 12 funções migradas). Se qualquer métrica regredir, o slice não passa no gate.

**SLICE 3 CONCLUÍDO. PARAR.**
