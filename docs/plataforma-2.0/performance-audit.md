# Plataforma 2.0 — Fase 11: Performance

## Snapshot de saúde (db_health)

| Métrica | Valor | Status |
|---------|-------|--------|
| Database | up | ✅ |
| PgBouncer | up | ✅ |
| Memória  | 65 % | Atenção (uso moderado-alto) |
| Disco de dados | 17 % | ✅ |
| Conexões | 16/60 | ✅ baixo |
| Pool clients | 1/200 | ✅ |
| Tamanho do banco | 47.4 MB | ✅ |
| WAL | 112 MB | Atenção (WAL > DB — checkpoint pouco frequente) |
| Restarts | 0 | ✅ |
| Rolled-back tx (since boot) | 189 401 | **Atenção** — alto volume de rollbacks |

## Top consultas mais caras (pg_stat_statements)

| # | Query                                                       | Calls | Mean (ms) | Total (ms) |
|---|-------------------------------------------------------------|------:|----------:|-----------:|
| 1 | `SELECT pacientes (todas colunas) ORDER BY nome LIMIT/OFFSET` (PostgREST) | 3 614 | 127.2 | 459 719 |
| 2 | Mesma query, payload sem `nome_social` | 1 988 | 116.6 | 231 861 |
| 3 | `SELECT documento_templates ORDER BY tipo, nome` (PostgREST) | 1 848 | 56.6 | 104 599 |
| 4 | … (cauda menor) | — | — | — |

### Diagnóstico

1. **Pacientes** — 2 236 linhas, lista paginada com `ORDER BY nome` sem índice equivalente. `idx_pacientes_nome_trgm` existe para busca mas não para ORDER BY plano. Oportunidade: índice btree em `(tenant_id, nome)` ou cursor-based pagination. Já existe `usePaginatedPacientes`; verificar se UI atual ainda dispara o list-all.
2. **documento_templates** — 6 linhas, 1 848 calls. Hot cache: lê todas 6 linhas a cada navegação. Solução: caching no cliente / store init único.
3. **Rolled-back transactions** elevadas: 189k desde o boot — provável retentativa por conflito de RLS ou validação. Investigar logs.

## Classificação geral

| Área | Status |
|------|--------|
| RPCs operacionais (`atendimentos_page`, `dashboard_metrics`, `financeiro_a_receber_v2`) | Saudável (cursor + filtros) |
| Listagem `pacientes` via PostgREST | **Atenção** |
| `documento_templates` polling | **Atenção** |
| Views (todas leves) | Saudável |
| Triggers em escrita | Saudável |
| WAL / rollbacks | **Atenção** |

## Conclusão
Saudável para volume atual (47 MB). Dois pontos quentes (pacientes/documento_templates) são oportunidades claras de otimização — **não executadas nesta fase**.
