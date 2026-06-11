/**
 * Tenant Resolver — Fonte única de verdade para contexto multi-tenant.
 * 
 * Consolidado (Fase 3: Simplificação):
 * - Unifica a descoberta do tenant_id (ex-data/_tenant.ts).
 * - Resolve a estratégia de banco (shared vs dedicated).
 * - Cache centralizado com invalidação automática em logout.
 * 
 * Fonte Única de Verdade (Governance): `tenant_registry` decide estratégia e roteamento.
 */

import { supabase } from "@/integrations/supabase/client";
import type { TenantContext, DBStrategy } from "./types";

let _cachedContext: TenantContext | null = null;
let _cachedTenantNome: string | null = null;
let _authListenerInstalled = false;

// ID do Tenant Demo (fallback seguro)
const DEMO_TENANT_ID = "00000000-0000-0000-0000-000000000001";

export function clearTenantContextCache(): void {
  _cachedContext = null;
  _cachedTenantNome = null;
}

/**
 * Invalidação automática do cache em logout / troca de usuário.
 */
export function installTenantAuthInvalidation(): void {
  if (_authListenerInstalled) return;
  _authListenerInstalled = true;

  let lastUserId: string | null = null;
  supabase.auth.onAuthStateChange((event, session) => {
    const uid = session?.user?.id ?? null;
    if (event === "SIGNED_OUT" || uid !== lastUserId) {
      clearTenantContextCache();
    }
    lastUserId = uid;
  });
}

/**
 * Descobre o contexto completo do tenant para o usuário atual.
 * Formalizado como a fonte única para decisões de roteamento e estratégia.
 */
export async function getTenantContext(): Promise<TenantContext> {
  if (_cachedContext) return _cachedContext;

  // 1. Identifica o usuário
  const { data: { user } } = await supabase.auth.getUser();
  let tenant_id = DEMO_TENANT_ID;

  if (user) {
    // 2. Busca o tenant_id no profile (Fonte de verdade da identidade)
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile?.tenant_id) {
      tenant_id = profile.tenant_id;
    }
  }

  // 3. Resolve estratégia via tenant_registry (Fonte de verdade da infraestrutura)
  let strategy: DBStrategy = "shared";
  let url: string | null = null;

  try {
    const { data: reg } = await supabase
      .from("tenant_registry")
      .select("database_strategy")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (reg) {
      strategy = (reg as any).database_strategy === "dedicated" ? "dedicated" : "shared";
      // O registry não guarda a URL bruta (segurança). Ela é reconstruída se necessário
      // ou lida da tabela tenants (legado).
      const { data: t } = await supabase
        .from("tenants")
        .select("database_url")
        .eq("id", tenant_id)
        .maybeSingle();
      url = t?.database_url ?? null;
    } else {
      // Fallback para tabela tenants (compatibilidade com backfill incompleto)
      const { data: t } = await supabase
        .from("tenants")
        .select("database_strategy, database_url")
        .eq("id", tenant_id)
        .maybeSingle();
      if (t) {
        strategy = t.database_strategy === "dedicated" ? "dedicated" : "shared";
        url = t.database_url ?? null;
      }
    }
  } catch (err) {
    console.error("[tenantResolver] Erro ao resolver infraestrutura do tenant:", err);
  }

  _cachedContext = { tenant_id, database_strategy: strategy, database_url: url };
  return _cachedContext;
}

/** 
 * Atalho para obter apenas o ID do tenant (Backward-compatible). 
 */
export async function getCurrentTenantId(): Promise<string> {
  const context = await getTenantContext();
  return context.tenant_id;
}

/**
 * Nome legível do tenant — usado em badges e branding.
 */
export async function getCurrentTenantNome(): Promise<string> {
  if (_cachedTenantNome) return _cachedTenantNome;
  
  const tid = await getCurrentTenantId();
  try {
    const { data } = await supabase
      .from("tenants")
      .select("nome")
      .eq("id", tid)
      .maybeSingle();
    _cachedTenantNome = (data?.nome ?? "SISLAC").trim() || "SISLAC";
  } catch {
    _cachedTenantNome = "SISLAC";
  }
  return _cachedTenantNome;
}

/** Versão síncrona do nome (retorna o último carregado ou null). */
export function getCachedTenantNome(): string | null {
  return _cachedTenantNome;
}
