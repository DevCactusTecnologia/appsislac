import { useEffect, useState } from "react";
import { Building2, Camera, Upload, ShieldCheck, AlertCircle, Mail, Phone, MapPin, FileText, Stethoscope, IdCard } from "lucide-react";
// ----------------------------------------------------------------------------
// SISLAC Document Ownership (IA-first semantics)
//   Lab Data  = institutional identity (THIS TAB — single source of truth).
//   Documents = reusable templates       → /configuracoes → aba "Documentos".
//   Receipts  = operational instances    → /atendimentos  → Detalhe do Atendimento.
// This tab MUST NOT manage templates or generate operational receipts.
// ----------------------------------------------------------------------------
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { getLabConfig, loadLabConfigFromDb, saveLabConfig, ensureLabLogoLoaded, clearLabLogoCache } from "@/data/labConfigStore";
import { DEFAULT_WATERMARK, type WatermarkConfig } from "@/lib/watermark";
import { supabase } from "@/integrations/supabase/client";
import EstadoCidadeFields from "@/components/EstadoCidadeFields";
import { Droplets } from "lucide-react";


const formatCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10)
    return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};

/** UF: apenas 2 letras maiúsculas. */
const formatUf = (v: string) => v.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2);
const formatCnes = (v: string) => v.replace(/\D/g, "").slice(0, 7);
const formatConselho = (v: string) => v.replace(/[^A-Za-zÇçÃãÕõ]/g, "").toUpperCase().slice(0, 6);
const formatRtNumero = (v: string) => v.replace(/\D/g, "").slice(0, 8);

const UFS_VALIDAS = new Set([
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI",
  "RJ","RN","RS","RO","RR","SC","SP","SE","TO",
]);

const CONSELHOS_VALIDOS = new Set(["CRBM","CRF","CRM","CRBIO","CRO","CRN","CRBQ"]);

