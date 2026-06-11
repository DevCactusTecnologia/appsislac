# Super-Admin — Dependency Map
> Auditor: Senior Architect + Security | Date: 2025-01-31 | SISLAC Control Plane

---

## 1. Entry-Point Graph

```
SuperAdminLogin.tsx
 └─ AuthContext (signInWithPassword + role check via user_roles table)
 └─ navigate → /super-admin

/super-admin layout
 └─ SuperAdminPrefsContext.tsx  (localStorage only — menu mode sidebar|topbar)
 └─ ROUTES
      ├── /super-admin                → SuperAdminDashboard.tsx
      ├── /super-admin/laboratorios   → SuperAdminTenants.tsx
      ├── /super-admin/laboratorios/novo → SuperAdminNovoLab.tsx
      ├── /super-admin/laboratorios/:id  → SuperAdminTenantDetalhe.tsx (1160 lines)
      ├── /super-admin/inscricoes     → SuperAdminInscricoes.tsx
      ├── /super-admin/planos         → SuperAdminPlanos.tsx
      ├── /super-admin/configuracoes  → SuperAdminConfiguracoes.tsx
      └── /super-admin/auditoria      → SuperAdminAuditoria.tsx
```

---

## 2. Page → Edge Function Matrix

| Page | Edge Functions Called | Direct DB Queries |
|---|---|---|
| `SuperAdminDashboard` | `super-admin-metrics` | — |
| `SuperAdminTenants` | `super-admin-list-tenants` | — |
| `SuperAdminNovoLab` | `super-admin-create-tenant` | — |
| `SuperAdminTenantDetalhe` | `super-admin-tenant-snapshot` (GET), `super-admin-update-tenant`, `super-admin-change-tenant-plan`, `super-admin-reset-tenant-password`, `super-admin-impersonate-tenant`, `super-admin-delete-tenant`, `super-admin-update-tenant-admin`, `super-admin-plans` (list), `super-admin-tenant-backup` (GET) | `supabase.from("tenants").select("*")` (loadTenant, line 157) |
| `SuperAdminInscricoes` | — | `supabase.from("inscricoes")` (direct CRUD — lines 123-200) |
| `SuperAdminPlanos` | `super-admin-plans` (list, upsert, toggleActive, setDefault, delete) | — |
| `SuperAdminConfiguracoes` | `super-admin-test-integration` | `supabase.from("saas_settings")` (direct CRUD — lines 116-133) |
| `SuperAdminAuditoria` | — | `supabase.from("atendimento_audit")` + `supabase.from("tenants")` (lines 41-51) |

---

## 3. Edge Function Internal Dependencies

### `super-admin-create-tenant`
- **Auth**: `createClient(ANON_KEY)` → `auth.getUser()` → `rpc("is_super_admin")`  
- **DB writes**: `tenants` INSERT → `tenant_registry` UPDATE (lab_code) → `unidades` INSERT  
- **RPCs**: `seed_default_mapas_for_tenant`, `seed_default_formas_pagamento_for_tenant`  
- **Auth Admin API**: `auth.admin.createUser` OR `auth.admin.inviteUserByEmail`  
- **Post-action**: `user_roles` UPSERT (`role="admin"`)

### `super-admin-update-tenant`
- **Auth**: caller → `rpc("is_super_admin")`  
- **DB writes**: `tenants` UPDATE (`status`, `nome`, `cnpj`, `email_contato`, `telefone`, `cidade`, `estado`, `plano`)  
- **Note**: `status` and `plano` fields are both updated here — **dual source of truth risk** (see SSOT doc)

### `super-admin-delete-tenant`
- **Auth**: `rpc("is_super_admin")` + `confirmName` must match `tenants.nome`  
- **DB**: reads `profiles` → for each user_id calls `rpc("is_super_admin")` to skip super admins  
- **Auth Admin API**: `auth.admin.deleteUser` for each non-super profile  
- **DB**: `tenants` DELETE (cascade via FK to all child tables)  
- **RISK**: No soft-delete; no pre-delete snapshot trigger; no async job — synchronous cascade on large tenants

### `super-admin-change-tenant-plan`
- **Auth**: `rpc("is_super_admin")`  
- **DB**: reads `subscription_plans` by `plan_code` → upserts `tenant_subscriptions_billing`  
- **Note**: Does NOT update `tenants.plano` — split from `super-admin-update-tenant`'s `plano` field

