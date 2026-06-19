// NovaDespesaDialog — Fase 6 V2 (Despesa simplificada).
//
// Form enxuto: Descrição · Categoria · Forma · Vencimento · Valor · Status.
// Persiste direto via `addSaida` do financeiroStore.
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addSaida, getNextSaidaProtocolo, type SaidaStatus } from "@/data/financeiroStore";
import { toast } from "@/hooks/use-toast";
import { isValidDateBR, maskDateBR } from "../../helpers";

interface Props {
  open: boolean;
  onClose: () => void;
  tiposDespesa: string[];
  formasPagamento: string[];
  destinosPagamento: string[];
  onSaved?: () => void;
}

function todayBR(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export default function NovaDespesaDialog({
  open, onClose, tiposDespesa, formasPagamento, destinosPagamento, onSaved,
}: Props) {
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [forma, setForma] = useState("");
  const [destino, setDestino] = useState("");
  const [vencimento, setVencimento] = useState(todayBR());
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState<SaidaStatus>("aberta");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setDescricao(""); setCategoria(""); setForma(""); setDestino("");
    setVencimento(todayBR()); setValor(""); setStatus("aberta");
  };

  const handleSave = async () => {
    if (!descricao.trim()) {
      toast({ title: "Descrição obrigatória", variant: "destructive" });
      return;
    }
    const valorNum = Number(valor.replace(",", "."));
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      toast({ title: "Informe um valor válido", variant: "destructive" });
      return;
    }
    if (!isValidDateBR(vencimento)) {
      toast({ title: "Vencimento inválido", description: "Use dd/mm/aaaa.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await addSaida({
        protocolo: getNextSaidaProtocolo(),
        data: todayBR(),
        cliente: descricao.trim(),
        valorTotal: valorNum,
        pagamento: forma,
        tipoDespesa: categoria,
        destinoPagamento: destino,
        descricao: descricao.trim(),
        dataVencimento: vencimento,
        foiPago: status === "paga" ? "Sim" : "Não",
        dataPagamento: status === "paga" ? todayBR() : "",
        status,
      });
      toast({ title: "Despesa registrada" });
      reset();
      onSaved?.();
      onClose();
    } catch (e) {
      toast({
        title: "Falha ao salvar despesa",
        description: (e as Error)?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova despesa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="desp-desc">Descrição</Label>
            <Input
              id="desp-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Aluguel sala 2"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent className="bg-popover">
                  {tiposDespesa.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select value={forma} onValueChange={setForma}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent className="bg-popover">
                  {formasPagamento.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="desp-venc">Vencimento</Label>
              <Input
                id="desp-venc"
                value={vencimento}
                onChange={(e) => setVencimento(maskDateBR(e.target.value))}
                placeholder="dd/mm/aaaa"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desp-valor">Valor (R$)</Label>
              <Input
                id="desp-valor"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as SaidaStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="aberta">Aberta</SelectItem>
                <SelectItem value="paga">Paga</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Destino é opcional; mantemos no rodapé para preservar o modelo. */}
          {destinosPagamento.length > 0 && (
            <div className="space-y-2">
              <Label>Destino do pagamento (opcional)</Label>
              <Select value={destino} onValueChange={setDestino}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent className="bg-popover">
                  {destinosPagamento.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : "Salvar despesa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
