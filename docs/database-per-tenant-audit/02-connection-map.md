# 02 — Mapa de Conexões

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (browser)                                          │
│   src/integrations/supabase/client.ts                       │
│     └─► createClient(VITE_SUPABASE_URL, VITE_*KEY)  ◄── 1 só │
│         (hardcoded em .env: xhaeozwdfjuvpxgguqqp)           │
│   121 arquivos importam este singleton.                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ SHARED SUPABASE PROJECT (xhaeozwdfjuvpxgguqqp)              │
│   • Auth (todos os logins)                                  │
│   • Postgres (todas as tabelas operacionais + control-plane)│
│   • Storage (buckets: tenant-assets, integration-assets…)   │
│   • Realtime                                                │
│   • Edge Functions (~70)                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼  (apenas em super-admin-test-tenant-db)
┌─────────────────────────────────────────────────────────────┐
│ deno-postgres Client → host/port/user lidos de              │
│ tenant_registry + senha resolvida via Deno.env[secretRef]   │
│ Uso atual: APENAS "SELECT 1 + version()" para diagnóstico   │
└─────────────────────────────────────────────────────────────┘
```

Não há nenhum caminho de leitura/escrita operacional que use o banco dedicado. `tenantConnection.resolveTenantConnection` retorna o client compartilhado para `shared` e **lança erro** para `dedicated` (linha 74: `'isolated_db' ainda em dry-run`).