### `super-admin-impersonate-tenant`
- **Auth**: `rpc("is_super_admin")`  
- **Logic**: reads all `profiles` for tenant → filters out super_admins (per-row RPC loop)  
- **Auth Admin API**: `auth.admin.generateLink({ type: "magiclink", email })`  
- **Risk**: magic link returned in JSON response body — single-use but visible in logs

### `super-admin-reset-tenant-password`
- **Auth**: `rpc("is_super_admin")` + validates `profile.tenant_id === tenantId` + anti-escalation check  
- **Auth Admin API**: `auth.admin.updateUserById({ password, email? })`  
- **DB**: `profiles.email` sync if email changed

### `super-admin-tenant-snapshot`
- 13 parallel DB queries via `Promise.all` (lines 33-57 of snapshot function)  
- Reads: `profiles`, `atendimentos`, `atendimento_pagamentos`, `pacientes`, `unidades`, `exames_catalogo`, `tenant_subscriptions_billing`, `subscription_plans`, `tenant_registry`  
- **Auth Admin API**: `auth.admin.getUserById` for last_sign_in

### `super-admin-tenant-backup`
- **Format sql**: builds INSERT statements from ~40 tenant tables → gzip compress → stream blob  
- **Format json/xlsx**: same data as JSON or XLSX (xlsx@0.18.5)  
- **Risk**: entire tenant dataset loaded into Deno memory — no streaming; large tenants may OOM edge function

### `tenant-resolve` (public, no auth)
- Lookup chain: `tenant_registry.lab_code` → `tenant_registry.slug` → `profiles.email` → `tenants.lab_code`  
- Returns minimal branding only; never exposes secrets (line: *"NUNCA expõe credenciais"*)

### `tenant-healthcheck`
- Auth: `X-Cron-Secret` header OR `rpc("is_super_admin")`  
- `isolated_db`: calls `neonHealthcheck` (dry-run in Wave 2)  
- `shared_db`: ping `tenant_registry` table  
- Writes results to `tenant_registry.last_health_*`

---

## 4. Shared Infrastructure

| Component | Used By |
|---|---|
| `_shared/hardening.ts` | All super-admin-* functions: CORS headers, structured logger, request_id, timeout, retry |
| `_shared/neonProvider.ts` | `tenant-healthcheck` (isolated_db path) |
| `rpc("is_super_admin")` | Every super-admin-* function + login page (client-side) |
| `supabase.auth.admin.*` | create-tenant, delete-tenant, impersonate-tenant, reset-tenant-password, update-tenant-admin, tenant-snapshot |

---

## 5. Context Dependencies

### `SuperAdminPrefsContext.tsx`
- Depends only on `AuthContext` (for `user.id` as localStorage key)
- Persists `menuMode: "sidebar"|"topbar"` in `localStorage` keyed by `sislac-superadmin-menu:{userId}`
- **No server state** — entirely client-side; safe

### `SuperAdminLogin.tsx`
- Calls `AuthContext.signInWithPassword`
- Post-login **client-side role check** via direct `user_roles` table query (lines 58-63)
- If role missing → `supabase.auth.signOut()` immediately
- Persists last email in `localStorage` key `sislac:last-superadmin-email`

---

## 6. Database Tables Touched by Super-Admin Flow

| Table | Operations |
|---|---|
| `tenants` | SELECT, INSERT, UPDATE, DELETE |
| `tenant_registry` | SELECT, UPDATE (lab_code, health) |
| `tenant_subscriptions_billing` | SELECT, UPSERT |
| `subscription_plans` | SELECT, UPSERT, UPDATE, DELETE |
| `profiles` | SELECT, UPDATE (email sync) |
| `user_roles` | SELECT (role check), UPSERT (admin role on create) |
| `unidades` | INSERT (default unit on create) |
| `inscricoes` | SELECT, UPDATE, DELETE (direct from Inscricoes page) |
| `saas_settings` | SELECT, UPSERT (Configuracoes page — direct from client) |
| `atendimento_audit` | SELECT (Auditoria page — direct from client) |
| `atendimentos`, `atendimento_pagamentos`, `pacientes`, `exames_catalogo` | SELECT (snapshot) |
