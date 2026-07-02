# 11 — Scalability Analysis

## Evidência de gargalos por eixo

| Eixo | Evidência | Status |
|---|---|---|
| **CPU (DB)** | `db_health`: não expõe %CPU. Não medível diretamente. | INCONCLUSIVO |
| **Memória (DB)** | 67% usado (`db_health`) | ATENÇÃO |
| **Rede** | Sem métrica. Egress Storage não medido. | INCONCLUSIVO |
| **Banco — conexões** | 16/60, pool 1/200 | FOLGA |
| **Banco — disco** | 19% (88 MB / plano atual) | FOLGA |
| **Banco — WAL** | 112 MB | NORMAL |
| **Banco — queries** | Top-3 slow > 10s cumulativo; `documento_templates` OFFSET pesa | GARGALO EMERGENTE |
| **Banco — rollbacks** | 357.919 desde boot; taxa desconhecida | INCONCLUSIVO |
| **Storage** | 8 buckets, sem métrica de throughput | INCONCLUSIVO |
| **Supabase Auth** | Sem métrica de sign-in rate | INCONCLUSIVO |
| **Frontend — bundle** | Lazy loading ativo (83 lazy, 69 Suspense); arquivos 100KB+ existentes | ATENÇÃO |
| **Frontend — memória** | 37 stores in-memory acumulados no browser | ATENÇÃO |
| **Backend — edges** | Escala automática, cold start não medido | INCONCLUSIVO |

## Gargalos concretos (com evidência)

1. **Memória DB 67%** — sem picos medidos; margem estreita.
2. **`documento_templates` OFFSET pagination** — 82ms mean, 211 calls; escala linear ruim.
3. **Rate-limit in-memory** — bypass por concorrência (repetido de Fase 09).

## Gargalos potenciais (sem prova)

- Realtime publication única.
- Bundle > 100KB em rota crítica.
- Tabelas hot (`audit_logs`, `operational_audit`) sem particionamento.

## Achados

| # | Item | Severidade |
|---|---|---|
| SCA01 | Memória DB 67% — margem estreita | MÉDIO |
| SCA02 | `documento_templates` sem cursor pagination | MÉDIO |
| SCA03 | Rollbacks acumulados 357k — taxa desconhecida | INCONCLUSIVO |
| SCA04 | Nenhuma métrica de throughput real coletada | INCONCLUSIVO |
