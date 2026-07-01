
# Fase 2 — Roteamento do Runtime para Banco Dedicado

Objetivo: fazer o laboratório 1001, ao logar, executar queries de domínio (`pacientes`, `atendimentos`, `atendimento_exames`, `atendimento_pagamentos`) no **projeto Supabase dedicado** já provisionado, mantendo o restante (Auth, Storage, tabelas ainda não migradas) no shared. Sem migrar dados nesta fase — o dedicado vai começar vazio.

---

## Decisões arquiteturais (fixas nesta fase)

1. **Auth continua 100% no shared.** JWT do dedicado é diferente e não há federação viável hoje. Confirmado em `docs/database-per-tenant-audit/06-auth.md`.
2. **Consequência:** o cliente que aponta para o dedicado envia requisições com a **anon key do dedicado** — cai no role `anon` do PostgREST dele. Não temos `auth.uid()` no dedicado.
3. **Modelo do dedicado:** banco é 100% do tenant, sem `tenant_id` em coluna. Isolamento é o próprio projeto. RLS fica desligada nas tabelas provisionadas; as GRANTs precisam **incluir `anon`** para leitura/escrita (ajuste no schema provisionado da Fase 1).
4. **Gate obrigatório:** só roteia para dedicado quando **todas** as condições forem verdadeiras:
   - `tenant_registry.database_strategy = 'dedicated'`
   - `tenant_registry.schema_provisioned_at IS NOT NULL`
   - `tenant_registry.db_project_url` e `db_anon_key_secret_ref` preenchidos
   - Feature flag `runtime_dedicated_enabled` (nova coluna booleana em `tenant_registry`, default `false`) explicitamente `true`
   - Se qualquer uma falhar → fallback silencioso para shared. Nunca quebra login.

5. **Escopo do roteamento — allowlist de tabelas:** apenas as 4 tabelas provisionadas (`pacientes`, `atendimentos`, `atendimento_exames`, `atendimento_pagamentos`) roteiam para o dedicado. Qualquer outra tabela / `auth` / `storage` / `functions.invoke` continua no shared. Isso permite ligar a Fase 2 sem esperar migração de dicionários, financeiro, VR etc.

---

## Entregas

### 1. Banco (migration)
- `ALTER TABLE public.tenant_registry ADD COLUMN runtime_dedicated_enabled boolean NOT NULL DEFAULT false`
- Setar `runtime_dedicated_enabled = true` para o tenant 1001 (feito manualmente pelo super admin depois via UI, não no migration).

### 2. Edge Function nova — `tenant-runtime-config`
- Autenticada (JWT do shared). Retorna, para o usuário chamador:
  ```json
  {
    "mode": "dedicated" | "shared",
    "dedicated": { "url": "...", "anon_key": "..." } | null,
    "allowed_tables": ["pacientes","atendimentos","atendimento_exames","atendimento_pagamentos"]
  }
  ```
- Lê `tenant_registry` do tenant do caller, valida o gate, resolve o `db_anon_key_secret_ref` no `Deno.env`. Se qualquer condição falhar → devolve `mode: "shared"`.
- Anon key é publishable — pode ir para o frontend.

### 3. Ajuste no provisionamento (edge `super-admin-provision-tenant-schema`)
- Trocar `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated` para incluir `anon`.
- Adicionar re-execução idempotente: novo botão / re-run atualiza grants em bancos já provisionados.

### 4. Runtime (frontend) — arquivos afetados
- `src/runtime/db/strategies/dedicated.ts` — deixar de lançar. Recebe `TenantRuntimeContext` com `database_url` + `anon_key` e cria `createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })`. Sem sessão — é um transport puro de dados.
- `src/runtime/db/types.ts` — adicionar campo opcional `anon_key: string | null` ao `TenantRuntimeContext` + `allowed_tables: string[]`.
- `src/runtime/db/tenantContext.ts` — passa a invocar `tenant-runtime-config` (uma vez, cacheado por sessão) para preencher `anon_key` e `allowed_tables` quando `mode === "dedicated"`.
- `src/runtime/db/factory.ts` — cache passa a manter DOIS clientes por tenant dedicado: `sharedClient` (para auth/storage/tabelas fora do allowlist) e `dedicatedClient` (para tabelas do allowlist).
- `src/runtime/db/index.ts` — o Proxy `db` ganha interceptação em `.from(table)`: se `table` estiver no `allowed_tables` do contexto atual E o modo for dedicated, delega ao `dedicatedClient`; caso contrário, ao `sharedClient`. Todo o resto (`db.auth`, `db.storage`, `db.functions`, `db.rpc`) continua no shared.

### 5. UI Super Admin
- `src/components/superadmin/TenantDatabaseConfig.tsx` — novo toggle **"Ativar roteamento dedicado (runtime)"** ligado a `runtime_dedicated_enabled`. Desabilitado até `schema_provisioned_at` estar preenchido. Aviso claro: "Ao ativar, este tenant passa a ler/gravar pacientes e atendimentos do banco dedicado (vazio até a Fase 3 de migração)".
- Edge function `super-admin-update-tenant-db-config` — aceitar o novo campo.

### 6. Telemetria
- `src/runtime/db/telemetry.ts` — novos eventos `runtime.route.dedicated` e `runtime.route.shared_fallback` com nome da tabela. Ajuda a monitorar o POC.

---

## Roteiro de validação (tenant 1001)

1. Deploy do migration + edge functions.
2. Super Admin re-executa "Provisionar schema" (aplica GRANTs em `anon`).
3. Super Admin liga o toggle `runtime_dedicated_enabled` no 1001.
4. Login no 1001 → abrir `/pacientes`: lista **vazia** (dedicado sem dados). Console mostra `runtime.route.dedicated` para `pacientes`.
5. Cadastrar 1 paciente de teste → persiste no dedicado (visível ao consultar `_sislac_health_check` + `pacientes` do dedicado).
6. Confirmar que `/configuracoes`, `/exames-catalogo`, `/convenios` continuam funcionando normalmente (roteados no shared).
7. Desligar toggle → sistema volta ao shared instantaneamente, sem impacto.

---

## Fora de escopo (fica para Fase 3 / Fase 4)

- Migração de dados shared → dedicated
- Roteamento de tabelas além da allowlist
- Federação real de Auth
- Cutover definitivo (shared read-only)
- Storage per-tenant
