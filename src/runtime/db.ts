/**
 * SISLAC Database Migration Core — Runtime cliente (versão simplificada).
 *
 * Objetivo único: expor um único ponto de acesso ao banco (`db`) e helpers
 * para descobrir/cachear o tenant do usuário autenticado.
 *
 * O roteamento shared → dedicated NÃO é feito no cliente. Enquanto o tenant
 * usa o banco compartilhado (Lovable Cloud) todo o app conversa com ele. Após
 * o flip, o cliente continua apontando para o mesmo endpoint público do
 * projeto Supabase configurado no `.env` — a troca real de projeto acontece
 * fora deste runtime (novo deploy com novas vars de ambiente).
 *
 * Este arquivo consolida o antigo `src/runtime/db/*` (index, factory,
 * strategies, resolver, telemetry, tenantContext, types) em um único módulo.
 */

import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// ── Tipos públicos ──────────────────────────────────────────────────
export type RuntimeStrategy = "shared" | "dedicated";
export type TenantDBStrategy = RuntimeStrategy;
export type RuntimeClient = SupabaseClient<Database>;

export interface TenantContext {
  tenant_id: string;
  database_strategy: TenantDBStrategy;
}

export interface TenantRuntimeContext {
  tenant_id: string;
  strategy: RuntimeStrategy;
}

export class RuntimeError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "RuntimeError";
  }
}

// ── Estado ──────────────────────────────────────────────────────────
const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

let _cachedContext: TenantContext | null = null;
let _cachedTenantNome: string | null = null;
let _inflight: Promise<TenantContext> | null = null;
let _authListenerInstalled = false;

// ── Cliente único ───────────────────────────────────────────────────
/**
 * Cliente Supabase único usado por toda a aplicação. Mantido como export
 * nomeado (`db`) por compatibilidade com o restante do código.
 */
export const db: RuntimeClient = supabase as unknown as RuntimeClient;

// ── Cache management ────────────────────────────────────────────────
export function clearTenantContextCache(): void {
  _cachedContext = null;
  _cachedTenantNome = null;
  _inflight = null;
}

/**
 * Instala listener que limpa o cache do tenant sempre que a sessão muda.
 * Deve ser chamado uma vez, no bootstrap.
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

// ── Resolução de tenant ─────────────────────────────────────────────
async function resolveContext(): Promise<TenantContext> {
  const { data: { user } } = await supabase.auth.getUser();
  let tenant_id = DEFAULT_TENANT_ID;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile?.tenant_id) tenant_id = profile.tenant_id;
  }
  return { tenant_id, database_strategy: "shared" };
}

export async function getTenantContext(): Promise<TenantContext> {
  if (_cachedContext) return _cachedContext;
  if (_inflight) return _inflight;
  _inflight = resolveContext()
    .then((ctx) => { _cachedContext = ctx; return ctx; })
    .finally(() => { _inflight = null; });
  return _inflight;
}

export async function getCurrentTenantId(): Promise<string> {
  return (await getTenantContext()).tenant_id;
}

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

export function getCachedTenantNome(): string | null {
  return _cachedTenantNome;
}

export function getCachedTenantContext(): TenantContext | null {
  return _cachedContext;
}

// ── Compat shims (mantidos para não quebrar chamadas existentes) ────
/**
 * Antes: recarregava o contexto do runtime (Fase 2 client). Hoje: apenas
 * garante uma resolução recente do tenant. Mantido por compat.
 */
export async function refreshContext(): Promise<TenantRuntimeContext> {
  clearTenantContextCache();
  const ctx = await getTenantContext();
  return { tenant_id: ctx.tenant_id, strategy: "shared" };
}

/** Antes: descartava clientes cacheados. Hoje: apenas limpa metadados. */
export async function resetRuntime(): Promise<void> {
  clearTenantContextCache();
}

/** Snapshot síncrono do último contexto conhecido. */
export function getCurrentContext(): TenantRuntimeContext {
  const ctx = _cachedContext;
  return {
    tenant_id: ctx?.tenant_id ?? DEFAULT_TENANT_ID,
    strategy: "shared",
  };
}
