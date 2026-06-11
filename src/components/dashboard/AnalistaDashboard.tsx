import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  Map as MapIcon,
  Microscope,
  Printer,
  Search,
  TestTubes,
  TrendingUp,
} from "lucide-react";
import { getAtendimentos, subscribe as subscribeAtendimentos } from "@/data/atendimentoStore";
import type { MockAtendimento } from "@/data/types";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

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
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

type StatusKind = "coleta" | "analise" | "liberar" | "liberado" | "cancelado" | "outro";
function classifyStatus(label?: string): StatusKind {
  const l = (label ?? "").toLowerCase();
  if (l.includes("cancel")) return "cancelado";
  if (l.includes("aguard") && l.includes("colet")) return "coleta";
  if (l.includes("anal") || l.includes("em an")) return "analise";
  if (l.includes("aguard") && l.includes("liber")) return "liberar";
  if (l.includes("liber") || l.includes("entreg")) return "liberado";
  return "outro";
}

/* ───────────────────────── building blocks ───────────────────────── */
interface KpiProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  accent?: "default" | "warning" | "success" | "danger";
  badge?: number;
}
function Kpi({ label, value, hint, icon: Icon, to, accent = "default", badge }: KpiProps) {
  const accentRing =
    accent === "warning" ? "ring-amber-500/20"
    : accent === "success" ? "ring-emerald-500/20"
    : accent === "danger" ? "ring-rose-500/20"
    : "ring-primary/10";
  const accentBg =
    accent === "warning" ? "bg-amber-500/10 text-amber-600"
    : accent === "success" ? "bg-emerald-500/10 text-emerald-600"
    : accent === "danger" ? "bg-rose-500/10 text-rose-600"
    : "bg-primary/10 text-primary";

  const inner = (
    <div className={`group relative h-full rounded-lg border border-border bg-card p-4 sm:p-5 ring-1 ${accentRing} transition-all hover:border-primary/40`}>
      <div className="flex items-center justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accentBg}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-2">
          {typeof badge === "number" && badge > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
              {badge}
            </span>
          )}
          {to && <ArrowUpRight className="h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-primary" />}
        </div>
      </div>
      <div className="mt-4 sm:mt-5">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl sm:text-3xl font-semibold tabular-nums text-foreground">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground truncate">{hint}</div>}
      </div>
    </div>
  );
  if (to) {
    return (
      <Link to={to} className="block h-full rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40">
        {inner}
      </Link>
    );
  }
  return inner;
}

interface QuickProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
}
function Quick({ label, icon: Icon, to }: QuickProps) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-all hover:border-primary/40 hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 truncate text-sm font-medium text-foreground">{label}</span>
    </Link>
  );
}

