# 09 — Arquitetura Real (como o código é hoje)

```
┌──────────────────── FRONT-END (React) ────────────────────┐
│                                                          │
│  Componentes / Pages                                     │
│      │                                                   │
│      ▼                                                   │
│  src/data/*Store.ts  ──► import { supabase } from        │
│                          "@/integrations/supabase/client"│
│                                                          │
│  (fachada db existe mas NÃO é usada pelos stores)        │
│                                                          │
│  AuthContext ──► registerIdentityIssuer (nunca lido)     │
│              └─► refreshContext / resetRuntime           │
│                    │                                     │
│                    ▼                                     │
│  runtime/db/factory + tenantContext                      │
│    resolveContext → invoke('tenant-runtime-config')      │
│      (sempre retorna mode='shared' na prática)           │
└──────────────────────────────────────────────────────────┘
                        │ HTTPS
                        ▼
┌────────────── SUPABASE SHARED (projeto único) ───────────┐
│  auth.users        tenant_registry                       │
│  public.*  (RLS)   tenant_migration_runs                 │
│  storage.*                                               │
└──────────────────────────────────────────────────────────┘
                        ▲
                        │
┌────────────────── EDGE FUNCTIONS ────────────────────────┐
│                                                          │
│  12 funções (Slices 1-3) usam:                           │
│     getPlatformClient / getUserClient /                  │
│     getUserTenantClient / getTenantClient                │
│         │                                                │
│         ▼                                                │
│   _shared/runtime/db.ts + tenantContext.ts               │
│         │                                                │
│         ▼ (se strategy=='dedicated')                     │
│   ┌── nunca chega aqui em produção ──────────┐           │
│   │ createClient(url, SB_SERVICE_ROLE_ref)   │           │
│   │  ► SUPABASE DEDICADO (por tenant)        │ (vazio)   │
│   └──────────────────────────────────────────┘           │
│                                                          │
│  20 funções super-admin-* / tenant-* (pipeline)          │
│      usam _shared/migration/connect.ts (postgres.js)     │
│      diretamente contra o dedicated                      │
└──────────────────────────────────────────────────────────┘
```

## Observações do desenho
- Único caminho realmente exercitado hoje: **stores → supabase singleton → Shared**.
- Runtime cliente (`db`, factory, strategies) está montado mas ocioso.
- Runtime servidor está em uso pelas 12 edge functions migradas, sempre pela ramificação `shared`.
- Pipeline de migração (20 edges + connect.ts) está pronto, sem execução real registrada.
- Identity Layer registrado no boot mas sem consumidores.

## Camadas por consumidor
| Camada | Consumidores reais |
|---|---|
| Fachada `db` (client) | 1 (AuthContext) |
| `getPlatformClient` (server) | ~15 edges |
| `getUserClient` (server) | ~8 edges |
| `getUserTenantClient` (server) | ~10 edges (Slices 2-3) |
| `getTenantClient` (server) | ~2 edges |
| `connect.ts` (postgres.js) | 7 edges (migrate/provision) |
| Identity (client) | 0 |
| Identity (server) | 0 |
