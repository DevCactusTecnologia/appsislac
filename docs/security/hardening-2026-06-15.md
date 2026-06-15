# Security Hardening Report — 2026-06-15

Scope: 11 findings selected by the user from the latest scan.

## DB migration (single)

| Finding | Action |
|---|---|
| `inscricoes_anon_full_read` | Dropped 3 anon policies (`Public insert/select/update`) and revoked SELECT/INSERT/UPDATE/DELETE on `public.inscricoes` from `anon`. The signup flow runs exclusively through the `leads-manager` edge function (service role + OTP). |
| `tenant_payment_gateways_broad_access` | Dropped the catch-all `Users can manage their tenant payment gateways` policy. Replaced with 4 RBAC policies: SELECT → admin OR manager of the tenant (or super_admin); INSERT/UPDATE/DELETE → admin of the tenant (or super_admin). Recepcionistas/analysts no longer see or mutate gateway secrets. |
| `user_roles_admin_can_grant_super_admin` | Re-created `user_roles_manage` policy with a tighter `WITH CHECK`: `is_super_admin(uid) OR (has_role(uid,'admin') AND role <> 'super_admin')`. Tenant admins can no longer escalate themselves. |
| `tenant_subscriptions_password_hash_stored` | `ALTER TABLE … DROP COLUMN admin_senha_hash`. Credentials live exclusively in Supabase Auth. |
| `SUPA_function_search_path_mutable` | `ALTER FUNCTION` set `search_path = public, extensions` on the 3 remaining functions without it (`update_updated_at_column`, `handle_tenant_identifiers`, `handle_default_payment_gateway`). |
| `SUPA_anon_security_definer_function_executable` | `REVOKE EXECUTE … FROM PUBLIC, anon` on all functions in `public`. Re-granted EXECUTE to `authenticated` + `service_role` only. Re-granted to `anon` ONLY for `get_published_tenant_page(uuid,text)` and `lookup_paciente_publico(uuid,text)` (intentional public RPCs). Default privileges set so future functions inherit the same posture. |
| `SUPA_authenticated_security_definer_function_executable` | Same migration. Note: this linter still fires by design — SECURITY DEFINER RPCs that legitimately need to be called by signed-in users (e.g. `current_tenant_id`, `has_role`, `dashboard_kpis`) cannot be downgraded to SECURITY INVOKER without breaking tenant isolation. Recorded as accepted in security memory. |
| `SUPA_rls_policy_always_true` | The two `inscricoes` policies (`USING true` / `WITH CHECK true`) were dropped in step 1; no other always-true policies remain in the database (verified via `pg_policy`). |

## Auth configuration

| Finding | Action |
|---|---|
| `SUPA_auth_leaked_password_protection` | `password_hibp_enabled` toggled to `true` via `configure_auth`. New passwords / password changes are checked against HIBP. |

## Frontend

| Finding | Action |
|---|---|
| `ckeditor_ghs_stored_xss` | Two layers of defense added (without changing existing PDF / print layout): **(1) Write-time** — `src/components/editor/CKEditor.tsx` `htmlSupport` now uses a restricted allowlist (block/inline formatting + table family + image/link only) and an explicit `disallow` for `script`, `iframe`, `object`, `embed`, `form`, `input`, `button`, `select`, `textarea`, `link`, `meta`, `base`, `svg`, `math` and any `on*` attribute. **(2) Render-time** — new `src/lib/sanitizeHtml.ts` (DOMPurify) is applied at every `dangerouslySetInnerHTML` / `innerHTML` site that consumes editor HTML: `LayoutDialog.tsx`, `PreviewComprovantesDialog.tsx`, `DocumentoTemplateDialog.tsx`, `admin/CKEditorTest.tsx`, and `ResultadoDetalhe.tsx` (PDF builder). Sanitizer preserves all formatting (tables, classes, inline styles, colspans, images) — visual output is identical; only `<script>` / event handlers / `javascript:` URLs are stripped. The `layout-impressao-travado` constraint is honored (no margin / footer / signature CSS changes). |
| `analyst_role_check_bypass` | `src/lib/validarCredenciaisAnalista.ts` no longer relies on the local `usuariosStore` cache for the role check. After the transient `signInWithPassword`, it calls `has_role(_user_id, 'analista')` and `has_role(_user_id, 'admin')` via RPC (SECURITY DEFINER, server-side). The cache is now only used for cosmetic name/initials lookup. A user from another tenant / outside the cache is correctly rejected. |

## Residual / accepted

- `SUPA_anon_security_definer_function_executable` will keep flagging the 2 anon-allowlisted RPCs (`get_published_tenant_page`, `lookup_paciente_publico`). These are required for the public landing/portal and validated to read only published / lookup data. Documented in security memory.
- `SUPA_authenticated_security_definer_function_executable` will keep flagging tenant-scoped helpers (`current_tenant_id`, `has_role`, `is_super_admin`, page RPCs). Switching to SECURITY INVOKER would break RLS bypass that these functions rely on. Documented in security memory.

## Files changed

- new: `src/lib/sanitizeHtml.ts`
- new: `docs/security/hardening-2026-06-15.md`
- edited: `src/components/editor/CKEditor.tsx`, `src/components/configuracoes/LayoutDialog.tsx`, `src/components/configuracoes/PreviewComprovantesDialog.tsx`, `src/components/configuracoes/documentos/DocumentoTemplateDialog.tsx`, `src/pages/admin/CKEditorTest.tsx`, `src/pages/ResultadoDetalhe.tsx`, `src/lib/validarCredenciaisAnalista.ts`
- DB migration: 1 file (RLS + GRANTs + column drop + search_path)
- Auth config: HIBP enabled
