import { useState, useEffect, useMemo } from "react";
import { User, MapPin, Shield, Save, Loader2, Check, AlertCircle, AlertTriangle, IdCard, Phone, Home, Sparkles, ChevronRight } from "lucide-react";
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
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  editMode?: boolean;
  initialData?: any;
  initialName?: string;
  onSave?: (data: any) => Promise<void>;
}

const maskCPF = (value: string) =>
  value
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})/, "$1-$2");

const maskPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length > 0 ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const maskCEP = (value: string) =>
  value.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");

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

const ageInYears = (br: string): number | null => {
  if (!isValidDateBR(br)) return null;
  const [d, m, y] = br.split("/").map(Number);
  const today = new Date();
  let age = today.getFullYear() - y;
  const mDiff = today.getMonth() - (m - 1);
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < d)) age--;
  return age;
};

const emptyForm = {
  nome: "",
  nomeSocial: "",
  cpf: "",
  sexo: "",
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
};

function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3 pb-2 border-b border-border/40">
      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="flex-1">
        <h3 className="text-[13px] font-semibold text-foreground tracking-tight leading-tight">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function CadastroPacienteDialog({ open, onClose, editMode, initialData, initialName, onSave }: Props) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("pessoais");
  const [useNomeSocial, setUseNomeSocial] = useState(false);
  const [showResponsavel, setShowResponsavel] = useState(false);
  const [formData, setFormData] = useState<any>(emptyForm);

  const cpfDigits = sanitizeCPF(formData.cpf || "");
  const cpfFilled = cpfDigits.length > 0;
  const cpfValid = cpfDigits.length === 11 && isValidCPF(cpfDigits);
  const cpfInvalid = cpfFilled && (cpfDigits.length < 11 || !cpfValid);

  const age = useMemo(() => ageInYears(formData.dataNascimento), [formData.dataNascimento]);
  const isNewborn = age !== null && age < 1;
  const isMinor = age !== null && age < 18;

  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({ ...emptyForm, ...initialData });
        setUseNomeSocial(!!initialData.nomeSocial);
        setShowResponsavel(!!initialData.guardianName || !!initialData.guardianCpf);
      } else if (initialName) {
        setFormData({ ...emptyForm, nome: initialName });
        setUseNomeSocial(false);
        setShowResponsavel(false);
      } else {
        setFormData(emptyForm);
        setUseNomeSocial(false);
        setShowResponsavel(false);
      }
      setActiveTab("pessoais");
    }
  }, [initialData, initialName, open]);

  // Auto-expand responsável quando paciente é menor
  useEffect(() => {
    if (isMinor) setShowResponsavel(true);
  }, [isMinor]);

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
    if (!formData.dataNascimento || !isValidDateBR(formData.dataNascimento)) {
      toast.error("Data de nascimento inválida. Use o formato DD/MM/AAAA.");
      setActiveTab("pessoais");
      return;
    }
    if (!formData.sexo) {
      toast.error("Selecione o sexo biológico");
      setActiveTab("pessoais");
      return;
    }
    if (cpfFilled && !cpfValid) {
      toast.error("CPF inválido. Verifique o número digitado ou deixe em branco.");
      setActiveTab("pessoais");
      return;
    }

    const payload = {
      ...formData,
      nomeSocial: useNomeSocial ? formData.nomeSocial : "",
    };

    setLoading(true);
    try {
      if (onSave) {
        await onSave(payload);
      } else if (editMode && initialData?.id) {
        await updatePaciente(initialData.id, payload);
        toast.success("Paciente atualizado com sucesso!");
      } else {
        await addPaciente({ ...payload, status: "Ativo" });
        toast.success("Paciente cadastrado com sucesso!");
      }
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar paciente");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full h-10 px-3 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all disabled:opacity-60";
  const labelClass = "text-[11px] font-medium text-muted-foreground mb-1.5 block";

  // Initials para o avatar header
  const initials = (formData.nome || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase() || "")
    .join("") || "?";

  return (
    <Dialog open={open} onOpenChange={(val) => !loading && !val && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-card rounded-2xl border-border shadow-xl gap-0">
        {/* Header compacto e moderno */}
        <DialogHeader className="px-6 py-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold tracking-wide shadow-sm">
              {initials}
            </div>
            <div className="text-left flex-1 min-w-0">
              <DialogTitle className="text-[15px] font-semibold text-foreground tracking-tight truncate">
                {editMode ? "Editar paciente" : "Novo paciente"}
              </DialogTitle>
              <DialogDescription className="text-[12px] text-muted-foreground mt-0.5">
                {age !== null
                  ? `${age} ${age === 1 ? "ano" : "anos"}${isMinor ? " · menor de idade" : ""}`
                  : editMode ? "Atualize os dados cadastrais" : "Preencha os dados do paciente"}
              </DialogDescription>
            </div>
            {age !== null && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 h-7 rounded-lg bg-background border border-border/60 text-[11px] font-medium text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" />
                Auto-detectado
              </div>
            )}
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
          <div className="px-6 border-b border-border/60 bg-card">
            <TabsList className="w-full justify-start h-11 bg-transparent gap-6 p-0">
              <TabsTrigger
                value="pessoais"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground rounded-none h-11 px-0 gap-2 text-[13px] font-medium text-muted-foreground transition-all"
              >
                <IdCard className="h-3.5 w-3.5" />
                Identificação
              </TabsTrigger>
              <TabsTrigger
                value="contato"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground rounded-none h-11 px-0 gap-2 text-[13px] font-medium text-muted-foreground transition-all"
              >
                <MapPin className="h-3.5 w-3.5" />
                Contato e endereço
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="max-h-[62vh] overflow-y-auto px-6 py-5 bg-card">
            <TabsContent value="pessoais" className="mt-0 space-y-6 animate-in fade-in duration-200 outline-none">
              {/* Bloco: Dados pessoais */}
              <section>
                <SectionHeader icon={User} title="Dados pessoais" subtitle="Campos obrigatórios marcados com *" />

                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Nome completo *</label>
                    <input
                      className={inputClass}
                      disabled={loading}
                      value={formData.nome}
                      onChange={e => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Ex: João da Silva Santos"
                    />
                    <button
                      type="button"
                      onClick={() => setUseNomeSocial(v => !v)}
                      className="mt-1.5 text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <ChevronRight className={`h-3 w-3 transition-transform ${useNomeSocial ? "rotate-90" : ""}`} />
                      {useNomeSocial ? "Remover nome social" : "Deseja usar nome social?"}
                    </button>
                    {useNomeSocial && (
                      <input
                        className={`${inputClass} mt-2`}
                        disabled={loading}
                        value={formData.nomeSocial}
                        onChange={e => setFormData({ ...formData, nomeSocial: e.target.value })}
                        placeholder="Nome social (como o paciente prefere ser chamado)"
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Data de nascimento *</label>
                      <input
                        className={inputClass}
                        disabled={loading}
                        value={formData.dataNascimento}
                        onChange={e => setFormData({ ...formData, dataNascimento: maskDateBR(e.target.value) })}
                        placeholder="DD/MM/AAAA"
                        inputMode="numeric"
                        maxLength={10}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Sexo biológico *</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["Masculino", "Feminino"] as const).map(opt => {
                          const active = formData.sexo === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              disabled={loading}
                              onClick={() => setFormData({ ...formData, sexo: opt })}
                              className={`h-10 rounded-lg text-sm font-medium border transition-all ${
                                active
                                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                  : "bg-background text-foreground border-border hover:border-primary/40 hover:bg-muted/40"
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>CPF</label>
                      <div className="relative">
                        <input
                          className={inputClass + (cpfInvalid ? " border-destructive focus:border-destructive pr-9" : cpfValid ? " pr-9" : "")}
                          disabled={loading}
                          value={formData.cpf}
                          onChange={e => setFormData({ ...formData, cpf: maskCPF(e.target.value) })}
                          placeholder="000.000.000-00 (opcional)"
                          inputMode="numeric"
                          aria-invalid={cpfInvalid}
                        />
                        {cpfValid && <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />}
                        {cpfInvalid && <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />}
                      </div>
                      {cpfInvalid && <p className="text-[11px] text-destructive mt-1">CPF inválido. Corrija ou deixe em branco.</p>}
                    </div>
                    <div>
                      <label className={labelClass}>E-mail</label>
                      <input
                        className={inputClass}
                        disabled={loading}
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        placeholder="paciente@exemplo.com"
                        type="email"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Bloco: Responsável legal incorporado */}
              <section>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/40">
                  <div className="flex items-center gap-2.5">
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${isMinor ? "bg-amber-500/15" : "bg-primary/10"}`}>
                      <Shield className={`h-3.5 w-3.5 ${isMinor ? "text-amber-600 dark:text-amber-400" : "text-primary"}`} />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-semibold text-foreground tracking-tight leading-tight">
                        Responsável legal {isMinor && <span className="text-amber-600 dark:text-amber-400">· recomendado</span>}
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {isNewborn
                          ? "Recém-nascido (até 1 ano): preferencialmente informe os dados da mãe ou responsável legal direto."
                          : isMinor
                          ? "Paciente menor de 18 anos — recomendamos informar os dados do responsável legal."
                          : "Opcional. Preencha se desejar registrar um responsável ou acompanhante."}
                      </p>
                    </div>
                  </div>
                  {!isMinor && (
                    <button
                      type="button"
                      onClick={() => setShowResponsavel(v => !v)}
                      className="text-[11px] font-medium text-primary hover:underline shrink-0"
                    >
                      {showResponsavel ? "Ocultar" : "Adicionar"}
                    </button>
                  )}
                </div>

                {(showResponsavel || isMinor) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>{isNewborn ? "Nome da mãe / responsável" : "Nome do responsável"}</label>
                      <input
                        className={inputClass}
                        disabled={loading}
                        value={formData.guardianName}
                        onChange={e => setFormData({ ...formData, guardianName: e.target.value })}
                        placeholder="Nome completo"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{isNewborn ? "CPF da mãe / responsável" : "CPF do responsável"}</label>
                      <input
                        className={inputClass}
                        disabled={loading}
                        value={formData.guardianCpf}
                        onChange={e => setFormData({ ...formData, guardianCpf: maskCPF(e.target.value) })}
                        placeholder="000.000.000-00"
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                )}
                {isMinor && (
                  <div className="mt-3 flex gap-2 items-start p-3 rounded-lg bg-amber-500/5 border border-amber-500/30">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed text-foreground">
                      Os dados do responsável legal podem ser exigidos para validação clínica e emissão de laudos.
                    </p>
                  </div>
                )}
              </section>
            </TabsContent>

            <TabsContent value="contato" className="mt-0 space-y-6 animate-in fade-in duration-200 outline-none">
              <section>
                <SectionHeader icon={Phone} title="Contato" subtitle="Telefones e e-mail para comunicação" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Celular</label>
                    <input className={inputClass} disabled={loading} value={formData.celular} onChange={e => setFormData({ ...formData, celular: maskPhone(e.target.value) })} placeholder="(00) 00000-0000" />
                  </div>
                  <div>
                    <label className={labelClass}>Telefone fixo</label>
                    <input className={inputClass} disabled={loading} value={formData.telefone} onChange={e => setFormData({ ...formData, telefone: maskPhone(e.target.value) })} placeholder="(00) 0000-0000" />
                  </div>
                </div>
              </section>

              <section>
                <SectionHeader icon={Home} title="Endereço" subtitle="Preencha o CEP para preenchimento automático" />
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4">
                    <div>
                      <label className={labelClass}>CEP</label>
                      <input className={inputClass} disabled={loading} value={formData.cep} onChange={e => setFormData({ ...formData, cep: maskCEP(e.target.value) })} onBlur={handleCEPBlur} placeholder="00000-000" />
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
                      <label className={labelClass}>Bairro</label>
                      <input className={inputClass} disabled={loading} value={formData.bairro} onChange={e => setFormData({ ...formData, bairro: e.target.value })} placeholder="Ex: Centro" />
                    </div>
                    <div>
                      <label className={labelClass}>Logradouro</label>
                      <input className={inputClass} disabled={loading} value={formData.endereco} onChange={e => setFormData({ ...formData, endereco: e.target.value })} placeholder="Ex: Rua das Flores" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4">
                    <div>
                      <label className={labelClass}>Número</label>
                      <input className={inputClass} disabled={loading} value={formData.numero} onChange={e => setFormData({ ...formData, numero: e.target.value })} placeholder="123" />
                    </div>
                    <div>
                      <label className={labelClass}>Complemento</label>
                      <input className={inputClass} disabled={loading} value={formData.complemento} onChange={e => setFormData({ ...formData, complemento: e.target.value })} placeholder="Apto 101, Bloco B..." />
                    </div>
                  </div>
                </div>
              </section>
            </TabsContent>
          </div>
        </Tabs>

        <div className="px-6 py-4 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground hidden sm:block">
            <span className="text-destructive">*</span> Campos obrigatórios
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              disabled={loading}
              className="h-10 px-4 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="h-10 px-5 rounded-lg text-[13px] font-semibold text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-60 flex items-center gap-2 transition-all"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editMode ? "Salvar alterações" : "Cadastrar paciente"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
