# Super-Admin — Single Source of Truth Analysis
> Auditor: Senior Architect + SaaS PO | Date: 2025-01-31 | SISLAC Control Plane

---

## Executive Summary

The SISLAC control plane has **three distinct SSOT problems**:
1. **Tenant status** — single source, but the `"bloqueado"` / `"inativo"` states are unreachable from the UI
2. **Tenant plan** — SPLIT between `tenants.plano` and `tenant_subscriptions_billing.plan_code`
3. **Plan limits enforcement** — stored in `subscription_plans` but NOT enforced at the data layer

---

## 1. Tenant Status

### Current State
| Field | Location | Setter |
|---|---|---|
| `tenants.status` | `public.tenants` table | `super-admin-update-tenant` (via `status` field) |

### Status Values in Use
| Value | Set By | Checked By |
|---|---|---|
| `"ativo"` | create-tenant (default), update-tenant toggle | `tenant-resolve` (rejects non-"ativo") |
| `"suspenso"` | update-tenant toggle from UI | `tenant-resolve` |
| `"inativo"` | StatusFilter in SuperAdminTenants UI (filter exists) but **no UI path sets it** | — |
| `"bloqueado"` | Referenced in `toneForTenantStatus` (StatusBadge) but **no UI path sets it** | — |

### Assessment: ✅ Single Source (but incomplete coverage)
`tenants.status` IS the single source of truth for tenant access. However:
- Two valid statuses (`inativo`, `bloqueado`) have no UI-driven path to set them
- Only a direct DB update can set these states
- `tenant-resolve` returns `tenant_inactive` for ANY non-"ativo" status — so the behavior is consistent, the UI path is missing

---

## 2. Tenant Plan — CRITICAL SSOT SPLIT

### Evidence

**Split A — `tenants.plano` (legacy field)**
```typescript
// super-admin-update-tenant/index.ts
// The update function accepts `plano` in the body and writes it to tenants table:
const updates: Record<string, unknown> = {};
if (typeof body.plano === "string") updates.plano = body.plano;
await admin.from("tenants").update(updates).eq("id", tenantId);
```

**Split B — `tenant_subscriptions_billing.plan_code` (new billing system)**
```typescript
// super-admin-change-tenant-plan/index.ts (separate function)
// Upserts tenant_subscriptions_billing, does NOT touch tenants.plano
await admin.from("tenant_subscriptions_billing").upsert({ plan_code: selectedPlanCode, ... })
```

**Split C — `tenant_subscriptions_billing` joined with `subscription_plans`**
```typescript
// super-admin-tenant-snapshot/index.ts
// Snapshot reads billing from tenant_subscriptions_billing and joins subscription_plans
const plan = planLookupRes.data.find(p => p.code === billingRes.data.plan_code)
billing = { ...billingRes.data, plan };
```

### Where Each Is Used

| Consumer | Uses Which Source |
|---|---|
| `SuperAdminTenantDetalhe` "Plano" tab | `snap.billing.plan_code` from `tenant_subscriptions_billing` |
| `SuperAdminTenants` list card | `billing.plan_name` from `super-admin-list-tenants` output |
| `super-admin-update-tenant` body accepts `plano` | writes to `tenants.plano` |
| `super-admin-create-tenant` | writes `plano` to `tenants` (line: `plano` in INSERT) |
| Wizard `SuperAdminNovoLab` form | `form.plano` → `create-tenant` body → `tenants.plano` |
| Plan display in TenantDetalhe | Uses `tenant_subscriptions_billing` (snapshot) |

### The Gap
When a tenant is **created** via the wizard:
- `tenants.plano = "free"` (or chosen value) is set
- **No `tenant_subscriptions_billing` row is created** by create-tenant function
- The "Plano" tab in TenantDetalhe shows "Nenhuma assinatura vinculada" until SuperAdmin manually assigns a plan via "Atribuir plano"

When a plan is **changed** via TenantDetalhe → "Trocar plano":
- `tenant_subscriptions_billing` is updated by `change-tenant-plan`
- `tenants.plano` is NOT updated
- These two fields become out of sync

### Risk Rating: 🔴 HIGH
**`tenants.plano` and `tenant_subscriptions_billing.plan_code` can contain different values for the same tenant.** Any system that reads `tenants.plano` (e.g. for feature gating, reporting, API) will see the stale legacy value while the billing system shows the current plan.

---

## 3. Plan Limits — Stored but Not Enforced

