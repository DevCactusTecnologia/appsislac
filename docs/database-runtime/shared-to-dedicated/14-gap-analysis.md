# 14 — Gap Analysis

## CRÍTICO

| # | Gap | Impacto | Risco | Complexidade | Tempo | Prioridade |
|---|---|---|---|---|---|---|
| C1 | **JWT mismatch shared↔dedicated** — `auth.uid()` é NULL no dedicated, RLS retorna vazio silenciosamente | Queries dedicated retornam 0 linhas; usuário vê tela vazia | Muito alto | Alta (custom JWT signing + federação ou SSO) | 3–6 semanas | P0 |
| C2 | **Edge functions data-plane continuam escrevendo no shared** — `create-atendimento`, `update-atendimento`, `sign-resultado`, `admin-*`, `whatsapp-*`, `lab-apoio-*` (~50 fns) | Dessincronização: front lê do dedicated, backend escreve no shared | Muito alto | Alta (refatorar 50 fns para `getTenantClient`) | 2–4 semanas | P0 |
| C3 | **`getTenantClient` é fail-closed para dedicated** — lança erro; nenhuma fn adotou | Impossível migrar dados sem rewrite | Alto | Média (implementar server-side dedicated client) | 1 semana | P0 |
| C4 | **Realtime só no shared** — `subscribeAtendimentos` usa shared | Perda de reatividade em rotina/resultados | Alto | Média (channel per tenant) | 1–2 semanas | P0 |
| C5 | **Storage único** — binários não migram; sem resolver por tenant | Assets órfãos; signed URLs quebram | Alto | Alta (cópia física + resolver) | 2–3 semanas | P0 |

## ALTO

| # | Gap | Impacto | Complexidade | Prioridade |
|---|---|---|---|---|
| A1 | **Cap 100 secrets/env** para `db_anon_key_secret_ref` | Bloqueia >100 tenants dedicated | Alta (KMS/vault externo) | P1 |
| A2 | **RPCs não replicadas** no dedicated (`update_atendimento_tx`, sequences, `current_tenant_id`) | RPC roteia para shared, ignora dedicated | Média | P1 |
| A3 | **Migrations não separadas** platform vs tenant | Impossível manter schema dedicated sincronizado | Média | P1 |
| A4 | **Sem TTL / invalidação distribuída** no Factory cache | Rollback/flip não propaga em tempo real | Baixa | P1 |
| A5 | **`profiles` continua no shared** — dedicated não tem tabela de usuários própria | Auth+dados dessincronizados | Média | P1 |

## MÉDIO

| # | Gap | Impacto | Prioridade |
|---|---|---|---|
| M1 | **Telemetria dev-only**; sem sink em produção | Cegueira operacional | P2 |
| M2 | **Sem tracing distribuído** por tenant | Debug caro | P2 |
| M3 | **Duplicação de cache** Factory vs `tenantContext._cachedContext` | Risco de skew | P2 |
| M4 | **`_shared/tenantConnection.ts` legado** convive com `_shared/runtime/*` | Confusão de manutenção | P2 |
| M5 | **`storage_namespace` coluna morta** | Débito de esquema | P2 |

## BAIXO

| # | Gap | Impacto | Prioridade |
|---|---|---|---|
| B1 | **Redundância `database_strategy` vs `runtime_mode`** | Ambiguidade menor | P3 |
| B2 | **Redundância `last_health_at` vs `last_health_check`** | Débito menor | P3 |
| B3 | **Sem CHECK constraint** garantindo consistência de flags | Validação só em runtime | P3 |
| B4 | **4 arquivos front usam `VITE_SUPABASE_URL` direto** (bypass do Runtime) | Débito de acoplamento | P3 |
| B5 | **`SuperAdminList` sem paginação identificada** | Não escala | P3 |
