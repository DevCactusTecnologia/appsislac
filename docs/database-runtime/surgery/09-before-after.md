# 09 — Before / After

| Métrica | Antes | Depois | Δ |
|---|---:|---:|---:|
| Arquivos runtime (client) | 11 | 1 | **-10** |
| Arquivos runtime (server) | 4 | 2 | **-2** |
| Edge functions dedicated-specific | 22 | 20 | **-2** |
| Linhas runtime (client) | ~555 | ~165 | **-390** |
| Linhas runtime (server) | ~530 | ~155 | **-375** |
| Abstrações públicas (Strategy/Factory/Identity/Provider) | 14 | 0 | **-14** |
| Diretórios doc redundantes | 3 | 0 | **-3** |
| Guardrail | 12 funcs | 12 funcs | = |
| Pipeline de migração (funcs) | 17 | 17 | = |

## Arquitetura conceitual

**Antes:**
```
app → Proxy(db) → Factory → Strategy(shared|dedicated) → SupabaseClient
                       ↑
                  tenantContext → edge tenant-runtime-config
              IdentityIssuer registry
```

**Depois:**
```
app → db (SupabaseClient singleton)
      tenant helpers (resolvem via profiles)
```
