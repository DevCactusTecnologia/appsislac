import { useEffect, useMemo, useState } from "react";
import { FileText, Calendar as CalendarIcon, Receipt, Wallet } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import StandardDialog from "@/components/ui/standard-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn, fmtBRL } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  fetchItensFaturaveis, criarFatura, marcarFaturaPaga,
  type ItemFaturavel,
} from "@/data/convenioFaturasStore";

interface Props {
  open: boolean;
  onClose: () => void;
  convenioId: number;
  convenioNome: string;
  formasPagamento: string[];
  /** Callback após criação/pagamento bem-sucedido (para refresh externo). */
  onCreated?: () => void;
}

function isoFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const FecharFaturaDialog = ({ open, onClose, convenioId, convenioNome, formasPagamento, onCreated }: Props) => {
  const [periodoInicio, setPeriodoInicio] = useState<Date | undefined>(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const [periodoFim, setPeriodoFim] = useState<Date | undefined>(() => new Date());
  const [desconto, setDesconto] = useState<string>("0");
  const [observacao, setObservacao] = useState("");
  const [itens, setItens] = useState<ItemFaturavel[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Após criação, modo "marcar como paga"
  const [faturaCriadaId, setFaturaCriadaId] = useState<number | null>(null);
  const [formaPagamento, setFormaPagamento] = useState<string>(formasPagamento[0] || "PIX");
  const [dataPagamento, setDataPagamento] = useState<Date | undefined>(() => new Date());

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      const d0 = new Date(); d0.setDate(1);
      setPeriodoInicio(d0);
      setPeriodoFim(new Date());
      setDesconto("0");
      setObservacao("");
      setItens([]);
      setFaturaCriadaId(null);
      setFormaPagamento(formasPagamento[0] || "PIX");
      setDataPagamento(new Date());
    }
  }, [open, formasPagamento]);

  const carregarItens = async () => {
    if (!periodoInicio || !periodoFim) return;
    setLoading(true);
    const items = await fetchItensFaturaveis(convenioId, isoFromDate(periodoInicio), isoFromDate(periodoFim));
    setItens(items);
    setLoading(false);
  };

  // Recarrega quando muda período
  useEffect(() => {
    if (open && !faturaCriadaId) void carregarItens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, periodoInicio?.toISOString(), periodoFim?.toISOString(), convenioId]);

  const subtotal = useMemo(() => itens.reduce((s, i) => s + i.valor, 0), [itens]);
  const descontoNum = useMemo(() => {
    const n = parseFloat((desconto || "0").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [desconto]);
  const total = useMemo(() => Math.max(0, subtotal - descontoNum), [subtotal, descontoNum]);

  const handleCriar = async () => {
    if (!periodoInicio || !periodoFim) {
      toast({ title: "Defina o período", variant: "destructive" });
      return;
    }
    if (itens.length === 0) {
      toast({ title: "Sem itens", description: "Nenhum exame finalizado neste período para faturar.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const res = await criarFatura({
      convenioId,
      periodoInicio: isoFromDate(periodoInicio),
      periodoFim: isoFromDate(periodoFim),
      desconto: descontoNum,
      observacao,
      itens,
    });
    setSaving(false);
    if (!res.ok) {
      toast({ title: "Falha ao criar fatura", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Fatura criada", description: `${itens.length} ite${itens.length === 1 ? "m" : "ns"} agrupados.` });
    setFaturaCriadaId(res.faturaId ?? null);
    onCreated?.();
  };

  const handleMarcarPaga = async () => {
    if (!faturaCriadaId || !dataPagamento) return;
    setSaving(true);
    const res = await marcarFaturaPaga(faturaCriadaId, formaPagamento, isoFromDate(dataPagamento));
    setSaving(false);
    if (!res.ok) {
      toast({ title: "Falha ao registrar pagamento", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Pagamento registrado", description: "Fatura paga — entrada agregada gerada." });
    onCreated?.();
    onClose();
  };

  const podeProsseguir = !faturaCriadaId
    ? itens.length > 0 && !!periodoInicio && !!periodoFim
    : !!dataPagamento && !!formaPagamento;

  return (
    <StandardDialog
      open={open}
      onClose={() => { if (!saving) onClose(); }}
      icon={<Receipt className="h-5 w-5 text-primary" />}
      title={faturaCriadaId ? "Registrar pagamento da fatura" : `Fechar fatura — ${convenioNome}`}
      subtitle={faturaCriadaId
        ? "Confirme a forma e a data do recebimento da fatura"
        : "Selecione o período. Serão agrupados todos os exames finalizados ainda não faturados."}
      maxWidth="3xl"
      footer={
        <>
          <Button variant="outline" className="rounded-2xl" onClick={onClose} disabled={saving}>
            {faturaCriadaId ? "Fechar" : "Cancelar"}
          </Button>
          {!faturaCriadaId ? (
            <Button className="rounded-2xl" onClick={handleCriar} disabled={!podeProsseguir || saving}>
              {saving ? "Criando..." : `Criar fatura (${fmtBRL(total)})`}
            </Button>
          ) : (
            <Button className="rounded-2xl gap-1.5" onClick={handleMarcarPaga} disabled={!podeProsseguir || saving}>
              <Wallet className="h-3.5 w-3.5" />
              {saving ? "Salvando..." : "Marcar como paga"}
            </Button>
          )}
        </>
      }
    >
      <div className="px-6 py-5 space-y-4">
        {!faturaCriadaId ? (
          <>
            {/* Período */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Período (início)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full h-10 rounded-xl justify-start gap-2", !periodoInicio && "text-muted-foreground")}>
                      <CalendarIcon className="h-4 w-4" />
                      {periodoInicio ? format(periodoInicio, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={periodoInicio} onSelect={setPeriodoInicio} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Período (fim)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full h-10 rounded-xl justify-start gap-2", !periodoFim && "text-muted-foreground")}>
                      <CalendarIcon className="h-4 w-4" />
                      {periodoFim ? format(periodoFim, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={periodoFim} onSelect={setPeriodoFim} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Itens */}
            <div className="rounded-2xl border border-border/50 bg-muted/15 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Itens incluídos {loading ? "(carregando…)" : `(${itens.length})`}
                </span>
              </div>
              <div className="max-h-[280px] overflow-y-auto rounded-xl border border-border/40 bg-card">
                {loading ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Buscando exames finalizados…</div>
                ) : itens.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Nenhum exame finalizado neste período para faturar.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr className="text-left">
                        <th className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">Data</th>
                        <th className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">Protocolo</th>
                        <th className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">Paciente</th>
                        <th className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">Exame</th>
                        <th className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map(i => (
                        <tr key={i.atendimentoExameId} className="border-t border-border/30">
                          <td className="px-3 py-2 tabular-nums text-xs text-muted-foreground">
                            {i.data ? format(new Date(i.data), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-xs">{i.protocolo}</td>
                          <td className="px-3 py-2 text-xs">{i.pacienteNome}</td>
                          <td className="px-3 py-2 text-xs">{i.exameNome}</td>
                          <td className="px-3 py-2 text-xs text-right tabular-nums font-semibold">{fmtBRL(i.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Totais */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Subtotal</p>
                <p className="text-sm font-bold tabular-nums">{fmtBRL(subtotal)}</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Desconto</Label>
                <Input
                  value={desconto}
                  onChange={(e) => setDesconto(e.target.value)}
                  className="h-7 mt-1 text-sm tabular-nums rounded-lg"
                  inputMode="decimal"
                />
              </div>
              <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-primary">Total</p>
                <p className="text-sm font-extrabold tabular-nums text-primary">{fmtBRL(total)}</p>
              </div>
            </div>

            {/* Observação */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Observação (opcional)</Label>
              <Input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex.: Lote 03/2026 — XP Saúde"
                className="h-10 rounded-xl"
                maxLength={200}
              />
            </div>
          </>
        ) : (
          /* Etapa de pagamento */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Forma de pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {formasPagamento.map(fp => <SelectItem key={fp} value={fp}>{fp}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Data do pagamento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full h-10 rounded-xl justify-start gap-2", !dataPagamento && "text-muted-foreground")}>
                    <CalendarIcon className="h-4 w-4" />
                    {dataPagamento ? format(dataPagamento, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataPagamento} onSelect={setDataPagamento} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="sm:col-span-2 rounded-xl border border-status-success/30 bg-status-success/5 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-status-success">Total a receber</p>
              <p className="text-base font-extrabold tabular-nums text-status-success">{fmtBRL(total)}</p>
            </div>
          </div>
        )}
      </div>
    </StandardDialog>
  );
};

export default FecharFaturaDialog;
