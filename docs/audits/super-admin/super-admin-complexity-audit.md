# Super-Admin — Complexity Audit
> Auditor: Senior Architect | Date: 2025-01-31 | SISLAC Control Plane

---

## 1. File-Level Complexity

| File | Lines | Dialogs / Modals | State vars | Edge functions called | Complexity |
|---|---|---|---|---|---|
| `SuperAdminTenantDetalhe.tsx` | **1160** | 5 (reset, delete, editAdmin, suspend, changePlan) | ~20 useState | 8 functions | 🔴 HIGH |
| `SuperAdminNovoLab.tsx` | 548 | 0 | ~7 useState | 1 function | 🟡 MEDIUM |
| `SuperAdminInscricoes.tsx` | 511 | 1 (detail dialog) | ~5 useState | 0 (direct DB) | 🟡 MEDIUM |
| `SuperAdminPlanos.tsx` | 315 | 2 (edit, delete confirm) | ~5 useState | 1 function (5 actions) | 🟢 LOW |
| `SuperAdminConfiguracoes.tsx` | 866 | 0 | ~12 useState | 1 function | 🟡 MEDIUM |
| `SuperAdminAuditoria.tsx` | full (est. 415) | 0 | ~5 useState | 0 (direct DB) | 🟢 LOW |
| `SuperAdminDashboard.tsx` | ~243 | 0 | ~2 useState | 1 function | 🟢 LOW |
| `SuperAdminTenants.tsx` | ~234 | 0 | ~3 useState | 1 function | 🟢 LOW |

---

## 2. SuperAdminTenantDetalhe Deep-Dive (1160 lines)

### State Machine Complexity
The component maintains **20 independent `useState` hooks** that interact implicitly:
- `tenant` + `snap` — two parallel data models describing the same entity (see SSOT doc)
- `actionBusy` — shared boolean for 5 different async actions (impersonate, suspend, delete, editAdmin, changePlan) → no way to know WHICH action is running
- `backupBusy` — separate busy for backup only (correct)
- `loading` (tenant load) vs `snapLoading` (snapshot load) — two separate loading states

### Cascade of Data Fetches on Mount
```
loadTenant()          → supabase.from("tenants").select("*")
  └─ on complete:
    loadSnapshot()    → fetch(super-admin-tenant-snapshot)   [13 parallel DB queries server-side]
      └─ on complete: billing plan info rendered
    (parallel) load plans useEffect → supabase.functions.invoke("super-admin-plans")
```
Three sequential waterfalls on initial render. `loadSnapshot` depends on `tenant.id` which depends on `loadTenant`. Plans load independently. Total round-trips: 3+ (client→server) before full page is rendered.

### Tab Architecture
5 tabs rendered conditionally inside a single large component:
- `identidade` — dados cadastrais + admin user + technical info + danger zone
- `plano` — billing + plan change
- `operacao` — live metrics + support access toggle (Switch with `defaultChecked` — state NOT persisted anywhere, line 672)
- `banco` — TenantDatabaseConfig + backup
- `seguranca` — users by profile + health signals

Each tab's JSX is an inline block. No extraction into sub-components → file grows linearly with features.

### The "Support Access" Switch Antipattern
```tsx
// SuperAdminTenantDetalhe.tsx line 672
<Switch defaultChecked />
```
This switch has no `checked` prop, no `onCheckedChange` handler, and no persistence. It is **decorative only** — always starts checked, saves nothing. This is a **fake control** in a critical-access page.

---

## 3. Edge Function Complexity

### `super-admin-create-tenant` — Complexity: HIGH
- 8 sequential async steps: auth → role check → slug → tenant insert → lab_code override → unit seed → mapas seed → formas_pagamento seed → user creation → role upsert
- **Non-atomic**: Steps 5-9 can fail independently without rolling back earlier steps
- Error handling: most seed failures are non-fatal (logged as warn) — creates partial state

### `super-admin-delete-tenant` — Complexity: HIGH
- N+1 loop: `for (const uid of userIds)` → `rpc("is_super_admin")` per user (line ~50 of delete function)
- For a tenant with 50 users: 50 sequential RPC calls before deletion begins
- Synchronous execution in single edge function invocation (no queue)

### `super-admin-tenant-snapshot` — Complexity: HIGH
- 13 parallel DB queries (`Promise.all`) — good design
- BUT also calls `auth.admin.getUserById` sequentially after for the admin user
- Total: 13 parallel + 1 sequential = 14 queries per snapshot load

### `super-admin-impersonate-tenant` — Complexity: MEDIUM-HIGH
- Per-user RPC loop to filter super admins: O(n) sequential calls inside eligible filter
- For tenants with many users this can be slow

### `super-admin-tenant-backup` — Complexity: HIGH
- ~40 table queries executed sequentially in a loop
- Entire dataset loaded into Deno memory as JS objects
- XLSX generation in memory via `xlsx@0.18.5`
- No streaming → edge function memory limit risk for large tenants

---

## 4. NovoLab Wizard Complexity

### Step Validation Gap
```typescript
// SuperAdminNovoLab.tsx line 77
const errorsByStep: Record<number, string | null> = useMemo(() => ({
  1: !form.nome.trim() ? "Informe o nome" : null,
  2: null,  // ← no validation
  3: null,  // ← no validation
  4: null,  // ← no validation
  5: null,  // ← no validation
}), [form]);
```
Only step 1 has validation. Admin email, admin name, and admin password (all required by the edge function) are collected in step 5 but **not validated client-side** before submission. The function will return 400 if they are missing.

### Stepper Jump
The stepper allows jumping to any completed or future step (`onJump={setStep}`) without validation. A user can jump from step 1 directly to step 5 and click "Ativar laboratório" with only `nome` filled in.

### StepBranding Dead Code
`StepBranding` function (lines 377-405 of NovoLab) is defined but **never rendered** — step 5 renders `StepAtivacao` instead. Dead code.

---

## 5. SuperAdminConfiguracoes Complexity

- 4 integration configs managed simultaneously in a single component (866 lines)
- Dirty-check via `JSON.stringify` comparison for each config (lines 187-193) — correct but brittle for nested objects
- `saas_settings` table accessed **directly from the client** without an edge function → bypasses audit logging and rate limiting
- SMTP password, AWS secrets, and WhatsApp tokens stored and loaded as plain JSON — no field-level encryption at the application layer

---

## 6. SuperAdminAuditoria Complexity

- Loads **last 500 events** via direct client query (line 44: `.limit(500)`) — no server-side filtering before returning all rows to client
- All filtering (tenant, search term) done **client-side** with `useMemo` on the full 500-row array
- For 100+ labs this limit will hide events — pagination exists but only over the already-fetched 500 rows, not over the full DB

---

## 7. Direct DB Access Anti-Patterns

Three pages bypass the edge-function layer entirely:

| Page | Table | Risk |
|---|---|---|
| `SuperAdminInscricoes` | `inscricoes` | No server-side audit; client sends raw SQL filters |
| `SuperAdminAuditoria` | `atendimento_audit`, `tenants` | 500-row limit baked on client; no server validation |
| `SuperAdminConfiguracoes` | `saas_settings` | Secrets in plaintext; no edge function guard |

This means these three pages rely **entirely on RLS** for security — and since super-admin sessions use elevated permissions (confirmed by `isSuperAdmin` flag in AuthContext), any misconfigured RLS would give full table access.
