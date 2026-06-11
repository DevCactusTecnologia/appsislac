import { createContext, useContext, useEffect, ReactNode, useCallback, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export type ThemeMode = "light" | "dark";

const DEFAULT_THEME: ThemeMode = "light";
const STORAGE_PREFIX = "sislac-theme-mode";
const ANON_KEY = `${STORAGE_PREFIX}::anon`;

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function keyFor(userId: string | number | null | undefined): string {
  if (userId === null || userId === undefined || userId === "") return ANON_KEY;
  return `${STORAGE_PREFIX}::user::${String(userId)}`;
}

function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("dark", "sa-light", "sa-dark", "superadmin-light", "superadmin-dark");
  root.removeAttribute("data-color-mode");
  root.removeAttribute("data-mode");
  root.removeAttribute("data-sa-theme");
  root.removeAttribute("data-superadmin-theme");
  if (theme === "dark") root.classList.add("dark");
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
}

function readStored(key: string): ThemeMode {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const v = window.localStorage.getItem(key);
    return v === "dark" || v === "light" ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function writeStored(key: string, theme: ThemeMode) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, theme); } catch { /* ignore */ }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // ThemeProvider sits inside AuthProvider in App.tsx; useAuth is safe here.
  let userId: string | number | null = null;
  try {
    const auth = useAuth();
    userId = auth.user?.id ?? null;
  } catch {
    userId = null;
  }
  const storageKey = keyFor(userId);

  const [theme, setThemeState] = useState<ThemeMode>(() => readStored(keyFor(userId)));

  // When the storage key (user) changes, reload that user's preference.
  useEffect(() => {
    const next = readStored(storageKey);
    setThemeState(next);
  }, [storageKey]);

  // Apply theme to <html> whenever it changes.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemeMode) => {
    writeStored(storageKey, next);
    setThemeState(next);
  }, [storageKey]);

  const toggle = useCallback(() => {
    setThemeState((curr) => {
      const next: ThemeMode = curr === "dark" ? "light" : "dark";
      writeStored(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    const fallback: ThemeMode = DEFAULT_THEME;
    return {
      theme: fallback,
      setTheme: (next: ThemeMode) => {
        writeStored(ANON_KEY, next);
        applyTheme(next);
      },
      toggle: () => {
        const next = readStored(ANON_KEY) === "dark" ? "light" : "dark";
        writeStored(ANON_KEY, next);
        applyTheme(next);
      },
    };
  }
  return ctx;
}
