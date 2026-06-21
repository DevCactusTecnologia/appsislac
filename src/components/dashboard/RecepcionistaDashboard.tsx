import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  FileText,
  Globe,
  Inbox,
  Plus,
  Receipt,
  Search,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { getAtendimentos, subscribe as subscribeAtendimentos } from "@/data/atendimentoStore";
import { getPacientes, subscribePacientes } from "@/data/pacienteStore";
import { getOrcamentos, subscribeOrcamentos } from "@/data/orcamentoStore";
import type { MockAtendimento } from "@/data/types";
import { fmtBRLNumber } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useSolicitacoesNaoLidas } from "@/hooks/useSolicitacoesNaoLidas";
import CaixaOperacionalCard from "@/components/caixa/CaixaOperacionalCard";

/* helpers */
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

/* KPI card */
interface KpiProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  badge?: number;
  accent?: "default" | "warning" | "success";
}
function Kpi({ label, value, hint, icon: Icon, to, badge, accent = "default" }: KpiProps) {
  const accentRing =
    accent === "warning"
      ? "ring-amber-500/20"
      : accent === "success"
      ? "ring-emerald-500/20"
      : "ring-primary/10";
  const accentBg =
    accent === "warning"
      ? "bg-amber-500/10 text-amber-600"
      : accent === "success"
      ? "bg-emerald-500/10 text-emerald-600"
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

/* Quick action button */
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

/* Status pill */
function StatusPill({ label }: { label: string }) {
  const l = label.toLowerCase();
  let cls = "bg-muted text-muted-foreground";
  if (l.includes("liber") || l.includes("entreg")) cls = "bg-emerald-500/15 text-emerald-700";
  else if (l.includes("cancel")) cls = "bg-rose-500/15 text-rose-700";
  else if (l.includes("aguard") && l.includes("colet")) cls = "bg-amber-500/15 text-amber-700";
  else if (l.includes("anal")) cls = "bg-sky-500/15 text-sky-700";
  else if (l.includes("realiz") || l.includes("pedido")) cls = "bg-primary/15 text-primary";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

const RecepcionistaDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { count: solicitacoesNovas } = useSolicitacoesNaoLidas();

  const [atendimentos, setAtendimentos] = useState<MockAtendimento[]>(() => getAtendimentos());
  const [pacientes, setPacientes] = useState(() => getPacientes());
  const [orcamentos, setOrcamentos] = useState(() => getOrcamentos());

  useEffect(() => {
    const unsubA = subscribeAtendimentos(() => setAtendimentos(getAtendimentos()));
    const unsubP = subscribePacientes(() => setPacientes(getPacientes()));
    const unsubO = subscribeOrcamentos(() => setOrcamentos(getOrcamentos()));
    return () => { unsubA(); unsubP(); unsubO(); };
  }, []);

  /* KPIs operacionais (apenas relevantes para recepção) */
  const kpis = useMemo(() => {
    let atendimentosHoje = 0;
    let aguardandoPagamento = 0;
    let receitaHoje = 0;
    let aReceber = 0;
    const ult30 = daysAgo(30);
    const cpfsAtendidos30d = new Set<string>();
    const novosCpfs30d = new Set<string>();

    for (const a of atendimentos) {
      const d = parsePtDate(a.data);
      const statusPg = (a.statusPagamento?.label ?? "").toLowerCase();

      if (isToday(d)) {
        atendimentosHoje++;
      }
      // Recepção precisa saber pagamentos pendentes/parciais não cancelados
      if (
        !statusPg.includes("cancel") &&
        (statusPg.includes("pend") || statusPg.includes("parcial"))
      ) {
        aguardandoPagamento++;
      }

      const totalAtd = (a.examesCobranca ?? []).reduce((acc, e) => acc + (e.valor ?? 0), 0);
      const pago = (a.pagamentosRealizados ?? []).reduce((acc, p) => acc + (p.valor ?? 0), 0);
      if (!statusPg.includes("cancel")) aReceber += Math.max(totalAtd - pago, 0);
      for (const p of a.pagamentosRealizados ?? []) {
        if (isToday(parsePtDate(p.data))) receitaHoje += p.valor ?? 0;
      }

      if (d && d >= ult30 && a.cpf) cpfsAtendidos30d.add(a.cpf);
    }
    // novos = quem aparece nos últimos 30d e não antes
    const cpfsAntes = new Set<string>();
    for (const a of atendimentos) {
      const d = parsePtDate(a.data);
      if (d && d < ult30 && a.cpf) cpfsAntes.add(a.cpf);
    }
    for (const cpf of cpfsAtendidos30d) if (!cpfsAntes.has(cpf)) novosCpfs30d.add(cpf);

    const ativos = pacientes.filter((p) => (p.status ?? "Ativo") === "Ativo").length;
    const orcamentosPendentes = orcamentos.filter((o) => !o.convertido).length;

    return {
      atendimentosHoje,
      aguardandoPagamento,
      receitaHoje,
      aReceber,
      pacientesAtivos: ativos,
      pacientesTotal: pacientes.length,
      atendidos30d: cpfsAtendidos30d.size,
      novos30d: novosCpfs30d.size,
      orcamentosPendentes,
    };
  }, [atendimentos, pacientes, orcamentos]);

  /* Últimos atendimentos do dia (até 6) */
  const atendimentosDoDia = useMemo(() => {
    return atendimentos
      .filter((a) => isToday(parsePtDate(a.data)))
      .slice(0, 6);
  }, [atendimentos]);

  const userName = (user?.nome ?? user?.email ?? "").split(" ")[0] || "";
  const dataFmt = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <>
      <Helmet>
        <title>Dashboard | SISLAC</title>
        <meta name="description" content="Painel da recepção: atendimentos, pacientes, orçamentos e financeiro do dia." />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Recepção</p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-foreground truncate">
              {userName ? `Olá, ${userName}` : "Bem-vindo"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground capitalize">{dataFmt}</p>
          </div>
          <Button
            onClick={() => navigate("/atendimentos/novo")}
            className="h-10 gap-2 self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            Novo atendimento
          </Button>
        </header>

        {/* Quick actions */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <Quick label="Cadastrar paciente" icon={UserPlus} to="/pacientes" />
          <Quick label="Novo orçamento" icon={FileText} to="/orcamentos" />
          <Quick label="Consultar atendimento" icon={Search} to="/atendimentos" />
          <Quick label="Pedidos do site" icon={Globe} to="/pedidos-site" />
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Kpi
            label="Atendimentos hoje"
            value={String(kpis.atendimentosHoje)}
            hint="Realizados na recepção"
            icon={ClipboardList}
            to="/atendimentos"
          />
          <Kpi
            label="Aguardando pagamento"
            value={String(kpis.aguardandoPagamento)}
            hint={kpis.aguardandoPagamento > 0 ? "Cobrança pendente" : "Sem pendências"}
            icon={Receipt}
            to="/financeiro"
            accent={kpis.aguardandoPagamento > 0 ? "warning" : "default"}
          />
          <Kpi
            label="Receita do dia"
            value={`R$ ${fmtBRLNumber(kpis.receitaHoje)}`}
            hint={`A receber: R$ ${fmtBRLNumber(kpis.aReceber)}`}
            icon={Wallet}
            to="/financeiro"
            accent="success"
          />
          <Kpi
            label="Pedidos novos"
            value={String(solicitacoesNovas)}
            hint="Pedidos pelo site"
            icon={Inbox}
            to="/pedidos-site"
            badge={solicitacoesNovas}
            accent={solicitacoesNovas > 0 ? "warning" : "default"}
          />
        </section>

        {/* Lista atendimentos do dia + pacientes */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 sm:px-5 py-3.5">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Atendimentos de hoje</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {kpis.atendimentosHoje} no total
                </p>
              </div>
              <Link to="/atendimentos" className="shrink-0 text-xs font-medium text-primary hover:underline">
                Ver todos
              </Link>
            </div>
            {atendimentosDoDia.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
                <ClipboardList className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Nenhum atendimento registrado hoje.</p>
                <Button size="sm" variant="outline" onClick={() => navigate("/atendimentos/novo")} className="mt-2 gap-2">
                  <Plus className="h-4 w-4" /> Iniciar atendimento
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {atendimentosDoDia.map((a) => (
                  <li key={a.protocolo}>
                    <Link
                      to={`/atendimentos?focus=${encodeURIComponent(a.protocolo)}`}
                      className="flex items-center gap-3 px-4 sm:px-5 py-3 transition-colors hover:bg-accent/40"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                        {(a.nome ?? "?").trim().charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">{a.nome || "—"}</p>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">#{a.protocolo}</span>
                          {a.convenio && (
                            <>
                              <span className="opacity-50">•</span>
                              <span className="truncate">{a.convenio}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="hidden sm:flex shrink-0 items-center gap-2">
                        {a.statusAtendimento?.label && <StatusPill label={a.statusAtendimento.label} />}
                      </div>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Pacientes */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 sm:px-5 py-3.5">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Pacientes</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Base ativa</p>
              </div>
              <Link to="/pacientes" className="shrink-0 text-xs font-medium text-primary hover:underline">
                Ver todos
              </Link>
            </div>
            <div className="p-4 sm:p-5 space-y-5">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Ativos</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tabular-nums text-foreground">{kpis.pacientesAtivos}</span>
                  <span className="text-xs text-muted-foreground">de {kpis.pacientesTotal}</span>
                </div>
              </div>
              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <UserPlus className="h-4 w-4" /> Novos (30d)
                  </div>
                  <span className="text-base font-semibold tabular-nums text-emerald-600">
                    +{kpis.novos30d}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" /> Atendidos (30d)
                  </div>
                  <span className="text-base font-semibold tabular-nums text-foreground">{kpis.atendidos30d}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" /> Orçamentos pendentes
                  </div>
                  <Link to="/orcamentos" className="text-base font-semibold tabular-nums text-foreground hover:text-primary transition-colors">
                    {kpis.orcamentosPendentes}
                  </Link>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="h-4 w-4" /> A receber
                  </div>
                  <span className="text-base font-semibold tabular-nums text-foreground">
                    R$ {fmtBRLNumber(kpis.aReceber)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1.5">
          <CalendarDays className="h-3 w-3" />
          Atualizado em tempo real conforme novos atendimentos são registrados.
        </p>
      </div>
    </>
  );
};

export default RecepcionistaDashboard;