// Preferências exclusivas do painel Super Admin.
// Apenas a posição do menu é mantida — o modo escuro foi removido do produto.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

export type SaMenuMode = "sidebar" | "topbar";

interface SuperAdminPrefs {
  menuMode: SaMenuMode;
}

const DEFAULTS: SuperAdminPrefs = { menuMode: "sidebar" };
const STORAGE_PREFIX = "sislac-superadmin-menu:";

function storageKey(userId: string | number | undefined) {
  return `${STORAGE_PREFIX}${userId ?? "anon"}`;
}

function readPrefs(userId: string | number | undefined): SuperAdminPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<SuperAdminPrefs>;
    return {
      menuMode: parsed.menuMode === "topbar" || parsed.menuMode === "sidebar" ? parsed.menuMode : DEFAULTS.menuMode,
    };
  } catch { return DEFAULTS; }
}

function writePrefs(userId: string | number | undefined, prefs: SuperAdminPrefs) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(storageKey(userId), JSON.stringify({ menuMode: prefs.menuMode })); } catch { /* ignore */ }
}

interface CtxValue extends SuperAdminPrefs {
  setMenuMode: (m: SaMenuMode) => void;
}

const Ctx = createContext<CtxValue | undefined>(undefined);

export function SuperAdminPrefsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;

  const [prefs, setPrefs] = useState<SuperAdminPrefs>(() => readPrefs(userId));

  useEffect(() => {
    setPrefs(readPrefs(userId));
  }, [userId]);

  const setMenuMode = useCallback((m: SaMenuMode) => {
    setPrefs((current) => {
      const next = { ...current, menuMode: m };
      writePrefs(userId, next);
      return next;
    });
  }, [userId]);

  const value = useMemo<CtxValue>(() => ({
    menuMode: prefs.menuMode,
    setMenuMode,
  }), [prefs.menuMode, setMenuMode]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSuperAdminPrefs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSuperAdminPrefs must be used within SuperAdminPrefsProvider");
  return ctx;
}
