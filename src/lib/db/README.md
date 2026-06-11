# Camada `db.*` — Preparação para Multi-Database

Esta pasta introduz uma **camada de abstração de dados** opcional, criada
como **fase 1** do plano para suportar futuramente _database-per-tenant_.

## Status atual

- ✅ Schema preparado (coluna `tenants.database_strategy` default `'shared'`)
- ✅ Adapter Supabase implementado e testável
- ✅ Adapter Postgres em **stub** (lança `NotImplemented`)
- ✅ Tenant resolver lê estratégia do banco
- ✅ Connection factory roteia por estratégia
- ❌ **Nenhum módulo do app foi migrado** — código existente segue usando
  `supabase.from(...)` direto, comportamento idêntico ao anterior.

## Estrutura

```
src/lib/db/
├── index.ts              ← entrypoint `db`
├── types.ts              ← DBAdapter, TenantContext, SelectQuery
├── tenantResolver.ts     ← getTenantContext()
├── clientFactory.ts      ← getDBClient(ctx)
└── adapters/
    ├── supabase.adapter.ts   ← usado hoje (estratégia "shared")
    └── postgres.adapter.ts   ← stub p/ "dedicated" no futuro
```

## Separação GLOBAL × TENANT

Quando começarmos a migrar tenants para bancos dedicados, estas tabelas
**continuam no banco compartilhado** (não podem ser particionadas):

| Categoria | Tabelas |
|-----------|---------|
| **GLOBAL** (sempre shared) | `tenants`, `profiles`, `user_roles`, `app_settings_audit` (auditoria cross-tenant), planos/billing futuros |

Estas são candidatas a virar **dedicadas** por tenant:

| Categoria | Tabelas |
|-----------|---------|
| **TENANT** (futuro multi-db) | `pacientes`, `atendimentos`, `atendimento_exames`, `atendimento_pagamentos`, `amostras`, `exames_catalogo`, `exame_parametros`, `exame_layouts`, `exame_pops`, `convenios`, `convenio_faturas`, `convenio_fatura_itens`, `especialistas`, `estoque_*`, `financeiro_*`, `motivos_cancelamento`, `mapas_trabalho`, `mapa_exames`, `documento_templates`, `orcamentos`, `orcamento_exames`, `orientacoes_entregues`, `identidade_confirmacoes`, `criticos_comunicacoes`, `app_settings`, `amostra_sequence` |

## Como adotar (futuro, gradual)

```ts
// Antes:
const { data, error } = await supabase.from("pacientes").select("*").eq("ativo", true);
if (error) throw error;

// Depois (quando o módulo for migrado):
import { db } from "@/lib/db";
const data = await db.select("pacientes", { eq: { ativo: true } });
```

Para queries complexas (joins, ilike, or), use o escape hatch:

```ts
const q = await db.raw("atendimentos");
const { data } = await q.select("*, atendimento_exames(*)").ilike("paciente_nome", "%maria%");
```

## Regras invioláveis

1. **Backward-compatible**: nenhum `supabase.from(...)` existente foi tocado.
2. **`persistOrThrow` continua sendo o ponto único de garantia de escrita** —
   o `SupabaseAdapter` o usa internamente.
3. **Adoção gradual** — quando migrarmos um módulo, fazemos um por vez
   começando por: atendimentos → pacientes → financeiro.
4. Tenants `dedicated` **não estão habilitados** — habilitar requer fase 2
   (implementação real do `PostgresAdapter` + infraestrutura).

## Plano de fases

| Fase | Status | Conteúdo |
|------|--------|----------|
| **1 — Preparação** | ✅ Em curso | Schema + camada de abstração + stubs |
| **2 — Infraestrutura** | ⏳ Futuro | Provisionamento de bancos dedicados, `PostgresAdapter` real, pool de conexões edge-side |
| **3 — Migração-piloto** | ⏳ Futuro | Mover 1 tenant para `dedicated`, validar |
| **4 — Refator módulo a módulo** | ⏳ Futuro | Substituir `supabase.from(...)` por `db.*` nos módulos críticos |
