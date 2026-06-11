import type { TPageContent } from "./blocks";

/** Origem absoluta do site público. Usa o host atual no browser e
 *  cai para o host publicado quando rodando server-side / build. */
export function getSiteOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "https://sislac.lovable.app";
}

/** Monta a URL absoluta para uma rota do site do tenant. */
export function tenantSiteUrl(slug: string, sub?: "sobre" | "contato"): string {
  const base = `${getSiteOrigin()}/site/${slug}`;
  return sub ? `${base}/${sub}` : base;
}

/** Extrai uma descrição curta do conteúdo da página (primeiro texto/hero). */
export function deriveDescriptionFromContent(content: TPageContent | null | undefined, fallback: string): string {
  if (!content?.length) return fallback;
  for (const block of content) {
    if (block.type === "hero") {
      const sub = (block.props.subtitulo ?? "").trim();
      if (sub) return sub.slice(0, 160);
      const tit = (block.props.titulo ?? "").trim();
      if (tit) return tit.slice(0, 160);
    }
    if (block.type === "texto") {
      const t = (block.props.texto ?? "").trim();
      if (t) return t.slice(0, 160);
    }
  }
  return fallback;
}