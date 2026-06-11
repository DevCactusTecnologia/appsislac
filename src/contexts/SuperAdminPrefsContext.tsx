// Preferências exclusivas do painel Super Admin.
// Somente a posição do menu é mantida; tema antigo não é mais lido, salvo ou aplicado.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

export type SaTheme = "light" | "dark";
export type SaMenuMode = "sidebar" | "topbar";

interface SuperAdminPrefs {
  theme: SaTheme;
  menuMode: SaMenuMode;
}

const DEFAULTS: SuperAdminPrefs = { theme: "light", menuMode: "sidebar" };
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
      theme: DEFAULTS.theme,
      menuMode: parsed.menuMode === "topbar" || parsed.menuMode === "sidebar" ? parsed.menuMode : DEFAULTS.menuMode,
    };
  } catch { return DEFAULTS; }
}

function writePrefs(userId: string | number | undefined, prefs: SuperAdminPrefs) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(storageKey(userId), JSON.stringify({ menuMode: prefs.menuMode })); } catch { /* ignore */ }
}

interface CtxValue extends SuperAdminPrefs {
  setTheme: (t: SaTheme) => void;
  setMenuMode: (m: SaMenuMode) => void;
  toggleTheme: () => void;
}

const Ctx = createContext<CtxValue | undefined>(undefined);

export function SuperAdminPrefsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;

  const [prefs, setPrefs] = useState<SuperAdminPrefs>(() => readPrefs(userId));

  // Recarrega ao trocar de usuário (login/logout) e aplica tema imediatamente
  useEffect(() => {
    const next = readPrefs(userId);
    setPrefs(next);
  }, [userId]);

  const update = useCallback((patch: Partial<SuperAdminPrefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      writePrefs(userId, next);
      return next;
    });
  }, [userId]);

  const setTheme = useCallback((_t: SaTheme) => { update({ theme: DEFAULTS.theme }); }, [update]);
  const setMenuMode = useCallback((m: SaMenuMode) => { update({ menuMode: m }); }, [update]);
  const toggleTheme = useCallback(() => { update({ theme: DEFAULTS.theme }); }, [update]);

  const value = useMemo<CtxValue>(() => ({
    theme: prefs.theme,
    menuMode: prefs.menuMode,
    setTheme,
    setMenuMode,
    toggleTheme,
  }), [prefs.theme, prefs.menuMode, setTheme, setMenuMode, toggleTheme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSuperAdminPrefs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSuperAdminPrefs must be used within SuperAdminPrefsProvider");
  return ctx;
}