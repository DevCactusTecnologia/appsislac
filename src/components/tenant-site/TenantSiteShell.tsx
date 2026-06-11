import { Link } from "react-router-dom";
import { landingThemeStyle } from "@/lib/tenantSite/themePresets";

export interface TenantSiteShellProps {
  slug: string;
  tema: string;
  tenantNome: string;
  /** Sub-rota ativa (para destacar item no rodapé). */
  current?: "home" | "sobre" | "contato";
  children: React.ReactNode;
}

/**
 * Casca compartilhada por todas as páginas públicas do tenant
 * (`/site/:slug`, `/site/:slug/sobre`, `/site/:slug/contato`).
 * Mantém o mesmo visual "Link in Bio" usado em TenantSite.tsx.
 */
export default function TenantSiteShell({ slug, tema, tenantNome, current = "home", children }: TenantSiteShellProps) {
  const navItem = (label: string, to: string, key: typeof current) => {
    const active = current === key;
    return (
      <Link
        to={to}
        className={`text-xs font-medium rounded-full px-3 py-1.5 transition-colors border ${
          active
            ? "bg-primary/15 text-primary border-primary/30"
            : "text-foreground/70 hover:text-foreground bg-card/60 backdrop-blur-md border-border/60"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-primary/10 via-background to-background relative overflow-hidden"
      style={landingThemeStyle(tema)}
    >
      {/* Decorative blurred orbs — Link in Bio vibe */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="px-4 pt-5">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-2 flex-wrap">
            <nav className="flex items-center gap-1.5">
              {navItem("Início", `/site/${slug}`, "home")}
              {navItem("Sobre", `/site/${slug}/sobre`, "sobre")}
              {navItem("Contato", `/site/${slug}/contato`, "contato")}
            </nav>
            <Link
              to={`/site/${slug}/app`}
              className="text-xs font-medium text-foreground/70 hover:text-foreground bg-card/60 backdrop-blur-md border border-border/60 rounded-full px-3.5 py-1.5 transition-colors"
            >
              Acessar portal →
            </Link>
          </div>
        </header>

        <main className="flex-1 pt-4 pb-12">{children}</main>

        <footer className="px-4 pb-6">
          <div className="max-w-xl mx-auto text-center text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} {tenantNome}
          </div>
        </footer>
      </div>
    </div>
  );
}