# 03 — Runtime Final

## Client (`src/runtime/db.ts` — 1 arquivo)
API pública única:

```
db                              // SupabaseClient singleton
getTenantContext()              // { tenant_id, database_strategy }
getCurrentTenantId()            // string
getCurrentTenantNome()          // string
getCachedTenantNome()           // string | null
getCachedTenantContext()        // TenantContext | null
clearTenantContextCache()       // void
installTenantAuthInvalidation() // instala listener uma vez
refreshContext()                // compat: limpa cache e re-resolve
resetRuntime()                  // compat: limpa cache
getCurrentContext()             // snapshot síncrono
RuntimeError                    // error tipado
```

Sem Proxy, sem factory, sem strategies, sem allowlist. O cliente **sempre** conversa com o Supabase configurado no `.env`. A troca real de projeto (após o flip) é feita por redeploy com novas VITE_SUPABASE_URL/KEY para o tenant.

## Server (`supabase/functions/_shared/runtime/db.ts` — 1 arquivo)
```
getPlatformClient()                      // service-role
getUserClient(authHeader)                // anon + JWT do usuário
getTenantClient(tenant_id)               // shared OU dedicated (service-role)
getUserTenantClient(auth, tenant_id)     // shared OU dedicated (JWT preservado)
resolveUserTenantId(userId)              // lookup em profiles
MigrationBlockedError                    // erro tipado do runtime dedicado
```

`resolveTenant()` é privado — lê `tenant_registry` diretamente e devolve strategy + credenciais.
