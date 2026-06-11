# Super-Admin — Risk Analysis
> Auditor: Senior Architect + Security | Date: 2025-01-31 | SISLAC Control Plane

---

## Risk Summary

| ID | Risk | Severity | Likelihood | Priority |
|---|---|---|---|---|
| R01 | Client-side super_admin role check after login | 🔴 Critical | Medium | P0 |
| R02 | Impersonation magic link visible in JSON response | 🔴 Critical | Low | P0 |
| R03 | saas_settings secrets stored in plaintext JSON in DB | 🔴 Critical | Medium | P0 |
| R04 | Non-atomic tenant creation → orphaned tenants | 🟠 High | Medium | P1 |
| R05 | Irreversible delete with no pre-delete backup | 🟠 High | Low | P1 |
| R06 | No audit trail for suspension/impersonation actions | 🟠 High | High | P1 |
| R07 | Backup loads full tenant data into Deno memory | 🟠 High | Medium | P1 |
| R08 | 500-row hard limit on audit log — blind spot at scale | 🟡 Medium | High | P2 |
| R09 | N+1 RPC calls in delete and impersonate flows | 🟡 Medium | Medium | P2 |
| R10 | Plan limits not enforced at data layer | 🟡 Medium | High | P2 |
| R11 | No notification/grace period on tenant suspension | 🟡 Medium | Medium | P2 |
| R12 | Decorative "Support Access" switch saves nothing | 🟡 Medium | High | P2 |
| R13 | lead→tenant conversion stub (toast.info only) | 🟡 Medium | High | P2 |
| R14 | Scalability: snapshot/backup/delete degrade at 100+ labs | 🟡 Medium | High | P2 |

---

## Security Risks

### R01 — Client-Side Super-Admin Role Check (P0)
**Location**: `SuperAdminLogin.tsx` lines 58-68

```typescript
const { data: roles } = await supabase
  .from("user_roles" as never)
  .select("role")
  .eq("user_id", uid);
const isSuper = Array.isArray(roles) && (roles as {role:string}[]).some(r => r.role === "super_admin");
if (!isSuper) {
  await supabase.auth.signOut();
  ...
}
```
**Risk**: The JWT session is created by `signInWithPassword` **before** the role check. A client-side race or a React render error between lines 51-63 could leave an authenticated session open without the super-admin guard being enforced. The session exists in memory/localStorage before `signOut()` is called.

**Mitigation needed**: The `is_super_admin` check should be enforced server-side at JWT claim level (custom claim) or via a dedicated login edge function that only issues a session if the role is confirmed.

---

### R02 — Impersonation Magic Link in JSON Response (P0)
**Location**: `super-admin-impersonate-tenant/index.ts` final return + `SuperAdminTenantDetalhe.tsx` line 296

```typescript
// Edge function returns:
return jsonResponse(200, { ok: true, actionLink, email, perfil }, requestId);

// Client opens it:
window.open(data.actionLink, "_blank");
```
**Risk**: 
- `actionLink` contains a one-time Supabase magic link token. It is returned in the HTTP response body → logged by edge function infrastructure (Supabase Dashboard logs), browser dev tools, network proxies, and any middleware.
- No link expiry shortening (default Supabase TTL is 1 hour).
- No confirmation dialog before generation — a single misclick generates a valid session link.

**Mitigation needed**: Redirect server-side (HTTP 302) so the token is never exposed in the response body. Add a confirmation dialog with purpose justification.

---

### R03 — Plaintext Secrets in saas_settings (P0)
**Location**: `SuperAdminConfiguracoes.tsx` `saveSetting` / `loadSetting` (lines 115-133)

```typescript
async function saveSetting(key: string, value: unknown) {
  return supabase.from("saas_settings" as any).upsert({ key, value }, { onConflict: "key" });
}
```
**Risk**: SMTP passwords, AWS `secretAccessKey`, WhatsApp `accessToken`, Gemini/OpenAI API keys are stored as plaintext JSON objects in the `saas_settings` table. The UI shows an "AES-256" badge (line 312) that is **cosmetic only** — no encryption is applied in the read/write path. Anyone with access to the DB (including Supabase dashboard) can read all credentials.

**Mitigation needed**: Use Supabase Vault or encrypt secrets at the edge function layer before persistence. Remove the misleading "AES-256" badge.

---

### R04 — Non-Atomic Tenant Creation (P1)
**Location**: `super-admin-create-tenant/index.ts` steps 4-8

