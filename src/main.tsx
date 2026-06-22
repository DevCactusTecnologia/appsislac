import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// Fontes opt-in para superfícies redesenhadas (ex.: /financeiro).
// O projeto continua usando Inter como fonte global; estas só são aplicadas
// em escopo via classes utilitárias `font-display`/`font-body`.
import "@fontsource/sora/400.css";
import "@fontsource/sora/500.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
// Soroteca 2.0 — Cloud Clinical (Space Grotesk + DM Sans)
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
// bootDataStores agora é disparado em App.tsx apenas após autenticação —
// evita hidratar stores e abrir Realtime em páginas públicas (landing/login),
// reduzindo trabalho na thread principal no primeiro paint.
import { setMapaWarningsConsole } from "@/lib/mapaSharedStyles";
import { installFavicon } from "@/lib/favicon";
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

// Em DEV, ecoa avisos de preparação de mapas (colgroup inválido, normalizações
// de células pequenas, etc.) para o console — facilita depurar layouts quebrados.
if (import.meta.env.DEV) setMapaWarningsConsole(true);

// Limpa qualquer marca visual residual de temas antigos (dark mode foi removido).
if (typeof document !== "undefined") {
  const root = document.documentElement;
  root.classList.remove(
    "dark", "sa-light", "sa-dark", "superadmin-light", "superadmin-dark",
  );
  for (const attr of [
    "data-theme", "data-color-mode", "data-mode", "data-sa-theme", "data-superadmin-theme",
  ]) root.removeAttribute(attr);
  root.style.colorScheme = "light";
  try {
    // Remove chaves legadas de tema do localStorage.
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && (k.startsWith("sislac-theme-mode") || k === "vite-ui-theme")) keys.push(k);
    }
    for (const k of keys) window.localStorage.removeItem(k);
  } catch { /* ignore */ }
}

// Boot dos stores acontece em App.tsx após autenticação (ver AppRoutes).

// Auto-reload em erro de carregamento de chunk dinâmico (acontece quando o
// usuário tem uma versão antiga em cache após deploy). Usa um flag em
// sessionStorage para evitar loop infinito caso o problema seja real.
if (typeof window !== "undefined") {
  // ── Captura global de erros frontend (estruturado via logger) ─────────
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

  const RELOAD_FLAG = "sislac-chunk-reload-at";
  const RELOAD_COOLDOWN_MS = 30_000;

  const isChunkLoadError = (msg: string) =>
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("Loading chunk");

  const tryReload = (msg: string) => {
    if (!isChunkLoadError(msg)) return;
    try {
      const last = Number(sessionStorage.getItem(RELOAD_FLAG) ?? "0");
      if (last && Date.now() - last < RELOAD_COOLDOWN_MS) {
        // Já recarregamos há pouco — não entrar em loop.
        // eslint-disable-next-line no-console
        console.warn("[sislac] chunk-reload suprimido (cooldown):", msg);
        return;
      }
      sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
    } catch { /* ignore */ }
    // eslint-disable-next-line no-console
    console.warn("[sislac] chunk-reload acionado por:", msg);
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
}


createRoot(document.getElementById("root")!).render(<App />);
