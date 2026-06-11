import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import LandingTemplate from "@/components/tenant-site/LandingTemplate";
import SEO, { medicalBusinessLD, breadcrumbLD, offerCatalogLD } from "@/components/seo/SEO";
import { getTenantBySlug, getPublishedPage, type TenantLookup, type TenantPage } from "@/lib/tenantSite/store";
import { getVitrineSettings, listExamesPublicos, type ExamePublico } from "@/lib/tenantSite/vitrineStore";
import { tenantSiteUrl, deriveDescriptionFromContent } from "@/lib/tenantSite/seoHelpers";

export default function TenantSite() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [tenant, setTenant] = useState<TenantLookup | null>(null);
  const [page, setPage] = useState<TenantPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [descricaoVitrine, setDescricaoVitrine] = useState<string>("");
  const [exames, setExames] = useState<ExamePublico[]>([]);
  const [seoTitle, setSeoTitle] = useState<string>("");
  const [seoDescription, setSeoDescription] = useState<string>("");
  const [ogImage, setOgImage] = useState<string | null>(null);
  const [heroImg, setHeroImg] = useState<string | null>(null);
  const [sobreImg, setSobreImg] = useState<string | null>(null);
  const [servicosImgs, setServicosImgs] = useState<Record<string, string | null>>({});
  const [unidadesImgs, setUnidadesImgs] = useState<Record<string, string | null>>({});
  const [secoesVisiveis, setSecoesVisiveis] = useState<Record<string, boolean>>({});
  const [tema, setTema] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const t = await getTenantBySlug(slug);
      if (!active) return;
      if (!t) { setNotFound(true); setLoading(false); return; }
      setTenant(t);
      const [p, s, ex] = await Promise.all([
        getPublishedPage(t.id, "home"),
        getVitrineSettings(t.id),
        listExamesPublicos(t.id, { limite: 30 }),
      ]);
      if (!active) return;
      setPage(p);
      setLogoUrl(s?.logo_url ?? null);
      setWhatsapp(s?.whatsapp_contato ?? null);
      setFaviconUrl(s?.favicon_url ?? null);
      setDescricaoVitrine(s?.descricao_vitrine ?? "");
      setSeoTitle(s?.seo_title ?? "");
      setSeoDescription(s?.seo_description ?? "");
      setOgImage(s?.og_image_url ?? null);
      setHeroImg(s?.hero_image_url ?? null);
      setSobreImg(s?.sobre_image_url ?? null);
      setServicosImgs((s?.servicos_images as Record<string, string | null>) ?? {});
      setUnidadesImgs((s?.unidades_images as Record<string, string | null>) ?? {});
      setSecoesVisiveis((s?.secoes_visiveis as Record<string, boolean>) ?? {});
      setTema(s?.tema ?? null);
      setExames(ex);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [slug]);

  // Apenas favicon — title/meta agora são gerenciados via <SEO />.
  useEffect(() => {
    if (!tenant) return;
    const link = document.querySelector<HTMLLinkElement>("link[rel='icon']") ?? (() => {
      const el = document.createElement("link");
      el.rel = "icon";
      document.head.appendChild(el);
      return el;
    })();
    const prevHref = link.href;
    if (faviconUrl) link.href = faviconUrl;
    return () => {
      if (faviconUrl) link.href = prevHref;
    };
  }, [tenant, faviconUrl]);

  if (notFound) return <Navigate to="/" replace />;
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!tenant) return null;

  const url = tenantSiteUrl(slug);
  const fallbackDesc = `${tenant.nome} — laboratório de análises clínicas. Conheça nossos exames, prazos e canais de atendimento.`;
  const description =
    seoDescription?.trim() ||
    descricaoVitrine?.trim() ||
    deriveDescriptionFromContent(page?.conteudo, fallbackDesc);
  const title = seoTitle?.trim() || `${tenant.nome} — Laboratório de análises clínicas`;
  const shareImage = ogImage || logoUrl || undefined;

  return (
    <>
      <SEO
        title={title}
        description={description}
        canonical={url}
        image={shareImage}
        jsonLd={[
          medicalBusinessLD({
            name: tenant.nome,
            url,
            description,
            logo: logoUrl ?? undefined,
          }),
          breadcrumbLD([{ name: tenant.nome, url }]),
          ...(exames.length
            ? [
                offerCatalogLD({
                  businessName: tenant.nome,
                  url,
                  exames: exames.map((e) => ({ nome: e.nome, valor: e.valor })),
                }),
              ]
            : []),
        ]}
      />
      <LandingTemplate
        slug={slug}
        tenantId={tenant.id}
        tenantNome={tenant.nome}
        logoUrl={logoUrl}
        whatsapp={whatsapp}
        descricao={descricaoVitrine || deriveDescriptionFromContent(page?.conteudo, "")}
        heroImageUrl={heroImg}
        sobreImageUrl={sobreImg}
        servicosImages={servicosImgs}
        unidadesImages={unidadesImgs}
        secoesVisiveis={secoesVisiveis}
        tema={tema}
      />
    </>
  );
}