function StatusPill({ kind, label }: { kind: StatusKind; label: string }) {
  const cls =
    kind === "liberado" ? "bg-emerald-500/15 text-emerald-700"
    : kind === "cancelado" ? "bg-rose-500/15 text-rose-700"
    : kind === "coleta" ? "bg-amber-500/15 text-amber-700"
    : kind === "analise" ? "bg-sky-500/15 text-sky-700"
    : kind === "liberar" ? "bg-violet-500/15 text-violet-700"
    : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

/* ───────────────────────── page ───────────────────────── */
const AnalistaDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [atendimentos, setAtendimentos] = useState<MockAtendimento[]>(() => getAtendimentos());
  useEffect(() => {
    const unsub = subscribeAtendimentos(() => setAtendimentos(getAtendimentos()));
    return () => { unsub(); };
  }, []);

  const userName = (user?.nome ?? user?.email ?? "").split(" ")[0] || "";
  const userFullName = (user?.nome ?? "").trim();

  /* KPIs e listas relevantes para o analista */
  const data = useMemo(() => {
    // IMPORTANTE: os KPIs do painel do analista são contados POR EXAME
    // (não por atendimento), porque o fluxo operacional é por amostra.
    // Pipeline real persistido (atendimento_exames.status):
    //   pendente → coletado → em_bancada → analisado → em_analise → finalizado | cancelado
    let coletasPendentes = 0;     // pendente → /registrar-coleta
    let emAnalise = 0;            // coletado + em_bancada → /analisar-amostra
    let aguardandoLiberacao = 0;  // analisado + em_analise → /resultados
    let liberadosHoje = 0;        // finalizado em atendimentos de hoje
    let meusExamesEmAnalise = 0;
    let meusLiberadosHoje = 0;
    let exames30d = 0;
    let meusExames30d = 0;

    const ult30 = daysAgo(30);
    const filaTrabalho: Array<{ a: MockAtendimento; kind: StatusKind }> = [];
    const counterExames = new Map<string, number>();

    for (const a of atendimentos) {
      const d = parsePtDate(a.data);
      const today = isToday(d);
      const exames = a.examesCobranca ?? [];

      // Contagem real por status do exame
      let temPendente = false;
      let temBancada = false;       // coletado / em_bancada → ação: analisar
      let temLiberar = false;       // analisado / em_analise → ação: liberar
      for (const ex of exames) {
        const s = (ex.status ?? "").toLowerCase();
        const liberadoHoje = isToday(parsePtDate(ex.dataLiberacaoISO ?? undefined));
        if (s === "pendente") { coletasPendentes++; temPendente = true; }
        else if (s === "coletado" || s === "em_bancada") { emAnalise++; temBancada = true; }
        else if (s === "analisado" || s === "em_analise" || s === "em análise" || s === "em analise") {
          aguardandoLiberacao++; temLiberar = true;
        }
        else if ((s === "finalizado" || s === "liberado") && (liberadoHoje || today)) liberadosHoje++;
      }

      // Fila prioritária: precisa de ação do analista (derivada dos exames)
      // Prioridade: liberação > coleta > análise (bancada)
      let kindFila: StatusKind | null = null;
      if (temLiberar) kindFila = "liberar";
      else if (temPendente) kindFila = "coleta";
      else if (temBancada) kindFila = "analise";
      if (kindFila) {
        filaTrabalho.push({ a, kind: kindFila });
      }

      // "Meus" exames (match por nome do analista, best-effort)
      if (userFullName) {
        for (const ex of exames) {
          if ((ex.analista ?? "").trim().toLowerCase() === userFullName.toLowerCase()) {
            const exStatus = (ex.status ?? "").toLowerCase();
            if (
              exStatus === "coletado" ||
              exStatus === "em_bancada" ||
              exStatus === "analisado" ||
              exStatus === "em_analise"
            ) meusExamesEmAnalise++;
            if ((isToday(parsePtDate(ex.dataLiberacaoISO ?? undefined)) || today) && (exStatus === "finalizado" || exStatus === "liberado")) meusLiberadosHoje++;
            if (d && d >= ult30) meusExames30d++;
          }
        }
      }

      // Top exames últimos 30d
      if (d && d >= ult30) {
        for (const nome of a.exames ?? []) {
          counterExames.set(nome, (counterExames.get(nome) ?? 0) + 1);
          exames30d++;
        }
      }
    }

    // Ordena fila: liberar > coleta > analise (urgência decrescente)
    const ordemPrioridade: Record<StatusKind, number> = { liberar: 0, coleta: 1, analise: 2, liberado: 3, cancelado: 4, outro: 5 };
    filaTrabalho.sort((x, y) => ordemPrioridade[x.kind] - ordemPrioridade[y.kind]);

    const topExames = [...counterExames.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    return {
      coletasPendentes,
      emAnalise,
      aguardandoLiberacao,
      liberadosHoje,
      meusExamesEmAnalise,
      meusLiberadosHoje,
      exames30d,
      meusExames30d,
      filaTrabalho: filaTrabalho.slice(0, 8),
      topExames,
    };
  }, [atendimentos, userFullName]);

  const dataFmt = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <>
      <Helmet>
        <title>Dashboard | SISLAC</title>
        <meta name="description" content="Painel do analista: amostras, análises, liberações e produtividade." />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Laboratório</p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-foreground truncate">
              {userName ? `Olá, ${userName}` : "Bem-vindo"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground capitalize">{dataFmt}</p>
          </div>
          <Button
            onClick={() => navigate("/analisar-amostra")}
            className="h-10 gap-2 self-start sm:self-auto"
          >
            <Microscope className="h-4 w-4" />
            Analisar amostras
          </Button>
        </header>

        {/* Quick actions — fluxo do analista */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <Quick label="Registrar coleta" icon={TestTubes} to="/registrar-coleta" />
          <Quick label="Analisar amostra" icon={Microscope} to="/analisar-amostra" />
          <Quick label="Liberar resultado" icon={CheckCircle2} to="/resultados" />
          <Quick label="Mapa de trabalho" icon={MapIcon} to="/mapa" />
        </section>

        {/* KPIs operacionais do laboratório */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Kpi
            label="Coletas pendentes"
            value={data.coletasPendentes}
            hint={data.coletasPendentes > 0 ? "Aguardando coleta" : "Tudo em dia"}
            icon={TestTubes}
            to="/registrar-coleta"
            accent={data.coletasPendentes > 0 ? "warning" : "default"}
            badge={data.coletasPendentes}
          />
          <Kpi
            label="Em análise"
            value={data.emAnalise}
            hint="Amostras processando"
            icon={Microscope}
            to="/analisar-amostra"
            accent="default"
          />
          <Kpi
            label="Aguardando liberação"
            value={data.aguardandoLiberacao}
            hint={data.aguardandoLiberacao > 0 ? "Pronto para validar" : "Sem pendências"}
            icon={AlertCircle}
            to="/resultados"
            accent={data.aguardandoLiberacao > 0 ? "danger" : "default"}
            badge={data.aguardandoLiberacao}
          />
          <Kpi
            label="Liberados hoje"
            value={data.liberadosHoje}
            hint="Resultados entregues"
            icon={CheckCircle2}
            to="/consultar-resultados"
            accent="success"
          />
        </section>

        {/* Fila de trabalho + Produtividade */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Fila prioritária */}
          <div className="lg:col-span-2 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 sm:px-5 py-3.5">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Fila de trabalho</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Priorizado por urgência: liberação → coleta → análise
                </p>
              </div>
              <Link to="/atendimentos" className="shrink-0 text-xs font-medium text-primary hover:underline">
                Ver todos
              </Link>
            </div>
            {data.filaTrabalho.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500/60" />
                <p className="text-sm text-muted-foreground">Nenhuma amostra pendente. Tudo em dia.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data.filaTrabalho.map(({ a, kind }) => {
                  const targetRoute =
                    kind === "coleta" ? "/registrar-coleta"
                    : kind === "analise" ? "/analisar-amostra"
                    : "/resultados";
                  return (
                    <li key={a.protocolo}>
                      <Link
                        to={targetRoute}
                        className="flex items-center gap-3 px-4 sm:px-5 py-3 transition-colors hover:bg-accent/40"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                          {(a.nome ?? "?").trim().charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{a.nome || "—"}</p>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="truncate">#{a.protocolo}</span>
                            <span className="opacity-50">•</span>
                            <span className="truncate">{(a.exames?.length ?? 0)} exame(s)</span>
                          </div>
                        </div>
                        <div className="hidden sm:flex shrink-0 items-center gap-2">
                          <StatusPill kind={kind} label={a.statusAtendimento?.label ?? "—"} />
                        </div>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Produtividade pessoal + top exames */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 sm:px-5 py-3.5">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Minha produtividade</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Atividade vinculada a você</p>
              </div>
              <Link to="/consultar-resultados" className="shrink-0 text-xs font-medium text-primary hover:underline">
                <Search className="inline h-3 w-3" />
              </Link>
            </div>
            <div className="p-4 sm:p-5 space-y-5">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Liberados hoje</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tabular-nums text-foreground">{data.meusLiberadosHoje}</span>
                  <span className="text-xs text-muted-foreground">por mim</span>
                </div>
              </div>
              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Activity className="h-4 w-4" /> Em análise (meus)
                  </div>
                  <span className="text-base font-semibold tabular-nums text-foreground">{data.meusExamesEmAnalise}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ClipboardList className="h-4 w-4" /> Exames (30d)
                  </div>
                  <span className="text-base font-semibold tabular-nums text-foreground">{data.meusExames30d}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="h-4 w-4" /> Total lab (30d)
                  </div>
                  <span className="text-base font-semibold tabular-nums text-foreground">{data.exames30d}</span>
                </div>
              </div>

              {data.topExames.length > 0 && (
                <div className="border-t border-border pt-4">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                    Top exames (30d)
                  </div>
                  <ul className="space-y-1.5">
                    {data.topExames.map(([nome, n]) => (
                      <li key={nome} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2 min-w-0">
                          <FlaskConical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate text-foreground">{nome}</span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border-t border-border pt-4 flex items-center gap-2">
                <Link
                  to="/relatorios/impressao"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <Printer className="h-3.5 w-3.5" /> Imprimir laudos
                </Link>
                <span className="text-muted-foreground/40">•</span>
                <Link
                  to="/lab-apoio"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <FlaskConical className="h-3.5 w-3.5" /> Lab. apoio
                </Link>
              </div>
            </div>
          </div>
        </section>

        <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1.5">
          <CalendarDays className="h-3 w-3" />
          Atualizado em tempo real conforme amostras são processadas.
        </p>
      </div>
    </>
  );
};

export default AnalistaDashboard;
