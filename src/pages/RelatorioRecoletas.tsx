import { PageHeader } from "@/components/shared/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { searchNormalize } from "@/lib/utils";
import { RotateCcw, AlertTriangle, CheckCircle2, XCircle, Filter, Search } from "lucide-react";
import {
  loadRecoletas,
  isRecoletasLoaded,
  subscribeRecoletas,
  getRecoletas,
  calcularMetricas,
  type RecoletaEtapa,
  type RecoletaStatus,
} from "@/data/recoletasStore";

const ETAPAS: { id: RecoletaEtapa | "todas"; label: string }[] = [
  { id: "todas", label: "Todas etapas" },
  { id: "coleta", label: "Coleta" },
  { id: "triagem", label: "Triagem" },
  { id: "analise", label: "Análise" },
  { id: "liberacao", label: "Liberação" },
];

const STATUS: { id: RecoletaStatus | "todos"; label: string }[] = [
  { id: "todos", label: "Todos status" },
  { id: "pendente", label: "Pendentes" },
  { id: "realizada", label: "Realizadas" },
  { id: "cancelada", label: "Canceladas" },
];

function periodoInicial(): { ini: string; fim: string } {
  const hoje = new Date();
  const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  return {
    ini: ini.toISOString().slice(0, 10),
    fim: hoje.toISOString().slice(0, 10),
  };
}

const RelatorioRecoletas = () => {
  const [, force] = useState(0);
  const [{ ini, fim }, setPeriodo] = useState(periodoInicial());
  const [etapa, setEtapa] = useState<RecoletaEtapa | "todas">("todas");
  const [status, setStatus] = useState<RecoletaStatus | "todos">("todos");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!isRecoletasLoaded()) loadRecoletas();
    const unsub = subscribeRecoletas(() => force((n) => n + 1));
    return () => unsub();
  }, []);

  const filtradas = useMemo(() => {
    const all = getRecoletas();
    const iniDate = new Date(ini + "T00:00:00").getTime();
    const fimDate = new Date(fim + "T23:59:59").getTime();
    const term = searchNormalize(busca);
    return all.filter((r) => {
      const t = new Date(r.dataSolicitacao).getTime();
      if (t < iniDate || t > fimDate) return false;
      if (etapa !== "todas" && r.etapa !== etapa) return false;
      if (status !== "todos" && r.status !== status) return false;
      if (term) {
        const hay = `${r.pacienteNome} ${r.protocolo} ${r.exameNome} ${r.motivoNome}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [ini, fim, etapa, status, busca]);

  const m = useMemo(() => calcularMetricas(filtradas), [filtradas]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        eyebrow="Relatórios"
        title="Relatório de Recoletas"
        description="Análise gerencial de causas, etapas e responsáveis."
      />

      {/* Filtros */}
      <div className="bg-card border border-border rounded-2xl p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">De</label>
          <input type="date" value={ini} onChange={(e) => setPeriodo((s) => ({ ...s, ini: e.target.value }))} className="mt-1 h-10 w-full px-3 rounded-xl border border-border bg-background text-sm" />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Até</label>
          <input type="date" value={fim} onChange={(e) => setPeriodo((s) => ({ ...s, fim: e.target.value }))} className="mt-1 h-10 w-full px-3 rounded-xl border border-border bg-background text-sm" />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Etapa</label>
          <select value={etapa} onChange={(e) => setEtapa(e.target.value as any)} className="mt-1 h-10 w-full px-3 rounded-xl border border-border bg-background text-sm">
            {ETAPAS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="mt-1 h-10 w-full px-3 rounded-xl border border-border bg-background text-sm">
            {STATUS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Buscar</label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Paciente, protocolo, exame..." className="h-10 w-full pl-9 pr-3 rounded-xl border border-border bg-background text-sm" />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total no período" value={m.total} tone="primary" />
        <KpiCard label="Pendentes" value={m.pendentes} tone="warning" icon={<AlertTriangle className="h-4 w-4" />} />
        <KpiCard label="Realizadas" value={m.realizadas} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <KpiCard label="Canceladas" value={m.canceladas} tone="muted" icon={<XCircle className="h-4 w-4" />} />
      </div>

      {/* Causas + Etapas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Top causas</h2>
          {m.porMotivo.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem dados no período.</p>
          ) : (
            <ul className="space-y-2.5">
              {m.porMotivo.slice(0, 7).map((c) => {
                const pct = m.total > 0 ? Math.round((c.total / m.total) * 100) : 0;
                return (
                  <li key={c.nome}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-foreground">{c.nome}</span>
                      <span className="text-muted-foreground tabular-nums">{c.total} · {pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-warning rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Por etapa</h2>
          <div className="grid grid-cols-2 gap-3">
            {(["coleta", "triagem", "analise", "liberacao"] as RecoletaEtapa[]).map((e) => {
              const v = m.porEtapa[e];
              const pct = m.total > 0 ? Math.round((v / m.total) * 100) : 0;
              return (
                <div key={e} className="rounded-xl border border-border p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold capitalize">{e}</div>
                  <div className="text-2xl font-bold text-foreground tabular-nums mt-1">{v}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{pct}% do total</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Histórico ({filtradas.length})</h2>
        </div>
        {filtradas.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Nenhuma recoleta encontrada com os filtros atuais.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 text-left">
                  <th className="py-2.5 px-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Data</th>
                  <th className="py-2.5 px-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Protocolo</th>
                  <th className="py-2.5 px-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Paciente</th>
                  <th className="py-2.5 px-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Exame</th>
                  <th className="py-2.5 px-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Motivo</th>
                  <th className="py-2.5 px-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Etapa</th>
                  <th className="py-2.5 px-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Status</th>
                  <th className="py-2.5 px-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Solicitante</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((r) => (
                  <tr key={r.id} className="border-t border-border/40 hover:bg-muted/20">
                    <td className="py-2.5 px-4 text-xs text-foreground tabular-nums">{new Date(r.dataSolicitacao).toLocaleString("pt-BR")}</td>
                    <td className="py-2.5 px-4 text-xs font-mono text-foreground">{r.protocolo}</td>
                    <td className="py-2.5 px-4 text-xs text-foreground">{r.pacienteNome}</td>
                    <td className="py-2.5 px-4 text-xs text-foreground">{r.exameNome}</td>
                    <td className="py-2.5 px-4 text-xs text-foreground">{r.motivoNome}</td>
                    <td className="py-2.5 px-4 text-xs text-foreground capitalize">{r.etapa}</td>
                    <td className="py-2.5 px-4">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="py-2.5 px-4 text-xs text-muted-foreground">{r.solicitanteEmail || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

function KpiCard({ label, value, tone, icon }: { label: string; value: number; tone: "primary" | "warning" | "success" | "muted"; icon?: React.ReactNode }) {
  const cls = tone === "primary" ? "bg-primary/5 text-primary"
    : tone === "warning" ? "bg-warning/10 text-warning"
    : tone === "success" ? "bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success))]"
    : "bg-muted text-muted-foreground";
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${cls}`}>{icon ?? <RotateCcw className="h-4 w-4" />}</div>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      </div>
      <div className="mt-2 text-3xl font-bold text-foreground tabular-nums">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: RecoletaStatus }) {
  const cfg = status === "pendente" ? { bg: "bg-warning/10", text: "text-warning", label: "Pendente" }
    : status === "realizada" ? { bg: "bg-[hsl(var(--status-success-bg))]", text: "text-[hsl(var(--status-success))]", label: "Realizada" }
    : { bg: "bg-muted", text: "text-muted-foreground", label: "Cancelada" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>;
}

export default RelatorioRecoletas;
