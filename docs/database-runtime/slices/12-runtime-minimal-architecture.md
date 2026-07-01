# 12 — Runtime Minimal Architecture

## Superfície final (congelada)

```
Domínio (React + Edge Functions)
        │
        ▼
┌───────────────────────────────┐
│      Database Runtime         │
│                               │
│  client:  db  (proxy)         │  ← src/runtime/db/index.ts
│  server:  getTenantClient()   │  ← supabase/functions/_shared/runtime/db.ts
│           getUserTenantClient()
│           getPlatformClient()
│           getUserClient()
│                               │
│  Identity Layer               │  ← src/runtime/identity/*
│                               │
│  Tenant Registry              │  ← tabela public.tenant_registry
└───────────────────────────────┘
        │
        ▼
   ┌────────┬──────────┐
   │ Shared │ Dedicated│
   └────────┴──────────┘
```

## Contratos públicos

**Client (frontend):**
- `db.from(table)` — roteia por allowlist.
- `db.auth | db.storage | db.functions | db.rpc | db.channel` — via shared (auth/canal permanecem no Shared por design D1).
- `refreshContext() | resetRuntime()` — usados após login/logout/flip.

**Server (edge functions):**
- `getPlatformClient()` — control-plane (service-role, shared).
- `getUserClient(auth)` — validar JWT do usuário.
- `getUserTenantClient(auth, tenant_id)` — **data-plane autenticado** (RPCs com `current_tenant_id()`).
- `getTenantClient(tenant_id)` — data-plane service-role (jobs/webhooks).
- `MigrationBlockedError` — bloqueio explícito, sem fallback silencioso.

**Identity Layer:**
- `registerIdentityIssuer(issuer)` — chamado no bootstrap.
- `getIdentityIssuer()` — consumido por qualquer camada que precise de sessão.

## Regras invioláveis

1. Nenhuma edge function do allowlist pode importar `createClient` do chokepoint direto — usa `getTenantClient`/`getUserTenantClient`. Guardrail CI valida.
2. Nenhum `catch` do runtime pode devolver silenciosamente `sharedClient` para tenant `dedicated`. Sempre `MigrationBlockedError`.
3. Nenhum componente novo pode ser adicionado sem provar que reduz complexidade **e** não pode ser absorvido pelos primitivos acima.

## Métricas do Runtime

| Métrica | Valor |
|---|---|
| Arquivos runtime (client + server) | 14 |
| Linhas totais | ~995 |
| Novas abstrações no Slice 2 | 1 (`getUserTenantClient`) |
| Domínio acoplado ao provedor | 0 imports diretos |
| Guardrails CI ativos | 1 (`check-data-plane-routing.sh`) |

## Estado

**MINIMAL DEDICATED RUNTIME** — congelado.
