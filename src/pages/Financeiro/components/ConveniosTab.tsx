// ConveniosTab — Fase 7 (área dedicada de Convênios).
//
// Filosofia: olhou, entendeu, usou.
//   • Sub-aba "Em aberto"  — saldos a faturar por convênio (ação: Fechar fatura).
//   • Sub-aba "Faturas"    — histórico de faturas emitidas (ação: ver detalhe).
// Sem cards de resumo: o macro vive no Painel.
import { useMemo, useState } from "react";
import { Receipt, FileText } from "lucide-react";
import { cn, fmtBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useFinanceiroContext } from "../FinanceiroContext";
import { useConvenioFaturas, type ConvenioFaturaRow } from "@/hooks/useConvenioFaturas";

const COL_HEADER =
  "text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider";

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

function StatusFaturaPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    aberta:    { label: "Aberta",    cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900" },
    paga:      { label: "Paga",      cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900" },
    cancelada: { label: "Cancelada", cls: "bg-muted text-muted-foreground border-border" },
  };
  const m = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={cn("inline-flex items-center px-2.5 h-7 rounded-full border text-[11px] font-medium", m.cls)}>
      {m.label}
    </span>
  );
}

function StatusAbertoPill() {
  return (
    <span className="inline-flex items-center px-2.5 h-7 rounded-full border text-[11px] font-medium bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900">
      Em aberto
    </span>
  );
}

