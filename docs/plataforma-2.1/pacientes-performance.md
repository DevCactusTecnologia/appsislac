# Plataforma 2.1 — Fase 4: Performance da listagem de Pacientes

## Diagnóstico (pg_stat_statements)

| # | Query | Calls | Mean (ms) | Total (ms) |
|---|-------|------:|----------:|-----------:|
| 1 | `SELECT pacientes (*) ORDER BY nome LIMIT/OFFSET` | 3 614 | 127,2 | 459 719 |
| 2 | Mesma, payload diferente | 1 988 | 116,6 | 231 861 |

## Análise de índices existentes

```
idx_pacientes_nome           btree (nome)                — único tenant ignorado
idx_pacientes_nome_trgm      gin (lower(nome) trgm)      — busca, não ORDER BY
idx_pacientes_tenant         btree (tenant_id)
idx_pacientes_tenant_cpf     btree (tenant_id, cpf)
idx_pacientes_tenant_created btree (tenant_id, created_at DESC)
idx_pacientes_tenant_nome    btree (tenant_id, lower(nome))   ← NÃO casa com ORDER BY nome
idx_pacientes_tenant_status  btree (tenant_id, status)
```

Causa raiz: PostgREST emite `ORDER BY nome` (sem `lower()`), portanto o planner não usa `idx_pacientes_tenant_nome`. Sem índice composto direto, o plano vira **bitmap heap + sort** sobre todo o subset do tenant.

## Ação implementada

```sql
CREATE INDEX IF NOT EXISTS idx_pacientes_tenant_nome_asc
  ON public.pacientes (tenant_id, nome);
```

Ganho esperado: `Index Scan` ordenado direto, eliminando o `Sort` em memória. Para 2 236 linhas e crescimento esperado (multi-tenant), o ganho será linear com o nº de pacientes por tenant.

## Não implementado nesta fase

- Cursor-based pagination (`usePaginatedPacientes` já existe; UI continua usando `.range()`).
- Trocar `select(*)` por projeção SLIM — exigiria revisão da UI; fica para futura iteração funcional.

## Resultado

- 1 índice criado, custo de escrita marginal (cadastro de paciente é evento humano, baixa frequência).
- Sem regressão; índice é `IF NOT EXISTS`.
