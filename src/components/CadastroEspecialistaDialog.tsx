import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Stethoscope, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { addEspecialista, updateEspecialista, type Especialista } from "@/data/especialistaStore";
import { sanitizeCPF, isValidCPF } from "@/lib/cpf";
import { ComboboxField, type ComboboxOption } from "@/components/configuracoes/_shared/ComboboxField";

interface CadastroEspecialistaDialogProps {
  open: boolean;
  onClose: () => void;
  /** Quando passado, o diálogo entra em modo edição e pré-preenche o formulário. */
  especialista?: Especialista | null;
}

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const formatCPF = (value: string) => {
  const d = sanitizeCPF(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const CONSELHOS_OPTS: ComboboxOption[] = [
  { value: "CRM", label: "CRM", hint: "Medicina" },
  { value: "CRO", label: "CRO", hint: "Odontologia" },
  { value: "CRF", label: "CRF", hint: "Farmácia" },
  { value: "CRBM", label: "CRBM", hint: "Biomedicina" },
  { value: "COREN", label: "COREN", hint: "Enfermagem" },
  { value: "CRN", label: "CRN", hint: "Nutrição" },
  { value: "CRP", label: "CRP", hint: "Psicologia" },
  { value: "CREFITO", label: "CREFITO", hint: "Fisio/T.O." },
  { value: "CRBio", label: "CRBio", hint: "Biologia" },
  { value: "CRMV", label: "CRMV", hint: "Veterinária" },
  { value: "Outro", label: "Outro" },
];
const UFS: { uf: string; nome: string }[] = [
  { uf: "AC", nome: "Acre" }, { uf: "AL", nome: "Alagoas" }, { uf: "AP", nome: "Amapá" },
  { uf: "AM", nome: "Amazonas" }, { uf: "BA", nome: "Bahia" }, { uf: "CE", nome: "Ceará" },
  { uf: "DF", nome: "Distrito Federal" }, { uf: "ES", nome: "Espírito Santo" }, { uf: "GO", nome: "Goiás" },
  { uf: "MA", nome: "Maranhão" }, { uf: "MT", nome: "Mato Grosso" }, { uf: "MS", nome: "Mato Grosso do Sul" },
  { uf: "MG", nome: "Minas Gerais" }, { uf: "PA", nome: "Pará" }, { uf: "PB", nome: "Paraíba" },
  { uf: "PR", nome: "Paraná" }, { uf: "PE", nome: "Pernambuco" }, { uf: "PI", nome: "Piauí" },
  { uf: "RJ", nome: "Rio de Janeiro" }, { uf: "RN", nome: "Rio Grande do Norte" }, { uf: "RS", nome: "Rio Grande do Sul" },
  { uf: "RO", nome: "Rondônia" }, { uf: "RR", nome: "Roraima" }, { uf: "SC", nome: "Santa Catarina" },
  { uf: "SP", nome: "São Paulo" }, { uf: "SE", nome: "Sergipe" }, { uf: "TO", nome: "Tocantins" },
];
const UFS_OPTS: ComboboxOption[] = UFS.map(({ uf, nome }) => ({ value: uf, label: uf, hint: nome }));
const SEXO_OPTS: ComboboxOption[] = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Feminino" },
  { value: "O", label: "Outro" },
];

const emptyForm = {
  nome: "",
  conselhoClasse: "CRM",
  crm: "",
  estadoEmissor: "",
  cpf: "",
  sexo: "",
  especialidade: "",
  telefone: "",
  email: "",
};

const CadastroEspecialistaDialog = ({ open, onClose, especialista }: CadastroEspecialistaDialogProps) => {
  const { toast } = useToast();
  const isEdit = !!especialista;
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Pré-preenche / reseta ao abrir
  useEffect(() => {
    if (open) {
      if (especialista) {
        setForm({
          nome: especialista.nome,
          conselhoClasse: especialista.conselhoClasse || "CRM",
          crm: especialista.crm,
          estadoEmissor: especialista.estadoEmissor || "",
          cpf: especialista.cpf || "",
          sexo: especialista.sexo || "",
          especialidade: especialista.especialidade,
          telefone: especialista.telefone,
          email: especialista.email,
        });
      } else {
        setForm(emptyForm);
      }
    }
  }, [open, especialista]);

  const updateField = (field: keyof typeof emptyForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (saving) return;
    if (!form.nome.trim()) { toast({ title: "Nome é obrigatório", variant: "destructive" }); return; }
    if (!form.crm.trim()) { toast({ title: "CRM é obrigatório", variant: "destructive" }); return; }
    if (form.cpf && !isValidCPF(form.cpf)) {
      toast({ title: "CPF inválido", variant: "destructive" });
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast({ title: "E-mail inválido", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (isEdit && especialista) {
        await updateEspecialista(especialista.id, form);
        toast({ title: "Especialista atualizado com sucesso!" });
      } else {
        await addEspecialista({ ...form, status: "Ativo" });
        toast({ title: "Especialista cadastrado com sucesso!" });
      }
      setForm(emptyForm);
      onClose();
    } catch (err: any) {
      toast({
        title: isEdit ? "Erro ao atualizar especialista" : "Erro ao cadastrar especialista",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  useBodyScrollLock(open);

  if (!open) return null;

  const inputClass = "w-full px-3 py-2.5 bg-muted/30 border border-border/60 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all duration-200 disabled:opacity-60";

  return createPortal((
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-[3px]" onClick={() => !saving && onClose()} />
      <div className="relative w-full max-w-xl max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] flex flex-col bg-card rounded-3xl border border-border shadow-[0_24px_80px_-12px_hsl(var(--foreground)/0.18)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/8 flex items-center justify-center">
              <Stethoscope className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground tracking-tight">
                {isEdit ? "Editar Especialista" : "Cadastrar Especialista"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isEdit ? "Atualize os dados do especialista" : "Preencha os dados do especialista"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-px bg-border/50" />

        {/* Form */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Nome completo *</label>
            <input className={inputClass} disabled={saving} value={form.nome} onChange={(e) => updateField("nome", e.target.value)} placeholder="Nome do especialista" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">CPF</label>
              <input className={inputClass} disabled={saving} value={form.cpf} onChange={(e) => updateField("cpf", formatCPF(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Sexo</label>
              <ComboboxField
                value={form.sexo}
                onChange={(v) => updateField("sexo", v)}
                options={SEXO_OPTS}
                placeholder="Selecione"
                allowCustom={false}
                disabled={saving}
              />
            </div>
          </div>
          <div className="grid grid-cols-[1fr_1.4fr_0.9fr] gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Conselho *</label>
              <ComboboxField
                value={form.conselhoClasse}
                onChange={(v) => updateField("conselhoClasse", v)}
                options={CONSELHOS_OPTS}
                placeholder="Pesquisar conselho"
                allowCustom={false}
                disabled={saving}
                minListWidth={260}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Número *</label>
              <input className={inputClass} disabled={saving} value={form.crm} onChange={(e) => updateField("crm", e.target.value)} placeholder="000000" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">UF emissor</label>
              <ComboboxField
                value={form.estadoEmissor}
                onChange={(v) => updateField("estadoEmissor", v)}
                options={UFS_OPTS}
                placeholder="UF"
                allowCustom={false}
                disabled={saving}
                minListWidth={240}
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Especialidade</label>
            <input className={inputClass} disabled={saving} value={form.especialidade} onChange={(e) => updateField("especialidade", e.target.value)} placeholder="Ex: Cardiologia" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Telefone</label>
              <input className={inputClass} disabled={saving} value={form.telefone} onChange={(e) => updateField("telefone", formatPhone(e.target.value))} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">E-mail</label>
              <input className={inputClass} disabled={saving} value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder="email@exemplo.com" type="email" />
            </div>
          </div>
        </div>

        <div className="h-px bg-border/50" />

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="h-11 px-6 rounded-2xl border border-border/60 bg-background text-[13px] font-medium text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 transition-all duration-200 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all duration-200 shadow-sm disabled:opacity-70"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  ), document.body);
};

export default CadastroEspecialistaDialog;
