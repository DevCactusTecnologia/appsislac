// Ferramenta de diagnóstico de tema. Apenas LEITURA — não altera nada.
//
// Uso:
//   1. Abra o console do navegador (F12)
//   2. Digite:  __sislacThemeDiag()
//
// Mostra todas as fontes possíveis do tema atual:
//   - localStorage (chaves modernas e legadas)
//   - <html> classList e atributos data-*
//   - Variáveis CSS resolvidas (--background, --primary, --foreground)
//   - Providers React ativos (Theme + SuperAdminPrefs)
//   - Eventuais classes/atributos legados ainda presentes

const LEGACY_ROOT_CLASSES = [
  "sa-light",
  "sa-dark",
  "superadmin-light",
  "superadmin-dark",
] as const;

const LEGACY_ROOT_ATTRS = [
  "data-color-mode",
  "data-mode",
  "data-sa-theme",
  "data-superadmin-theme",
] as const;

const KNOWN_STORAGE_KEYS = [
  "sislac-theme-mode",
  "vite-ui-theme",
  "theme",
  "color-theme",
] as const;

const TRACKED_CSS_VARS = [
  "--background",
  "--foreground",
  "--primary",
  "--primary-foreground",
  "--card",
  "--border",
  "--sidebar-background",
] as const;

export interface ThemeDiagnosticsReport {
  timestamp: string;
  storage: Record<string, string | null>;
  superAdminMenuKeys: Record<string, string | null>;
  documentElement: {
    classList: string[];
    dataTheme: string | null;
    colorScheme: string | null;
    legacyClassesPresent: string[];
    legacyAttrsPresent: Record<string, string>;
  };
  cssVariables: Record<string, string>;
  computed: {
    backgroundColor: string;
    color: string;
  };
  verdict: string[];
}

function runThemeDiagnostics(): ThemeDiagnosticsReport {
  const root = document.documentElement;
  const body = document.body;

  const storage: Record<string, string | null> = {};
  for (const k of KNOWN_STORAGE_KEYS) {
    try { storage[k] = window.localStorage.getItem(k); } catch { storage[k] = null; }
  }

  // Varre TODAS as chaves do localStorage que contenham "theme" (case-insensitive)
  // ou pertençam ao prefixo super admin — para flagrar qualquer fonte oculta.
  const superAdminMenuKeys: Record<string, string | null> = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      const lower = key.toLowerCase();
      if (lower.includes("theme") || lower.includes("superadmin") || lower.includes("sa-")) {
        superAdminMenuKeys[key] = window.localStorage.getItem(key);
      }
    }
  } catch { /* ignore */ }

  const legacyClassesPresent = LEGACY_ROOT_CLASSES.filter((c) => root.classList.contains(c));
  const legacyAttrsPresent: Record<string, string> = {};
  for (const a of LEGACY_ROOT_ATTRS) {
    const v = root.getAttribute(a);
    if (v != null) legacyAttrsPresent[a] = v;
  }

  const computedRoot = window.getComputedStyle(root);
  const cssVariables: Record<string, string> = {};
  for (const v of TRACKED_CSS_VARS) {
    cssVariables[v] = computedRoot.getPropertyValue(v).trim();
  }

  const computedBody = window.getComputedStyle(body);

  const verdict: string[] = [];

  if (legacyClassesPresent.length > 0) {
    verdict.push(
      `⚠ Classes legadas presentes em <html>: ${legacyClassesPresent.join(", ")}`,
    );
  }
  if (Object.keys(legacyAttrsPresent).length > 0) {
    verdict.push(
      `⚠ Atributos legados presentes em <html>: ${Object.keys(legacyAttrsPresent).join(", ")}`,
    );
  }

  const dataTheme = root.getAttribute("data-theme");
  const hasDarkClass = root.classList.contains("dark");

  if (dataTheme === "dark" && !hasDarkClass) {
    verdict.push("⚠ data-theme=dark mas classe .dark ausente — Tailwind dark mode não está ativo.");
  }
  if (dataTheme === "light" && hasDarkClass) {
    verdict.push("⚠ data-theme=light mas classe .dark presente — inconsistência.");
  }

  const stored = storage["sislac-theme-mode"];
  if (stored && stored !== "light" && stored !== "dark") {
    verdict.push(`⚠ localStorage[sislac-theme-mode] tem valor inesperado: "${stored}"`);
  }

  // Sinaliza chaves "fantasma" (ex.: do tema antigo)
  const ghostKeys = Object.keys(superAdminMenuKeys).filter(
    (k) => !KNOWN_STORAGE_KEYS.includes(k as (typeof KNOWN_STORAGE_KEYS)[number])
      && !k.startsWith("sislac-superadmin-menu:"),
  );
  if (ghostKeys.length > 0) {
    verdict.push(`⚠ Chaves de tema "fantasma" no localStorage: ${ghostKeys.join(", ")}`);
  }

  if (verdict.length === 0) {
    verdict.push("✓ Nenhuma fonte de tema legado detectada. Tema atual coerente.");
  }

  const report: ThemeDiagnosticsReport = {
    timestamp: new Date().toISOString(),
    storage,
    superAdminMenuKeys,
    documentElement: {
      classList: Array.from(root.classList),
      dataTheme,
      colorScheme: root.style.colorScheme || null,
      legacyClassesPresent,
      legacyAttrsPresent,
    },
    cssVariables,
    computed: {
      backgroundColor: computedBody.backgroundColor,
      color: computedBody.color,
    },
    verdict,
  };

  // Pretty-print no console
  // eslint-disable-next-line no-console
  console.groupCollapsed("%c[SISLAC] Diagnóstico de Tema", "color:#4D41F3;font-weight:bold");
  // eslint-disable-next-line no-console
  console.log("Veredito:", verdict);
  // eslint-disable-next-line no-console
  console.log("localStorage (chaves conhecidas):", storage);
  // eslint-disable-next-line no-console
  console.log("localStorage (relacionadas a tema):", superAdminMenuKeys);
  // eslint-disable-next-line no-console
  console.log("<html>:", report.documentElement);
  // eslint-disable-next-line no-console
  console.log("Variáveis CSS resolvidas:", cssVariables);
  // eslint-disable-next-line no-console
  console.log("Cores computadas no <body>:", report.computed);
  // eslint-disable-next-line no-console
  console.groupEnd();

  return report;
}

/**
 * Registra a função de diagnóstico em `window.__sislacThemeDiag` para uso no
 * console do navegador. Não roda automaticamente — apenas expõe o helper.
 */
export function installThemeDiagnostics() {
  if (typeof window === "undefined") return;
  (window as unknown as { __sislacThemeDiag?: () => ThemeDiagnosticsReport }).__sislacThemeDiag =
    runThemeDiagnostics;
}