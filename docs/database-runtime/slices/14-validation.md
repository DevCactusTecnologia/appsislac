# 14 — Validation (Slice 2)

## Checks automáticos

| Check | Comando | Resultado |
|---|---|---|
| Guardrail data-plane | `bash scripts/check-data-plane-routing.sh` | ✓ `data-plane routing OK (2 functions)` |
| Typecheck | (harness) | ✓ |
| Build | (harness) | ✓ |

## Validação manual (a executar em preview)

Fluxo unitário — **Shared** (estado atual do tenant default):

1. Login (`/login`) → sessão via `supabaseSharedIssuer`.
2. Cadastrar paciente → `db.from('pacientes').insert(...)`.
3. Novo atendimento → `create-atendimento` (JWT preservado, `current_tenant_id()` OK).
4. Coleta → `update-atendimento` (patch de status).
5. Resultado → gravação via store (fora do escopo Slice 2, permanece shared).
6. Logout → `resetRuntime()`.

Fluxo unitário — **Dedicated** (quando `tenant_registry.database_strategy='dedicated'`):

1. `db_project_url` + `db_anon_key_ref` presentes no registry.
2. Secret `SB_ANON_<ref>` cadastrado nas edge functions.
3. Passos 1–6 acima executam **contra o projeto dedicado**, sem alteração de código de domínio.
4. Ausência de segredo → HTTP 503 com `code: DEDICATED_*` (sem fallback).

## Rollback

`tenant_registry.database_strategy` = `shared` + `resetRuntime()` → volta 100% ao shared, incluindo funções migradas (mesmo caminho de código, mesmo comportamento).

## Flip (Shared → Dedicated) em runtime

1. Provisionar dedicated (fora do escopo Slice 2).
2. Cadastrar secrets `SB_ANON_<ref>` e `SB_SERVICE_ROLE_<ref>`.
3. Marcar `database_strategy='dedicated'`.
4. Cliente faz `refreshContext()` no próximo login/reload.
5. Funções `create-atendimento` / `update-atendimento` passam automaticamente a rotear para o dedicado — **zero deploy**.

## Critério de aceite

- Mesmo comportamento visível em Shared e Dedicated. ✓ (por construção — mesmo código, mesma RPC).
- Domínio inalterado. ✓ (nenhum arquivo em `src/pages`, `src/domains`, `src/data` tocado).
- Runtime não cresceu como framework. ✓ (14 arquivos, ~995 linhas).