type SubTab = "aberto" | "faturas";
type FilterStatus = "todas" | "aberta" | "paga" | "cancelada";

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
    <div className="space-y-4">
      {/* Sub-abas */}
      <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-2xl border border-border/30 w-fit">
        {([
          { key: "aberto",  label: `Em aberto (${aReceberConvenioRows.length})` },
          { key: "faturas", label: `Faturas (${faturas.length})` },
        ] as const).map(t => {
          const active = subTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/60",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ─── EM ABERTO ─── */}
      {subTab === "aberto" && (
        <div className="rounded-3xl border border-border/60 bg-card overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className={COL_HEADER}>Convênio</th>
                  <th className={COL_HEADER + " text-right"}>Saldo</th>
                  <th className={COL_HEADER}>Desde</th>
                  <th className={COL_HEADER + " text-center"}>Status</th>
                  <th className={COL_HEADER + " text-center w-[160px]"}></th>
                </tr>
              </thead>
              <tbody>
                {aReceberConvenioRows.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-16 text-sm text-muted-foreground">Nenhum convênio com saldo em aberto</td></tr>
                ) : aReceberConvenioRows.map(row => {
                  const dias = diasDesde(row.desde);
                  return (
                    <tr key={row.convenioId} className="border-b border-border/20 last:border-0 hover:bg-muted/15 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-foreground">{row.convenioNome}</span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {row.qtdExames} {row.qtdExames === 1 ? "exame" : "exames"} · {row.qtdPacientes} {row.qtdPacientes === 1 ? "paciente" : "pacientes"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-sm font-semibold text-foreground tabular-nums">{fmtBRL(row.saldo)}</span>
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground tabular-nums">
                        <div className="flex flex-col gap-0.5">
                          <span>{formatBR(row.desde)}</span>
                          {dias !== null && (
                            <span className="text-[11px] text-muted-foreground">
                              {dias === 0 ? "Hoje" : `há ${dias} dia${dias === 1 ? "" : "s"}`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center"><StatusAbertoPill /></td>
                      <td className="px-5 py-4 text-center">
                        <Button
                          size="sm"
                          onClick={() => {
                            setFecharFaturaAlvo({ convenioId: row.convenioId, convenioNome: row.convenioNome });
                            setFecharFaturaOpen(true);
                          }}
                          className="rounded-xl h-8 text-xs gap-1.5"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          Fechar fatura
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-border/30">
            {aReceberConvenioRows.length === 0 ? (
              <div className="p-16 text-center text-sm text-muted-foreground">Nenhum convênio com saldo em aberto</div>
            ) : aReceberConvenioRows.map(row => (
              <div key={row.convenioId} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{row.convenioNome}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {row.qtdExames} exame(s) · desde {formatBR(row.desde)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-foreground shrink-0 tabular-nums">{fmtBRL(row.saldo)}</p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <StatusAbertoPill />
                  <Button
                    size="sm"
                    onClick={() => {
                      setFecharFaturaAlvo({ convenioId: row.convenioId, convenioNome: row.convenioNome });
                      setFecharFaturaOpen(true);
                    }}
                    className="rounded-xl h-8 text-xs gap-1.5"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    Fechar fatura
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── FATURAS ─── */}
      {subTab === "faturas" && (
        <>
          {/* chips de filtro */}
          <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-2xl border border-border/30 w-fit">
            {([
              { key: "todas",     label: `Todas (${faturas.length})` },
              { key: "aberta",    label: `Abertas (${counts.aberta})` },
              { key: "paga",      label: `Pagas (${counts.paga})` },
              { key: "cancelada", label: `Canceladas (${counts.cancelada})` },
            ] as const).map(c => {
              const active = filtroStatus === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setFiltroStatus(c.key as FilterStatus)}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/60",
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          <div className="rounded-3xl border border-border/60 bg-card overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20">
                    <th className={COL_HEADER}>Fatura</th>
                    <th className={COL_HEADER}>Convênio</th>
                    <th className={COL_HEADER}>Período</th>
                    <th className={COL_HEADER + " text-right"}>Total</th>
                    <th className={COL_HEADER + " text-center"}>Status</th>
                    <th className={COL_HEADER + " text-center w-[120px]"}></th>
                  </tr>
                </thead>
                <tbody>
                  {loadingFaturas ? (
                    <tr><td colSpan={6} className="text-center py-16 text-sm text-muted-foreground">Carregando…</td></tr>
                  ) : faturasFiltered.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-16 text-sm text-muted-foreground">Nenhuma fatura encontrada</td></tr>
                  ) : faturasFiltered.map(f => (
                    <tr key={f.id} className="border-b border-border/20 last:border-0 hover:bg-muted/15 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-foreground tabular-nums">{f.codigo}</span>
                          <span className="text-[11px] text-muted-foreground">emitida em {formatBR(f.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground">{f.convenio_nome}</td>
                      <td className="px-5 py-4 text-xs text-muted-foreground tabular-nums">
                        {formatBR(f.periodo_inicio)} → {formatBR(f.periodo_fim)}
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-semibold text-foreground tabular-nums">{fmtBRL(f.total)}</td>
                      <td className="px-5 py-4 text-center"><StatusFaturaPill status={f.status} /></td>
                      <td className="px-5 py-4 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setFaturaDetalheAlvo({
                              id: f.id,
                              codigo: f.codigo,
                              convenio: f.convenio_nome,
                              total: f.total,
                            });
                            setFaturaDetalheOpen(true);
                          }}
                          className="rounded-xl h-8 text-xs gap-1.5"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-border/30">
              {loadingFaturas ? (
                <div className="p-16 text-center text-sm text-muted-foreground">Carregando…</div>
              ) : faturasFiltered.length === 0 ? (
                <div className="p-16 text-center text-sm text-muted-foreground">Nenhuma fatura encontrada</div>
              ) : faturasFiltered.map(f => (
                <div key={f.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground tabular-nums truncate">{f.codigo}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {f.convenio_nome} · {formatBR(f.periodo_inicio)}→{formatBR(f.periodo_fim)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-foreground shrink-0 tabular-nums">{fmtBRL(f.total)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <StatusFaturaPill status={f.status} />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setFaturaDetalheAlvo({
                          id: f.id, codigo: f.codigo,
                          convenio: f.convenio_nome, total: f.total,
                        });
                        setFaturaDetalheOpen(true);
                      }}
                      className="rounded-xl h-8 text-xs gap-1.5"
                    >
                      <FileText className="h-3.5 w-3.5" /> Ver
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