Steps execute sequentially with non-fatal error handling:
1. `tenants` INSERT → ✅ required
2. `tenant_registry` lab_code override → ⚠ warn if fails, tenant still created
3. `unidades` INSERT → ⚠ warn if fails
4. `seed_default_mapas_for_tenant` RPC → ⚠ warn if fails  
5. `seed_default_formas_pagamento_for_tenant` RPC → ⚠ warn if fails
6. `auth.admin.createUser` / `inviteUserByEmail` → if fails, returns `ok:true` with `warning`

**Risk**: A tenant can be created in an incomplete state — no admin user, no default unit, no mapas de trabalho, no payment methods. The UI only shows the `warning` field; no rollback occurs. The orphaned tenant is silently left in the DB.

---

### R05 — Irreversible Delete Without Pre-Delete Backup (P1)
**Location**: `super-admin-delete-tenant/index.ts` + UI Danger Zone

- Hard cascade delete with no soft-delete
- No automatic pre-delete snapshot
- Synchronous edge function — can timeout for large tenants leaving a partially deleted state (users deleted from Auth but DB rows remain)
- No storage cleanup (S3/Supabase Storage files remain orphaned)

---

### R06 — No Audit Trail for Super-Admin Actions (P1)
**Affected actions**: suspend, reactivate, impersonate, plan change, password reset, delete

The edge functions log to structured JSON (edge function logs) but:
- No DB audit table is written (no `admin_audit_log` table observed)
- Edge function logs are ephemeral (Supabase retains for limited time)
- Impossible to query "who suspended lab X on date Y" from the application

Only `impersonate-tenant` logs `impersonation_link_generated` + `reset-tenant-password` logs `password_reset_by_super_admin` to the edge function console — not to the DB.

---

## Multi-Tenant Risks

### R10 — Plan Limits Not Enforced at Data Layer (P2)
**Location**: `subscription_plans` fields `limite_usuarios`, `limite_unidades`, `limite_atendimentos_mes`

These limits are displayed in the UI (TenantDetalhe "Plano" tab, LimitBadge component) but:
- No DB constraint or trigger enforces them
- No RLS policy checks plan limits
- Application-level enforcement not observed in any edge function

A tenant on a "Free" plan (e.g., 5 user limit) can create unlimited users if the application does not enforce the check at user creation time.

---

### R07 — Backup Memory Risk at Scale (P1)
**Location**: `super-admin-tenant-backup/index.ts`

Backup loads ~40 tables entirely into a JavaScript array in Deno memory, then serializes to SQL/JSON/XLSX. Deno edge functions have a memory limit (~512 MB). A tenant with:
- 50,000 atendimentos × ~20 fields = ~10 MB JSON
- 100,000 exame_parametros rows = ~20 MB

Could trigger OOM or a 30-second timeout, resulting in a failed backup with no partial result.

---

## Scalability Risks (100+ Labs)

### R08 — Audit Log Hard Cap (P2)
`SuperAdminAuditoria.tsx` line 44: `.limit(500)` — with 100+ labs generating tens of events per day, the 500-row snapshot covers only minutes of activity. Client-side filtering then operates on this truncated dataset.

### R09 — N+1 in Delete and Impersonate (P2)
- `super-admin-delete-tenant`: O(n) sequential `rpc("is_super_admin")` calls per user
- `super-admin-impersonate-tenant`: O(n) sequential `rpc("is_super_admin")` per profile

At 100 users per tenant this is 100 sequential round-trips. Edge function timeout is 30s (Supabase default).

### R14 — Snapshot Performance Degradation (P2)
`super-admin-list-tenants` returns metrics for ALL tenants. The list page loads once and renders all tenant cards. At 100+ labs:
- Single invocation must aggregate metrics for all tenants
- Page load time grows linearly
- No pagination on the list

### Other Scalability Observations
- `SuperAdminTenantDetalhe` fetches snapshot on every tab visit (no caching)
- Plans are re-fetched every time `SuperAdminTenantDetalhe` mounts (line 201-206 `useEffect`)
- No SWR/React Query caching strategy observed — every navigation re-fetches

---

## Summary Table — Actions That Affect Production Immediately

| Action | Immediate Production Effect |
|---|---|
| Suspend tenant | All users locked out instantly, no warning |
| Change plan | Billing record updated; limits not enforced |
| Reset password | Admin password changed immediately |
| Impersonate | Super-admin gains live session in tenant environment |
| Delete tenant | All data permanently destroyed |
| Edit saas_settings (SMTP) | Next email send uses new config |
| Edit saas_settings (WhatsApp) | Next WhatsApp message uses new config |
| Create tenant | Tenant goes live immediately with `status: "ativo"` |