function validarCnpj(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((s, n, i) => s + Number(n) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const dv1 = calc(d.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]);
  const dv2 = calc(d.slice(0, 13), [6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return dv1 === Number(d[12]) && dv2 === Number(d[13]);
}

const inputClass =
  "w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all";
const inputErrorClass =
  "w-full px-3.5 py-2.5 bg-background border border-destructive/60 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/20 focus:border-destructive transition-all";
const labelClass =
  "text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block";
const errorMsgClass =
  "flex items-center gap-1.5 mt-1.5 text-[11px] text-destructive font-medium";

const LaboratorioTab = () => {
  const initial = getLabConfig();
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.logo);
  const [logoKey, setLogoKey] = useState<string | null>(initial.logoKey);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [watermark, setWatermark] = useState<WatermarkConfig>(initial.watermark ?? { ...DEFAULT_WATERMARK });
  const [uploadingWatermark, setUploadingWatermark] = useState(false);
  const [form, setForm] = useState({
    nome: initial.nome,
    cnpj: initial.cnpj,
    telefone: initial.telefone,
    email: initial.email,
    estado: initial.estado,
    cidade: initial.cidade,
    endereco: initial.endereco,
    razaoSocial: initial.razaoSocial,
    inscricaoMunicipal: initial.inscricaoMunicipal,
    cnes: initial.cnes,
    responsavelTecnico: initial.responsavelTecnico,
    responsavelTecnicoConselho: initial.responsavelTecnicoConselho,
    responsavelTecnicoNumero: initial.responsavelTecnicoNumero,
    responsavelTecnicoUf: initial.responsavelTecnicoUf,
  });

  // Hidrata o formulário a partir do banco ao montar — garante que o usuário
  // sempre veja a versão mais recente, mesmo após login em outro navegador.
  useEffect(() => {
    let cancelled = false;
    loadLabConfigFromDb().then(async (fresh) => {
      if (cancelled) return;
      setForm({
        nome: fresh.nome,
        cnpj: fresh.cnpj,
        telefone: fresh.telefone,
        email: fresh.email,
        estado: fresh.estado,
        cidade: fresh.cidade,
        endereco: fresh.endereco,
        razaoSocial: fresh.razaoSocial,
        inscricaoMunicipal: fresh.inscricaoMunicipal,
        cnes: fresh.cnes,
        responsavelTecnico: fresh.responsavelTecnico,
        responsavelTecnicoConselho: fresh.responsavelTecnicoConselho,
        responsavelTecnicoNumero: fresh.responsavelTecnicoNumero,
        responsavelTecnicoUf: fresh.responsavelTecnicoUf,
      });
      setLogoKey(fresh.logoKey);
      setWatermark(fresh.watermark ?? { ...DEFAULT_WATERMARK });
      if (fresh.logoKey && !fresh.logo) {
        const dataUrl = await ensureLabLogoLoaded();
        if (!cancelled) setLogoPreview(dataUrl ?? null);
      } else {
        setLogoPreview(fresh.logo);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  /** Validação completa antes de salvar. Retorna mapa de erros. */
  const validar = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = "Informe o nome do laboratório.";
    if (form.cnpj && !validarCnpj(form.cnpj)) e.cnpj = "CNPJ inválido.";
    if (form.cnes && form.cnes.length !== 7) e.cnes = "CNES deve ter 7 dígitos.";
    if (form.responsavelTecnicoUf && !UFS_VALIDAS.has(form.responsavelTecnicoUf))
      e.responsavelTecnicoUf = "UF inválida (ex: GO, SP).";
    if (form.estado && form.estado.length !== 2)
      e.estado = "UF deve ter 2 letras.";
    // RT é tudo-ou-nada: se preencheu qualquer campo, exige os demais
    const rtCampos = [
      form.responsavelTecnico,
      form.responsavelTecnicoConselho,
      form.responsavelTecnicoNumero,
      form.responsavelTecnicoUf,
    ];
    const algumPreenchido = rtCampos.some((v) => v.trim());
    const todosPreenchidos = rtCampos.every((v) => v.trim());
    if (algumPreenchido && !todosPreenchidos) {
      if (!form.responsavelTecnico.trim())
        e.responsavelTecnico = "Obrigatório quando há RT cadastrado.";
      if (!form.responsavelTecnicoConselho.trim())
        e.responsavelTecnicoConselho = "Informe o conselho.";
      if (!form.responsavelTecnicoNumero.trim())
        e.responsavelTecnicoNumero = "Informe o número.";
      if (!form.responsavelTecnicoUf.trim())
        e.responsavelTecnicoUf = "Informe a UF.";
    }
    if (
      form.responsavelTecnicoConselho &&
      !CONSELHOS_VALIDOS.has(form.responsavelTecnicoConselho)
    ) {
      e.responsavelTecnicoConselho = "Conselho inválido (CRBM, CRF, CRM…).";
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Email inválido.";
    return e;
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "Máximo de 2MB.",
        variant: "destructive",
      });
      return;
    }
    setUploadingLogo(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error("Falha ao ler arquivo"));
        r.readAsDataURL(file);
      });
      const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
      const { data, error } = await supabase.functions.invoke("upload-image", {
        body: {
          category: "logo",
          contentType: file.type,
          dataBase64: base64,
          filename: file.name || "logo.png",
        },
      });
      if (error || !data?.ok) throw new Error(error?.message || data?.error || "Falha no upload");
      setLogoKey(data.key);
      setLogoPreview(dataUrl);
      clearLabLogoCache();
      toast({ title: "Logo enviado", description: "Imagem armazenada com segurança." });
    } catch (err) {
      toast({
        title: "Erro no upload",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  };

  const handleLogoRemove = async () => {
    setUploadingLogo(true);
    try {
      const { data, error } = await supabase.functions.invoke("upload-image", {
        body: { category: "logo", remove: true },
      });
      if (error || !data?.ok) throw new Error(error?.message || data?.error || "Falha ao remover");
      setLogoKey(null);
      setLogoPreview(null);
      clearLabLogoCache();
    } catch (err) {
      toast({
        title: "Erro ao remover",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    const e = validar();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast({
        title: "Verifique os campos destacados",
        description: `${Object.keys(e).length} erro(s) impedem o salvamento.`,
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      // Logo já foi persistido via edge function; aqui só salvamos campos textuais.
      // Mantemos logoPreview como fallback inline para clientes legados.
      await saveLabConfig({ ...form, logo: logoKey ? null : logoPreview, logoKey, watermark });
      toast({ title: "Configurações salvas", description: "Dados persistidos no banco." });
    } catch (err) {
      toast({
        title: "Erro ao salvar",
        description: err instanceof Error ? err.message : "Não foi possível persistir no banco.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const fresh = getLabConfig();
    setForm({
      nome: fresh.nome,
      cnpj: fresh.cnpj,
      telefone: fresh.telefone,
      email: fresh.email,
      estado: fresh.estado,
      cidade: fresh.cidade,
      endereco: fresh.endereco,
      razaoSocial: fresh.razaoSocial,
      inscricaoMunicipal: fresh.inscricaoMunicipal,
      cnes: fresh.cnes,
      responsavelTecnico: fresh.responsavelTecnico,
      responsavelTecnicoConselho: fresh.responsavelTecnicoConselho,
      responsavelTecnicoNumero: fresh.responsavelTecnicoNumero,
      responsavelTecnicoUf: fresh.responsavelTecnicoUf,
    });
    setLogoPreview(fresh.logo);
    setLogoKey(fresh.logoKey);
    setErrors({});
  };

  /** Helper para classe + mensagem. */
  const fieldCls = (k: string) => (errors[k] ? inputErrorClass : inputClass);
  const FieldError = ({ k }: { k: string }) =>
    errors[k] ? (
      <p className={errorMsgClass}>
        <AlertCircle className="h-3 w-3" /> {errors[k]}
      </p>
    ) : null;

  const hasRtData =
    !!form.responsavelTecnico.trim() ||
    !!form.responsavelTecnicoConselho.trim() ||
    !!form.responsavelTecnicoNumero.trim() ||
    !!form.responsavelTecnicoUf.trim();

  return (
    <div className="space-y-6 pb-28 animate-in fade-in duration-300">
      {/* ─── Hero identitário ───────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/5 via-card to-transparent">
        <div className="p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="relative shrink-0">
            <div className="h-24 w-24 rounded-2xl bg-card border border-border/60 shadow-sm flex items-center justify-center overflow-hidden">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo do laboratório" className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-7 w-7 text-muted-foreground/40" />
              )}
            </div>
            <label
              htmlFor="lab-logo-input"
              className={`absolute -bottom-2 -right-2 h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:opacity-90 transition-all ${uploadingLogo ? "cursor-wait opacity-60 pointer-events-none" : "cursor-pointer"}`}
              title="Trocar logo"
            >
              <Upload className="h-4 w-4" />
              <input
                id="lab-logo-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={uploadingLogo}
              />
            </label>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Identidade do laboratório</p>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mt-1 truncate">
              {form.nome || "Seu laboratório"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-xl">
              Dados gerais e identidade visual exibidos em laudos, comprovantes e no portal do paciente.
            </p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-[11px] text-muted-foreground">
                PNG, JPG ou WEBP até 2MB
              </span>
              {(logoPreview || logoKey) && (
                <button
                  type="button"
                  onClick={handleLogoRemove}
                  disabled={uploadingLogo}
                  className="text-[11px] font-medium text-destructive hover:underline disabled:opacity-50"
                >
                  Remover logo
                </button>
              )}
              {uploadingLogo && (
                <span className="text-[11px] font-medium text-primary">Enviando…</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Bloco: Contato & localização ──────────────────── */}
      <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <header className="px-6 pt-5 pb-4 flex items-center gap-3 border-b border-border/40">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Dados de contato</h3>
            <p className="text-[11px] text-muted-foreground">Nome fantasia, telefone e endereço operacional</p>
          </div>
        </header>
        <div className="p-6 space-y-5">
          <div>
            <label className={labelClass}>Nome do laboratório *</label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => updateField("nome", e.target.value)}
              placeholder="Ex: Lab Cactus"
              className={fieldCls("nome")}
            />
            <FieldError k="nome" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}><Phone className="inline h-3 w-3 mr-1" />Telefone</label>
              <input
                type="text"
                value={form.telefone}
                onChange={(e) => updateField("telefone", formatPhone(e.target.value))}
                placeholder="(99) 9 9999-9999"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}><Mail className="inline h-3 w-3 mr-1" />Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="contato@lab.com"
                className={fieldCls("email")}
              />
              <FieldError k="email" />
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Endereço</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <EstadoCidadeFields
                estado={form.estado}
                cidade={form.cidade}
                onChange={({ estado, cidade }) => setForm((prev) => ({ ...prev, estado, cidade }))}
                inputClassName={inputClass}
                labelClassName={labelClass}
                cidadeWrapperClassName="sm:col-span-2"
              />
            </div>
            <div>
              <label className={labelClass}>Logradouro</label>
              <input
                type="text"
                value={form.endereco}
                onChange={(e) => updateField("endereco", e.target.value)}
                placeholder="Rua, nº, Bairro"
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Bloco: Documentos legais ───────────────────────── */}
      <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <header className="px-6 pt-5 pb-4 flex items-center gap-3 border-b border-border/40">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Documentos legais</h3>
            <p className="text-[11px] text-muted-foreground">
              Impressos em comprovantes, declarações e laudos — atendem à RDC ANVISA 302/2005
            </p>
          </div>
        </header>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}><IdCard className="inline h-3 w-3 mr-1" />CNPJ</label>
              <input
                type="text"
                value={form.cnpj}
                onChange={(e) => updateField("cnpj", formatCNPJ(e.target.value))}
                placeholder="00.000.000/0000-00"
                className={fieldCls("cnpj")}
              />
              <FieldError k="cnpj" />
            </div>
            <div>
              <label className={labelClass}>Razão social</label>
              <input
                type="text"
                value={form.razaoSocial}
                onChange={(e) => updateField("razaoSocial", e.target.value)}
                placeholder="Ex: Lab Cactus Análises Clínicas Ltda."
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Inscrição municipal</label>
              <input
                type="text"
                value={form.inscricaoMunicipal}
                onChange={(e) => updateField("inscricaoMunicipal", e.target.value)}
                placeholder="0000000-0"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>CNES</label>
              <input
                type="text"
                value={form.cnes}
                onChange={(e) => updateField("cnes", formatCnes(e.target.value))}
                placeholder="0000000"
                className={fieldCls("cnes")}
                inputMode="numeric"
              />
              <FieldError k="cnes" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Bloco: Responsável técnico ─────────────────────── */}
      <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <header className="px-6 pt-5 pb-4 flex items-center justify-between gap-3 border-b border-border/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Stethoscope className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground">Responsável técnico (RT)</h3>
              <p className="text-[11px] text-muted-foreground">
                Profissional habilitado pelo conselho regulador da bioanálise
              </p>
            </div>
          </div>
          {hasRtData && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-1 rounded-md">
              <ShieldCheck className="h-3 w-3" /> Cadastrado
            </span>
          )}
        </header>
        <div className="p-6 space-y-4">
          <div>
            <label className={labelClass}>Nome completo</label>
            <input
              type="text"
              value={form.responsavelTecnico}
              onChange={(e) => updateField("responsavelTecnico", e.target.value)}
              placeholder="Nome completo do RT"
              className={fieldCls("responsavelTecnico")}
            />
            <FieldError k="responsavelTecnico" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Conselho</label>
              <input
                type="text"
                value={form.responsavelTecnicoConselho}
                onChange={(e) =>
                  updateField("responsavelTecnicoConselho", formatConselho(e.target.value))
                }
                placeholder="CRBM"
                className={fieldCls("responsavelTecnicoConselho")}
              />
              <FieldError k="responsavelTecnicoConselho" />
            </div>
            <div>
              <label className={labelClass}>Nº registro</label>
              <input
                type="text"
                value={form.responsavelTecnicoNumero}
                onChange={(e) => updateField("responsavelTecnicoNumero", formatRtNumero(e.target.value))}
                placeholder="00000"
                className={fieldCls("responsavelTecnicoNumero")}
                inputMode="numeric"
              />
              <FieldError k="responsavelTecnicoNumero" />
            </div>
            <div>
              <label className={labelClass}>UF</label>
              <input
                type="text"
                value={form.responsavelTecnicoUf}
                onChange={(e) =>
                  updateField("responsavelTecnicoUf", formatUf(e.target.value))
                }
                placeholder="GO"
                className={fieldCls("responsavelTecnicoUf")}
              />
              <FieldError k="responsavelTecnicoUf" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Barra de ações fixa ───────────────────────────── */}
      <div className="sticky bottom-4 z-10 mt-2">
        <div className="rounded-2xl border border-border/60 bg-card/95 backdrop-blur shadow-lg p-3 sm:p-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground px-2 hidden sm:block">
            As alterações são aplicadas em laudos e comprovantes imediatamente após salvar.
          </p>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              className="rounded-xl h-10 px-5 flex-1 sm:flex-initial"
              onClick={handleReset}
              disabled={saving}
            >
              Descartar
            </Button>
            <Button
              className="rounded-xl h-10 px-6 flex-1 sm:flex-initial"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LaboratorioTab;
