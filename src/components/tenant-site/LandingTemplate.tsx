import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X, ArrowUpRight, MessageCircle, Microscope, Truck, Building2, Stethoscope, Star, MapPin, Phone, Clock, Mail } from "lucide-react";
import ExamesListaRenderer from "./blocks/ExamesListaRenderer";
import { landingThemeStyle } from "@/lib/tenantSite/themePresets";
import heroTeam from "@/assets/landing/hero-team.jpg";
import sobreLab from "@/assets/landing/sobre-lab.jpg";
import servicoResultados from "@/assets/landing/servico-resultados.jpg";
import servicoColeta from "@/assets/landing/servico-coleta.jpg";
import servicoUnidades from "@/assets/landing/servico-unidades.jpg";
import servicoExames from "@/assets/landing/servico-exames.jpg";
import unidadeMatriz from "@/assets/landing/unidade-matriz.jpg";
import unidadeShopping from "@/assets/landing/unidade-shopping.jpg";
import unidadeClinica from "@/assets/landing/unidade-clinica.jpg";

/**
 * Template institucional fixo da landing pública do tenant.
 * Inspirado no modelo São Lucas: hero escuro, sobre, navegação por cards,
 * convênios, unidades, depoimentos, footer.
 *
 * Paleta hardcoded (azul institucional). Dados:
 * - nome / logo / slug vêm do tenant
 * - exames vêm da vitrine pública (ExamesListaRenderer)
 * - convênios / unidades / depoimentos são placeholders (sem acesso anônimo no RLS)
 */

export interface LandingTemplateProps {
  slug: string;
  tenantId: string;
  tenantNome: string;
  logoUrl?: string | null;
  whatsapp?: string | null;
  descricao?: string | null;
  /** Overrides de imagens fornecidos pela configuração da landing. */
  heroImageUrl?: string | null;
  sobreImageUrl?: string | null;
  servicosImages?: Record<string, string | null> | null;
  unidadesImages?: Record<string, string | null> | null;
  /** Mapa que controla a exibição das seções da landing. Default: todas exibidas. */
  secoesVisiveis?: Record<string, boolean> | null;
  /** Tema/paleta selecionada na configuração do tenant. */
  tema?: string | null;
}

