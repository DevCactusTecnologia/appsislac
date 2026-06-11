import { useEffect, useState } from "react";
import { Boxes, Save } from "lucide-react";
import { toast } from "sonner";
import StandardDialog from "@/components/ui/standard-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  CATEGORIAS_INSUMO,
  UNIDADES_MEDIDA,
  type Fornecedor,
  type Insumo,
  salvarInsumo,
} from "@/data/estoqueStore";

interface Props {
  open: boolean;
  onClose: () => void;
  insumo: Insumo | null;
  fornecedores: Fornecedor[];
  onSaved: () => void;
}

export default function InsumoDialog({ open, onClose, insumo, fornecedores, onSaved }: Props) {
  const [form, setForm] = useState({
    codigo: "",
    nome: "",
    categoria: "Outros" as string,
    unidade_medida: "un",
    fornecedor_id: "" as string,
    estoque_minimo: 0,
    alerta_validade_dias: 30,
    observacao: "",
    ativo: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        codigo: insumo?.codigo ?? "",
        nome: insumo?.nome ?? "",
        categoria: insumo?.categoria ?? "Outros",
        unidade_medida: insumo?.unidade_medida ?? "un",
        fornecedor_id: insumo?.fornecedor_id ?? "",
        estoque_minimo: insumo?.estoque_minimo ?? 0,
        alerta_validade_dias: insumo?.alerta_validade_dias ?? 30,
        observacao: insumo?.observacao ?? "",
        ativo: insumo?.ativo ?? true,
      });
    }
  }, [open, insumo]);

  async function handleSave() {
    if (!form.nome.trim()) {
      toast.error("Nome do insumo é obrigatório");
      return;
    }
    setSaving(true);
    const res = await salvarInsumo({
      ...(insumo ? { id: insumo.id } : {}),
      codigo: form.codigo.trim(),
      nome: form.nome.trim(),
      categoria: form.categoria,
      unidade_medida: form.unidade_medida,
      fornecedor_id: form.fornecedor_id || null,
      estoque_minimo: Number(form.estoque_minimo) || 0,
      alerta_validade_dias: Number(form.alerta_validade_dias) || 30,
      observacao: form.observacao,
      ativo: form.ativo,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? "Erro ao salvar insumo");
      return;
    }
    toast.success(insumo ? "Insumo atualizado" : "Insumo cadastrado");
    onSaved();
    onClose();
  }

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      icon={<Boxes className="h-5 w-5 text-primary" />}
      title={insumo ? "Editar insumo" : "Novo insumo"}
      subtitle="Defina categoria, unidade e parâmetros de controle."
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
        {/* Identificação */}
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Identificação</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-[12px] font-medium text-foreground">Nome do insumo <span className="text-destructive">*</span></Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Tubo EDTA 4 ml" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-foreground">Código interno</Label>
              <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="Opcional" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-foreground">Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_INSUMO.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <div className="h-px bg-border/50" />

        {/* Suprimento e controle */}
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Suprimento e controle</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-foreground">Unidade de medida</Label>
              <Select value={form.unidade_medida} onValueChange={(v) => setForm({ ...form, unidade_medida: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIDADES_MEDIDA.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-foreground">Fornecedor padrão</Label>
              <Select value={form.fornecedor_id || "__none__"} onValueChange={(v) => setForm({ ...form, fornecedor_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhum —</SelectItem>
                  {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-foreground">Estoque mínimo</Label>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={form.estoque_minimo}
                onChange={(e) => setForm({ ...form, estoque_minimo: Number(e.target.value) })}
              />
              <p className="text-[11px] text-muted-foreground">Use 0 para desativar o alerta de saldo baixo.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-foreground">Alerta de validade (dias)</Label>
              <Input
                type="number"
                min="1"
                value={form.alerta_validade_dias}
                onChange={(e) => setForm({ ...form, alerta_validade_dias: Number(e.target.value) })}
              />
              <p className="text-[11px] text-muted-foreground">Quantos dias antes do vencimento sinalizar.</p>
            </div>
          </div>
        </section>

        <div className="h-px bg-border/50" />

        {/* Extras */}
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Observações</h3>
          <div className="space-y-1.5">
            <Label className="text-[12px] font-medium text-foreground">Notas adicionais</Label>
            <Textarea
              rows={3}
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              placeholder="Cuidados de armazenamento, marca preferida, etc."
            />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
            <div>
              <p className="text-[13px] font-medium text-foreground">Insumo ativo</p>
              <p className="text-[11px] text-muted-foreground">Quando inativo, não aparece no cadastro de novos lotes.</p>
            </div>
            <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
          </div>
        </section>
      </div>
    </StandardDialog>
  );
}
