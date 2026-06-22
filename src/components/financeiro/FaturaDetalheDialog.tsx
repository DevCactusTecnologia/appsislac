import { useEffect, useMemo, useState } from "react";
import { Receipt, Loader2, AlertTriangle, RotateCw, Ban } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import StandardDialog from "@/components/ui/standard-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { fmtBRL } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { fetchItensFatura, type ConvenioFaturaItem } from "@/data/convenioFaturasStore";
import {
  fetchGlosasDaFatura,
  fetchResumoFatura,
  fetchCadeiaReapresentacao,
  registrarGlosa,
  reapresentarGlosas,
  cancelarGlosa,
  type ConvenioGlosa,
  type FaturaResumo,
} from "@/data/convenioGlosasStore";

interface Props {
  open: boolean;
  onClose: () => void;
  faturaId: number;
  faturaCodigo: string;
  convenioNome: string;
  total: number;
}

const FaturaDetalheDialog = ({ open, onClose, faturaId, faturaCodigo, convenioNome, total }: Props) => {
  const [itens, setItens] = useState<ConvenioFaturaItem[]>([]);
  const [glosas, setGlosas] = useState<ConvenioGlosa[]>([]);
  const [resumo, setResumo] = useState<FaturaResumo | null>(null);
  const [cadeia, setCadeia] = useState<FaturaResumo[]>([]);
  const [loading, setLoading] = useState(false);

  // estado glosa
  const [glosaSel, setGlosaSel] = useState<Record<number, { checked: boolean; valor: string }>>({});
  const [motivoGlosa, setMotivoGlosa] = useState("");
  const [showGlosaForm, setShowGlosaForm] = useState(false);
  const [submittingGlosa, setSubmittingGlosa] = useState(false);

  // estado reapresentação
  const [reapSel, setReapSel] = useState<Record<number, boolean>>({});
  const [motivoReap, setMotivoReap] = useState("");
  const [showReapForm, setShowReapForm] = useState(false);
  const [submittingReap, setSubmittingReap] = useState(false);

  const reload = async () => {
    setLoading(true);
    const [its, gls, res, ch] = await Promise.all([
      fetchItensFatura(faturaId),
      fetchGlosasDaFatura(faturaId),
      fetchResumoFatura(faturaId),
      fetchCadeiaReapresentacao(faturaId),
    ]);
    setItens(its);
    setGlosas(gls);
    setResumo(res);
    setCadeia(ch);
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    setShowGlosaForm(false);
    setShowReapForm(false);
    setGlosaSel({});
    setReapSel({});
    setMotivoGlosa("");
    setMotivoReap("");
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, faturaId]);

  // mapa item → glosa aberta (impede glosa duplicada)
  const itemGlosadoAberto = useMemo(() => {
    const m = new Map<number, ConvenioGlosa>();
    glosas.filter((g) => g.status === "aberta" || g.status === "reapresentada").forEach((g) => {
      if (g.faturaItemId != null) m.set(g.faturaItemId, g);
    });
    return m;
  }, [glosas]);

  const glosasAbertas = useMemo(() => glosas.filter((g) => g.status === "aberta"), [glosas]);

  const podeGlosar = resumo && resumo.status !== "cancelada";
  const podeReapresentar = glosasAbertas.length > 0;

  // ---- handlers ----
  const handleGlosar = async () => {
    const selecionados = Object.entries(glosaSel)
      .filter(([, v]) => v.checked)
      .map(([id, v]) => {
        const item = itens.find((i) => i.id === Number(id));
        const valorNum = Number(v.valor.replace(",", "."));
        return { itemId: Number(id), valorGlosado: Number.isFinite(valorNum) && valorNum > 0 ? valorNum : (item?.valor ?? 0) };
      });
    if (selecionados.length === 0) {
      toast({ title: "Selecione ao menos um item", variant: "destructive" });
      return;
    }
    setSubmittingGlosa(true);
    const r = await registrarGlosa(faturaId, motivoGlosa, selecionados);
    setSubmittingGlosa(false);
    if (!r.ok) {
      toast({ title: "Falha ao registrar glosa", description: r.error, variant: "destructive" });
      return;
    }
    toast({ title: "Glosa registrada", description: `${selecionados.length} item(ns) glosado(s)` });
    setShowGlosaForm(false);
    setMotivoGlosa("");
    setGlosaSel({});
    await reload();
  };

  const handleReapresentar = async () => {
    const ids = Object.entries(reapSel).filter(([, v]) => v).map(([id]) => Number(id));
    if (ids.length === 0) {
      toast({ title: "Selecione ao menos uma glosa", variant: "destructive" });
      return;
    }
    setSubmittingReap(true);
    const today = new Date().toISOString().slice(0, 10);
    const r = await reapresentarGlosas({
      faturaOrigemId: faturaId,
      glosaIds: ids,
      motivo: motivoReap,
      periodoInicio: today,
      periodoFim: today,
    });
    setSubmittingReap(false);
    if (!r.ok) {
      toast({ title: "Falha na reapresentação", description: r.error, variant: "destructive" });
      return;
    }
    toast({ title: "Reapresentação criada", description: `Fatura ${r.codigo} (tentativa ${r.tentativa})` });
    setShowReapForm(false);
    setReapSel({});
    setMotivoReap("");
    await reload();
  };

  const handleCancelarGlosa = async (g: ConvenioGlosa) => {
    const motivo = window.prompt("Motivo do cancelamento da glosa:");
    if (!motivo) return;
    const r = await cancelarGlosa(g.id, motivo);
    if (!r.ok) {
      toast({ title: "Falha ao cancelar glosa", description: r.error, variant: "destructive" });
      return;
    }
    toast({ title: "Glosa cancelada" });
    await reload();
  };

  // ---- render helpers ----
  const StatusBadge = ({ s }: { s: ConvenioGlosa["status"] }) => {
    const map: Record<string, string> = {
      aberta: "bg-amber-50 text-amber-700 border-amber-200/70",
      reapresentada: "bg-blue-50 text-blue-700 border-blue-200/70",
      aceita_perda: "bg-muted text-muted-foreground border-border",
      cancelada: "bg-muted text-muted-foreground border-border",
    };
    return <Badge variant="outline" className={`text-[10px] ${map[s] ?? ""}`}>{s}</Badge>;
  };

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      icon={<Receipt className="h-5 w-5 text-primary" />}
      title={`Fatura ${faturaCodigo}`}
      subtitle={`${convenioNome} • ${itens.length} ite${itens.length === 1 ? "m" : "ns"} • ${fmtBRL(total)}`}
      maxWidth="4xl"
      footer={<Button variant="outline" className="rounded-2xl" onClick={onClose}>Fechar</Button>}
    >
      <div className="px-6 py-5 space-y-4">
        {/* Resumo SSOT */}
        {resumo && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            <div className="rounded-lg border border-border/40 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Faturado</div>
              <div className="font-semibold tabular-nums">{fmtBRL(resumo.totalFaturado)}</div>
            </div>
            <div className="rounded-lg border border-border/40 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Recebido</div>
              <div className="font-semibold tabular-nums text-emerald-700">{fmtBRL(resumo.totalRecebido)}</div>
            </div>
            <div className="rounded-lg border border-border/40 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Glosado</div>
              <div className="font-semibold tabular-nums text-amber-700">{fmtBRL(resumo.totalGlosado)}</div>
            </div>
            <div className="rounded-lg border border-border/40 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Reapresentado</div>
              <div className="font-semibold tabular-nums text-blue-700">{fmtBRL(resumo.totalReapresentado)}</div>
            </div>
            <div className="rounded-lg border border-border/40 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo pendente</div>
              <div className="font-semibold tabular-nums">{fmtBRL(resumo.saldoPendente)}</div>
            </div>
          </div>
        )}

        {/* Cadeia de tentativas */}
        {cadeia.length > 1 && (
          <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-xs">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Cadeia de reapresentações</div>
            <div className="flex flex-wrap gap-1.5">
              {cadeia.map((c) => (
                <span key={c.faturaId} className={`px-2 py-0.5 rounded border tabular-nums ${c.faturaId === faturaId ? "border-primary text-primary font-semibold" : "border-border text-muted-foreground"}`}>
                  T{c.tentativa} · {c.codigo} · {fmtBRL(c.totalFaturado)} · {c.status}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-wrap gap-2">
          {podeGlosar && !showGlosaForm && (
            <Button size="sm" variant="outline" className="rounded-md gap-1.5" onClick={() => setShowGlosaForm(true)}>
              <AlertTriangle className="h-3.5 w-3.5" /> Glosar itens
            </Button>
          )}
          {podeReapresentar && !showReapForm && (
            <Button size="sm" variant="outline" className="rounded-md gap-1.5" onClick={() => setShowReapForm(true)}>
              <RotateCw className="h-3.5 w-3.5" /> Reapresentar glosas
            </Button>
          )}
        </div>

        {/* Form glosa */}
        {showGlosaForm && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
            <div className="text-xs font-semibold text-amber-900 dark:text-amber-200">Registrar glosa</div>
            <Textarea
              placeholder="Motivo da glosa (obrigatório) — ex.: 'Item não autorizado pelo convênio'"
              value={motivoGlosa}
              onChange={(e) => setMotivoGlosa(e.target.value)}
              className="text-xs min-h-[60px]"
            />
            <div className="text-[10px] text-muted-foreground">Marque os itens e ajuste o valor glosado (parcial). Em branco = glosa total do item.</div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => { setShowGlosaForm(false); setGlosaSel({}); setMotivoGlosa(""); }}>Cancelar</Button>
              <Button size="sm" onClick={handleGlosar} disabled={submittingGlosa}>
                {submittingGlosa && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Confirmar glosa
              </Button>
            </div>
          </div>
        )}

        {/* Form reapresentação */}
        {showReapForm && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 p-3 space-y-2">
            <div className="text-xs font-semibold text-blue-900 dark:text-blue-200">Reapresentar glosas</div>
            <Textarea
              placeholder="Motivo da reapresentação (obrigatório)"
              value={motivoReap}
              onChange={(e) => setMotivoReap(e.target.value)}
              className="text-xs min-h-[60px]"
            />
            <div className="text-[10px] text-muted-foreground">Selecione abaixo as glosas a reapresentar. Será criada uma nova fatura vinculada (tentativa+1).</div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => { setShowReapForm(false); setReapSel({}); setMotivoReap(""); }}>Cancelar</Button>
              <Button size="sm" onClick={handleReapresentar} disabled={submittingReap}>
                {submittingReap && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Criar reapresentação
              </Button>
            </div>
          </div>
        )}

        {/* Itens da fatura */}
        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : itens.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Nenhum item vinculado a esta fatura.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr className="text-left">
                  {showGlosaForm && <th className="px-3 py-2.5 w-8"></th>}
                  <th className="px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground">Data</th>
                  <th className="px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground">Protocolo</th>
                  <th className="px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground">Paciente</th>
                  <th className="px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground">Exame</th>
                  <th className="px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground text-right">Valor</th>
                  {showGlosaForm && <th className="px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground text-right w-[140px]">Glosar (R$)</th>}
                  <th className="px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground text-center">Glosa</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((i) => {
                  const glAberta = itemGlosadoAberto.get(i.id);
                  const sel = glosaSel[i.id];
                  const disabled = !!glAberta;
                  return (
                    <tr key={i.id} className="border-t border-border/30">
                      {showGlosaForm && (
                        <td className="px-3 py-2.5">
                          <Checkbox
                            disabled={disabled}
                            checked={!!sel?.checked}
                            onCheckedChange={(c) => setGlosaSel((s) => ({ ...s, [i.id]: { checked: !!c, valor: s[i.id]?.valor ?? "" } }))}
                          />
                        </td>
                      )}
                      <td className="px-4 py-2.5 tabular-nums text-xs text-muted-foreground">
                        {i.atendimentoData ? format(new Date(i.atendimentoData), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-xs">{i.atendimentoProtocolo ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs">{i.pacienteNome ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs">{i.exameNome ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-right tabular-nums font-semibold">{fmtBRL(i.valor)}</td>
                      {showGlosaForm && (
                        <td className="px-4 py-2.5 text-xs text-right">
                          <Input
                            disabled={disabled || !sel?.checked}
                            placeholder={i.valor.toFixed(2)}
                            value={sel?.valor ?? ""}
                            onChange={(e) => setGlosaSel((s) => ({ ...s, [i.id]: { checked: !!s[i.id]?.checked, valor: e.target.value } }))}
                            className="h-7 text-xs text-right tabular-nums"
                          />
                        </td>
                      )}
                      <td className="px-4 py-2.5 text-center">
                        {glAberta ? <StatusBadge s={glAberta.status} /> : <span className="text-[10px] text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Lista de glosas */}
        {glosas.length > 0 && (
          <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
            <div className="px-4 py-2 bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Glosas registradas ({glosas.length})
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/15">
                <tr className="text-left">
                  {showReapForm && <th className="px-3 py-2 w-8"></th>}
                  <th className="px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">Data</th>
                  <th className="px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">Motivo</th>
                  <th className="px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground text-right">Original</th>
                  <th className="px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground text-right">Glosado</th>
                  <th className="px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">Status</th>
                  <th className="px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center w-16"></th>
                </tr>
              </thead>
              <tbody>
                {glosas.map((g) => (
                  <tr key={g.id} className="border-t border-border/30">
                    {showReapForm && (
                      <td className="px-3 py-2">
                        <Checkbox
                          disabled={g.status !== "aberta"}
                          checked={!!reapSel[g.id]}
                          onCheckedChange={(c) => setReapSel((s) => ({ ...s, [g.id]: !!c }))}
                        />
                      </td>
                    )}
                    <td className="px-4 py-2 text-xs tabular-nums text-muted-foreground">
                      {format(new Date(g.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                    </td>
                    <td className="px-4 py-2 text-xs max-w-[280px] truncate" title={g.motivo}>{g.motivo}</td>
                    <td className="px-4 py-2 text-xs text-right tabular-nums">{fmtBRL(g.valorOriginal)}</td>
                    <td className="px-4 py-2 text-xs text-right tabular-nums font-semibold text-amber-700">{fmtBRL(g.valorGlosado)}</td>
                    <td className="px-4 py-2 text-center"><StatusBadge s={g.status} /></td>
                    <td className="px-4 py-2 text-center">
                      {g.status === "aberta" && (
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleCancelarGlosa(g)} title="Cancelar glosa">
                          <Ban className="h-3 w-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </StandardDialog>
  );
};

export default FaturaDetalheDialog;