function whatsappHref(num: string | null | undefined, msg: string): string | null {
  if (!num) return null;
  const digits = num.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const e164 = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${e164}?text=${encodeURIComponent(msg)}`;
}

export default function LandingTemplate({
  slug,
  tenantId,
  tenantNome,
  logoUrl,
  whatsapp,
  descricao,
  heroImageUrl,
  sobreImageUrl,
  servicosImages,
  unidadesImages,
  secoesVisiveis,
  tema,
}: LandingTemplateProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wa = whatsappHref(whatsapp, `Olá, ${tenantNome}! Gostaria de agendar uma consulta.`);
  const initial = (tenantNome || "L").trim().charAt(0).toUpperCase();
  const svc = servicosImages ?? {};
  const uni = unidadesImages ?? {};
  const sec = secoesVisiveis ?? {};
  const showSection = (key: string) => sec[key] !== false; // padrão visível
  const showSobre = showSection("sobre");
  const showServicos = showSection("servicos");
  const showExames = showSection("exames");
  const showConvenios = showSection("convenios");
  const showUnidades = showSection("unidades");
  const showDepoimentos = showSection("depoimentos");

  const navItems = useMemo(
    () =>
      [
        showSobre ? { label: "Sobre nós", href: "#sobre" } : null,
        showExames ? { label: "Exames", href: "#exames" } : null,
        showUnidades ? { label: "Unidades", href: "#unidades" } : null,
        showDepoimentos ? { label: "Depoimentos", href: "#depoimentos" } : null,
        { label: "Contato", href: `/site/${slug}/contato`, external: true },
      ].filter(Boolean) as Array<{ label: string; href: string; external?: boolean }>,
    [slug, showSobre, showExames, showUnidades, showDepoimentos],
  );

  useEffect(() => {
    if (!menuOpen) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [menuOpen]);

  return (
    <div style={landingThemeStyle(tema)} className="min-h-screen bg-white text-slate-900 antialiased">
      {/* ============ HERO ============ */}
      <header className="relative bg-[hsl(var(--primary))] text-white overflow-hidden">
        {/* topbar */}
        <div className="relative z-20 max-w-7xl mx-auto px-5 lg:px-10 h-16 lg:h-20 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5">
            {logoUrl ? (
              <img src={logoUrl} alt={tenantNome} className="h-9 lg:h-10 w-auto object-contain" />
            ) : (
              <div className="h-9 w-9 rounded-md bg-white/15 backdrop-blur flex items-center justify-center font-bold">{initial}</div>
            )}
            <span className="font-semibold text-sm lg:text-base tracking-tight">{tenantNome}</span>
          </a>

          <nav className="hidden lg:flex items-center gap-7 text-sm">
            {navItems.map((it) =>
              it.external ? (
                <Link key={it.label} to={it.href} className="text-white/80 hover:text-white transition-colors">{it.label}</Link>
              ) : (
                <a key={it.label} href={it.href} className="text-white/80 hover:text-white transition-colors">{it.label}</a>
              ),
            )}
            <Link to={`/site/${slug}/app`} className="text-white/80 hover:text-white transition-colors inline-flex items-center gap-1">
              Resultados <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </nav>

          <button
            type="button"
            className="lg:hidden h-10 w-10 rounded-md bg-white/10 hover:bg-white/15 flex items-center justify-center"
            aria-label="Abrir menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {/* hero content */}
        <div className="relative max-w-7xl mx-auto px-5 lg:px-10 pt-8 pb-16 lg:py-24 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="relative z-10">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.15] tracking-tight max-w-xl">
              Qualidade, tecnologia e acolhimento para uma vida mais saudável.
            </h1>
            <p className="mt-5 text-sm sm:text-base text-white/75 max-w-md">
              {descricao?.trim() || `Cuidando de você e da sua família com precisão e atenção em cada exame.`}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={wa ?? "#exames"}
                target={wa ? "_blank" : undefined}
                rel={wa ? "noopener noreferrer" : undefined}
                className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-[hsl(var(--accent))] hover:brightness-110 text-[hsl(var(--accent-foreground))] text-sm font-semibold transition-all shadow-lg shadow-black/10"
              >
                <MessageCircle className="h-4 w-4" /> Agende sua consulta
              </a>
              <a
                href="#exames"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-white/10 hover:bg-white/15 backdrop-blur text-white text-sm font-medium border border-white/15 transition-colors"
              >
                Ver exames
              </a>
            </div>
          </div>

          {/* hero illustration / mosaic */}
          <div className="relative h-[280px] sm:h-[360px] lg:h-[440px] rounded-3xl overflow-hidden bg-white/5 border border-white/10">
            <img
              src={heroImageUrl || heroTeam}
              alt={`Equipe do ${tenantNome}`}
              width={1280}
              height={896}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-[hsl(var(--primary))]/60 via-[hsl(var(--primary))]/10 to-transparent" />
            <div className="absolute bottom-4 right-4 bg-white/15 backdrop-blur-md text-white rounded-2xl px-4 py-3 border border-white/20">
              <div className="text-2xl font-bold leading-none">+40</div>
              <div className="text-[11px] text-white/80 mt-1">anos de experiência</div>
            </div>
          </div>
        </div>

        <div className="absolute -top-32 -right-24 h-80 w-80 rounded-full bg-[hsl(var(--accent))]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-white/5 blur-3xl pointer-events-none" />
      </header>

      {/* ============ MOBILE MENU ============ */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 bg-[hsl(var(--primary))] text-white lg:hidden flex flex-col">
          <div className="h-16 flex items-center justify-between px-5">
            <span className="font-semibold">{tenantNome}</span>
            <button onClick={() => setMenuOpen(false)} className="h-10 w-10 rounded-md bg-white/10 flex items-center justify-center">
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 flex flex-col gap-1 px-5 pt-6">
            {navItems.map((it) =>
              it.external ? (
                <Link key={it.label} to={it.href} onClick={() => setMenuOpen(false)} className="py-3 text-lg font-medium border-b border-white/10">
                  {it.label}
                </Link>
              ) : (
                <a key={it.label} href={it.href} onClick={() => setMenuOpen(false)} className="py-3 text-lg font-medium border-b border-white/10">
                  {it.label}
                </a>
              ),
            )}
          </nav>
        </div>
      ) : null}

      {/* ============ SOBRE ============ */}
      {showSobre && (
      <section id="sobre" className="max-w-7xl mx-auto px-5 lg:px-10 py-16 lg:py-24 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div className="relative aspect-[4/3] rounded-3xl overflow-hidden">
          <img
            src={sobreImageUrl || sobreLab}
            alt={`Identidade visual ${tenantNome}`}
            loading="lazy"
            width={1024}
            height={768}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute bottom-5 right-5 bg-[hsl(var(--primary))]/90 backdrop-blur-md text-white rounded-2xl px-4 py-3 border border-white/20">
            <div className="text-2xl font-bold leading-none">+40</div>
            <div className="text-[11px] text-white/80 mt-1">anos de experiência</div>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-widest text-[hsl(var(--primary))] uppercase">Sobre nós</p>
          <h2 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">
            Um pouco da nossa história
          </h2>
          <div className="mt-5 space-y-4 text-sm sm:text-[15px] text-slate-600 leading-relaxed">
            <p>
              Há mais de quatro décadas, o {tenantNome} tem o compromisso com a medicina diagnóstica,
              cuidando da qualidade técnica de seus exames, com atenção ao atendimento ao cliente e
              à valorização de seus colaboradores.
            </p>
            <p>
              Investimos continuamente em tecnologia, processos e formação da equipe para entregar
              resultados confiáveis com agilidade e humanidade.
            </p>
          </div>
        </div>
      </section>
      )}

      {/* ============ NAVEGUE / SERVIÇOS ============ */}
      {showServicos && (
      <section className="bg-[hsl(var(--primary))] text-white py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-5 lg:px-10">
          <p className="text-xs font-semibold tracking-widest text-white/60 uppercase">Navegue</p>
          <h2 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight max-w-2xl">
            Veja como podemos ajudar
          </h2>
          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <ServicoCard icon={<Microscope className="h-5 w-5" />} title="Resultados de exames" image={svc.resultados || servicoResultados} href={`/site/${slug}/app`} external />
            <ServicoCard icon={<Truck className="h-5 w-5" />} title="Coleta domiciliar" image={svc.coleta || servicoColeta} href={wa ?? "#exames"} external={!!wa} />
            <ServicoCard icon={<Building2 className="h-5 w-5" />} title="Nossas unidades" image={svc.unidades || servicoUnidades} href="#unidades" />
            <ServicoCard icon={<Stethoscope className="h-5 w-5" />} title="Exames disponíveis" image={svc.exames || servicoExames} href="#exames" />
          </div>
        </div>
      </section>
      )}

      {/* ============ EXAMES (vitrine) ============ */}
      {showExames && (
      <section id="exames" className="max-w-7xl mx-auto px-5 lg:px-10 py-16 lg:py-24">
        <div className="text-center mb-10">
          <p className="text-xs font-semibold tracking-widest text-[hsl(var(--primary))] uppercase">Exames</p>
          <h2 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
            Exames disponíveis
          </h2>
          <p className="mt-3 text-sm text-slate-600 max-w-xl mx-auto">
            Selecione os exames de interesse e solicite uma reserva. Nossa equipe entra em contato para confirmar.
          </p>
        </div>
        <ExamesListaRenderer
          titulo=""
          descricao=""
          mostrarPreco
          mostrarBusca
          apenasDestaque={false}
          limite={60}
          layout="grid"
          tenantId={tenantId}
        />
      </section>
      )}

      {/* ============ CONVÊNIOS ============ */}
      {showConvenios && (
      <section className="bg-slate-50 py-14 lg:py-20">
        <div className="max-w-7xl mx-auto px-5 lg:px-10 text-center">
          <p className="text-xs font-semibold tracking-widest text-[hsl(var(--primary))] uppercase">Convênios</p>
          <h2 className="mt-2 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight max-w-2xl mx-auto">
            Conheça os convênios aceitos nas nossas unidades
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-x-10 gap-y-6 items-center">
            {["SulAmérica", "Porto Seguro", "Amil", "Cartão de Bem", "SAF", "Bradesco"].map((c) => (
              <div key={c} className="text-slate-400 font-bold tracking-tight text-base sm:text-lg">{c}</div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ============ UNIDADES ============ */}
      {showUnidades && (
      <section id="unidades" className="bg-[hsl(var(--primary))] text-white py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-5 lg:px-10">
          <p className="text-xs font-semibold tracking-widest text-white/60 uppercase">Unidades</p>
          <h2 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
            Conheça nossas unidades
          </h2>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { nome: "Matriz", local: "Centro", img: uni.matriz || unidadeMatriz },
              { nome: "Filial Shopping", local: "Várzea", img: uni.shopping || unidadeShopping },
              { nome: "Clínica Alcance", local: "Bairro Novo", img: uni.clinica || unidadeClinica },
            ].map((u) => (
              <div key={u.nome} className="group relative aspect-[4/3] rounded-2xl border border-white/10 overflow-hidden">
                <img src={u.img} alt={u.nome} loading="lazy" width={800} height={600} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--primary))] via-[hsl(var(--primary))]/40 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold">{u.nome}</div>
                      <div className="text-xs text-white/70 flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" /> {u.local}
                      </div>
                    </div>
                    <div className="h-9 w-9 rounded-full bg-[hsl(var(--accent))] flex items-center justify-center">
                      <ArrowUpRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ============ DEPOIMENTOS ============ */}
      {showDepoimentos && (
      <section id="depoimentos" className="max-w-7xl mx-auto px-5 lg:px-10 py-16 lg:py-24">
        <p className="text-xs font-semibold tracking-widest text-[hsl(var(--primary))] uppercase">Depoimentos</p>
        <h2 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
          O que falam sobre nós
        </h2>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { nome: "Luciana S.", texto: "Atendimento impecável, resultado rápido e equipe muito atenciosa. Recomendo!" },
            { nome: "Marcos D.", texto: "Sempre fui muito bem atendido. Estrutura excelente e profissionais qualificados." },
            { nome: "Juliana P.", texto: "Coleta domiciliar funcionou perfeitamente. Pontualidade e cuidado em cada detalhe." },
          ].map((d) => (
            <article key={d.nome} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex gap-0.5 text-amber-500">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
              </div>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">{d.texto}</p>
              <div className="mt-4 text-xs font-semibold text-slate-700">{d.nome}</div>
            </article>
          ))}
        </div>
      </section>
      )}

      {/* ============ FOOTER ============ */}
      <footer className="bg-[hsl(var(--primary))] text-white">
        <div className="max-w-7xl mx-auto px-5 lg:px-10 py-14 grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <div className="flex items-center gap-2.5">
              {logoUrl ? (
                <img src={logoUrl} alt={tenantNome} className="h-10 w-auto object-contain" />
              ) : (
                <div className="h-10 w-10 rounded-md bg-white/15 flex items-center justify-center font-bold">{initial}</div>
              )}
              <span className="font-semibold">{tenantNome}</span>
            </div>
            <p className="mt-3 text-sm text-white/70 max-w-xs">
              Laboratório de análises clínicas comprometido com qualidade, agilidade e atendimento humano.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-widest text-white/60 uppercase">Links úteis</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li><a href="#top" className="text-white/80 hover:text-white">Página inicial</a></li>
              <li><a href="#sobre" className="text-white/80 hover:text-white">Sobre</a></li>
              <li><Link to={`/site/${slug}/app`} className="text-white/80 hover:text-white">Resultados</Link></li>
              <li><a href="#exames" className="text-white/80 hover:text-white">Exames</a></li>
              <li><a href="#unidades" className="text-white/80 hover:text-white">Unidades</a></li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-widest text-white/60 uppercase">Entre em contato</p>
            <ul className="mt-4 space-y-2.5 text-sm text-white/80">
              {whatsapp ? (
                <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-[hsl(var(--accent))]" /> {whatsapp}</li>
              ) : null}
              <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-[hsl(var(--accent))]" /> contato@{slug}.com.br</li>
              <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-[hsl(var(--accent))]" /> Seg a Sex 07h às 17h</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-5 lg:px-10 py-5 text-[11px] text-white/50 flex flex-wrap justify-between gap-2">
            <span>© {new Date().getFullYear()} {tenantNome}. Todos os direitos reservados.</span>
            <span>Site desenvolvido sobre a plataforma SISLAC.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ServicoCard({ icon, title, href, external, image }: { icon: React.ReactNode; title: string; href: string; external?: boolean; image?: string }) {
  const cls = "group relative rounded-2xl border border-white/10 overflow-hidden flex flex-col min-h-[200px] hover:border-white/30 transition-colors";
  const inner = (
    <>
      {image ? (
        <img src={image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--primary))] via-[hsl(var(--primary))]/50 to-[hsl(var(--primary))]/20" />
      <div className="relative p-4 lg:p-5 flex flex-col gap-6 flex-1">
        <div className="h-9 w-9 rounded-lg bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] flex items-center justify-center">
          {icon}
        </div>
        <div className="flex items-end justify-between gap-2 mt-auto">
          <div className="text-sm font-semibold leading-tight text-white">{title}</div>
          <ArrowUpRight className="h-4 w-4 text-white/70 group-hover:text-white transition-colors" />
        </div>
      </div>
    </>
  );
  if (external || /^https?:|^\/site\//.test(href)) {
    return <a href={href} className={cls} target={external && href.startsWith("http") ? "_blank" : undefined} rel={external && href.startsWith("http") ? "noopener noreferrer" : undefined}>{inner}</a>;
  }
  return <a href={href} className={cls}>{inner}</a>;
}