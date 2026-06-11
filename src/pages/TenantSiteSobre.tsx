import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import TenantSiteShell from "@/components/tenant-site/TenantSiteShell";
import SEO, { medicalBusinessLD, breadcrumbLD } from "@/components/seo/SEO";
import { getTenantBySlug, type TenantLookup } from "@/lib/tenantSite/store";
import { getVitrineSettings, type VitrineSettings } from "@/lib/tenantSite/vitrineStore";
import { tenantSiteUrl } from "@/lib/tenantSite/seoHelpers";

export default function TenantSiteSobre() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [tenant, setTenant] = useState<TenantLookup | null>(null);
  const [settings, setSettings] = useState<VitrineSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const t = await getTenantBySlug(slug);
      if (!active) return;
      if (!t) { setNotFound(true); setLoading(false); return; }
      setTenant(t);
      const s = await getVitrineSettings(t.id);
      if (!active) return;
      setSettings(s);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [slug]);

  if (notFound) return <Navigate to="/" replace />;
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!tenant) return null;

  const tema = settings?.tema ?? "indigo";
  const logoUrl = settings?.logo_url ?? undefined;
  const descricao = settings?.descricao_vitrine?.trim() || `Conheça o ${tenant.nome}: um laboratório de análises clínicas comprometido com qualidade, agilidade e atendimento humano.`;
  const url = tenantSiteUrl(slug, "sobre");

  return (
    <>
      <SEO
        title={`Sobre — ${tenant.nome}`}
        description={descricao.slice(0, 160)}
        canonical={url}
        image={logoUrl}
        jsonLd={[
          medicalBusinessLD({
            name: tenant.nome,
            url: tenantSiteUrl(slug),
            description: descricao,
            logo: logoUrl,
          }),
          breadcrumbLD([
            { name: tenant.nome, url: tenantSiteUrl(slug) },
            { name: "Sobre", url },
          ]),
        ]}
      />
      <TenantSiteShell slug={slug} tema={tema} tenantNome={tenant.nome} current="sobre">
        <article className="w-full max-w-xl mx-auto px-4">
          <div className="bg-card/70 backdrop-blur-md border border-border/60 rounded-3xl p-6 md:p-8">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`Logotipo do ${tenant.nome}`}
                className="h-16 w-auto mb-5 object-contain"
                loading="lazy"
              />
            ) : null}
            <h1 className="text-2xl font-semibold text-foreground mb-3">Sobre o {tenant.nome}</h1>
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
              {descricao}
            </p>

            <hr className="my-6 border-border/60" />

            <h2 className="text-base font-semibold text-foreground mb-2">Compromisso com a qualidade</h2>
            <p className="text-sm text-foreground/75 leading-relaxed">
              Trabalhamos com processos rigorosos de coleta, análise e liberação de resultados,
              seguindo as melhores práticas laboratoriais e a legislação vigente.
              Nossa equipe é qualificada e nossos equipamentos passam por controle de qualidade contínuo.
            </p>
          </div>
        </article>
      </TenantSiteShell>
    </>
  );
}
