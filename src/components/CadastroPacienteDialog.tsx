import { useState, useEffect, useMemo } from "react";
import { X, User, MapPin, Shield, Phone, Mail, CreditCard, Calendar, Save, Loader2, Info, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { addPaciente, updatePaciente } from "@/data/pacienteStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LocationSelector } from "@/components/inscricao/LocationSelector";
import { isValidCPF, sanitizeCPF } from "@/lib/cpf";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogPortal,
  DialogOverlay
} from "@/components/ui/dialog";
import { ComboboxField, type ComboboxOption } from "@/components/configuracoes/_shared/ComboboxField";

interface Props {
  open: boolean;
  onClose: () => void;
  editMode?: boolean;
  initialData?: any;
  initialName?: string;
  onSave?: (data: any) => Promise<void>;
}

const maskCPF = (value: string) => {
  return value
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})/, "$1-$2");
};

const maskPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length > 0 ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const maskCEP = (value: string) => {
  return value
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, "$1-$2");
};

const SEXO_OPTS: ComboboxOption[] = [
  { value: "Masculino", label: "Masculino" },
  { value: "Feminino", label: "Feminino" },
];

const maskDateBR = (value: string) => {
  const d = (value || "").replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

const isValidDateBR = (br: string): boolean => {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(br)) return false;
  const [d, m, y] = br.split("/").map(Number);
  if (y < 1900 || y > new Date().getFullYear()) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
};

