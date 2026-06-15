# SISLAC — Multi-Tenant Audit (Phase 4)

**Data:** 2026-06-15. Somente leitura.

Pergunta central:
> **Existe algum caminho onde um tenant consiga enxergar outro tenant?**

Resposta: **não foi encontrado caminho exploitável.** Detalhes abaixo.

---

## 1. Tenant Resolution

### 1.1 Frontend
- `src/data/_tenant.ts` + `AuthContext` resolvem `tenantId` a partir do JWT (claim) **apenas para UX**. Toda query operacional usa `queryKey: ["tenant", tenantId, ...]` (`mem://architecture/query-key-rules`).
- Frontend **nunca** envia `tenant_id` em INSERT/UPDATE — campo é preenchido server-side via trigger `set_tenant_id_default()` ou via `DEFAULT current_tenant_id()`.

### 1.2 Banco
- `current_tenant_id()` SECURITY DEFINER lê `auth.jwt() -> 'user_metadata' -> 'tenant_id'` (ou tabela `profiles` como fallback) e retorna `uuid`.
- `current_tenant_id_strict()` lança erro se NULL — usado por funções que não podem operar fora de tenant.

### 1.3 Edge functions
- `tenant-resolve` é função pública sem segredo — devolve apenas branding pelo `lab_code`/`slug`/`email` do tenant. **Nunca expõe credenciais.**

---

## 2. Tenant Leakage — análise por vetor

| Vetor | Risco | Mitigação atual |
|---|---|---|
| Cliente envia `tenant_id` arbitrário em INSERT | ❌ bloqueado | Policies WITH CHECK comparam `tenant_id = current_tenant_id()`. Trigger sobrescreve. |
| Cliente faz SELECT em tabela sem WHERE | ❌ bloqueado | RLS filtra por `current_tenant_id()`. |
| JWT forjado | ❌ bloqueado | JWT assinado HS256 pela própria Supabase; `auth.uid()` deriva da assinatura. |
| `user_metadata.tenant_id` alterado pelo próprio user | ⚠️ **mitigado parcial** | `current_tenant_id()` lê primeiro de `profiles.tenant_id` (não editável pelo user), apenas fallback no JWT. Confirmar SSOT em `current_tenant_id()`. |
| Edge function chama `service_role` sem checar tenant | ⚠️ revisar | Funções `super-admin-*` validam `is_super_admin`. Funções operacionais (`create-atendimento`, `update-atendimento`) validam JWT + leem `tenant_id` do `profiles`. **Sem leitura por param do request.** |
| `select_options` com `tenant_id IS NULL` | ✅ intencional | Dicionário global; nunca contém dado sensível. |
| `tenant-resolve` público | ✅ ok | retorna só branding. |
| Realtime channels | ✅ ok | canais por `tenant_id`, RLS aplicado pelo Supabase Realtime. |

---

## 3. Tenant Escalation

- Único caminho para virar `super_admin` é via **edge function `super-admin-update-tenant-admin`** que exige caller já super_admin + log em `platform_audit`.
- Policy de `user_roles` (após hardening 2026-06-15) **rejeita** INSERT/UPDATE com `role='super_admin'` quando caller não é super_admin.
- Auto-cadastro de role: **não existe** — função `handle_new_user` cria sempre `role='user'`.

---

## 4. Tenant Bypass

Tentativas mapeadas:

1. **Direct PostgREST `Range`/`prefer`** — RLS aplica antes da serialização.
2. **RPC com `tenant_id` parâmetro** — todas as RPCs operacionais ignoram o parâmetro de tenant e usam `current_tenant_id()` internamente.
3. **Storage** — buckets têm policies por `tenant_id` em path (`tenant-id/...`); auditado em `storage_audit`.
4. **Edge function com `service_role`** — todas re-validam JWT + tenant; nenhuma aceita `tenant_id` cru do request body como verdade.

---

## 5. Super Admin Isolation

- Super admin **não tem `tenant_id`** em `profiles` (NULL).
- `is_super_admin(uid)` retorna true apenas para entradas em `user_roles` com `role='super_admin'`.
- Operações de super admin **não fazem JOIN com `current_tenant_id()`** — usam `tenant_id_alvo` recebido via request body, validado contra `tenants.id` existente.
- Impersonação devolve magic link single-use (logado em `platform_audit`).

---

## 6. Resposta final

> **Não foi identificado caminho onde um tenant consiga ler/escrever dados de outro tenant.**

Pontos a observar (não exploits, apenas higiene):
- **H1.** Garantir que `current_tenant_id()` sempre priorize `profiles.tenant_id` sobre `user_metadata.tenant_id`. (Hipótese: já é o caso. Verificar em revisão futura.)
- **H2.** Auditar periodicamente edge functions adicionadas após esta data para garantir que não confiem em `tenant_id` do body.
- **H3.** Garantir que novos campos `tenant_id` em novas tabelas tenham `NOT NULL` + trigger `set_tenant_id_default` (padrão já documentado em memória do projeto).

**Fim Fase 4.** Nada alterado.
