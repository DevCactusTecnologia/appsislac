import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// bootDataStores agora é disparado em App.tsx apenas após autenticação —
// evita hidratar stores e abrir Realtime em páginas públicas (landing/login),
// reduzindo trabalho na thread principal no primeiro paint.
import { setMapaWarningsConsole } from "@/lib/mapaSharedStyles";
import { installFavicon } from "@/lib/favicon";
import { installThemeDiagnostics } from "@/lib/themeDiagnostics";
import { logger } from "@/lib/logger";

const SW_CLEANUP_RELOAD_FLAG = "sislac-sw-cleanup-reload";

function cleanupLegacyBrowserWorkers() {
  if (typeof window === "undefined") return;
  window.addEventListener("load", () => {
    try { sessionStorage.removeItem(SW_CLEANUP_RELOAD_FLAG); } catch { /* ignore */ }
  });

  const canUseWorkers = "serviceWorker" in navigator;
  const canUseCaches = "caches" in window;

  const run = async () => {
    let changed = false;
    try {
      if (canUseCaches) {
        const names = await window.caches.keys();
        if (names.length > 0) changed = true;
        await Promise.all(names.map((name) => window.caches.delete(name)));
      }
    } catch { /* ignore */ }

    try {
      if (canUseWorkers) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (registrations.length > 0) changed = true;
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
    } catch { /* ignore */ }

    if (!changed) return;
    try {
      if (sessionStorage.getItem(SW_CLEANUP_RELOAD_FLAG)) return;
      sessionStorage.setItem(SW_CLEANUP_RELOAD_FLAG, "1");
    } catch { /* ignore */ }
    window.location.replace(window.location.href);
  };

  void run();
}

cleanupLegacyBrowserWorkers();

// Instala favicon com URL versionada (hash de conteúdo via Vite).
installFavicon();

// Expõe `window.__sislacThemeDiag()` no console para diagnosticar a origem do
// tema atual (localStorage, classes/atributos do <html>, vars CSS resolvidas).
// É somente leitura — não muda nenhum comportamento da aplicação.
installThemeDiagnostics();

// Em DEV, ecoa avisos de preparação de mapas (colgroup inválido, normalizações
// de células pequenas, etc.) para o console — facilita depurar layouts quebrados.
if (import.meta.env.DEV) setMapaWarningsConsole(true);

const LEGACY_ROOT_CLASSES = ["sa-light", "sa-dark", "superadmin-light", "superadmin-dark"];
const LEGACY_ROOT_ATTRS = ["data-color-mode", "data-mode", "data-sa-theme", "data-superadmin-theme"];

function resetRootVisualState() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  // Remove apenas marcas legadas. A classe `dark` é gerenciada pelo
  // ThemeContext e NÃO deve ser removida no boot.
  root.classList.remove(...LEGACY_ROOT_CLASSES);
  for (const attr of LEGACY_ROOT_ATTRS) root.removeAttribute(attr);
}

function applyStoredTheme() {
  if (typeof window === "undefined") return;
  try {
    const stored = window.localStorage.getItem("sislac-theme-mode");
    const theme = stored === "dark" ? "dark" : "light";
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
  } catch { /* ignore */ }
}

resetRootVisualState();
applyStoredTheme();

// Remove somente marcas visuais legadas do Super Admin sem tocar em sessão,
// cache, service worker ou credenciais de demonstração.
if (typeof window !== "undefined" && typeof document !== "undefined") {
  const enforceCurrentThemeOnly = () => {
    resetRootVisualState();
    applyStoredTheme();
  };

  const observer = new MutationObserver(enforceCurrentThemeOnly);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", ...LEGACY_ROOT_ATTRS],
  });

  window.addEventListener("pageshow", enforceCurrentThemeOnly);
  window.addEventListener("storage", enforceCurrentThemeOnly);
}

// Boot dos stores acontece em App.tsx após autenticação (ver AppRoutes).

// Auto-reload em erro de carregamento de chunk dinâmico (acontece quando o
// usuário tem uma versão antiga em cache após deploy). Usa um flag em
// sessionStorage para evitar loop infinito caso o problema seja real.
if (typeof window !== "undefined") {
  // ── Captura global de erros frontend (estruturado via logger) ─────────
  // Não interfere em outros handlers — apenas adiciona registro estruturado
  // que pode ser plugado em sink externo (Sentry, Logflare) via __logSink.
  window.addEventListener("error", (event) => {
    try {
      logger.error("window.onerror", event.message || "Erro não capturado", {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        url: window.location.href,
        stack: event.error instanceof Error ? event.error.stack : undefined,
      });
    } catch { /* ignore */ }
  });

  window.addEventListener("unhandledrejection", (event) => {
    try {
      const reason = event.reason;
      const msg = typeof reason === "string" ? reason : reason?.message ?? "unhandled rejection";
      logger.error("window.unhandledrejection", msg, {
        url: window.location.href,
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    } catch { /* ignore */ }
  });

  const RELOAD_FLAG = "sislac-chunk-reload";

  const isChunkLoadError = (msg: string) =>
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("Loading chunk");

  const tryReload = (msg: string) => {
    if (!isChunkLoadError(msg)) return;
    try {
      if (sessionStorage.getItem(RELOAD_FLAG)) return;
      sessionStorage.setItem(RELOAD_FLAG, "1");
    } catch { /* ignore */ }
    window.location.reload();
  };

  window.addEventListener("error", (event) => {
    tryReload(event.message ?? "");
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg = typeof reason === "string" ? reason : reason?.message ?? "";
    tryReload(msg);
  });

  // Limpa o flag após carga bem-sucedida.
  window.addEventListener("load", () => {
    try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* ignore */ }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
