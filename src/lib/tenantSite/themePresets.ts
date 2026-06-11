// Presets de tema aplicados na landing pública (/site/:slug).
// Cada preset define as CSS variables HSL que sobrescrevem :root
// SOMENTE dentro do escopo da landing — o app interno do tenant continua
// usando a paleta padrão do SISLAC.

export type LandingThemeId = "indigo" | "emerald" | "rose" | "ocean" | "amber" | "violet";

export interface LandingThemePreset {
  id: LandingThemeId;
  label: string;
  // valores em formato HSL "H S% L%" prontos para hsl(var(--x))
  primary: string;
  primaryFg: string;
  accent: string;
  accentFg: string;
  ring: string;
  // cor para gradientes/orbs decorativos (geralmente igual a primary)
  glow: string;
  // amostra usada no seletor visual
  swatch: string; // hex
}

const LANDING_THEME_PRESETS: Record<LandingThemeId, LandingThemePreset> = {
  indigo: {
    id: "indigo",
    label: "Indigo",
    primary: "244 88% 60%",
    primaryFg: "0 0% 100%",
    accent: "244 70% 96%",
    accentFg: "244 88% 48%",
    ring: "244 88% 60%",
    glow: "244 88% 60%",
    swatch: "#4D41F3",
  },
  emerald: {
    id: "emerald",
    label: "Esmeralda",
    primary: "152 60% 38%",
    primaryFg: "0 0% 100%",
    accent: "152 50% 95%",
    accentFg: "152 60% 28%",
    ring: "152 60% 38%",
    glow: "152 60% 42%",
    swatch: "#1F9D6E",
  },
  rose: {
    id: "rose",
    label: "Rosa",
    primary: "340 82% 56%",
    primaryFg: "0 0% 100%",
    accent: "340 70% 96%",
    accentFg: "340 82% 46%",
    ring: "340 82% 56%",
    glow: "340 82% 60%",
    swatch: "#E63A77",
  },
  ocean: {
    id: "ocean",
    label: "Oceano",
    primary: "205 88% 48%",
    primaryFg: "0 0% 100%",
    accent: "205 70% 95%",
    accentFg: "205 88% 38%",
    ring: "205 88% 48%",
    glow: "205 88% 52%",
    swatch: "#1486D6",
  },
  amber: {
    id: "amber",
    label: "Âmbar",
    primary: "32 92% 50%",
    primaryFg: "0 0% 100%",
    accent: "38 95% 95%",
    accentFg: "28 90% 38%",
    ring: "32 92% 50%",
    glow: "32 92% 55%",
    swatch: "#F59A09",
  },
  violet: {
    id: "violet",
    label: "Violeta",
    primary: "270 70% 56%",
    primaryFg: "0 0% 100%",
    accent: "270 60% 96%",
    accentFg: "270 70% 46%",
    ring: "270 70% 56%",
    glow: "270 70% 60%",
    swatch: "#8C49E6",
  },
};

/** Retorna o preset (com fallback para indigo). */
export function getLandingTheme(id: string | null | undefined): LandingThemePreset {
  if (id && id in LANDING_THEME_PRESETS) return LANDING_THEME_PRESETS[id as LandingThemeId];
  return LANDING_THEME_PRESETS.indigo;
}

/** Gera o CSSProperties com as overrides para aplicar via `style` no wrapper da landing. */
export function landingThemeStyle(id: string | null | undefined): React.CSSProperties {
  const t = getLandingTheme(id);
  return {
    ["--primary" as never]: t.primary,
    ["--primary-foreground" as never]: t.primaryFg,
    ["--accent" as never]: t.accent,
    ["--accent-foreground" as never]: t.accentFg,
    ["--ring" as never]: t.ring,
    ["--landing-glow" as never]: t.glow,
  } as React.CSSProperties;
}

export const LANDING_THEME_LIST: LandingThemePreset[] = Object.values(LANDING_THEME_PRESETS);