import { PageHeader } from "@/components/shared/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Crown,
  ClipboardList,
  FileText,
  Microscope,
  TestTubes,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  Sparkles,
} from "lucide-react";
import { getAtendimentos, subscribe as subscribeAtendimentos } from "@/data/atendimentoStore";
import heroFlower from "@/assets/hero-flower.png";
import { getPacientes, subscribePacientes } from "@/data/pacienteStore";
import { getSaidas, subscribeFinanceiro } from "@/data/financeiroStore";
import type { MockAtendimento } from "@/data/types";
import { fmtBRLNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureFlag } from "@/lib/featureFlags";
import { useDashboardKpis } from "@/hooks/useDashboardKpis";
import { useAReceberTotais } from "@/hooks/useAReceberPacientes";
import { supabase } from "@/integrations/supabase/client";
import RecepcionistaDashboard from "@/components/dashboard/RecepcionistaDashboard";
import AnalistaDashboard from "@/components/dashboard/AnalistaDashboard";

/* ───────────────────────── helpers ───────────────────────── */

const PT_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})/;

function parsePtDate(value?: string): Date | null {
  if (!value) return null;
  const m = value.match(PT_DATE_RE);
  if (!m) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  const [, dd, mm, yyyy] = m;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
}

function isToday(d: Date | null): boolean {
  if (!d) return false;
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function isThisMonth(d: Date | null): boolean {
  if (!d) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

/* ───────────────────────── building blocks ───────────────────────── */

function VerSiteButton() {
  const { user } = useAuth();
  const [slug, setSlug] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const tenantId = (user as { tenantId?: string } | null)?.tenantId;
      if (!tenantId) return;
      const { data } = await supabase
        .from("tenants")
        .select("slug")
        .eq("id", tenantId)
        .maybeSingle();
      if (alive) setSlug((data as { slug?: string } | null)?.slug ?? null);
    })();
    return () => { alive = false; };
  }, [user]);
  if (!slug) return null;
  return (
    <a
      href={`/site/${slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-foreground text-background text-sm font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-sm"
    >
      <Crown className="h-4 w-4" />
      Ver site
    </a>
  );
}

interface HeroKpiProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  trend?: "up" | "down" | "neutral";
  visual?: "ring" | "dots" | "spark" | "bars";
  visualValue?: number; // 0..1 para ring, ou ratio de preenchimento
}

function KpiVisual({ kind, value = 0.6 }: { kind?: HeroKpiProps["visual"]; value?: number }) {
  const v = Math.max(0, Math.min(1, value));
  if (kind === "ring") {
    const r = 24, c = 2 * Math.PI * r;
    return (
      <svg viewBox="0 0 68 68" className="h-16 w-16 -rotate-90">
        <circle cx="34" cy="34" r={r} className="fill-none stroke-lavender/25" strokeWidth="12" />
        <circle
          cx="34" cy="34" r={r}
          className="fill-none stroke-primary transition-[stroke-dashoffset] duration-700"
          strokeWidth="12" strokeLinecap="butt"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)}
        />
      </svg>
    );
  }
  if (kind === "dots") {
    const rows = [2, 3, 4, 5, 6, 5], total = rows.reduce((a, b) => a + b, 0), filled = Math.round(v * total);
    let idx = 0;
    return (
      <div className="flex flex-col justify-end gap-1.5">
        {rows.map((count, row) => (
          <div key={row} className="flex gap-1.5">
            {Array.from({ length: count }).map((_, dot) => {
              const active = idx++ < filled;
              return <span key={dot} className={cn("h-2 w-2 rounded-full", active ? "bg-primary/70" : "bg-lavender/25")} />;
            })}
          </div>
        ))}
      </div>
    );
  }
  if (kind === "spark") {
    const pts = [12, 24, 31, 26, 16, 20, 34, 42, 35, 29, 44, 51, 47];
    const d = pts.map((y, i) => `${i === 0 ? "M" : "L"} ${i * 10} ${58 - y}`).join(" ");
    return (
      <svg viewBox="0 0 128 64" preserveAspectRatio="none" className="h-16 w-32">
        <path d={`${d} L 128 64 L 0 64 Z`} className="fill-lavender/25" />
        <path d={d} className="fill-none stroke-primary" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "bars") {
    const heights = [42, 64, 36, 50, 78, 34, 96, 44];
    return (
      <div className="flex h-16 w-32 items-end gap-2">
        {heights.map((h, i) => (
          <span key={i} className="w-3 rounded-t bg-primary/55 animate-bar-in" style={{ height: `${h}%`, animationDelay: `${i * 40}ms`, transformOrigin: "bottom" }} />
        ))}
      </div>
    );
  }
  return null;
}

function HeroKpi({ label, value, hint, icon: Icon, to, trend = "neutral", visual, visualValue }: HeroKpiProps) {
  void Icon;
  void trend;
  void hint;

  const inner = (
    <div
      className="group relative flex h-[132px] flex-col overflow-hidden rounded-2xl border border-border bg-card p-3 sm:p-4 shadow-soft card-tactile animate-fade-in-up sm:h-[148px]"
      style={{ containerType: "inline-size" }}
    >
      {/* Decoração de fundo (não compete por espaço) */}
      {visual && (
        <div className="pointer-events-none absolute -bottom-2 -right-2 opacity-25 sm:opacity-40 transition-transform duration-300 group-hover:scale-[1.03]">
          <KpiVisual kind={visual} value={visualValue} />
        </div>
      )}
      <div className="relative z-10 truncate text-[11px] font-semibold uppercase tracking-normal text-foreground/80">
        {label}
      </div>
      <div className="relative z-10 mt-auto w-full pt-3">
        <div
          className="block w-full font-bold tabular-nums tracking-tight leading-none text-foreground"
          style={{ fontSize: "clamp(1rem, 9cqw, 2rem)" }}
        >
          <span className="block w-full truncate">{value}</span>
        </div>
        {hint && (
          <div className="mt-1 truncate text-[10px] font-medium text-muted-foreground sm:text-[11px]">
            {hint}
          </div>
        )}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block h-full focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-2xl">
        {inner}
      </Link>
    );
  }
  return inner;
}

interface MiniStatProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  accent?: "default" | "warning" | "success" | "danger";
}

function MiniStat({ label, value, icon: Icon, to, accent = "default" }: MiniStatProps) {
  const badge =
    accent === "success"
      ? "Concluído"
      : accent === "warning"
      ? "Em processo"
      : accent === "danger"
      ? "Atenção"
      : "Aguardando";
  const badgeCls =
    accent === "success"
      ? "bg-emerald-100 text-emerald-700"
      : accent === "warning"
      ? "bg-amber-100 text-amber-700"
      : accent === "danger"
      ? "bg-rose-100 text-rose-700"
      : "bg-muted text-muted-foreground";
  const markerCls = accent === "success" ? "bg-foreground text-background" : accent === "warning" ? "ring-primary/35 bg-lavender/20 text-primary" : "border-border bg-background text-muted-foreground";

  const inner = (
    <div className="group flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-all duration-200 hover:border-primary/30 hover:bg-accent/30">
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ring-4 ring-transparent transition-transform group-hover:scale-105", markerCls)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="truncate text-sm font-semibold text-foreground">{label}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className={cn("hidden rounded-full px-3 py-1 text-[11px] font-medium sm:inline-flex", badgeCls)}>{badge}</span>
        <span className="text-base font-semibold tabular-nums text-foreground">{value}</span>
        {to && <ArrowUpRight className="h-4 w-4 text-foreground transition-transform group-hover:translate-x-0.5" />}
      </div>
    </div>
  );
  if (to) {
    return (
      <Link to={to} className="block focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-xl">
        {inner}
      </Link>
    );
  }
  return inner;
}

interface PanelProps {
  title: string;
  hint?: string;
  action?: { label: string; to: string };
  children: React.ReactNode;
  className?: string;
}

function Panel({ title, hint, action, children, className = "" }: PanelProps) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border bg-card shadow-soft animate-fade-in-up ${className}`}>
      <div className="relative flex items-center justify-between gap-3 border-b border-border/60 bg-lavender/40 px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {action && (
          <Link
            to={action.to}
            className="shrink-1 inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-xs font-medium text-primary hover:gap-1.5 hover:bg-accent transition-all"
          >
            {action.label}
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ───────────────────────── page ───────────────────────── */

const Dashboard = () => {
  const { user } = useAuth();
  const perfil = user?.perfil;
  const isRecepcionista = perfil === "recepcionista";
  const isAnalista = perfil === "analista";

  // Recepção tem dashboard dedicado, moderno e responsivo (escopo restrito).
  if (isRecepcionista) {
    return <RecepcionistaDashboard />;
  }

  // Analista tem dashboard dedicado focado em fluxo de amostras/análise/liberação.
  if (isAnalista) {
    return <AnalistaDashboard />;
  }

  // C-2 — Canary: quando paginated_atendimentos ON e USE_LEGACY_STORE OFF,
  // calculamos os KPIs server-side via RPC `dashboard_kpis` e ignoramos o
  // cache global (evita dados truncados em tenants grandes).
  const paginatedFlag = useFeatureFlag("paginated_atendimentos");
  const legacyFlag = useFeatureFlag("USE_LEGACY_STORE");
  const useRpc = paginatedFlag && !legacyFlag;

  // Caminho legado: continua subscrevendo aos stores (zero regressão).
  const [atendimentos, setAtendimentos] = useState<MockAtendimento[]>(() =>
    useRpc ? [] : getAtendimentos()
  );
  const [pacientes, setPacientes] = useState(() => (useRpc ? [] : getPacientes()));
  const [saidas, setSaidas] = useState(() => (useRpc ? [] : getSaidas()));

  useEffect(() => {
    if (useRpc) return; // não subscrever quando estamos em modo RPC
    const unsubA = subscribeAtendimentos(() => setAtendimentos(getAtendimentos()));
    const unsubP = subscribePacientes(() => setPacientes(getPacientes()));
    const unsubF = subscribeFinanceiro(() => setSaidas(getSaidas()));
    return () => {
      unsubA();
      unsubP();
      unsubF();
    };
  }, [useRpc]);

  // Caminho RPC: dados agregados pelo banco (consistentes com o dataset completo).
  const { data: rpcKpis } = useDashboardKpis(useRpc);

  // Fase 7 — SSOT: "A Receber" sempre vem da RPC `financeiro_a_receber_totais`,
  // independentemente da feature flag. Garante um único número entre Dashboard,
  // Recepção, Painel e Financeiro.
  const { totais: aReceberSsot } = useAReceberTotais(true);

  /* ── Operacional do dia ───────────────────────────────── */
  const operacionalLegacy = useMemo(() => {
    const hoje = atendimentos.filter((a) => isToday(parsePtDate(a.data)));
    let coletasPendentes = 0;
    let analisesAndamento = 0;
    let resultadosLiberar = 0;
    let cancelados = 0;
    let liberadosHoje = 0;

    for (const a of atendimentos) {
      const status = (a.statusAtendimento?.label ?? "").toLowerCase();
      const liberadoHojePorExame = (a.examesCobranca ?? []).some((ex) =>
        isToday(parsePtDate(ex.dataLiberacaoISO ?? undefined))
      );
      // Pipeline: Aguardando Coleta → Amostra Coletada → Em Análise → Amostra Analisada → Resultado Salvo → Resultado Liberado
      if (status.includes("aguard") && status.includes("colet")) coletasPendentes++;
      else if (status === "amostra coletada" || status.includes("em análise") || status.includes("em analise")) analisesAndamento++;
      else if (status === "amostra analisada" || status.includes("resultado salvo") || (status.includes("aguard") && status.includes("liber"))) resultadosLiberar++;
      else if (status.includes("cancel")) cancelados++;
      if (liberadoHojePorExame || (isToday(parsePtDate(a.data)) && (status.includes("liberado") || status.includes("entreg")))) liberadosHoje++;
    }
    return {
      atendimentosHoje: hoje.length,
      coletasPendentes,
      analisesAndamento,
      resultadosLiberar,
      cancelados,
      liberadosHoje,
    };
  }, [atendimentos]);

  /* ── Financeiro ───────────────────────────────────────── */
  const financeiroLegacy = useMemo(() => {
    let receitaHoje = 0;
    let receitaMes = 0;
    let aReceber = 0;
    let totalAtendimentosValor = 0;
    let countComValor = 0;

    for (const a of atendimentos) {
      const totalAtd = (a.examesCobranca ?? []).reduce((acc, e) => acc + (e.valor ?? 0), 0);
      if (totalAtd > 0) {
        totalAtendimentosValor += totalAtd;
        countComValor++;
      }

      const pago = (a.pagamentosRealizados ?? []).reduce((acc, p) => acc + (p.valor ?? 0), 0);
      const pendente = Math.max(totalAtd - pago, 0);
      const statusPg = (a.statusPagamento?.label ?? "").toLowerCase();
      if (!statusPg.includes("cancel")) aReceber += pendente;

      for (const p of a.pagamentosRealizados ?? []) {
        const dPag = parsePtDate(p.data);
        if (isToday(dPag)) receitaHoje += p.valor ?? 0;
        if (isThisMonth(dPag)) receitaMes += p.valor ?? 0;
      }
    }

    let saidasMes = 0;
    for (const s of saidas) {
      const d = parsePtDate(s.foiPago === "Sim" ? s.dataPagamento : s.dataVencimento);
      if (isThisMonth(d)) saidasMes += s.valorTotal ?? 0;
    }

    const ticketMedio = countComValor > 0 ? totalAtendimentosValor / countComValor : 0;
    return {
      receitaHoje,
      receitaMes,
      aReceber,
      saidasMes,
      saldoMes: receitaMes - saidasMes,
      ticketMedio,
    };
  }, [atendimentos, saidas]);

  /* ── Produtividade & qualidade ────────────────────────── */
  const produtividadeLegacy = useMemo(() => {
    const ultimos30 = daysAgo(30);
    let exames30d = 0;
    let canceladosExames = 0;
    const porUnidade = new Map<string, number>();
    const porSolicitante = new Map<string, number>();

    for (const a of atendimentos) {
      const d = parsePtDate(a.data);
      if (!d || d < ultimos30) continue;
      const totalEx = a.exames?.length ?? 0;
      exames30d += totalEx;
      if ((a.statusAtendimento?.label ?? "").toLowerCase().includes("cancel")) canceladosExames += totalEx;
      const u = a.unidadeId ?? "—";
      porUnidade.set(u, (porUnidade.get(u) ?? 0) + totalEx);
      const s = a.solicitante?.trim() || "—";
      porSolicitante.set(s, (porSolicitante.get(s) ?? 0) + totalEx);
    }

    const taxaCancelamento = exames30d > 0 ? (canceladosExames / exames30d) * 100 : 0;
    const topUnidade = [...porUnidade.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    const topSolicitante = [...porSolicitante.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    return { exames30d, taxaCancelamento, topUnidade, topSolicitante };
  }, [atendimentos]);

  /* ── Pacientes & convênios ────────────────────────────── */
  const pacientesInsightLegacy = useMemo(() => {
    const ativos = pacientes.filter((p) => (p.status ?? "Ativo") === "Ativo").length;
    const ultimos30 = daysAgo(30);
    const cpfsAtendidos = new Set<string>();
    const novosCpf = new Set<string>();
    const porConvenio = new Map<string, number>();
    for (const a of atendimentos) {
      const d = parsePtDate(a.data);
      if (!d || d < ultimos30) continue;
      if (a.cpf) cpfsAtendidos.add(a.cpf);
      const conv = a.convenio?.trim() || "Particular";
      porConvenio.set(conv, (porConvenio.get(conv) ?? 0) + 1);
    }
    const cpfsAntes = new Set<string>();
    for (const a of atendimentos) {
      const d = parsePtDate(a.data);
      if (!d) continue;
      if (d < ultimos30 && a.cpf) cpfsAntes.add(a.cpf);
    }
    for (const cpf of cpfsAtendidos) if (!cpfsAntes.has(cpf)) novosCpf.add(cpf);
    const topConvenio = [...porConvenio.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    return {
      total: pacientes.length,
      ativos,
      atendidos30d: cpfsAtendidos.size,
      novos30d: novosCpf.size,
      topConvenio,
    };
  }, [pacientes, atendimentos]);

  /* ── Top 5 exames mais pedidos (30d) ──────────────────── */
  const topExamesLegacy = useMemo(() => {
    const ultimos30 = daysAgo(30);
    const counter = new Map<string, number>();
    let total = 0;
    for (const a of atendimentos) {
      const d = parsePtDate(a.data);
      if (!d || d < ultimos30) continue;
      for (const ex of a.exames ?? []) {
        counter.set(ex, (counter.get(ex) ?? 0) + 1);
        total++;
      }
    }
    const top = [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { items: top, total };
  }, [atendimentos]);

  // ── Seleção final: RPC tem prioridade quando ativo ──
  const operacional = useRpc ? rpcKpis.operacional : operacionalLegacy;
  // Fase 7 — SSOT: "A Receber" SEMPRE vem da RPC dedicada (mesmo no caminho RPC),
  // garantindo um único número entre Dashboard, Recepção, Painel e Financeiro.
  const financeiroBase = useRpc ? rpcKpis.financeiro : financeiroLegacy;
  const financeiro = { ...financeiroBase, aReceber: aReceberSsot.totalGeral };
  const produtividade = useRpc
    ? { ...rpcKpis.produtividade, topUnidade: null as [string, number] | null,
        topSolicitante: rpcKpis.produtividade.topSolicitante
          ? [rpcKpis.produtividade.topSolicitante, 0] as [string, number] : null }
    : produtividadeLegacy;
  const pacientesInsight = useRpc
    ? { ...rpcKpis.pacientes,
        topConvenio: rpcKpis.pacientes.topConvenio
          ? [rpcKpis.pacientes.topConvenio, 0] as [string, number] : null }
    : pacientesInsightLegacy;
  const topExames = useRpc
    ? { items: rpcKpis.topExames, total: rpcKpis.topExames.reduce((a, [, n]) => a + n, 0) }
    : topExamesLegacy;

  const userName = (user?.nome ?? user?.email ?? "").split(" ")[0] || "";

  return (
    <>
      <Helmet>
        <title>Dashboard | SISLAC</title>
        <meta
          name="description"
          content="Visão geral operacional, financeira e de produtividade do laboratório."
        />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <PageHeader
          eyebrow="Visão geral"
          title={userName ? `Olá, ${userName}!` : "Dashboard"}
          description="Visão geral operacional, financeira e de produtividade."
          actions={<VerSiteButton />}
        />

        {/* Hero gradient card */}
        <section
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4D41F3] to-[#818CF8] p-6 sm:p-8 text-primary-foreground shadow-soft animate-fade-in-up"
          style={{ animationDelay: "60ms" }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/10 to-transparent" aria-hidden />
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/20 blur-3xl" aria-hidden />
          <div className="absolute right-8 bottom-0 h-40 w-40 rounded-full bg-white/10 blur-2xl" aria-hidden />
          <img
            src={heroFlower}
            alt=""
            aria-hidden
            loading="lazy"
            className="pointer-events-none select-none absolute -right-6 sm:-right-4 -bottom-10 sm:-bottom-14 h-[150%] max-h-[420px] w-auto object-contain hidden sm:block animate-fade-in drop-shadow-[0_20px_40px_rgba(0,0,0,0.15)]"
          />
          <div className="relative flex flex-col gap-4">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[11px] font-semibold uppercase tracking-wider">
                <Sparkles className="h-3 w-3" />
                Hoje
              </div>
              <h2 className="mt-3 text-xl sm:text-2xl font-bold leading-tight">
                Acompanhe seus atendimentos em tempo real
              </h2>
              <p className="mt-1.5 text-sm text-white/85">
                {operacional.atendimentosHoje} atendimento{operacional.atendimentosHoje === 1 ? "" : "s"} hoje · {operacional.liberadosHoje} liberado{operacional.liberadosHoje === 1 ? "" : "s"}.
              </p>
            </div>
            <Link
              to="/atendimentos"
              className="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg"
            >
              Ver atendimentos
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Hero KPIs — os 4 indicadores que importam */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <HeroKpi
            label="Atendimentos hoje"
            value={String(operacional.atendimentosHoje)}
            hint={`${operacional.liberadosHoje} liberados`}
            icon={ClipboardList}
            to="/atendimentos"
            trend={operacional.liberadosHoje > 0 ? "up" : "neutral"}
            visual="ring"
            visualValue={operacional.atendimentosHoje > 0 ? Math.min(1, operacional.liberadosHoje / Math.max(operacional.atendimentosHoje, 1)) : 0.15}
          />
          <HeroKpi
            label="Receita do dia"
            value={`R$ ${fmtBRLNumber(financeiro.receitaHoje)}`}
            hint={`Mês: R$ ${fmtBRLNumber(financeiro.receitaMes)}`}
            icon={Wallet}
            to="/financeiro"
            trend="up"
            visual="dots"
            visualValue={financeiro.receitaMes > 0 ? Math.min(1, financeiro.receitaHoje / financeiro.receitaMes) : 0.2}
          />
          {!isRecepcionista && (
            <HeroKpi
              label="Saldo do mês"
              value={`R$ ${fmtBRLNumber(financeiro.saldoMes)}`}
              hint={`Saídas: R$ ${fmtBRLNumber(financeiro.saidasMes)}`}
              icon={Activity}
              to="/financeiro"
              trend={financeiro.saldoMes >= 0 ? "up" : "down"}
              visual="spark"
            />
          )}
          <HeroKpi
            label="A receber"
            value={`R$ ${fmtBRLNumber(financeiro.aReceber)}`}
            hint={`Ticket médio: R$ ${fmtBRLNumber(financeiro.ticketMedio)}`}
            icon={TrendingUp}
            to="/financeiro"
            trend={financeiro.aReceber > 0 ? "down" : "neutral"}
            visual="bars"
          />
        </section>

        {/* Operacional + Pacientes */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel
            title="Fluxo operacional"
            hint="Acompanha sua rotina laboratorial"
            className="lg:col-span-2"
          >
            <div className="space-y-2.5">
              <MiniStat
                label="Coletas realizadas"
                value={operacional.coletasPendentes}
                icon={TestTubes}
                to="/registrar-coleta"
                accent="success"
              />
              {!isRecepcionista && (
                <>
                  <MiniStat
                    label="Análises em andamento"
                    value={operacional.analisesAndamento}
                    icon={Microscope}
                    to="/analisar-amostra"
                    accent="warning"
                  />
                  <MiniStat
                    label="Resultados disponíveis"
                    value={operacional.resultadosLiberar}
                    icon={FileText}
                    to="/resultados"
                  />
                </>
              )}
              <MiniStat
                label="Liberados hoje"
                value={operacional.liberadosHoje}
                icon={CheckCircle2}
                to="/resultados"
                accent="success"
              />
            </div>
          </Panel>

          <Panel title="Pacientes" hint="Base ativa e novos no período" action={{ label: "Ver todos", to: "/pacientes" }}>
            <div className="space-y-5">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Ativos
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tabular-nums text-foreground">
                    {pacientesInsight.ativos}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    de {pacientesInsight.total}
                  </span>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <UserPlus className="h-4 w-4" />
                    Novos (30d)
                  </div>
                  <span className="text-base font-semibold tabular-nums text-emerald-600">
                    +{pacientesInsight.novos30d}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    Atendidos (30d)
                  </div>
                  <span className="text-base font-semibold tabular-nums text-foreground">
                    {pacientesInsight.atendidos30d}
                  </span>
                </div>
              </div>
            </div>
          </Panel>
        </section>

        {/* Top exames + Produtividade */}
        {!isRecepcionista && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel
            title="Exames mais solicitados"
            hint="Últimos 30 dias"
            className="lg:col-span-2"
          >
            {topExames.items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sem dados no período.
              </p>
            ) : (
              <ol className="space-y-3">
                {topExames.items.map(([nome, qtd], idx) => {
                  const pct = topExames.total > 0 ? (qtd / topExames.items[0][1]) * 100 : 0;
                  return (
                    <li key={nome} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold text-muted-foreground bg-muted">
                            {idx + 1}
                          </span>
                          <span className="truncate text-foreground">{nome}</span>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                          {qtd}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 animate-bar-in"
                          style={{ width: `${pct}%`, animationDelay: `${idx * 60}ms` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>

          <Panel title="Produtividade" hint="Indicadores de 30 dias">
            <div className="space-y-5">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Exames realizados
                </div>
                <div className="mt-1 text-3xl font-semibold tabular-nums text-foreground">
                  {produtividade.exames30d}
                </div>
              </div>
              <div className="border-t border-border pt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Cancelamento</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      produtividade.taxaCancelamento > 5
                        ? "text-rose-600"
                        : "text-foreground"
                    }`}
                  >
                    {produtividade.taxaCancelamento.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Convênio top</span>
                  <span className="truncate font-medium text-foreground max-w-[140px]">
                    {pacientesInsight.topConvenio
                      ? pacientesInsight.topConvenio[0]
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Solicitante top</span>
                  <span className="truncate font-medium text-foreground max-w-[140px]">
                    {produtividade.topSolicitante
                      ? produtividade.topSolicitante[0]
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          </Panel>
        </section>
        )}
      </div>
    </>
  );
};

export default Dashboard;