// Shared helper to enforce tenant isolation on admin edge functions.
// Returns ok=true when the caller may act on the target user, otherwise an
// HTTP-ready error tuple. Super admins always pass.
//
// Usage:
//   const guard = await assertSameTenantOrSuperAdmin(admin, callerId, targetId);
//   if (!guard.ok) return errorResponse(guard.status, guard.message, requestId, log);

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export interface TenantGuardOk {
  ok: true;
  callerTenantId: string | null;
  targetTenantId: string | null;
  isSuperAdmin: boolean;
  targetIsSuperAdmin: boolean;
}
export interface TenantGuardErr {
  ok: false;
  status: number;
  message: string;
}
export type TenantGuardResult = TenantGuardOk | TenantGuardErr;

async function fetchTenant(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await admin
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as { tenant_id?: string | null } | null)?.tenant_id ?? null;
}

async function isSuper(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin.rpc("is_super_admin", { _user_id: userId });
  return data === true;
}

/**
 * Resolves caller and target tenants, then asserts:
 *   - caller is super_admin (bypass), OR
 *   - caller.tenant_id == target.tenant_id AND target is NOT super_admin.
 *
 * Never trust client-provided tenant_id — it is always resolved server-side.
 */
export async function assertSameTenantOrSuperAdmin(
  admin: SupabaseClient,
  callerUserId: string,
  targetUserId: string,
): Promise<TenantGuardResult> {
  if (!targetUserId) {
    return { ok: false, status: 400, message: "userId obrigatório" };
  }

  const [callerSuper, targetSuper, callerTenant, targetTenant] = await Promise.all([
    isSuper(admin, callerUserId),
    isSuper(admin, targetUserId),
    fetchTenant(admin, callerUserId),
    fetchTenant(admin, targetUserId),
  ]);

  // Super admin bypass — platform role, scope global.
  if (callerSuper) {
    return {
      ok: true,
      callerTenantId: callerTenant,
      targetTenantId: targetTenant,
      isSuperAdmin: true,
      targetIsSuperAdmin: targetSuper,
    };
  }

  // Tenant admins can never touch a super_admin account.
  if (targetSuper) {
    return { ok: false, status: 403, message: "Operação não permitida sobre super administradores" };
  }

  if (!callerTenant) {
    return { ok: false, status: 403, message: "Caller sem tenant associado" };
  }
  if (!targetTenant) {
    return { ok: false, status: 404, message: "Usuário alvo não encontrado" };
  }
  if (callerTenant !== targetTenant) {
    return { ok: false, status: 403, message: "Operação não permitida: usuário pertence a outro laboratório" };
  }

  return {
    ok: true,
    callerTenantId: callerTenant,
    targetTenantId: targetTenant,
    isSuperAdmin: false,
    targetIsSuperAdmin: false,
  };
}