### Where Limits Live
| Limit | Column | Table |
|---|---|---|
| Max users | `limite_usuarios` | `subscription_plans` |
| Max units | `limite_unidades` | `subscription_plans` |
| Max atendimentos/month | `limite_atendimentos_mes` | `subscription_plans` |

### Where Limits Are Displayed
- `SuperAdminTenantDetalhe` "Plano" tab → `LimitBadge` component (line 604-607)
- Plan card in `SuperAdminPlanos` page

### Where Limits Are Enforced
- **DB triggers**: None observed
- **RLS policies**: None observed checking plan limits
- **Edge functions**: No limit check in `admin-invite-user`, `create-atendimento`, or similar

### Assessment: 🔴 LIMITS ARE DECORATIVE
Plan limits are stored and displayed but not enforced anywhere in the application layer. A tenant on a "Free" plan with `limite_usuarios=5` can add unlimited users if the invitation flow does not check this limit.

---

## 4. Lab Code — Source of Truth

### Where lab_code Lives
| Table | Field | Role |
|---|---|---|
| `tenant_registry` | `lab_code` | **Primary SSOT** — used by tenant-resolve, display |
| `tenants` | `lab_code` | Denormalized copy (used by SuperAdminTenants list via list-tenants function) |

### Sync Mechanism
- `create-tenant` inserts into `tenants` (trigger auto-creates `tenant_registry` row)  
- Then `super-admin-create-tenant` calls `tenant_registry.UPDATE lab_code` to apply custom code  
- `tenants.lab_code` may come from a trigger or join — not explicitly set in create-tenant INSERT
- `SuperAdminTenantDetalhe` `loadTenant` queries `tenants.lab_code` but the definitive ID routing uses `tenant_registry.lab_code` in `tenant-resolve`

### Assessment: 🟡 MEDIUM RISK
Two tables store `lab_code`. The trigger is the synchronization mechanism. If the trigger fails silently, the two tables diverge. The `lab_code` is displayed from `tenants.lab_code` in most UIs but routing uses `tenant_registry.lab_code`.

---

## 5. Database Strategy / Runtime Mode

### Where It Lives
| Field | Table | Set By |
|---|---|---|
| `database_strategy` | `tenants` | tenant creation / DB config |
| `runtime_mode` | `tenant_registry` | tenant-healthcheck, provisioning |

### How TenantDetalhe Resolves It
```typescript
// SuperAdminTenantDetalhe.tsx line 380-382
const isolatedDb = (snap?.registry?.runtime_mode === "isolated_db")
  || tenant.database_strategy === "isolated_db"
  || tenant.database_strategy === "dedicated";
```
The OR chain merges two sources. If they disagree (e.g., `tenant.database_strategy = "shared_db"` but `registry.runtime_mode = "isolated_db"`), `isolatedDb` is true. The backup button correctly hides for isolated_db.

### Assessment: 🟡 MEDIUM RISK
Two fields encode the same concept. The client-side OR logic handles the ambiguity but could give wrong results if one source is stale.

---

## 6. Admin User Identity

### Who is "the admin"?
The snapshot function finds the tenant admin by:
```typescript
admin.from("profiles")
  .select("...")
  .eq("tenant_id", tenantId)
  .eq("perfil", "admin")
  .order("created_at", { ascending: true })
  .limit(1)
  .maybeSingle()
```
The **oldest** profile with `perfil="admin"` is considered the admin. If a tenant has multiple admins, only one is shown and operated on (password reset, impersonation targets this user).

### Assessment: 🟡 MEDIUM RISK
"Admin of tenant" is a runtime query result, not a persisted FK. Multi-admin tenants show only one admin in the UI. Password reset and impersonation target the oldest admin only — this could be surprising if the customer considers a different user as the primary admin.

---

## 7. SSOT Recommendations

| Priority | Recommendation |
|---|---|
| P0 | Deprecate `tenants.plano` field or keep it in sync with `tenant_subscriptions_billing.plan_code` via a DB trigger |
| P0 | Create `tenant_subscriptions_billing` row automatically in `super-admin-create-tenant` using the chosen `plano` |
| P1 | Add DB-level enforcement for plan limits (CHECK constraint or trigger) |
| P1 | Add UI paths to set `"inativo"` and `"bloqueado"` statuses, or remove them from the status enum |
| P1 | Consolidate `database_strategy` and `runtime_mode` into a single field in one table |
| P2 | Expose "tenant admin" as a named FK (`primary_admin_user_id`) rather than a runtime query |
| P2 | Add `lab_code` sync validation in healthcheck to detect divergence between `tenants` and `tenant_registry` |
