// ============================================================
// Feature flags — canary controlado
// ------------------------------------------------------------
// Ordem de precedência:
//   1) localStorage (override local p/ QA/devs)
//   2) tenant.feature_flags (RPC `current_tenant_feature_flags`)
//   3) default (false)
//
// Fail-safe: qualquer erro de leitura → flag OFF (comportamento antigo).
// ============================================================

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export type FeatureFlagKey =
  | "paginated_atendimentos"
  | "USE_LEGACY_STORE"
  /**
   * Habilita o provider DBSync (DB Diagnósticos) por tenant.
   * Default OFF — quando OFF, zero polling/jobs/dispatch DBSync.
   */
  | "dbsync_enabled"
  /**
   * Login V2 multi-database (fluxo 2 etapas + branding dinâmico).
   * Default ON; fallback legado em /login?legacy=1.
   */
  | "login_v2";

const LOCAL_STORAGE_PREFIX = "ff:";

type TenantFlags = Record<string, unknown>;

let _tenantFlags: TenantFlags | null = null;
let _loadPromise: Promise<TenantFlags> | null = null;
const _listeners = new Set<() => void>();

function notify() {
  for (const l of _listeners) {
    try { l(); } catch { /* fail-safe */ }
  }
}

function readLocal(key: FeatureFlagKey): boolean | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(LOCAL_STORAGE_PREFIX + key);
    if (raw === null) return null;
    return raw === "1" || raw === "true";
  } catch {
    return null;
  }
}

function readTenantFlag(key: FeatureFlagKey): boolean {
  if (!_tenantFlags) return false;
  const v = _tenantFlags[key];
  return v === true || v === "true" || v === 1 || v === "1";
}

export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  const local = readLocal(key);
  if (local !== null) return local;
  return readTenantFlag(key);
}

/** Limpa o cache (chame no logout). */
export function resetFeatureFlags(): void {
  _tenantFlags = null;
  _loadPromise = null;
  notify();
}

/** Carrega flags do tenant atual. Idempotente; cacheia em memória. */
export async function loadTenantFeatureFlags(): Promise<TenantFlags> {
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    try {
      const { data, error } = await supabase.rpc("current_tenant_feature_flags");
      if (error) {
        logger.warn("featureFlags", "current_tenant_feature_flags falhou", { error: error.message });
        _tenantFlags = {};
      } else {
        _tenantFlags = (data && typeof data === "object" ? (data as TenantFlags) : {}) ?? {};
      }
    } catch (e: unknown) {
      logger.warn("featureFlags", "exceção ao carregar feature_flags", { error: (e as Error)?.message });
      _tenantFlags = {};
    } finally {
      notify();
    }
    return _tenantFlags ?? {};
  })();
  return _loadPromise;
}

export function subscribeFeatureFlags(listener: () => void): () => void {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}

/** React hook reativo. Retorna `false` até carregar; nunca lança. */
export function useFeatureFlag(key: FeatureFlagKey): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => isFeatureEnabled(key));
  useEffect(() => {
    let alive = true;
    loadTenantFeatureFlags().finally(() => {
      if (alive) setEnabled(isFeatureEnabled(key));
    });
    const unsub = subscribeFeatureFlags(() => {
      if (alive) setEnabled(isFeatureEnabled(key));
    });
    // Reage a mudanças manuais via DevTools (storage event de outras abas)
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith(LOCAL_STORAGE_PREFIX) && alive) {
        setEnabled(isFeatureEnabled(key));
      }
    };
    if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
    return () => {
      alive = false;
      unsub();
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
    };
  }, [key]);
  return enabled;
}