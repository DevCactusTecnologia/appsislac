# 03 — Database Performance

## Volumes (pg_stat_user_tables)

| Tabela | Rows | Tamanho |
|---|---|---|
| `audit_logs` | 13.474 | 20 MB |
| `operational_audit` | 13.225 | 14 MB |
| `atendimento_audit` | 7.165 | 14 MB |
| `cities` | 5.570 | 344 kB |
| `pacientes` | 2.298 | 744 kB |
| `valores_referencia` | 495 | 112 kB |
| `exames_catalogo` | 441 | 272 kB |
| `atendimento_exames` | 96 | 80 kB |
| `amostras` | 69 | 16 kB |

Total DB: 88.2 MB · WAL: 112 MB · Disk: 19%.

## Índices

- 480 índices no schema `public` (`pg_indexes`).
- 371 `CREATE INDEX` em `supabase/migrations/` (355 migrations).
- 211 triggers PL/pgSQL em `public`.

## Top slow queries (pg_stat_statements)

| # | Query | Calls | Mean (ms) | Total (ms) |
|---|---|---|---|---|
| 1 | `documento_templates` full scan `ORDER BY tipo,nome LIMIT/OFFSET` | 211 | 82.8 | 17.470 |
| 2 | `pacientes` full scan `ORDER BY nome,id LIMIT/OFFSET` | 170 | 100.3 | 17.051 |
| 3 | `pacientes` cursor pagination `WHERE (nome,id) > ...` | 316 | 33.3 | 10.520 |

**Evidência**: paginação por OFFSET ainda ativa em `documento_templates` e `pacientes` (query #1 e #2), coexistindo com cursor pagination (#3, memory `pacienteStore`).

## N+1

- Frontend: 37 stores in-memory (Fase 08). Padrão de fetch em bloco, não item-a-item. Grep não achou loops `await supabase.from(...).select().eq(id)` dentro de `for/map`.
- Edge functions: cada edge usa 1 client por request; loops de fetch em `super-admin-migrate-tenant-data` são por tabela (batelada), não por row.
- **Inconclusivo** para pipelines de laudo em lote (`laudoBatchPdf`).

## RPCs

- 200 funções `public` (Fase 09).
- 37 usos de `.rpc(` em `src/`. Concentração em RPCs `*_tx` (atendimento, pagamento, migração).

## JOINs / Views

- Views: não enumeradas nesta fase.
- JOINs pesados: não amostrados no top-10 slow queries.

## Filtros / Paginação

- `usePaginatedAtendimentos`, `usePaginatedPacientes`, `useResultadosPage` — cursor pagination (memory).
- `documento_templates`: OFFSET puro — evidência de query #1.

## Rolled-back transactions

- `db_health`: **357.919** rollbacks acumulados desde boot. Sem taxa temporal; requer amostragem repetida para julgar.

## Achados

| # | Item | Severidade |
|---|---|---|
| DB01 | `documento_templates` sem cursor pagination — mean 82ms, 211 calls | MÉDIO |
| DB02 | `pacientes` ainda serve query OFFSET legada em paralelo à cursor pagination | BAIXO |
| DB03 | 357k rolled-back txn since boot — taxa desconhecida | INCONCLUSIVO |
| DB04 | Cobertura de índices por policy RLS não validada 1-a-1 | INCONCLUSIVO |
