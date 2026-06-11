import { Helmet } from "react-helmet-async";

export interface SEOProps {
  /** Título da aba/SERP. Mantenha < 60 caracteres. */
  title: string;
  /** Descrição usada na SERP. Mantenha < 160 caracteres. */
  description: string;
  /** URL canônica absoluta (ex.: https://meulab.com.br/site/lab/sobre). */
  canonical?: string;
  /** URL de imagem para Open Graph / Twitter Card. */
  image?: string;
  /** Define se a página deve ser indexada pelo Google. */
  noindex?: boolean;
  /** JSON-LD estruturado (schema.org). Pode ser um objeto ou um array de objetos. */
  jsonLd?: object | object[];
  /** Tipo Open Graph (default: website). */
  ogType?: "website" | "article" | "profile";
  /** Idioma da página (default: pt-BR). */
  locale?: string;
}

/**
 * Componente declarativo de SEO. Injeta meta tags de SERP, Open Graph,
 * Twitter Card e JSON-LD estruturado.
 *
 * Use UM <SEO /> por rota — múltiplas instâncias na mesma página produzem
 * comportamento imprevisível pois `react-helmet-async` mescla pela ordem de
 * montagem.
 */
export function SEO({
  title,
  description,
  canonical,
  image,
  noindex = false,
  jsonLd,
  ogType = "website",
  locale = "pt-BR",
}: SEOProps) {
  const safeTitle = (title ?? "").trim().slice(0, 70);
  const safeDescription = (description ?? "").trim().slice(0, 200);
  const ldNodes = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet prioritizeSeoTags>
      <html lang={locale} />
      <title>{safeTitle}</title>
      <meta name="description" content={safeDescription} />
      {canonical ? <link rel="canonical" href={canonical} /> : null}
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"} />

      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={safeTitle} />
      <meta property="og:description" content={safeDescription} />
      <meta property="og:locale" content={locale.replace("-", "_")} />
      {canonical ? <meta property="og:url" content={canonical} /> : null}
      {image ? <meta property="og:image" content={image} /> : null}

      {/* Twitter Card */}
      <meta name="twitter:card" content={image ? "summary_large_image" : "summary"} />
      <meta name="twitter:title" content={safeTitle} />
      <meta name="twitter:description" content={safeDescription} />
      {image ? <meta name="twitter:image" content={image} /> : null}

      {/* JSON-LD */}
      {ldNodes.map((node, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(node)}</script>
      ))}
    </Helmet>
  );
}

export default SEO;

/** Helpers para construir nós JSON-LD comuns. */

export interface MedicalBusinessLD {
  name: string;
  url: string;
  description?: string;
  logo?: string;
  telephone?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

export function medicalBusinessLD(input: MedicalBusinessLD) {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    name: input.name,
    url: input.url,
    ...(input.description ? { description: input.description } : {}),
    ...(input.logo ? { logo: input.logo, image: input.logo } : {}),
    ...(input.telephone ? { telephone: input.telephone } : {}),
    ...(input.email ? { email: input.email } : {}),
    ...(input.address
      ? {
          address: {
            "@type": "PostalAddress",
            ...(input.address.street ? { streetAddress: input.address.street } : {}),
            ...(input.address.city ? { addressLocality: input.address.city } : {}),
            ...(input.address.state ? { addressRegion: input.address.state } : {}),
            ...(input.address.postalCode ? { postalCode: input.address.postalCode } : {}),
            ...(input.address.country ? { addressCountry: input.address.country } : { addressCountry: "BR" }),
          },
        }
      : {}),
  };
}

export function breadcrumbLD(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function offerCatalogLD(input: {
  businessName: string;
  url: string;
  exames: Array<{ nome: string; descricao?: string; valor?: number }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: `Exames disponíveis — ${input.businessName}`,
    url: input.url,
    itemListElement: input.exames.map((ex, idx) => ({
      "@type": "Offer",
      position: idx + 1,
      itemOffered: {
        "@type": "MedicalTest",
        name: ex.nome,
        ...(ex.descricao ? { description: ex.descricao } : {}),
      },
      ...(typeof ex.valor === "number" && ex.valor > 0
        ? { price: ex.valor.toFixed(2), priceCurrency: "BRL" }
        : {}),
    })),
  };
}