# 08 — Shared → Dedicated: Escala

## Modelo

- Shared: 116/119 tabelas com `tenant_id NOT NULL`, RLS uniforme.
- Dedicated: `tenant_registry.runtime_mode='isolated_db'` + secrets `SB_SERVICE_ROLE_<ref>` por tenant.

## Evidência empírica

- 1 tenant migrado com sucesso para dedicated (contexto anterior).
- 66 rows em `tenant_migration_runs` — trilhas de migração.

## Capacidade

### 10 tenants — VIÁVEL
- DB atual: 88 MB, 60 conexões. Folga ampla.
- Edges: sem limite prático.

### 100 tenants — VIÁVEL COM CAVEATS
- `audit_logs` já 13k rows com poucos tenants ativos. Extrapolação linear = ~130k+.
- Rate-limit in-memory começa a divergir (Fase 09).
- 60 conexões DB Cloud plano atual → 60 conexões / 100 tenants = 0.6/tenant. Requer pool tuning.

### 500 tenants — INCONCLUSIVO / EXIGE DEDICATED
- Runtime dedicated existe mas sem evidência de teste em larga escala.
- Storage: buckets únicos particionados por prefixo — enumeração/listagem se degrada.
- `documento_templates` slow query (17s total, 211 calls) escala linear com tenants — sem cursor pagination.

### 1000 tenants — SEM EVIDÊNCIA
- Nenhum load test documentado.
- Governance de secrets por tenant (`SB_SERVICE_ROLE_<ref>` × 1000) não tem procedimento automatizado.
- Realtime publication única — 1000 tenants compartilham throughput.

## Chokepoints identificados

| Item | Limite prático |
|---|---|
| Conexões Postgres (60 atual) | Escala vertical do plano Cloud |
| Realtime publication única | Cloud-managed; sem shard por tenant |
| `whatsapp_outbox` sem partition | Fila única cross-tenant |
| `audit_logs` sem particionamento | Crescimento linear composto |

## Achados

| # | Item | Severidade |
|---|---|---|
| SC01 | 10 tenants suportado (evidência) | INFORMATIVO |
| SC02 | 100 tenants requer tuning de pool + paginação `documento_templates` | ALTO |
| SC03 | 500/1000 tenants sem evidência de load test | INCONCLUSIVO |
| SC04 | Sem particionamento de tabelas hot (audit_logs, whatsapp_outbox) | ALTO |
