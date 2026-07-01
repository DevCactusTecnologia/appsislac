/**
 * Runtime 2.0 — Tenant Context (Fase D).
 *
 * Fonte única para descoberta do tenant do usuário autenticado + estratégia
 * de infraestrutura (`tenant_registry`). Consolidado a partir do antigo
 * `src/lib/db/tenantResolver.ts` como parte da eliminação de duplicações
 * arquiteturais da Fase D.
 *
 * Este módulo NÃO cria clients — apenas descobre metadados. A criação
 * do transport permanece na Factory / Strategies do runtime.
 */

import { db as supabase } from "@/runtime/db";

export type TenantDBStrategy = "shared" | "dedicated";

export interface TenantContext {
  tenant_id: string;
  database_strategy: TenantDBStrategy;
  database_url: string | null;
}

let _cachedContext: TenantContext | null = null;
let _cachedTenantNome: string | null = null;
let _authListenerInstalled = false;

// Tenant padrão da plataforma (laboratório principal) usado como fallback
// quando a resolução via `profiles.tenant_id` não retorna nada.
const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

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

  const { data: { user } } = await supabase.auth.getUser();
  let tenant_id = DEFAULT_TENANT_ID;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile?.tenant_id) {
      tenant_id = profile.tenant_id;
    }
  }

  let strategy: TenantDBStrategy = "shared";
  let url: string | null = null;

  try {
    const { data: reg } = await supabase
      .from("tenant_registry")
      .select("database_strategy")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (reg) {
      strategy = (reg as { database_strategy?: string }).database_strategy === "dedicated"
        ? "dedicated"
        : "shared";
      const { data: t } = await supabase
        .from("tenants")
        .select("database_url")
        .eq("id", tenant_id)
        .maybeSingle();
      url = (t as { database_url?: string | null } | null)?.database_url ?? null;
    } else {
      const { data: t } = await supabase
        .from("tenants")
        .select("database_strategy, database_url")
        .eq("id", tenant_id)
        .maybeSingle();
      if (t) {
        const row = t as { database_strategy?: string; database_url?: string | null };
        strategy = row.database_strategy === "dedicated" ? "dedicated" : "shared";
        url = row.database_url ?? null;
      }
    }
  } catch (err) {
    console.error("[tenantContext] Erro ao resolver infraestrutura do tenant:", err);
  }

  _cachedContext = { tenant_id, database_strategy: strategy, database_url: url };
  return _cachedContext;
}

/** Atalho para obter apenas o ID do tenant. */
export async function getCurrentTenantId(): Promise<string> {
  const context = await getTenantContext();
  return context.tenant_id;
}

/** Nome legível do tenant — usado em badges e branding. */
export async function getCurrentTenantNome(): Promise<string> {
  if (_cachedTenantNome) return _cachedTenantNome;

  const tid = await getCurrentTenantId();
  try {
    const { data } = await supabase
      .from("tenants")
      .select("nome")
      .eq("id", tid)
      .maybeSingle();
    _cachedTenantNome = ((data as { nome?: string } | null)?.nome ?? "SISLAC").trim() || "SISLAC";
  } catch {
    _cachedTenantNome = "SISLAC";
  }
  return _cachedTenantNome;
}

/** Versão síncrona do nome (retorna o último carregado ou null). */
export function getCachedTenantNome(): string | null {
  return _cachedTenantNome;
}
