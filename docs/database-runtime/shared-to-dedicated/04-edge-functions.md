# 04 — Edge Functions

## Números observados

- Total de edge functions: **79**.
- Arquivos importando `_shared/runtime/*`: **79** (100%) — o chokepoint SDK é universal.
- Arquivos importando `@supabase/supabase-js` diretamente da esm.sh: **1** — o próprio `_shared/runtime/createClient.ts` (por design; é o chokepoint).

## Padrões observados

Padrão dominante (verificado em amostragem — `tenant-runtime-config`, `tenant-dedicated-login-gate`, `super-admin-*`, `whatsapp-*`, `lab-apoio-*`, `create-atendimento`, `update-atendimento`, `admin-*`):

```ts
import { createClient } from "../_shared/runtime/createClient.ts";
const admin = createClient(SUPABASE_URL, SERVICE_KEY);
const userClient = createClient(SUPABASE_URL, ANON_KEY, { global:{ headers:{ Authorization: ... } } });
```

**Todas as ~79 funções continuam apontando para o projeto shared** (SUPABASE_URL do env do projeto). O chokepoint garante governança de versão, mas não faz roteamento tenant-aware ainda.

## `getTenantClient` (fachada tenant-aware)

`supabase/functions/_shared/runtime/db.ts:getTenantClient(tenant_id)`:
- Consulta `TenantContextProvider`.
- Se `strategy==='dedicated'` → **`throw new Error("runtime não disponível ainda")`**.
- Se `shared` → devolve `getPlatformClient()` (service-role).

Consumidores diretos de `getTenantClient` (grep): **nenhum consumo em edge functions operacionais**. É uma fachada preparada mas ainda não adotada.

## Classificação por prontidão

| Categoria | Funções | Status |
|---|---|---|
| Control-plane (só shared por design) | `super-admin-*` (25+), `tenant-runtime-config`, `tenant-dedicated-login-gate`, `tenant-healthcheck`, `tenant-resolve`, `tenant-domain-verify` | ✓ Correto — devem ficar no shared |
| Operacionais data-plane | `create-atendimento`, `update-atendimento`, `admin-*`, `sign-resultado`, `assinatura-url`, `upload-*`, `lab-apoio-*`, `ai-*`, `whatsapp-*`, `integration-*`, `provider-*`, `lgpd-*`, `leads-manager` | ✗ **Nenhuma pronta para dedicated** — escrevem no shared |
| Storage | `upload-image`, `upload-pdf`, `upload-assinatura`, `image-url`, `lab-apoio-upload-pdf` | ✗ Storage do shared |
| Realtime / Cron | `whatsapp-dispatcher`, `integration-jobs-runner`, `lab-apoio-cron-fetch`, `provider-health-aggregator` | ✗ Shared only |

## Respostas objetivas

- **Quais usam Runtime?** 79/79 usam o chokepoint SDK; **0/79** usam `getTenantClient` para rotear.
- **Quais ainda conhecem Supabase?** Todas — SUPABASE_URL é lido do env em cada função.
- **Quais usam Service Role?** Praticamente todas as operacionais (padrão `admin = createClient(URL, SERVICE_KEY)`).
- **Quais usam getTenantClient?** 0.
- **Quais estão prontas para Dedicated?** 0 do data-plane. `getTenantClient` é fail-closed para dedicated.
- **Quais têm código legado?** `_shared/tenantConnection.ts` (referenciado em audit 01) — coexiste com `_shared/runtime/*`.
