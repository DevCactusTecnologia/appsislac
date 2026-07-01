# 12 — Performance & Escala

Simulação teórica com base nos limites arquiteturais atuais.

## Estruturas dimensionadas por tenant

| Estrutura | Limite | Comportamento |
|---|---|---|
| Factory cache (front) | 1 tenant ativo por sessão (SPA) | `currentContext` mutável — troca de tenant no browser destrói/recria |
| `DedicatedStrategy.clientCache` (front) | Cresce com nº de `(url, anon)` distintos vistos na mesma sessão | ~irrelevante em SPA típica |
| Edge functions — cold start | Por função, por região Supabase | Nenhum pool compartilhado entre invocações; cada boot cria client |
| `tenant-runtime-config` latency | 1 lookup em `tenant_registry` por sessão + `Deno.env` | O(1) |
| RLS lookups | `current_tenant_id()` por query | Custa 1 subquery em `profiles` (indexado) |

## Simulação

| Nº de tenants | Shared | Dedicated |
|---|---|---|
| **10** | ✓ Sem stress | △ Requer 10 projetos Supabase provisionados; auth quebra por JWT mismatch |
| **100** | ✓ RLS/índices atendem | ✗ 100 anon keys via env vars — cap de 100 secrets por env do Supabase (documentado em `<build-secrets>`). Já atinge o teto |
| **500** | △ Preocupa `select_options`, `select_options` globais, `profiles` growth | ✗ Estoura cap de secrets. Necessária tabela criptografada / KMS |
| **1000** | △ Requer sharding lógico (particionamento por tenant_id) | ✗ Estrutura não suporta |
| **5000** | ✗ Sem particionamento explícito | ✗ Inviável na arquitetura atual |
| **10000** | ✗ | ✗ |

## Bottlenecks identificados

1. **Cap de 100 secrets por environment** — `db_anon_key_secret_ref` vira uma env var por tenant. Já é bloqueio a partir de 100 tenants dedicated.
2. **Sem TTL no cache do Factory** — irrelevante em SPA, mas se movermos parte para SSR/edge, cache cresce.
3. **`_cachedContext` global em `tenantContext.ts`** — assume 1 tenant por processo. Não serve para servidor multi-tenant simultâneo.
4. **Nenhum warm-up** — 1º acesso paga latência de `tenant-runtime-config`.
5. **`super-admin-list-tenants`** — sem paginação identificada; N tenants = N linhas em resposta.

## Respostas objetivas

- **Cache suporta?** ✓ até ~1 tenant/sessão. ✗ para pool multi-tenant simultâneo.
- **ConnectionFactory suporta?** △ até ~50 tenants ativos no mesmo processo (memória OK). ✗ para 500+ com WS realtime cada.
- **Auth suporta?** ✓ para shared em qualquer escala. ✗ para dedicated (JWT mismatch).
- **Storage suporta?** ✗ Único bucket para todos — vira bottleneck e ponto único de falha.
