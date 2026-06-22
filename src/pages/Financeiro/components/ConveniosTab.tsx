// ConveniosTab — V3 (refinado, compacto, design system unificado).
import { useMemo, useState } from "react";
import { Receipt, FileText } from "lucide-react";
import { cn, fmtBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useFinanceiroContext } from "../FinanceiroContext";
import { useConvenioFaturas, type ConvenioFaturaRow } from "@/hooks/useConvenioFaturas";
import CompetenciaAtualCard from "@/components/financeiro/CompetenciaAtualCard";

const TH = "text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]";

function formatBR(d: string | null | undefined): string {
  if (!d) return "—";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR");
}

function diasDesde(d: string | null | undefined): number | null {
  if (!d) return null;
  let dt: Date;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
    const [dd, mm, yyyy] = d.split("/").map(Number);
    dt = new Date(yyyy, mm - 1, dd);
  } else {
    dt = new Date(d);
  }
  if (Number.isNaN(dt.getTime())) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  dt.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - dt.getTime()) / 86_400_000));
}

function Pill({ label, dot, cls }: { label: string; dot: string; cls: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 h-6 rounded-md border text-[11px] font-medium", cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}

function StatusFaturaPill({ status }: { status: string }) {
  const map: Record<string, { label: string; dot: string; cls: string }> = {
    aberta:    { label: "Aberta",    dot: "bg-amber-500",   cls: "bg-amber-50 text-amber-700 border-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900" },
    paga:      { label: "Paga",      dot: "bg-emerald-500", cls: "bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900" },
    cancelada: { label: "Cancelada", dot: "bg-muted-foreground/50", cls: "bg-muted text-muted-foreground border-border" },
  };
  const m = map[status] ?? { label: status, dot: "bg-muted-foreground", cls: "bg-muted text-muted-foreground border-border" };
  return <Pill {...m} />;
}

function StatusAbertoPill() {
  return <Pill label="Em aberto" dot="bg-amber-500" cls="bg-amber-50 text-amber-700 border-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900" />;
}

type SubTab = "aberto" | "faturas";
type FilterStatus = "todas" | "aberta" | "paga" | "cancelada";

const chipBase = "px-3 h-7 rounded-md text-xs font-medium transition-all whitespace-nowrap";
const chipActive = "bg-background text-foreground shadow-sm border border-border/60";
const chipIdle = "text-muted-foreground hover:text-foreground";

export default function ConveniosTab() {
  const {
    aReceberConvenioRows,
    setFecharFaturaAlvo, setFecharFaturaOpen,
    setFaturaDetalheAlvo, setFaturaDetalheOpen,
  } = useFinanceiroContext();

  const [subTab, setSubTab] = useState<SubTab>("aberto");
  const [filtroStatus, setFiltroStatus] = useState<FilterStatus>("todas");

  const { data: faturas = [], isLoading: loadingFaturas } = useConvenioFaturas(true);

  const faturasFiltered = useMemo<ConvenioFaturaRow[]>(() => {
    if (filtroStatus === "todas") return faturas;
    return faturas.filter(f => (f.status ?? "aberta") === filtroStatus);
  }, [faturas, filtroStatus]);

  const counts = useMemo(() => ({
    aberta: faturas.filter(f => f.status === "aberta").length,
    paga: faturas.filter(f => f.status === "paga").length,
    cancelada: faturas.filter(f => f.status === "cancelada").length,
  }), [faturas]);

  return (
    <div className="space-y-3">
      <div className="inline-flex items-center gap-0.5 p-1 bg-muted/40 rounded-lg border border-border/40">
        {([
          { key: "aberto",  label: `Em aberto (${aReceberConvenioRows.length})` },
          { key: "faturas", label: `Faturas (${faturas.length})` },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={cn(chipBase, subTab === t.key ? chipActive : chipIdle)}>
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "aberto" && (
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/40 bg-muted/15">
                  <th className={TH}>Convênio</th>
                  <th className={cn(TH, "text-right")}>Saldo</th>
                  <th className={TH}>Desde</th>
                  <th className={cn(TH, "text-center")}>Status</th>
                  <th className={cn(TH, "text-center w-[150px]")}></th>
                </tr>
              </thead>
              <tbody>
                {aReceberConvenioRows.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-14 text-sm text-muted-foreground">Nenhum convênio com saldo em aberto</td></tr>
                ) : aReceberConvenioRows.map(row => {
                  const dias = diasDesde(row.desde);
                  return (
                    <tr key={row.convenioId} className="border-b border-border/15 last:border-0 even:bg-muted/[0.04] hover:bg-primary/[0.04] transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[13px] font-medium text-foreground">{row.convenioNome}</span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {row.qtdExames} {row.qtdExames === 1 ? "exame" : "exames"} · {row.qtdPacientes} {row.qtdPacientes === 1 ? "paciente" : "pacientes"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-[13px] font-semibold text-foreground tabular-nums">{fmtBRL(row.saldo)}</span>
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-foreground tabular-nums">
                        <div className="flex flex-col gap-0.5">
                          <span>{formatBR(row.desde)}</span>
                          {dias !== null && (
                            <span className="text-[11px] text-muted-foreground">
                              {dias === 0 ? "Hoje" : `há ${dias} dia${dias === 1 ? "" : "s"}`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center"><StatusAbertoPill /></td>
                      <td className="px-4 py-2.5 text-center">
                        <Button size="sm" onClick={() => {
                          setFecharFaturaAlvo({ convenioId: row.convenioId, convenioNome: row.convenioNome });
                          setFecharFaturaOpen(true);
                        }} className="rounded-md h-7 text-[11px] gap-1.5 px-3">
                          <Receipt className="h-3 w-3" />
                          Fechar fatura
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-border/30">
            {aReceberConvenioRows.length === 0 ? (
              <div className="p-14 text-center text-sm text-muted-foreground">Nenhum convênio com saldo em aberto</div>
            ) : aReceberConvenioRows.map(row => (
              <div key={row.convenioId} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{row.convenioNome}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">{row.qtdExames} exame(s) · desde {formatBR(row.desde)}</p>
                  </div>
                  <p className="text-sm font-semibold text-foreground shrink-0 tabular-nums">{fmtBRL(row.saldo)}</p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <StatusAbertoPill />
                  <Button size="sm" onClick={() => {
                    setFecharFaturaAlvo({ convenioId: row.convenioId, convenioNome: row.convenioNome });
                    setFecharFaturaOpen(true);
                  }} className="rounded-md h-7 text-[11px] gap-1.5 px-3">
                    <Receipt className="h-3 w-3" /> Fechar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === "faturas" && (
        <>
          <div className="inline-flex items-center gap-0.5 p-1 bg-muted/40 rounded-lg border border-border/40">
            {([
              { key: "todas",     label: `Todas (${faturas.length})` },
              { key: "aberta",    label: `Abertas (${counts.aberta})` },
              { key: "paga",      label: `Pagas (${counts.paga})` },
              { key: "cancelada", label: `Canceladas (${counts.cancelada})` },
            ] as const).map(c => (
              <button key={c.key} onClick={() => setFiltroStatus(c.key as FilterStatus)}
                className={cn(chipBase, filtroStatus === c.key ? chipActive : chipIdle)}>
                {c.label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/15">
                    <th className={TH}>Fatura</th>
                    <th className={TH}>Convênio</th>
                    <th className={TH}>Período</th>
                    <th className={cn(TH, "text-right")}>Total</th>
                    <th className={cn(TH, "text-center")}>Status</th>
                    <th className={cn(TH, "text-center w-[110px]")}></th>
                  </tr>
                </thead>
                <tbody>
                  {loadingFaturas ? (
                    <tr><td colSpan={6} className="text-center py-14 text-sm text-muted-foreground">Carregando…</td></tr>
                  ) : faturasFiltered.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-14 text-sm text-muted-foreground">Nenhuma fatura encontrada</td></tr>
                  ) : faturasFiltered.map(f => (
                    <tr key={f.id} className="border-b border-border/15 last:border-0 even:bg-muted/[0.04] hover:bg-primary/[0.04] transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[13px] font-medium text-foreground tabular-nums">{f.codigo}</span>
                          <span className="text-[11px] text-muted-foreground">emitida em {formatBR(f.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-foreground">{f.convenio_nome}</td>
                      <td className="px-4 py-2.5 text-[11px] text-muted-foreground tabular-nums">
                        {formatBR(f.periodo_inicio)} → {formatBR(f.periodo_fim)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[13px] font-semibold text-foreground tabular-nums">{fmtBRL(f.total)}</td>
                      <td className="px-4 py-2.5 text-center"><StatusFaturaPill status={f.status} /></td>
                      <td className="px-4 py-2.5 text-center">
                        <Button size="sm" variant="outline" onClick={() => {
                          setFaturaDetalheAlvo({ id: f.id, codigo: f.codigo, convenio: f.convenio_nome, total: f.total });
                          setFaturaDetalheOpen(true);
                        }} className="rounded-md h-7 text-[11px] gap-1.5 px-3">
                          <FileText className="h-3 w-3" />
                          Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-border/30">
              {loadingFaturas ? (
                <div className="p-14 text-center text-sm text-muted-foreground">Carregando…</div>
              ) : faturasFiltered.length === 0 ? (
                <div className="p-14 text-center text-sm text-muted-foreground">Nenhuma fatura encontrada</div>
              ) : faturasFiltered.map(f => (
                <div key={f.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground tabular-nums truncate">{f.codigo}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{f.convenio_nome} · {formatBR(f.periodo_inicio)}→{formatBR(f.periodo_fim)}</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground shrink-0 tabular-nums">{fmtBRL(f.total)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <StatusFaturaPill status={f.status} />
                    <Button size="sm" variant="outline" onClick={() => {
                      setFaturaDetalheAlvo({ id: f.id, codigo: f.codigo, convenio: f.convenio_nome, total: f.total });
                      setFaturaDetalheOpen(true);
                    }} className="rounded-md h-7 text-[11px] gap-1.5 px-3">
                      <FileText className="h-3 w-3" /> Ver
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
