import { useEffect } from "react";
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
  ChevronRight,
  CircleDot,
  BadgeCheck,
  Bot,
  QrCode,
  MessageCircle,
  Globe,
  Map,
  Package,
  Stethoscope,
  ClipboardList,
  Printer,
  FileSignature,
  Building2,
} from "lucide-react";

const pillars = [
  { icon: Activity, title: "Operação contínua", desc: "Recepção, coleta, bancada e liberação no mesmo protocolo — sem planilhas, sem retrabalho." },
  { icon: BadgeCheck, title: "Qualidade clínica", desc: "Valores de referência por sexo/idade, alerta de críticos e auditoria dupla (analisado/liberado)." },
  { icon: Wallet, title: "Financeiro integrado", desc: "Caixa, PIX no balcão, convênios TISS/TUSS, glosas e fechamento por competência." },
  { icon: Network, title: "Integrações nativas", desc: "Labs de apoio (DB, Hermes-Pardini, Álvaro), site público do laboratório e WhatsApp centralizado." },
];

const modules = [
  { icon: Users, title: "Atendimento", desc: "Recepção, orçamento, protocolo único e cobrança por convênio ou particular." },
  { icon: Stethoscope, title: "Pacientes", desc: "Cadastro único, histórico clínico, débitos e alertas de jejum e prioridade." },
  { icon: ClipboardList, title: "Coleta & Bancada", desc: "Etiquetas, registro de coleta, análise por setor e digitação inteligente de resultados." },
  { icon: FlaskConical, title: "Catálogo de exames", desc: "Parâmetros, fórmulas, réguas etárias e variações por jejum/risco cardiovascular." },
  { icon: Map, title: "Mapa de trabalho", desc: "Filtragem por paciente, setor ou analista; impressão por bancada e reimpressão garantida." },
  { icon: FileSignature, title: "Laudos & Impressão", desc: "Layout científico travado, assinatura digital, marca d'água e impressão em lote." },
  { icon: Beaker, title: "Soroteca", desc: "Estrutura física, triagem, materiais e expurgo com rastreabilidade total da amostra." },
  { icon: Network, title: "Labs de apoio", desc: "Terceirização com recebimento manual ou automático e PDF do apoio anexado ao laudo." },
  { icon: Wallet, title: "Financeiro", desc: "Caixa, A receber, despesas, conciliação e fechamento de convênios por competência." },
  { icon: FileBarChart, title: "Convênios & TISS", desc: "Tabelas TUSS/CBHPM, lotes TISS, glosas e faturamento por competência." },
  { icon: Package, title: "Estoque", desc: "Insumos, reagentes, validade e consumo por setor." },
  { icon: LayoutDashboard, title: "Administração", desc: "Multi-unidade, papéis granulares, auditoria de cada ação e gestão de equipe." },
];

const flow = [
  { step: "01", title: "Cadastro", desc: "Paciente identificado, jejum e prioridade clínica registrados." },
  { step: "02", title: "Atendimento", desc: "Exames, convênio, orçamento e cobrança em um clique." },
  { step: "03", title: "Coleta", desc: "Etiquetas impressas, amostras rastreadas e armazenadas na soroteca." },
  { step: "04", title: "Análise", desc: "Resultados digitados, fórmulas calculadas e críticos sinalizados." },
  { step: "05", title: "Liberação", desc: "Validação dupla, laudo assinado, faturamento e entrega ao paciente." },
];

const extras = [
  { icon: Bot, title: "SISLAC Assistant", desc: "Assistente com IA por Ctrl+J: navega, busca pacientes e explica regras do sistema por voz ou texto." },
  { icon: QrCode, title: "PIX no balcão", desc: "QR Code dinâmico gerado na recepção; pagamento confirmado e baixa automática no caixa." },
  { icon: MessageCircle, title: "WhatsApp centralizado", desc: "Orçamentos, comprovantes e laudos enviados pelo número oficial do laboratório." },
  { icon: Globe, title: "Site público do laboratório", desc: "Vitrine de exames, pedidos online e domínio próprio — sem dependência de webdesigner." },
  { icon: Printer, title: "Impressão geral", desc: "PDF em lote dos laudos finalizados do dia, na ordem do atendimento." },
  { icon: Building2, title: "Multi-unidade", desc: "Sede, filiais e pontos de coleta com escopo de dados, papéis e fluxos próprios." },
];

const differentials = [
  "Validação clínica com valores críticos e referência por sexo/idade",
  "Auditoria dupla: quem analisou e quem liberou cada exame",
  "Integração direta com Hermes-Pardini, DB e Álvaro",
  "Soroteca com cadeia de custódia da amostra ponta a ponta",
  "PIX presencial, TISS, convênios e particular no mesmo caixa",
  "Conformidade com RDC ANVISA 786/2023 e LGPD",
];

