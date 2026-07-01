/**
 * Runtime 2.0 — Tenant Context (Fase D + Fase 2).
 *
 * Fonte única para descoberta do tenant do usuário autenticado + estratégia
 * de infraestrutura. Na Fase 2, também busca as credenciais do banco
 * dedicado via edge function `tenant-runtime-config`.
 *
 * Este módulo NÃO cria clients — apenas descobre metadados.
 */

import { supabase as sharedClient } from "@/integrations/supabase/client";

export type TenantDBStrategy = "shared" | "dedicated";

export interface TenantContext {
  tenant_id: string;
  database_strategy: TenantDBStrategy;
  database_url: string | null;
  anon_key: string | null;
  allowed_tables: string[];
}

let _cachedContext: TenantContext | null = null;
let _cachedTenantNome: string | null = null;
let _authListenerInstalled = false;
let _inflight: Promise<TenantContext> | null = null;

// Tenant padrão da plataforma usado como fallback.
const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

export function clearTenantContextCache(): void {
  _cachedContext = null;
  _cachedTenantNome = null;
  _inflight = null;
}

export function installTenantAuthInvalidation(): void {
  if (_authListenerInstalled) return;
  _authListenerInstalled = true;

  let lastUserId: string | null = null;
  sharedClient.auth.onAuthStateChange((event, session) => {
    const uid = session?.user?.id ?? null;
    if (event === "SIGNED_OUT" || uid !== lastUserId) {
      clearTenantContextCache();
    }
    lastUserId = uid;
  });
}

interface RuntimeConfigResponse {
  mode: "shared" | "dedicated";
  dedicated: { url: string; anon_key: string } | null;
  allowed_tables: string[];
  reason?: string | null;
}

async function fetchRuntimeConfig(): Promise<RuntimeConfigResponse | null> {
  try {
    const { data, error } = await sharedClient.functions.invoke<RuntimeConfigResponse>(
      "tenant-runtime-config",
      { body: {} },
    );
    if (error) {
      console.warn("[tenantContext] runtime-config error:", error.message);
      return null;
    }
    return data ?? null;
  } catch (e) {
    console.warn("[tenantContext] runtime-config exception:", e);
    return null;
  }
}

async function resolveContext(): Promise<TenantContext> {
  const { data: { user } } = await sharedClient.auth.getUser();
  let tenant_id = DEFAULT_TENANT_ID;

  if (user) {
    const { data: profile } = await sharedClient
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile?.tenant_id) tenant_id = profile.tenant_id;
  }

  // Se não há usuário autenticado, retornamos shared imediatamente
  // — sem chamar a edge function (evita 401 desnecessário).
  if (!user) {
    return { tenant_id, database_strategy: "shared", database_url: null, anon_key: null, allowed_tables: [] };
  }

  const cfg = await fetchRuntimeConfig();
  if (cfg?.mode === "dedicated" && cfg.dedicated) {
    return {
      tenant_id,
      database_strategy: "dedicated",
      database_url: cfg.dedicated.url,
      anon_key: cfg.dedicated.anon_key,
      allowed_tables: cfg.allowed_tables ?? [],
    };
  }

  return { tenant_id, database_strategy: "shared", database_url: null, anon_key: null, allowed_tables: [] };
}

export async function getTenantContext(): Promise<TenantContext> {
  if (_cachedContext) return _cachedContext;
  if (_inflight) return _inflight;
  _inflight = resolveContext()
    .then((ctx) => {
      _cachedContext = ctx;
      return ctx;
    })
    .finally(() => { _inflight = null; });
  return _inflight;
}

export async function getCurrentTenantId(): Promise<string> {
  const context = await getTenantContext();
  return context.tenant_id;
}

export async function getCurrentTenantNome(): Promise<string> {
  if (_cachedTenantNome) return _cachedTenantNome;
  const tid = await getCurrentTenantId();
  try {
    const { data } = await sharedClient
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

export function getCachedTenantNome(): string | null {
  return _cachedTenantNome;
}

/** Snapshot síncrono do contexto atual (ou null se ainda não resolvido). */
export function getCachedTenantContext(): TenantContext | null {
  return _cachedContext;
}