export default function CadastroPacienteDialog({ open, onClose, editMode, initialData, initialName, onSave }: Props) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("pessoais");
  const [formData, setFormData] = useState<any>({
    nome: "",
    cpf: "",
    sexo: "Masculino",
    dataNascimento: "",
    telefone: "",
    celular: "",
    email: "",
    cep: "",
    estado: "",
    cidade: "",
    bairro: "",
    endereco: "",
    numero: "",
    complemento: "",
    guardianName: "",
    guardianCpf: "",
    consentimentoLgpd: true,
  });

  const cpfDigits = sanitizeCPF(formData.cpf || "");
  const cpfValid = cpfDigits.length === 11 && isValidCPF(cpfDigits);
  const cpfInvalid = cpfDigits.length === 11 && !cpfValid;

  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData(initialData);
      } else if (initialName) {
        setFormData((prev: any) => ({
          ...prev,
          nome: initialName,
          cpf: "",
          sexo: "Masculino",
          dataNascimento: "",
          telefone: "",
          celular: "",
          email: "",
          cep: "",
          estado: "",
          cidade: "",
          bairro: "",
          endereco: "",
          numero: "",
          complemento: "",
          guardianName: "",
          guardianCpf: "",
          consentimentoLgpd: true,
        }));
      } else {
        setFormData({
          nome: "",
          cpf: "",
          sexo: "Masculino",
          dataNascimento: "",
          telefone: "",
          celular: "",
          email: "",
          cep: "",
          estado: "",
          cidade: "",
          bairro: "",
          endereco: "",
          numero: "",
          complemento: "",
          guardianName: "",
          guardianCpf: "",
          consentimentoLgpd: true,
        });
      }
    }
  }, [initialData, initialName, open]);


  const handleCEPBlur = async () => {
    const cep = formData.cep.replace(/\D/g, "");
    if (cep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setFormData((prev: any) => ({
            ...prev,
            endereco: data.logradouro,
            bairro: data.bairro,
            cidade: data.localidade,
            estado: data.uf,
          }));
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
      }
    }
  };

  const handleSave = async () => {
    if (!formData.nome || formData.nome.trim().length < 3) {
      toast.error("Nome completo é obrigatório");
      setActiveTab("pessoais");
      return;
    }

    if (!formData.cpf) {
      toast.error("CPF é obrigatório");
      setActiveTab("pessoais");
      return;
    }

    if (!cpfValid) {
      toast.error("CPF inválido. Verifique o número digitado.");
      setActiveTab("pessoais");
      return;
    }

    if (!formData.dataNascimento || !isValidDateBR(formData.dataNascimento)) {
      toast.error("Data de nascimento inválida. Use o formato DD/MM/AAAA.");
      setActiveTab("pessoais");
      return;
    }


    setLoading(true);
    try {
      if (onSave) {
        await onSave(formData);
      } else if (editMode && initialData?.id) {
        await updatePaciente(initialData.id, formData);
        toast.success("Paciente atualizado com sucesso!");
      } else {
        await addPaciente({
          ...formData,
          status: "Ativo",
        });
        toast.success("Paciente cadastrado com sucesso!");
      }
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar paciente");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3 py-2.5 bg-muted/30 border border-border/60 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all duration-200 disabled:opacity-60";

  return (
    <Dialog open={open} onOpenChange={(val) => !loading && !val && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-card rounded-3xl border-border shadow-2xl gap-0">
        <DialogHeader className="px-6 py-5 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/8 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <DialogTitle className="text-[15px] font-semibold text-foreground tracking-tight">
                {editMode ? "Editar Cadastro do Paciente" : "Novo Cadastro de Paciente"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {editMode ? "Atualize os dados cadastrais do paciente" : "Preencha os dados para cadastrar um novo paciente"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
          <div className="px-6 border-b border-border/40">
            <TabsList className="w-full justify-start h-12 bg-transparent gap-8 p-0">
              <TabsTrigger 
                value="pessoais" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-12 px-0 gap-2 text-[13px] font-medium transition-all"
              >
                <Info className="h-4 w-4" />
                Dados Pessoais
              </TabsTrigger>
              <TabsTrigger 
                value="contato" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-12 px-0 gap-2 text-[13px] font-medium transition-all"
              >
                <MapPin className="h-4 w-4" />
                Contato e Endereço
              </TabsTrigger>
              <TabsTrigger 
                value="responsavel" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-12 px-0 gap-2 text-[13px] font-medium transition-all"
              >
                <Shield className="h-4 w-4" />
                Responsável Legal
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
            <TabsContent value="pessoais" className="mt-0 space-y-4 animate-in fade-in duration-300 outline-none">
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Nome completo *</label>
                  <input 
                    className={inputClass} 
                    disabled={loading} 
                    value={formData.nome} 
                    onChange={e => setFormData({...formData, nome: e.target.value})} 
                    placeholder="Ex: João da Silva Santos" 
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">CPF *</label>
                    <div className="relative">
                      <input
                        className={inputClass + (cpfInvalid ? " border-destructive/60 focus:border-destructive/60 pr-9" : cpfValid ? " pr-9" : "")}
                        disabled={loading}
                        value={formData.cpf}
                        onChange={e => setFormData({...formData, cpf: maskCPF(e.target.value)})}
                        placeholder="000.000.000-00"
                        inputMode="numeric"
                        aria-invalid={cpfInvalid}
                      />
                      {cpfValid && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" aria-label="CPF válido" />
                      )}
                      {cpfInvalid && (
                        <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" aria-label="CPF inválido" />
                      )}
                    </div>
                    {cpfInvalid && (
                      <p className="text-[11px] text-destructive mt-1">CPF inválido conforme regras da Receita Federal.</p>
                    )}
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Sexo biológico</label>
                    <ComboboxField
                      value={formData.sexo}
                      onChange={(v) => setFormData({...formData, sexo: v})}
                      options={SEXO_OPTS}
                      placeholder="Selecione"
                      allowCustom={false}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Data de nascimento *</label>
                    <input
                      className={inputClass}
                      disabled={loading}
                      value={formData.dataNascimento}
                      onChange={e => setFormData({...formData, dataNascimento: maskDateBR(e.target.value)})}
                      placeholder="DD/MM/AAAA"
                      inputMode="numeric"
                      maxLength={10}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">E-mail</label>
                    <input 
                      className={inputClass} 
                      disabled={loading} 
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                      placeholder="paciente@exemplo.com" 
                      type="email"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contato" className="mt-0 space-y-4 animate-in fade-in duration-300 outline-none">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Celular</label>
                  <input 
                    className={inputClass} 
                    disabled={loading} 
                    value={formData.celular} 
                    onChange={e => setFormData({...formData, celular: maskPhone(e.target.value)})} 
                    placeholder="(00) 00000-0000" 
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Telefone fixo</label>
                  <input 
                    className={inputClass} 
                    disabled={loading} 
                    value={formData.telefone} 
                    onChange={e => setFormData({...formData, telefone: maskPhone(e.target.value)})} 
                    placeholder="(00) 0000-0000" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-4">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">CEP</label>
                  <input 
                    className={`${inputClass} max-w-[120px]`}
                    disabled={loading} 
                    value={formData.cep} 
                    onChange={e => setFormData({...formData, cep: maskCEP(e.target.value)})} 
                    onBlur={handleCEPBlur}
                    placeholder="00000-000" 
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <LocationSelector 
                    selectedState={formData.estado}
                    selectedCity={formData.cidade}
                    onStateChange={uf => setFormData((prev: any) => ({ ...prev, estado: uf }))}
                    onCityChange={city => setFormData((prev: any) => ({ ...prev, cidade: city }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Bairro</label>
                  <input 
                    className={inputClass} 
                    disabled={loading} 
                    value={formData.bairro} 
                    onChange={e => setFormData({...formData, bairro: e.target.value})} 
                    placeholder="Ex: Centro" 
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Logradouro (Endereço)</label>
                  <input 
                    className={inputClass} 
                    disabled={loading} 
                    value={formData.endereco} 
                    onChange={e => setFormData({...formData, endereco: e.target.value})} 
                    placeholder="Ex: Rua das Flores" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Número</label>
                  <input 
                    className={inputClass} 
                    disabled={loading} 
                    value={formData.numero} 
                    onChange={e => setFormData({...formData, numero: e.target.value})} 
                    placeholder="Ex: 123" 
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Complemento</label>
                  <input 
                    className={inputClass} 
                    disabled={loading} 
                    value={formData.complemento} 
                    onChange={e => setFormData({...formData, complemento: e.target.value})} 
                    placeholder="Ex: Apto 101" 
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="responsavel" className="mt-0 space-y-4 animate-in fade-in duration-300 outline-none">
              <div className="bg-primary/5 p-4 rounded-2xl flex gap-4 items-start mb-2 border border-primary/10">
                <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-[13px] text-foreground">Dados do Responsável Legal</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">Preencha estes campos caso o paciente seja menor de idade ou necessite de acompanhamento legal.</p>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Nome do responsável</label>
                  <input 
                    className={inputClass} 
                    disabled={loading} 
                    value={formData.guardianName} 
                    onChange={e => setFormData({...formData, guardianName: e.target.value})} 
                    placeholder="Nome completo do responsável" 
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">CPF do responsável</label>
                  <input 
                    className={inputClass} 
                    disabled={loading} 
                    value={formData.guardianCpf} 
                    onChange={e => setFormData({...formData, guardianCpf: maskCPF(e.target.value)})} 
                    placeholder="000.000.000-00" 
                  />
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="p-6 border-t border-border/50 bg-muted/20 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl text-[13px] font-bold text-primary-foreground bg-primary hover:opacity-90 shadow-lg shadow-primary/20 flex items-center gap-2 transition-all duration-200"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editMode ? "Salvar Alterações" : "Cadastrar Paciente"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}