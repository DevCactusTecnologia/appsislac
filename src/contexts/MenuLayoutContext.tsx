import { createContext, useContext, useEffect, ReactNode, useCallback, useMemo, useState } from "react";

export type MenuMode = "sidebar" | "topbar";

const STORAGE_KEY = "sislac-menu-mode";
const DEFAULT_MODE: MenuMode = "sidebar";

interface MenuLayoutContextValue {
  mode: MenuMode;
  setMode: (mode: MenuMode) => void;
  toggle: () => void;
}

const MenuLayoutContext = createContext<MenuLayoutContextValue | undefined>(undefined);

function getStoredMode(): MenuMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "sidebar" || stored === "topbar") return stored;
  } catch { /* ignore */ }
  return DEFAULT_MODE;
}

export function MenuLayoutProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<MenuMode>(getStoredMode);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, mode); } catch { /* ignore */ }
  }, [mode]);

  const setMode = useCallback((next: MenuMode) => setModeState(next), []);
  const toggle = useCallback(() => setModeState((c) => (c === "sidebar" ? "topbar" : "sidebar")), []);

  const value = useMemo(() => ({ mode, setMode, toggle }), [mode, setMode, toggle]);

  return (
    <MenuLayoutContext.Provider value={value}>
      {children}
    </MenuLayoutContext.Provider>
  );
}

export function useMenuLayout() {
  const ctx = useContext(MenuLayoutContext);
  if (!ctx) throw new Error("useMenuLayout must be used within MenuLayoutProvider");
  return ctx;
}
