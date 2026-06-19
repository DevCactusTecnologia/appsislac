import { useState, useEffect, useMemo } from "react";
import {
  X, User, MapPin, Shield, Save, Loader2, Check, AlertCircle,
  AlertTriangle, IdCard, Phone, Home, UserCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { addPaciente, updatePaciente } from "@/data/pacienteStore";
import { LocationSelector } from "@/components/inscricao/LocationSelector";
import { isValidCPF, sanitizeCPF } from "@/lib/cpf";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

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

type TabKey = "pessoais" | "contato";

export default function CadastroPacienteDialog({ open, onClose, editMode, initialData, initialName, onSave }: Props) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("pessoais");
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

  useBodyScrollLock(open);

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

  if (!open) return null;

  const inputClass =
    "w-full px-3 py-2.5 bg-muted/30 border border-border/60 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all duration-200 disabled:opacity-60";
  const labelClass = "text-[11px] font-medium text-muted-foreground mb-1.5 block";

  // Initials para o avatar header
  const initials = (formData.nome || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase() || "")
    .join("") || "?";

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: "pessoais", label: "Identificação", icon: IdCard },
    { key: "contato", label: "Contato e endereço", icon: MapPin },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-[3px]" onClick={() => !loading && onClose()} />
      <div className="relative w-full max-w-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] flex flex-col bg-card rounded-3xl border border-border shadow-[0_24px_80px_-12px_hsl(var(--foreground)/0.18)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-primary/8 flex items-center justify-center text-[13px] font-semibold text-primary tracking-wide">
              {initials !== "?" ? initials : <UserCircle2 className="h-5 w-5 text-primary" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-foreground tracking-tight truncate">
                {editMode ? "Editar paciente" : "Novo paciente"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {age !== null
                  ? `${age} ${age === 1 ? "ano" : "anos"}${isNewborn ? " · recém-nascido" : isMinor ? " · menor de idade" : ""}`
                  : editMode ? "Atualize os dados cadastrais" : "Preencha os dados do paciente"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-px bg-border/50" />

        {/* Tabs */}
        <div className="px-6 pt-3 flex items-center gap-1">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`h-9 px-3 rounded-xl text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-all ${
                  active
                    ? "bg-primary/8 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto">
          {activeTab === "pessoais" && (
            <>
              {/* Dados pessoais */}
              <section className="space-y-4">
                <div>
                  <label className={labelClass}>Nome completo *</label>
                  <input
                    className={inputClass}
                    disabled={loading}
                    value={formData.nome}
                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: João da Silva Santos"
                    autoFocus
                  />

                  {/* Toggle nome social estilo CactusClinic */}
                  <label className="mt-2.5 inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={useNomeSocial}
                      onChange={(e) => setUseNomeSocial(e.target.checked)}
                      className="sr-only"
                      disabled={loading}
                    />
                    <span className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${useNomeSocial ? "bg-primary" : "bg-muted-foreground/25"}`}>
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${useNomeSocial ? "translate-x-4" : "translate-x-0.5"}`} />
                    </span>
                    <span className="text-[11.5px] text-muted-foreground font-medium">Deseja usar nome social?</span>
                  </label>

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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                            className={`h-[42px] rounded-xl text-[13px] font-medium border transition-all ${
                              active
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted/30 text-foreground border-border/60 hover:border-primary/40"
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              </section>

              {/* Responsável legal */}
              <section
                className={`rounded-2xl border p-4 transition-colors ${
                  isNewborn
                    ? "border-amber-500/40 bg-amber-500/5"
                    : isMinor
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-border/60 bg-muted/20"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isMinor ? "bg-amber-500/15" : "bg-primary/10"
                    }`}>
                      <Shield className={`h-4 w-4 ${isMinor ? "text-amber-600 dark:text-amber-400" : "text-primary"}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[13px] font-semibold text-foreground tracking-tight leading-tight">
                        Responsável legal
                        {isNewborn && <span className="ml-1.5 text-amber-700 dark:text-amber-400">· obrigatório</span>}
                        {!isNewborn && isMinor && <span className="ml-1.5 text-amber-700 dark:text-amber-400">· recomendado</span>}
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <div className="mt-3 flex gap-2 items-start">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed text-foreground/80">
                      Os dados do responsável legal podem ser exigidos para validação clínica e emissão de laudos.
                    </p>
                  </div>
                )}
              </section>
            </>
          )}

          {activeTab === "contato" && (
            <>
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-primary" />
                  <h3 className="text-[12.5px] font-semibold text-foreground tracking-tight">Contato</h3>
                </div>
                <div>
                  <label className={labelClass}>Celular</label>
                  <input
                    className={inputClass}
                    disabled={loading}
                    value={formData.celular}
                    onChange={e => setFormData({ ...formData, celular: maskPhone(e.target.value) })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Home className="h-3.5 w-3.5 text-primary" />
                  <h3 className="text-[12.5px] font-semibold text-foreground tracking-tight">Endereço</h3>
                </div>

                <LocationSelector
                  selectedState={formData.estado}
                  selectedCity={formData.cidade}
                  onStateChange={uf => setFormData((prev: any) => ({ ...prev, estado: uf }))}
                  onCityChange={city => setFormData((prev: any) => ({ ...prev, cidade: city }))}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Bairro</label>
                    <input className={inputClass} disabled={loading} value={formData.bairro} onChange={e => setFormData({ ...formData, bairro: e.target.value })} placeholder="Ex: Centro" />
                  </div>
                  <div>
                    <label className={labelClass}>Logradouro</label>
                    <input className={inputClass} disabled={loading} value={formData.endereco} onChange={e => setFormData({ ...formData, endereco: e.target.value })} placeholder="Ex: Rua das Flores" />
                  </div>
                </div>

                <div className="grid grid-cols-[140px_1fr] gap-3">
                  <div>
                    <label className={labelClass}>Número</label>
                    <input className={inputClass} disabled={loading} value={formData.numero} onChange={e => setFormData({ ...formData, numero: e.target.value })} placeholder="123" />
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        <div className="h-px bg-border/50" />

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground hidden sm:block">
            <span className="text-destructive">*</span> Campos obrigatórios
          </p>
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={onClose}
              disabled={loading}
              className="h-11 px-6 rounded-2xl border border-border/60 bg-background text-[13px] font-medium text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 transition-all duration-200 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all duration-200 shadow-sm disabled:opacity-70"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {loading ? "Salvando..." : editMode ? "Salvar alterações" : "Cadastrar paciente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
