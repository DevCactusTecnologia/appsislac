import { useEffect, useState } from "react";
import { Building2, Save } from "lucide-react";
import { toast } from "sonner";
import StandardDialog from "@/components/ui/standard-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { type Fornecedor, salvarFornecedor } from "@/data/estoqueStore";

interface Props {
  open: boolean;
  onClose: () => void;
  fornecedor: Fornecedor | null;
  onSaved: () => void;
}

export default function FornecedorDialog({ open, onClose, fornecedor, onSaved }: Props) {
  const [form, setForm] = useState({ nome: "", cnpj: "", contato: "", telefone: "", email: "", ativo: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        nome: fornecedor?.nome ?? "",
        cnpj: fornecedor?.cnpj ?? "",
        contato: fornecedor?.contato ?? "",
        telefone: fornecedor?.telefone ?? "",
        email: fornecedor?.email ?? "",
        ativo: fornecedor?.ativo ?? true,
      });
    }
  }, [open, fornecedor]);

  async function handleSave() {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    setSaving(true);
    const res = await salvarFornecedor({
      ...(fornecedor ? { id: fornecedor.id } : {}),
      ...form,
      nome: form.nome.trim(),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? "Erro ao salvar");
      return;
    }
    toast.success(fornecedor ? "Fornecedor atualizado" : "Fornecedor cadastrado");
    onSaved();
    onClose();
  }

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      icon={<Building2 className="h-5 w-5 text-primary" />}
      title={fornecedor ? "Editar fornecedor" : "Novo fornecedor"}
      subtitle="Cadastre os dados básicos do parceiro de fornecimento."
      maxWidth="lg"
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
      <div className="px-6 py-5 grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-[12px] font-medium text-foreground">Nome <span className="text-destructive">*</span></Label>
          <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Razão social ou nome fantasia" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px] font-medium text-foreground">CNPJ</Label>
          <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px] font-medium text-foreground">Pessoa de contato</Label>
          <Input value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} placeholder="Nome do responsável" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px] font-medium text-foreground">Telefone</Label>
          <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px] font-medium text-foreground">E-mail</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contato@fornecedor.com" />
        </div>
        <div className="col-span-2 flex items-center justify-between rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
          <div>
            <p className="text-[13px] font-medium text-foreground">Fornecedor ativo</p>
            <p className="text-[11px] text-muted-foreground">Inativos não aparecem nas listas de seleção.</p>
          </div>
          <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
        </div>
      </div>
    </StandardDialog>
  );
}
