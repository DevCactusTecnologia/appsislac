# 07 — Optional Improvements

Fora do plano mínimo. Só entram após produção estável.

| ID | Origem | Motivo de ser opcional |
|---|---|---|
| O1 | F-FE-01 (dualidade stores/TanStack) | MONITORAR; funciona hoje |
| O2 | F-FE-02 (framework forms) | MONITORAR; validação inline suficiente |
| O3 | F-BE-01 (60/74 edges fora do edgeBoot) | MONITORAR; hardening incremental |
| O4 | F-INT-01 (DLQ formal IA/PIX) | MONITORAR; circuit breaker já cobre |
| O5 | F-RT-01 (ativação massiva runtime dedicated) | Só sob demanda comercial |
| O6 | F-SCALE-01 (load test >100 tenants) | Executar quando pipeline comercial exigir |
| O7 | F-PERF-03 (357k rollbacks) | Métrica ambiente; monitorar |
| O8 | F-SEC-09 (retenção CFM 20a technical enforcement) | MONITORAR jurídico |
| O9 | F-SEC-12 (espelhar auth logs GoTrue) | MONITORAR |
| O10 | F-SEC-13 (hash-chain WORM) | BAIXO |

Nenhum item opcional deve ser puxado para o plano mínimo.
