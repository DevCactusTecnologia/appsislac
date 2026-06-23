import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Activity,
  FlaskConical,
  Users,
  Beaker,
  FileBarChart,
  Wallet,
  Network,
  LayoutDashboard,
  CheckCircle2,
  Sparkles,
  Menu,
  X,
  BadgeCheck,
} from "lucide-react";

const pillars = [
  { icon: Activity, title: "Operação contínua", desc: "Da recepção ao laudo, sem ruptura de fluxo entre setores." },
  { icon: BadgeCheck, title: "Qualidade & rastreabilidade", desc: "Cadeia de custódia da amostra, validação de críticos e conformidade com a RDC ANVISA 786/2023." },
  { icon: Wallet, title: "Controle financeiro", desc: "Entradas, saídas, convênios e conciliação em tempo real." },
  { icon: Network, title: "Integrações nativas", desc: "Labs de apoio e equipamentos analíticos sem retrabalho." },
];

const modules = [
  { icon: Users, title: "Atendimento", desc: "Triagem, recepção e protocolo único." },
  { icon: Activity, title: "Pacientes", desc: "Histórico, débitos e alertas automáticos." },
  { icon: FlaskConical, title: "Exames", desc: "Catálogo, parâmetros e validação clínica." },
  { icon: Beaker, title: "Soroteca", desc: "Rastreabilidade, validade e reutilização." },
  { icon: Wallet, title: "Financeiro", desc: "Caixa, faturas e fechamento por período." },
  { icon: FileBarChart, title: "Convênios", desc: "Tabelas TUSS/CBHPM e lotes TISS." },
  { icon: Network, title: "Labs de apoio", desc: "DB, Hermes, Álvaro e adaptadores." },
  { icon: LayoutDashboard, title: "Administração", desc: "Multi-unidade, papéis e auditoria." },
];

const flow = [
  { step: "01", title: "Cadastro", desc: "Paciente identificado e protocolo emitido." },
  { step: "02", title: "Atendimento", desc: "Exames selecionados, convênio e cobrança." },
  { step: "03", title: "Coleta", desc: "Etiquetas, amostras e rastreabilidade ativa." },
  { step: "04", title: "Análise", desc: "Resultados validados e críticos sinalizados." },
  { step: "05", title: "Liberação", desc: "Laudo assinado, faturamento e entrega." },
];

const differentials = [
  "Validação clínica com checagem de valores críticos e de referência",
  "Auditoria completa de cada ação operacional",
  "Integração direta com laboratórios de apoio",
  "Controle de soroteca com rastreabilidade da amostra",
  "Conformidade com a RDC ANVISA 786/2023",
];

