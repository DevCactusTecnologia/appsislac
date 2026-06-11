import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Phone, Mail, MessageCircle } from "lucide-react";
import TenantSiteShell from "@/components/tenant-site/TenantSiteShell";
import SEO, { medicalBusinessLD, breadcrumbLD } from "@/components/seo/SEO";
import { getTenantBySlug, type TenantLookup } from "@/lib/tenantSite/store";
import { getVitrineSettings, type VitrineSettings } from "@/lib/tenantSite/vitrineStore";
import { tenantSiteUrl } from "@/lib/tenantSite/seoHelpers";

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}

export default function TenantSiteContato() {
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
  const whatsapp = settings?.whatsapp_contato?.replace(/\D/g, "") ?? "";
  const url = tenantSiteUrl(slug, "contato");
  const descricao = `Entre em contato com o ${tenant.nome}: agende exames, tire dúvidas sobre coleta, jejum, resultados e horários de atendimento.`;

  return (
    <>
      <SEO
        title={`Contato — ${tenant.nome}`}
        description={descricao.slice(0, 160)}
        canonical={url}
        image={logoUrl}
        jsonLd={[
          medicalBusinessLD({
            name: tenant.nome,
            url: tenantSiteUrl(slug),
            description: settings?.descricao_vitrine ?? descricao,
            logo: logoUrl,
            telephone: whatsapp ? `+${whatsapp}` : undefined,
          }),
          breadcrumbLD([
            { name: tenant.nome, url: tenantSiteUrl(slug) },
            { name: "Contato", url },
          ]),
        ]}
      />
      <TenantSiteShell slug={slug} tema={tema} tenantNome={tenant.nome} current="contato">
        <section className="w-full max-w-xl mx-auto px-4">
          <div className="bg-card/70 backdrop-blur-md border border-border/60 rounded-3xl p-6 md:p-8">
            <h1 className="text-2xl font-semibold text-foreground mb-2">Fale com o {tenant.nome}</h1>
            <p className="text-sm text-foreground/75 mb-6">
              Estamos aqui para ajudar. Escolha o canal de sua preferência.
            </p>

            <div className="flex flex-col gap-3">
              {whatsapp ? (
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-2xl bg-primary/10 hover:bg-primary/15 border border-primary/30 transition-colors"
                >
                  <MessageCircle className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">WhatsApp</div>
                    <div className="text-sm font-medium text-foreground">{formatPhone(whatsapp)}</div>
                  </div>
                </a>
              ) : null}
              {whatsapp ? (
                <a
                  href={`tel:+${whatsapp}`}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-card/60 hover:bg-card/80 border border-border/60 transition-colors"
                >
                  <Phone className="h-5 w-5 text-foreground/70" />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">Telefone</div>
                    <div className="text-sm font-medium text-foreground">{formatPhone(whatsapp)}</div>
                  </div>
                </a>
              ) : null}

              <div className="flex items-center gap-3 p-4 rounded-2xl bg-card/40 border border-border/40">
                <Mail className="h-5 w-5 text-foreground/70" />
                <div className="flex-1 text-sm text-foreground/75">
                  Para informações sobre exames e resultados, utilize o portal do paciente.
                </div>
              </div>
            </div>

            {!whatsapp ? (
              <p className="mt-6 text-xs text-muted-foreground">
                Nenhum canal de contato direto configurado. Acesse o portal para mais informações.
              </p>
            ) : null}
          </div>
        </section>
      </TenantSiteShell>
    </>
  );
}
