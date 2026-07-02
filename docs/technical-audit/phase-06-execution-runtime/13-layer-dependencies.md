# 13 — Layer Dependencies

Mapa unidirecional observado (nenhum caminho inverso encontrado):

```
Página React (src/pages/**)
    │
    ▼
Hook (src/hooks/**)          — Realtime, paginação, KPI
    │
    ▼
Store (src/data/**)          — ensureLoaded + queryKey ["tenant", tid, ...]
    │
    ▼
Service (src/domains/**/services/*, src/pages/**/services/*)
    │
    ▼
Runtime cliente (src/runtime/db.ts)
    │
    ▼
Supabase JS (src/integrations/supabase/client.ts)
    │
    ├──► Edge Function (supabase/functions/*)
    │        │
    │        ▼
    │    _shared/runtime/createClient  (server chokepoint)
    │        │
    │        ▼
    │    RPC *_tx (transação)
    │
    └──► RPC direto  ou  supabase.from (cadastros)
             │
             ▼
         PostgreSQL
             │
             ├─► RLS (373 policies)
             ├─► Trigger audit_<tabela> → *_audit
             ├─► Trigger updated_at
             └─► Trigger RBAC (ex.: atendimento_exames_rbac_check_trg)
                     │
                     ▼
                  Tabela
                     │
                     ▼
             Realtime broadcast
                     │
                     ▼
        useRealtimeChannel → invalidação de queryKey → refetch → re-render
```

Nenhuma página importa `@supabase/supabase-js` diretamente (validado por scripts). Nenhuma edge importa `createClient` fora do chokepoint (regra Fase C).