const LandingPageResponsive = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const original = document.title;
    document.title = "SISLAC — Gestão completa para laboratórios clínicos";
    const meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute("content") ?? null;
    if (meta) {
      meta.setAttribute(
        "content",
        "SISLAC: plataforma SaaS para laboratórios clínicos. Atendimento, coleta, análise, financeiro e integrações em um único sistema seguro e escalável.",
      );
    }
    return () => {
      document.title = original;
      if (meta && prevDesc !== null) meta.setAttribute("content", prevDesc);
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Background decorativo - Responsivo */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {/* Mobile: Blobs menores */}
        <div className="absolute -left-32 -top-40 h-[320px] w-[320px] rounded-full bg-primary/20 blur-[160px] sm:h-[640px] sm:w-[640px]" />
        <div className="absolute right-[-120px] top-[280px] h-[260px] w-[260px] rounded-full bg-secondary/15 blur-[160px] sm:h-[520px] sm:w-[520px]" />
        <div className="absolute left-1/2 top-[1100px] h-[240px] w-[240px] -translate-x-1/2 rounded-full bg-primary/10 blur-[180px] sm:h-[480px] sm:w-[480px]" />
        <div
          className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(hsl(var(--foreground))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground))_1px,transparent_1px)] [background-size:48px_48px]"
          aria-hidden="true"
        />
      </div>

      {/* Header - RESPONSIVO */}
      <header className="fixed left-1/2 top-3 z-50 w-[95%] max-w-6xl -translate-x-1/2 rounded-full border border-border/60 bg-card/70 px-3 py-2 shadow-[0_8px_30px_-12px_hsl(var(--foreground)/0.18)] backdrop-blur-xl transition-all sm:top-5 sm:px-6 sm:py-2.5">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo */}
          <Link to="/" className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_4px_12px_-4px_hsl(var(--primary)/0.6)] sm:h-8 sm:w-8">
              <FlaskConical className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
            <span className="hidden text-sm font-semibold tracking-tight text-foreground lg:inline sm:text-base">SISLAC</span>
          </Link>

          {/* Nav Desktop */}
          <nav className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex sm:gap-5 lg:gap-7 lg:text-sm">
            <a href="#pilares" className="transition-colors hover:text-foreground">Pilares</a>
            <a href="#modulos" className="transition-colors hover:text-foreground">Módulos</a>
            <a href="#fluxo" className="transition-colors hover:text-foreground">Fluxo</a>
            <a href="#diferenciais" className="transition-colors hover:text-foreground">Diferenciais</a>
          </nav>

          {/* CTA Buttons */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Mobile: Botão compacto */}
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-transform hover:scale-[1.02] sm:hidden"
              aria-label="Entrar"
            >
              <ArrowRight className="h-3 w-3" />
            </Link>

            {/* Tablet: Texto "Entrar" */}
            <Link
              to="/login"
              className="hidden rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex sm:px-3.5 sm:text-sm"
            >
              Entrar
            </Link>

            {/* Desktop: Botão completo */}
            <Link
              to="/login"
              className="hidden items-center gap-1.5 rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-transform hover:scale-[1.02] sm:inline-flex"
            >
              Entrar
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex items-center justify-center p-1 text-foreground sm:hidden"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="mt-3 border-t border-border/40 pt-3 sm:hidden">
            <div className="flex flex-col gap-2">
              <a href="#pilares" className="block rounded px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Pilares</a>
              <a href="#modulos" className="block rounded px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Módulos</a>
              <a href="#fluxo" className="block rounded px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Fluxo</a>
              <a href="#diferenciais" className="block rounded px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Diferenciais</a>
            </div>
          </nav>
        )}
      </header>

      <main className="relative z-10">
        {/* Hero - RESPONSIVO */}
        <section className="px-4 pb-12 pt-24 sm:px-6 sm:pb-20 sm:pt-32 md:pb-24 md:pt-40 lg:pt-44">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center sm:gap-6 md:gap-8">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-2 py-0.75 text-[10px] font-medium tracking-wide text-primary sm:gap-2 sm:px-3 sm:py-1 sm:text-xs md:px-3.5 md:py-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Mais laudos liberados, menos retrabalho
            </div>

            <h1 className="text-balance text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl sm:leading-[1.1] md:text-5xl md:leading-[1.05] lg:text-7xl">
              Gestão completa para
              <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
                laboratórios clínicos
              </span>
            </h1>

            <p className="max-w-2xl text-pretty text-xs leading-relaxed text-muted-foreground sm:text-sm md:text-base lg:text-lg">
              Do atendimento ao resultado, tudo em um único sistema seguro e escalável.
              Coleta rastreada, análises validadas, financeiro integrado.
            </p>

            <div className="mt-2 flex w-full flex-col items-center gap-2 sm:mt-4 sm:w-auto sm:gap-3 sm:flex-row">
              <Link
                to="/login"
                className="group flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-[0_10px_40px_-12px_hsl(var(--primary)/0.7)] transition-all hover:scale-[1.02] hover:shadow-[0_14px_48px_-10px_hsl(var(--primary)/0.7)] sm:w-auto sm:rounded-full sm:px-7 sm:py-3 md:px-7 md:py-3.5 sm:text-sm"
              >
                Entrar agora
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 sm:h-4 sm:w-4" />
              </Link>
              <a
                href="#fluxo"
                className="flex w-full items-center justify-center gap-1 rounded-lg border border-border bg-card/60 px-4 py-2 text-xs font-semibold text-foreground backdrop-blur-md transition-colors hover:bg-card sm:w-auto sm:rounded-full sm:px-7 sm:py-3 md:px-7 md:py-3.5 sm:text-sm"
              >
                Ver demonstração
              </a>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-[9px] text-muted-foreground sm:mt-3 sm:gap-x-4 sm:gap-y-2 sm:text-xs md:text-xs">
              <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5 text-secondary sm:h-3 sm:w-3" />Reduz retrabalho</span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5 text-secondary sm:h-3 sm:w-3" />Laudos em minutos</span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5 text-secondary sm:h-3 sm:w-3" />Rastreabilidade</span>
            </div>
          </div>

          {/* Hero Preview - RESPONSIVO */}
          <div className="relative mx-auto mt-8 max-w-6xl sm:mt-12 md:mt-16 lg:mt-20">
            <div className="absolute -inset-x-8 -top-4 h-16 rounded-full bg-primary/20 blur-3xl sm:-inset-x-12 sm:-top-6 sm:h-24 md:h-32" />
            <div className="relative overflow-hidden rounded-lg border border-border/70 bg-card/80 p-1.5 shadow-[0_20px_60px_-20px_hsl(var(--foreground)/0.3)] backdrop-blur-xl sm:rounded-2xl sm:p-2 md:rounded-[28px]">
              <div className="flex h-6 items-center justify-between border-b border-border/60 px-2 sm:h-8 sm:px-3 md:h-10 md:px-4">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 sm:h-2 sm:w-2" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 sm:h-2 sm:w-2" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 sm:h-2 sm:w-2" />
                </div>
                <div className="rounded-md bg-muted/60 px-1.5 py-0.25 font-mono text-[7px] text-muted-foreground sm:px-2 sm:py-0.5 sm:text-[9px] md:px-2.5 md:text-[10px]">
                  sislac.app
                </div>
                <div className="w-6 sm:w-8 md:w-12" />
              </div>

              <div className="grid grid-cols-1 gap-0 sm:grid-cols-12">
                <aside className="col-span-1 hidden border-r border-border/60 bg-muted/30 p-2 sm:block sm:col-span-3 sm:p-3 md:p-4">
                  <div className="flex items-center gap-1.5 px-1.5 pb-2.5 sm:px-2 sm:pb-3 md:pb-4">
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary text-primary-foreground sm:h-6 sm:w-6 md:h-7 md:w-7">
                      <FlaskConical className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    </div>
                    <span className="text-[10px] font-semibold sm:text-xs md:text-sm">SISLAC</span>
                  </div>
                  <div className="space-y-0.5 sm:space-y-1">
                    {[
                      { i: Activity, l: "Atendimentos", active: true },
                      { i: Users, l: "Pacientes" },
                      { i: FlaskConical, l: "Exames" },
                      { i: Beaker, l: "Soroteca" },
                    ].map((it) => (
                      <button
                        key={it.l}
                        className={`flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] transition-colors sm:px-2 sm:py-1.5 sm:text-xs md:gap-2 md:px-2 md:py-1.5 md:text-xs ${
                          it.active
                            ? "bg-primary/20 text-primary"
                            : "text-muted-foreground hover:bg-muted/60"
                        }`}
                      >
                        <it.i className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                        <span className="hidden sm:inline">{it.l}</span>
                      </button>
                    ))}
                  </div>
                </aside>

                <main className="col-span-1 p-2 sm:col-span-9 sm:p-3 md:p-6">
                  <div className="space-y-2 sm:space-y-3 md:space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-[8px] font-semibold text-foreground sm:text-[10px] md:text-xs">ATENDIMENTOS</h2>
                      <button className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[7px] transition-colors hover:bg-muted sm:px-2 sm:py-1 sm:text-[8px] md:text-xs">
                        + Novo
                      </button>
                    </div>
                    <div className="space-y-1 sm:space-y-1.5">
                      {[
                        { p: "João Silva", conv: "Unimed", prec: "R$ 450" },
                        { p: "Maria Santos", conv: "Próprio", prec: "R$ 380" },
                      ].map((row, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded border border-border/50 bg-muted/20 px-1.5 py-1 text-[8px] sm:px-2 sm:py-1.5 sm:text-[9px] md:px-3 md:py-2 md:text-xs"
                        >
                          <div>
                            <div className="font-medium text-foreground">{row.p}</div>
                            <div className="text-muted-foreground">{row.conv}</div>
                          </div>
                          <div className="font-semibold text-primary">{row.prec}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </main>
              </div>
            </div>
          </div>
        </section>

        {/* Pilares - RESPONSIVO */}
        <section id="pilares" className="px-4 py-12 sm:px-6 sm:py-16 md:py-20 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 text-center sm:mb-8 md:mb-12">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary sm:text-sm">Pilares</p>
              <h2 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl">
                Construído para laboratórios reais.
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:gap-6 lg:gap-8">
              {pillars.map((pilar) => {
                const IconComponent = pilar.icon;
                return (
                  <div
                    key={pilar.title}
                    className="group rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-lg sm:p-5 md:p-6"
                  >
                    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary transition-colors group-hover:bg-primary/25 sm:h-12 sm:w-12">
                      <IconComponent className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <h3 className="mb-2 text-sm font-semibold text-foreground sm:text-base md:text-lg">
                      {pilar.title}
                    </h3>
                    <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {pilar.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Módulos - RESPONSIVO */}
        <section id="modulos" className="px-4 py-12 sm:px-6 sm:py-16 md:py-20 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 text-center sm:mb-8 md:mb-12">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary sm:text-sm">Módulos</p>
              <h2 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl">
                Tudo integrado em um sistema.
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-4 lg:gap-6">
              {modules.map((mod) => {
                const IconComponent = mod.icon;
                return (
                  <div
                    key={mod.title}
                    className="group rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/50 hover:shadow-lg sm:p-4 md:p-5"
                  >
                    <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/15 text-secondary transition-colors group-hover:bg-secondary/25 sm:h-9 sm:w-9 md:h-10 md:w-10">
                      <IconComponent className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <h3 className="mb-1 text-xs font-semibold text-foreground sm:text-sm md:text-base">
                      {mod.title}
                    </h3>
                    <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs md:text-sm">
                      {mod.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA Final - RESPONSIVO */}
        <section className="px-4 pb-16 pt-8 sm:px-6 sm:pb-24 sm:pt-12 md:pb-32 md:pt-16">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-lg border border-border bg-card p-6 text-center sm:rounded-lg sm:p-10 md:rounded-lg md:p-16 lg:p-20">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-[10px] font-medium text-primary sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs md:px-3.5 md:py-1.5 md:text-xs">
              <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              Pronto para começar
            </div>

            <h2 className="mb-3 text-balance text-xl font-bold tracking-tight sm:mb-4 sm:text-3xl md:mb-5 md:text-4xl lg:text-5xl">
              Pronto para modernizar seu laboratório?
            </h2>
            <p className="mx-auto mb-6 max-w-xl text-pretty text-xs leading-relaxed text-muted-foreground sm:mb-8 sm:text-sm md:mb-10 md:text-base">
              Crie sua conta em minutos. Comece pelo essencial e expanda conforme seu fluxo amadurece.
            </p>

            <div className="flex flex-col items-center justify-center gap-2 sm:gap-3 sm:flex-row">
              <Link to="/login" className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto sm:px-6 sm:py-3 md:px-8 md:py-4 md:text-sm">
                Entrar agora
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 sm:h-4 sm:w-4" />
              </Link>
              <a href="mailto:contato@sislac.app" className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted sm:w-auto sm:px-6 sm:py-3 md:px-8 md:py-4 md:text-sm">
                Falar com especialista
              </a>
            </div>
          </div>
        </section>

        {/* Footer - RESPONSIVO */}
        <footer className="border-t border-border/60 px-4 py-6 sm:px-6 sm:py-10">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row sm:gap-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary text-primary-foreground sm:h-6 sm:w-6">
                <FlaskConical className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              </div>
              <span className="font-medium text-foreground">SISLAC</span>
              <span className="hidden sm:inline">· Sistema laboratorial clínico</span>
            </div>
            <div className="flex items-center gap-3 sm:gap-5">
              <Link to="/login" className="transition-colors hover:text-foreground">Entrar</Link>
              <a href="#modulos" className="transition-colors hover:text-foreground">Módulos</a>
              <Link to="/privacidade" className="transition-colors hover:text-foreground">Privacidade</Link>
              <span className="hidden sm:inline">© {new Date().getFullYear()} SISLAC</span>
            </div>
          </div>
        </footer>
      </main>

      {/* WhatsApp Button - RESPONSIVO */}
      <a
        href="https://wa.me/5583996729999"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Conversar pelo WhatsApp"
        className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14"
      >
        <svg viewBox="0 0 32 32" className="h-6 w-6 sm:h-7 sm:w-7" fill="currentColor" aria-hidden="true">
          <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.946 2.722.946.817 0 2.15-.36 2.45-1.235.13-.387.13-.703.07-.79-.07-.144-.27-.215-.558-.358Z M16.026 5.917A10.066 10.066 0 0 0 5.953 16c0 1.79.473 3.526 1.376 5.06L6 26l5.087-1.319a10.024 10.024 0 0 0 4.94 1.275C21.585 25.956 26 21.572 26 16.139c0-2.704-1.058-5.244-2.972-7.158a10.014 10.014 0 0 0-7.002-3.064Zm0 18.43c-1.42 0-2.812-.388-4.014-1.118l-.288-.172-2.984.776.787-2.913-.187-.302a8.42 8.42 0 0 1-1.301-4.512c0-4.654 3.788-8.43 8.43-8.43a8.398 8.398 0 0 1 5.962 2.476 8.394 8.394 0 0 1 2.467 5.964c0 4.654-3.79 8.43-8.43 8.43Z"/>
        </svg>
      </a>
    </div>
  );
};

export default LandingPageResponsive;