const Landing = () => {
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
      {/* Background decor - RESPONSIVO */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 -top-40 h-[320px] w-[320px] rounded-full bg-primary/20 blur-[160px] sm:h-[640px] sm:w-[640px]" />
        <div className="absolute right-[-120px] top-[280px] h-[260px] w-[260px] rounded-full bg-secondary/15 blur-[160px] sm:h-[520px] sm:w-[520px]" />
        <div className="absolute left-1/2 top-[1100px] h-[240px] w-[240px] -translate-x-1/2 rounded-full bg-primary/10 blur-[180px] sm:h-[480px] sm:w-[480px]" />
        <div
          className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(hsl(var(--foreground))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground))_1px,transparent_1px)] [background-size:48px_48px]"
          aria-hidden="true"
        />
      </div>

      {/* Header — minimalista: apenas logo + Entrar */}
      <header className="fixed left-1/2 top-3 z-50 w-[95%] max-w-6xl -translate-x-1/2 rounded-full border border-border/60 bg-card/70 px-3 py-2 shadow-[0_8px_30px_-12px_hsl(var(--foreground)/0.18)] backdrop-blur-xl sm:top-5 sm:px-5 sm:py-2.5">
        <div className="flex items-center justify-between gap-2">
          <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="SISLAC — início">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_4px_12px_-4px_hsl(var(--primary)/0.6)]">
              <FlaskConical className="h-4 w-4" />
              <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            </div>
          </Link>

          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-transform hover:scale-[1.02] sm:px-5 sm:py-2 sm:text-sm"
          >
            Entrar
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="px-4 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-40 lg:pt-44">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 text-center sm:gap-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-[11px] font-medium tracking-wide text-primary sm:px-3.5 sm:text-xs">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              100% gratuito · sem cartão de crédito
            </div>

            <h1 className="text-balance text-3xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
              Gestão completa para
              <br className="hidden sm:inline" />{" "}
              <span className="bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
                laboratórios clínicos
              </span>
            </h1>

            <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base lg:text-lg">
              Do atendimento ao resultado, tudo em um único sistema seguro e escalável.
              <span className="font-semibold text-foreground"> Grátis para sempre</span> — sem mensalidade, sem limite de usuários, sem pegadinha.
            </p>

            <div className="mt-2 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Link
                to="/inscricao"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_10px_40px_-12px_hsl(var(--primary)/0.7)] transition-all hover:scale-[1.02] hover:shadow-[0_14px_48px_-10px_hsl(var(--primary)/0.7)] sm:px-7 sm:py-3.5"
              >
                Criar conta grátis
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground sm:gap-x-6 sm:text-xs">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-secondary" />Gratuito, sem mensalidade</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-secondary" />Laudos liberados em minutos</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-secondary" />Rastreabilidade ponta a ponta</span>
            </div>

          </div>

          {/* Hero preview */}
          <div className="relative mx-auto mt-12 max-w-6xl sm:mt-20">
            <div className="absolute -inset-x-12 -top-6 h-32 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative overflow-hidden rounded-[28px] border border-border/70 bg-card/80 p-2 shadow-[0_30px_80px_-30px_hsl(var(--foreground)/0.35)] backdrop-blur-xl">
              <div className="flex h-10 items-center justify-between border-b border-border/60 px-4">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                  <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                  <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                </div>
                <div className="rounded-md bg-muted/60 px-2.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  sislac.app/atendimentos
                </div>
                <div className="w-12" />
              </div>

              <div className="grid grid-cols-12 gap-0">
                <aside className="col-span-3 hidden border-r border-border/60 bg-muted/30 p-4 md:block">
                  <div className="flex items-center gap-2 px-2 pb-4">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                      <FlaskConical className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm font-semibold">SISLAC</span>
                  </div>
                  <div className="space-y-1">
                    {[
                      { i: Activity, l: "Atendimentos", active: true },
                      { i: Users, l: "Pacientes" },
                      { i: FlaskConical, l: "Exames" },
                      { i: Beaker, l: "Soroteca" },
                      { i: Wallet, l: "Financeiro" },
                      { i: LayoutDashboard, l: "Configurações" },
                    ].map((it) => {
                      const Icon = it.i;
                      return (
                        <div
                          key={it.l}
                          className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs ${
                            it.active ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {it.l}
                        </div>
                      );
                    })}
                  </div>
                </aside>

                <div className="col-span-12 p-3 sm:p-5 md:col-span-9 md:p-6">
                  <div className="mb-4 flex items-center justify-between sm:mb-5">
                    <div>
                      <h3 className="text-sm font-semibold sm:text-base">Atendimentos</h3>
                      <p className="text-[11px] text-muted-foreground sm:text-xs">Visão geral do dia</p>
                    </div>
                    <div className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-medium text-primary-foreground sm:px-3 sm:py-1.5 sm:text-[11px]">
                      + Novo
                    </div>
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-2 sm:mb-5 sm:grid-cols-4 sm:gap-2.5">
                    {[
                      { l: "Total", v: "248", t: "primary" as const },
                      { l: "Em andamento", v: "57", t: "warning" as const },
                      { l: "Finalizados", v: "184", t: "success" as const },
                      { l: "Críticos", v: "3", t: "danger" as const },
                    ].map((k) => (
                      <div key={k.l} className="rounded-lg border border-border/60 bg-card p-2.5 sm:p-3">
                        <div className="text-[9px] uppercase tracking-wide text-muted-foreground sm:text-[10px]">{k.l}</div>
                        <div
                          className={`mt-1 text-lg font-semibold tabular-nums sm:text-xl ${
                            k.t === "primary"
                              ? "text-primary"
                              : k.t === "warning"
                                ? "text-[hsl(var(--status-warning))]"
                                : k.t === "success"
                                  ? "text-[hsl(var(--status-success))]"
                                  : "text-[hsl(var(--status-danger))]"
                          }`}
                        >
                          {k.v}
                        </div>
                      </div>
                    ))}
                  </div>


                  <div className="overflow-x-auto rounded-lg border border-border/60">
                    <div className="min-w-[520px]">
                      <div className="grid grid-cols-12 gap-2 border-b border-border/60 bg-muted/40 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        <div className="col-span-2">Protocolo</div>
                        <div className="col-span-4">Paciente</div>
                        <div className="col-span-3">Convênio</div>
                        <div className="col-span-2">Status</div>
                        <div className="col-span-1 text-right">Total</div>
                      </div>
                      {[
                        { p: "P-2841", n: "Maria Silva Andrade", c: "Unimed", s: "Em análise", st: "warning" as const, v: "R$ 184" },
                        { p: "P-2840", n: "João Pedro Almeida", c: "Particular", s: "Finalizado", st: "success" as const, v: "R$ 92" },
                        { p: "P-2839", n: "Ana Beatriz Costa", c: "Bradesco", s: "Coletado", st: "info" as const, v: "R$ 246" },
                        { p: "P-2838", n: "Carlos Henrique Lima", c: "SulAmérica", s: "Pendente", st: "pending" as const, v: "R$ 312" },
                      ].map((r) => (
                        <div key={r.p} className="grid grid-cols-12 items-center gap-2 border-b border-border/40 px-3 py-2.5 text-xs last:border-b-0">
                          <div className="col-span-2 font-mono text-[11px] text-muted-foreground">{r.p}</div>
                          <div className="col-span-4 truncate font-medium">{r.n}</div>
                          <div className="col-span-3 truncate text-muted-foreground">{r.c}</div>
                          <div className="col-span-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                r.st === "success"
                                  ? "bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success))]"
                                  : r.st === "warning"
                                    ? "bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning))]"
                                    : r.st === "info"
                                      ? "bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info))]"
                                      : "bg-[hsl(var(--status-pending-bg))] text-[hsl(var(--status-pending))]"
                              }`}
                            >
                              <CircleDot className="h-2.5 w-2.5" />
                              {r.s}
                            </span>
                          </div>
                          <div className="col-span-1 text-right font-semibold tabular-nums">{r.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pilares */}
        <section id="pilares" className="px-4 py-16 sm:px-6 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 max-w-2xl sm:mb-14">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Por que SISLAC</p>
              <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                Quatro pilares que sustentam a operação clínica.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {pillars.map((p) => {
                const Icon = p.icon;
                return (
                  <div key={p.title} className="group relative overflow-hidden rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/40">
                    <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mb-1.5 text-base font-semibold">{p.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Módulos */}
        <section id="modulos" className="px-4 py-16 sm:px-6 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-6xl">
            <div className="mb-14 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Módulos</p>
                <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                  Tudo que o laboratório precisa, em um só lugar.
                </h2>
              </div>
              <p className="max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
                Cada módulo é independente, mas conversa nativamente com os outros. Ative o que for útil para o seu fluxo.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {modules.map((m, idx) => {
                const Icon = m.icon;
                return (
                  <div key={m.title} className="group relative overflow-hidden rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3 className="mb-1 text-sm font-semibold">{m.title}</h3>
                    <p className="text-xs leading-relaxed text-muted-foreground">{m.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Inteligência & automação */}
        <section id="extras" className="px-4 py-16 sm:px-6 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 flex flex-col gap-8 sm:mb-14 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Inteligência & automação</p>
                <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                  Recursos que cabem na rotina do balcão.
                </h2>
              </div>
              <p className="max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
                Pequenas decisões automatizadas que economizam horas por dia — IA, PIX, WhatsApp e site próprio do laboratório.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {extras.map((e) => {
                const Icon = e.icon;
                return (
                  <div key={e.title} className="group relative overflow-hidden rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mb-1 text-sm font-semibold">{e.title}</h3>
                    <p className="text-xs leading-relaxed text-muted-foreground">{e.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Fluxo */}
        <section id="fluxo" className="px-4 py-16 sm:px-6 sm:py-24 lg:py-32">

          <div className="mx-auto max-w-6xl">
            <div className="mb-10 max-w-2xl sm:mb-14">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Como funciona</p>
              <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                Cinco passos. Zero retrabalho.
              </h2>
            </div>

            <div className="relative">
              <div className="absolute left-0 right-0 top-8 hidden h-px bg-border lg:block" />
              <div className="grid gap-4 lg:grid-cols-5">
                {flow.map((f, idx) => (
                  <div key={f.step} className="relative">
                    <div className="rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40">
                      <div className="mb-4 flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background font-mono text-xs font-semibold text-primary">
                          {f.step}
                        </div>
                        {idx < flow.length - 1 && (
                          <ChevronRight className="hidden h-4 w-4 text-muted-foreground/50 lg:block" />
                        )}
                      </div>
                      <h3 className="mb-1 text-sm font-semibold">{f.title}</h3>
                      <p className="text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Diferenciais */}
        <section id="diferenciais" className="px-4 py-16 sm:px-6 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Diferenciais</p>
                <h2 className="mb-5 text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                  Construído para a realidade do laboratório.
                </h2>
                <p className="text-pretty text-base leading-relaxed text-muted-foreground">
                  Não é um ERP genérico adaptado. É um sistema laboratorial, do dia a dia operacional ao fechamento contábil.
                </p>
              </div>
              <ul className="space-y-2.5">
                {differentials.map((d) => (
                  <li key={d} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-secondary/15 text-secondary">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm text-foreground">{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* CTA Final */}
        <section className="px-4 pb-20 pt-8 sm:px-6 sm:pb-32 sm:pt-12">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-lg border border-border bg-card p-6 text-center sm:p-12 lg:p-20">
            <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3.5 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Pronto para começar
            </div>

            <h2 className="mb-5 text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              Pronto para modernizar
              <br />
              seu laboratório?
            </h2>
            <p className="mx-auto mb-10 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
              Crie sua conta em minutos. Comece pelo essencial e expanda conforme seu fluxo amadurece.
            </p>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/inscricao" className="group inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                Criar conta
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a href="mailto:contato@sislac.app" className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-8 py-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
                Falar com especialista
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/60 px-4 py-8 sm:px-6 sm:py-10">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-xs text-muted-foreground sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <FlaskConical className="h-3 w-3" />
              </div>
              <span className="font-medium text-foreground">SISLAC</span>
              <span>· Sistema laboratorial clínico</span>
            </div>
            <div className="flex items-center gap-5">
              <Link to="/login" className="transition-colors hover:text-foreground">Entrar</Link>
              <a href="#modulos" className="transition-colors hover:text-foreground">Módulos</a>
              <Link to="/privacidade" className="transition-colors hover:text-foreground">Privacidade</Link>
              <span>© {new Date().getFullYear()} SISLAC</span>
            </div>
          </div>
        </footer>
      </main>

      {/* Botão flutuante WhatsApp */}
      <a
        href="https://wa.me/5583996729999"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Conversar pelo WhatsApp"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105"
      >
        <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden="true">
          <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.946 2.722.946.817 0 2.15-.36 2.45-1.235.13-.387.13-.703.07-.79-.07-.144-.27-.215-.558-.358Z M16.026 5.917A10.066 10.066 0 0 0 5.953 16c0 1.79.473 3.526 1.376 5.06L6 26l5.087-1.319a10.024 10.024 0 0 0 4.94 1.275C21.585 25.956 26 21.572 26 16.139c0-2.704-1.058-5.244-2.972-7.158a10.014 10.014 0 0 0-7.002-3.064Zm0 18.43c-1.42 0-2.812-.388-4.014-1.118l-.288-.172-2.984.776.787-2.913-.187-.302a8.42 8.42 0 0 1-1.301-4.512c0-4.654 3.788-8.43 8.43-8.43a8.398 8.398 0 0 1 5.962 2.476 8.394 8.394 0 0 1 2.467 5.964c0 4.654-3.79 8.43-8.43 8.43Z"/>
        </svg>
      </a>
    </div>
  );
};

export default Landing;
