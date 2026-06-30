# 09 — Escalabilidade

| Clientes | Cenário com código atual |
|---------:|--------------------------|
| 1–10     | OK no modo shared. Bancos dedicados: **não funcionam** (resolveTenantConnection lança erro). |
| 100      | Shared: provável esgotamento do pool PostgREST do único projeto e gargalo de Realtime/Storage. |
| 500      | Shared: inviável sem sharding/replicas. Dedicado: zero implementação. |
| 1000     | Inviável em ambas estratégias com o código atual. |

Gargalos estruturais:
- Pool único de Postgres do projeto shared.
- 1 quota de Storage / Realtime / Auth.
- 0 mecanismo de roteamento por tenant em runtime.
- Migrations aplicadas via Supabase CLI no projeto único — não há orquestração multi-banco.
