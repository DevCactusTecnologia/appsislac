interface Props {
  titulo: string;
  subtitulo: string;
  ctaTexto: string;
  ctaUrl: string;
  imagemUrl: string;
  alinhamento: "left" | "center";
  ctaBase?: string;
}

function resolveCtaHref(url: string, base?: string): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return url;
  if (base) return `${base.replace(/\/$/, "")}/${url}`;
  return `/${url}`;
}

export default function HeroRenderer({ titulo, subtitulo, ctaTexto, ctaUrl, imagemUrl, alinhamento, ctaBase }: Props) {
  const href = resolveCtaHref(ctaUrl, ctaBase);
  const initial = (titulo || "L").trim().charAt(0).toUpperCase();
  return (
    <div className="flex flex-col items-center text-center pt-6 pb-2">
      {/* Avatar circular — Link in Bio style */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-accent blur-xl opacity-60" />
        {imagemUrl ? (
          <img
            src={imagemUrl}
            alt={titulo}
            className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover ring-4 ring-background shadow-xl"
            loading="lazy"
          />
        ) : (
          <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center ring-4 ring-background shadow-xl">
            <span className="text-3xl sm:text-4xl font-bold text-primary-foreground">{initial}</span>
          </div>
        )}
      </div>

      {titulo ? (
        <h1 className="mt-5 text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          {titulo}
        </h1>
      ) : null}
      {subtitulo ? (
        <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-md leading-relaxed">
          {subtitulo}
        </p>
      ) : null}
      {href && ctaTexto ? (
        <a
          href={href}
          className="mt-5 inline-flex items-center justify-center h-11 px-6 rounded-full bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity shadow-md"
        >
          {ctaTexto}
        </a>
      ) : null}
    </div>
  );
}