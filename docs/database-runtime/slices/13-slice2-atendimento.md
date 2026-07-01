# 13 — Slice 2: Atendimento

## Escopo executado (mínimo)

1. **Identity Layer wiring** — `registerIdentityIssuer(supabaseSharedIssuer)` em `src/main.tsx`.
2. **Telemetria mínima** — mantidos apenas eventos: `runtime.resolve.*`, `runtime.client.*`, `runtime.route.*`, `runtime.failure` (tenant, strategy, latência, erro). Sem sinks externos.
3. **Guardrail CI** — `scripts/check-data-plane-routing.sh` falha build se função no allowlist importar `createClient` direto ou omitir `getTenantClient`/`getUserTenantClient`.
4. **Migração do domínio Atendimento** — `create-atendimento` e `update-atendimento` passaram a rotear via `getUserTenantClient(auth, tenant_id)`.

## Fora de escopo (explicitamente proibido nesta fase)

Resultado, Financeiro, Storage, Realtime, RPC genérico, WhatsApp, IA.

## Novo primitivo: `getUserTenantClient`

Único acréscimo ao Runtime nesta fase. Substitui o padrão manual (`createClient(URL, ANON, {Authorization})`) presente em cada função.

```ts
const auth = getUserClient(authHeader);
const { data: { user } } = await auth.auth.getUser();
const tenantId = await resolveUserTenantId(user.id);
const supabase = await getUserTenantClient(authHeader, tenantId);
await supabase.rpc("create_atendimento_tx", ...);
```

- Shared → cliente anon + Authorization (comportamento idêntico ao anterior).
- Dedicated → resolve `db_project_url` + `db_anon_key_ref` do `tenant_registry`; sem segredo → `MigrationBlockedError` → HTTP 503. **Sem fallback silencioso.**

## Funções migradas

| Function | Antes | Depois |
|---|---|---|
| `create-atendimento` | `createClient(URL, ANON, {Authorization})` | `getUserClient` + `getUserTenantClient` |
| `update-atendimento` | idem | idem |
| `extract-requisicao-exames` | não tocava DB | inalterado |
| `ai-suggest-exames` | Slice 6 (IA) | inalterado |

## Guardrail CI

Allowlist inicial em `scripts/check-data-plane-routing.sh`:

```
create-atendimento
update-atendimento
```

Rollout futuro: adicionar 1 linha por função migrada.

## Comportamento observado

| Fluxo | Shared (produção atual) | Dedicated (quando ativo) |
|---|---|---|
| Login | `supabaseSharedIssuer.signInWithPassword` | idem (JWT federado — D1) |
| Cadastro paciente | `db.from('pacientes')` → shared | → dedicated (via allowlist) |
| Novo atendimento | `create-atendimento` → RPC no shared preservando JWT | RPC no dedicated preservando o mesmo JWT |
| Update atendimento | idem | idem |
| Rollback | `resetRuntime()` limpa cache | idem |

## Estado

Slice 2 concluído. Runtime não cresceu (1 função nova, 2 funções migradas, 0 abstrações novas).
