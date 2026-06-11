import { useEffect, useState } from "react";
import { Layers, Save } from "lucide-react";
import { toast } from "sonner";
import StandardDialog from "@/components/ui/standard-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  type Fornecedor,
  type Insumo,
  type Lote,
  salvarLote,
} from "@/data/estoqueStore";

interface Props {
  open: boolean;
  onClose: () => void;
  lote: Lote | null;
  insumos: Insumo[];
  fornecedores: Fornecedor[];
  insumoIdInicial?: string;
  onSaved: () => void;
}

export default function LoteDialog({ open, onClose, lote, insumos, fornecedores, insumoIdInicial, onSaved }: Props) {
  const [form, setForm] = useState({
    insumo_id: "",
    numero_lote: "",
    data_validade: "",
    quantidade_inicial: 0,
    custo_unitario: 0,
    fornecedor_id: "",
    data_entrada: new Date().toISOString().slice(0, 10),
    nota_fiscal: "",
    observacao: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        insumo_id: lote?.insumo_id ?? insumoIdInicial ?? "",
        numero_lote: lote?.numero_lote ?? "",
        data_validade: lote?.data_validade ?? "",
        quantidade_inicial: lote?.quantidade_inicial ?? 0,
        custo_unitario: lote?.custo_unitario ?? 0,
        fornecedor_id: lote?.fornecedor_id ?? "",
        data_entrada: lote?.data_entrada ?? new Date().toISOString().slice(0, 10),
        nota_fiscal: lote?.nota_fiscal ?? "",
        observacao: lote?.observacao ?? "",
      });
    }
  }, [open, lote, insumoIdInicial]);

  async function handleSave() {
    if (!form.insumo_id) return toast.error("Selecione o insumo");
    if (!form.numero_lote.trim()) return toast.error("Informe o número do lote");
    if (!form.data_validade) return toast.error("Informe a data de validade");
    if (!lote && Number(form.quantidade_inicial) <= 0) return toast.error("Quantidade inicial deve ser maior que zero");

    setSaving(true);
    const res = await salvarLote({
      ...(lote ? { id: lote.id } : {}),
      insumo_id: form.insumo_id,
      numero_lote: form.numero_lote.trim(),
      data_validade: form.data_validade,
      quantidade_inicial: Number(form.quantidade_inicial),
      ...(lote ? {} : { quantidade_atual: Number(form.quantidade_inicial) }),
      custo_unitario: Number(form.custo_unitario) || 0,
      fornecedor_id: form.fornecedor_id || null,
      data_entrada: form.data_entrada,
      nota_fiscal: form.nota_fiscal,
      observacao: form.observacao,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? "Erro ao salvar lote");
      return;
    }
    toast.success(lote ? "Lote atualizado" : "Lote registrado");
    onSaved();
    onClose();
  }

  const insumoSel = insumos.find((i) => i.id === form.insumo_id);

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      icon={<Layers className="h-5 w-5 text-primary" />}
      title={lote ? "Editar lote" : "Novo lote / Entrada"}
      subtitle={lote ? "Atualize informações do lote registrado." : "Registre a entrada de um novo lote no estoque."}
      maxWidth="2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </>
      }
    >
      <div className="px-6 py-5 space-y-6">
        {/* Insumo */}
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Insumo</h3>
          <div className="space-y-1.5">
            <Label className="text-[12px] font-medium text-foreground">Selecione o insumo <span className="text-destructive">*</span></Label>
            <Select value={form.insumo_id} onValueChange={(v) => setForm({ ...form, insumo_id: v })} disabled={!!lote}>
              <SelectTrigger><SelectValue placeholder="Selecione um insumo cadastrado" /></SelectTrigger>
              <SelectContent>
                {insumos.filter((i) => i.ativo).map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.nome} <span className="text-xs text-muted-foreground">({i.unidade_medida})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {insumoSel && (
              <p className="text-[11px] text-muted-foreground">
                Categoria: <span className="font-medium text-foreground">{insumoSel.categoria}</span> · Unidade: <span className="font-medium text-foreground">{insumoSel.unidade_medida}</span>
              </p>
            )}
          </div>
        </section>

        <div className="h-px bg-border/50" />

        {/* Identificação do lote */}
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Identificação do lote</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-foreground">Número do lote <span className="text-destructive">*</span></Label>
              <Input value={form.numero_lote} onChange={(e) => setForm({ ...form, numero_lote: e.target.value })} placeholder="Ex.: L240514" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-foreground">Data de validade <span className="text-destructive">*</span></Label>
              <Input type="date" value={form.data_validade} onChange={(e) => setForm({ ...form, data_validade: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-foreground">Quantidade {lote ? "inicial" : <span className="text-destructive">*</span>}</Label>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={form.quantidade_inicial}
                onChange={(e) => setForm({ ...form, quantidade_inicial: Number(e.target.value) })}
                disabled={!!lote}
              />
              {lote && <p className="text-[11px] text-muted-foreground">Para alterar quantidade use Movimentação.</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-foreground">Custo unitário (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.0001"
                value={form.custo_unitario}
                onChange={(e) => setForm({ ...form, custo_unitario: Number(e.target.value) })}
                placeholder="0,00"
              />
            </div>
          </div>
        </section>

        <div className="h-px bg-border/50" />

        {/* Origem */}
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Origem e entrada</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-foreground">Fornecedor</Label>
              <Select value={form.fornecedor_id || "__none__"} onValueChange={(v) => setForm({ ...form, fornecedor_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhum —</SelectItem>
                  {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-foreground">Data de entrada</Label>
              <Input type="date" value={form.data_entrada} onChange={(e) => setForm({ ...form, data_entrada: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-[12px] font-medium text-foreground">Nota fiscal</Label>
              <Input value={form.nota_fiscal} onChange={(e) => setForm({ ...form, nota_fiscal: e.target.value })} placeholder="Número da NF" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-[12px] font-medium text-foreground">Observação</Label>
              <Textarea rows={3} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="Condições de armazenamento, marca, etc." />
            </div>
          </div>
        </section>
      </div>
    </StandardDialog>
  );
}
