// Cadastro / edição de exame — UI cirurgicamente simplificada.
//
// Filosofia: o EXAME é apenas IDENTIDADE OPERACIONAL.
//   - Analítica  → vive em Parâmetros (subdialog)
//   - Layout     → vive em Layouts dinâmicos
//   - Faixas VR  → vive em Valores de Referência
//   - Apoio      → maioria vive nos Drivers/Provider
//   - Snapshot   → continua congelando metodologia/unidade no laudo
//
// Esta UI expõe SOMENTE 3 áreas:
//   1. Identidade   (sempre visível)
//   2. Coleta       (sempre visível)
//   3. Faturamento + Apoio (collapse)
// + Configurações regulatórias (collapse discreto): metodologia/unidade
//   default + flags de exibição no laudo. Tratados como `legacy_default`.
//
// IMPORTANTE: NENHUM campo do banco foi removido. Campos órfãos/avançados
// permanecem no `form` state (inicializados a partir de editData) e são
// salvos normalmente — apenas não aparecem mais na UI principal.
import { useState, useEffect, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  X, FlaskConical, Save, AlertCircle, Zap, Building2, FileText,
  Beaker, ClipboardCheck, Info, ChevronDown, Snowflake, History,
  CheckCircle2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

import { addExameCatalogo, updateExameCatalogo, ExameCatalogo } from "@/data/exameCatalogoStore";
import { getLabsApoioAtivos } from "@/data/labApoioStore";
import {
  loadSetoresCustomizados, subscribeSetoresCustomizados, getSetoresClassificados,
  addSetorCustomizado, isSetorPadrao, resolveSetorIdByNome,
} from "@/data/setoresLaboratoriaisStore";
import { getCurrentTenantId } from "@/data/_tenant";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { sanitizeTuss, validarTuss, PORTES_CBHPM } from "@/lib/regulatorio";
import { showError } from "@/lib/showError";
import {
  MATERIAIS_PADRAO, RECIPIENTES, SEXOS_APLICAVEIS,
  formatCbhpm, validarCbhpm, validarLoinc,
} from "@/lib/laboratorioPadroes";
import { gerarMnemonico, getPresetForSetor } from "@/lib/exameDefaults";
import { Switch } from "@/components/ui/switch";
import ComboboxField from "@/components/configuracoes/_shared/ComboboxField";
import { supabase } from "@/integrations/supabase/client";

type ExameFormData = Omit<ExameCatalogo, "id" | "ativo" | "usadoEmAtendimento" | "codigo" | "analise"> & { id?: string };

interface NovoExameDialogProps {
  open: boolean;
  onClose: () => void;
  editData?: Partial<ExameCatalogo> | null;
}

// Defaults iniciais — alinhados ao schema slim Exames 2.1.
const emptyForm: ExameFormData = {
  nome: "", mnemonico: "", categoria: "", codigoCBHPM: "", codigoTUSS: "",
  material: "", tipoProcesso: "INTERNO", labApoioId: null, integracaoAtiva: false,
  porteCBHPM: "-", codigoLOINC: "", codigoSUS: "", metodologia: "",
  prazoEntregaDias: 1, urgenciaDisponivel: false, prazoUrgenciaHoras: 0,
  recipiente: "", corTampa: "", volumeMinimoMl: 0, estabilidade: "",
  requerJejum: false, horasJejum: 0, preparoPaciente: "",
  grupoEtiquetas: "", quantidadeEtiquetas: 1, informacoesColeta: "",
  sinonimos: "", sexoAplicavel: "AMBOS", exibirPortal: true,
  unidadePadrao: "", requerAssinaturaMedica: true, setorId: null,
  tussSemEquivalente: false,
  providerIntegracao: "", codigoExameApoio: "", permiteEnvioApoio: false,
  exibirMetodologiaLaudo: true, exibirUnidadeLaudo: true, exibirMaterialLaudo: false,
  tags: [],
  // Interface Engine readiness (Sub-fase B) — preparação, sem UI ainda.
  codigoInterfaceamento: "", codigoHL7: "", codigoEquipamento: null,
};

const inputClass = "w-full px-3 py-2.5 bg-muted/30 border border-border/60 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all";
const selectClass = `${inputClass} appearance-none cursor-pointer pr-8`;
const labelClass = "text-[11px] font-medium text-muted-foreground mb-1.5 block";

const ChevronIcon = () => (
  <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
);

function Section({ id, label, icon: Icon, open, onToggle, children, hint }: {
  id: string; label: string; icon: React.ComponentType<{ className?: string }>;
  open: boolean; onToggle: () => void; children: ReactNode; hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
      <button type="button" onClick={onToggle}
        aria-expanded={open} aria-controls={`sec-${id}`}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0 text-left">
            <p className="text-[12px] font-semibold text-foreground truncate">{label}</p>
            {hint && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div id={`sec-${id}`} className="px-4 pb-4 pt-1 space-y-3 border-t border-border/40">{children}</div>}
    </div>
  );
}

function Hint({ text }: { text: string }) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button type="button" tabIndex={-1} aria-label="Ajuda"
          className="inline-flex items-center justify-center align-middle ml-1 text-muted-foreground/60 hover:text-foreground/80 transition-colors">
          <HelpCircle className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-[11px] leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  );
}

function OkCheck() {
  return (
    <p className="mt-1 flex items-center gap-1 text-[10px] text-success">
      <CheckCircle2 className="h-3 w-3" /> Formato válido
    </p>
  );
}

const NovoExameDialog = ({ open, onClose, editData }: NovoExameDialogProps) => {
  const [form, setForm] = useState<ExameFormData>(emptyForm);
  const [setoresVersion, setSetoresVersion] = useState(0);
  const [mnemonicoEdited, setMnemonicoEdited] = useState(false);
  const [usageCount, setUsageCount] = useState<number | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    faturamento: false,
  });
  const labsApoio = getLabsApoioAtivos();

  useEffect(() => {
    if (!open) return;
    void loadSetoresCustomizados();
    const unsub = subscribeSetoresCustomizados(() => setSetoresVersion((v) => v + 1));
    return () => { unsub(); };
  }, [open]);

  const setoresOptions = useMemo(() => {
    void setoresVersion;
    return getSetoresClassificados().map((s) => ({
      value: s.nome, label: s.nome,
      badge: s.origem === "padrao" ? "SBPC/ML" : "Customizado",
      badgeTone: (s.origem === "padrao" ? "primary" : "success") as "primary" | "success",
    }));
  }, [setoresVersion]);

  useEffect(() => {
    if (!open) return;
    setForm(editData ? { ...emptyForm, ...editData } : emptyForm);
    setMnemonicoEdited(!!editData?.mnemonico);
    setOpenSections({ faturamento: false });
    setUsageCount(null);
    if (editData?.id) {
      (async () => {
        try {
          const { count } = await supabase
            .from("atendimento_exames")
            .select("id", { count: "exact", head: true })
            .eq("exame_id", editData.id as string)
            .in("status", ["finalizado", "liberado"]);
          setUsageCount(count ?? 0);
        } catch { setUsageCount(null); }
      })();
    }
  }, [open, editData]);

  const updateField = <K extends keyof ExameFormData>(field: K, value: ExameFormData[K]) => {
    setForm((prev) => {
      let v: ExameFormData[K] = value;
      if (field === "codigoTUSS") v = sanitizeTuss(value as string) as ExameFormData[K];
      if (field === "codigoCBHPM") v = formatCbhpm(value as string) as ExameFormData[K];
      const next = { ...prev, [field]: v } as ExameFormData;

      if (field === "nome" && !editData?.id && !mnemonicoEdited) {
        next.mnemonico = gerarMnemonico(String(v));
      }

      if (field === "categoria" && !editData?.id) {
        const preset = getPresetForSetor(String(v));
        if (preset) {
          if (!next.material && preset.material) next.material = preset.material;
          if (!next.recipiente && preset.recipiente) {
            next.recipiente = preset.recipiente;
            const r = RECIPIENTES.find((x) => x.value === preset.recipiente);
            if (r) next.corTampa = r.cor;
          }
          if (!next.volumeMinimoMl && preset.volumeMinimoMl) next.volumeMinimoMl = preset.volumeMinimoMl;
          if (preset.requerJejum && !next.requerJejum) {
            next.requerJejum = true;
            if (!next.horasJejum) next.horasJejum = preset.horasJejum ?? 8;
          }
          if (!next.grupoEtiquetas && preset.grupoEtiquetas) next.grupoEtiquetas = preset.grupoEtiquetas;
        }
      }

      if (field === "tipoProcesso" && v !== "TERCEIRIZADO") {
        next.labApoioId = null; next.integracaoAtiva = false;
      }
      if (field === "recipiente") {
        const rec = RECIPIENTES.find((r) => r.value === v);
        if (rec) next.corTampa = rec.cor;
      }
      if (field === "requerJejum" && !v) next.horasJejum = 0;
      if (field === "urgenciaDisponivel" && !v) next.prazoUrgenciaHoras = 0;
      return next;
    });
  };

  const tussCheck = useMemo(() => validarTuss(form.codigoTUSS), [form.codigoTUSS]);
  const cbhpmCheck = useMemo(() => validarCbhpm(form.codigoCBHPM), [form.codigoCBHPM]);
  const loincCheck = useMemo(() => validarLoinc(form.codigoLOINC), [form.codigoLOINC]);

  const ensureOpen = (k: string) => setOpenSections((p) => ({ ...p, [k]: true }));

  const handleSave = async () => {
    if (!form.mnemonico.trim()) {
      toast({ title: "Campo obrigatório", description: "Informe o mnemônico do exame.", variant: "destructive" }); return;
    }
    if (!form.nome.trim()) {
      toast({ title: "Campo obrigatório", description: "Informe o nome do exame.", variant: "destructive" }); return;
    }
    if (!form.categoria.trim()) {
      toast({ title: "Setor obrigatório", description: "Selecione ou crie o setor laboratorial do exame.", variant: "destructive" });
      return;
    }
    if (form.tipoProcesso === "TERCEIRIZADO" && !form.labApoioId) {
      toast({ title: "Campo obrigatório", description: "Selecione o laboratório de apoio.", variant: "destructive" });
      ensureOpen("faturamento"); return;
    }
    if (!tussCheck.ok) { toast({ title: "TUSS inválido", description: tussCheck.mensagem, variant: "destructive" }); ensureOpen("faturamento"); return; }
    if (!cbhpmCheck.ok) { toast({ title: "CBHPM inválido", description: cbhpmCheck.mensagem, variant: "destructive" }); ensureOpen("faturamento"); return; }
    if (!loincCheck.ok) { toast({ title: "LOINC inválido", description: loincCheck.mensagem, variant: "destructive" }); ensureOpen("faturamento"); return; }

    const analise = form.tipoProcesso === "TERCEIRIZADO" && form.labApoioId ? form.labApoioId : "INTERNA";
    const payload = {
      ...form,
      categoria: form.categoria || "GERAL",
      material: form.material || "Soro",
      codigo: form.codigoCBHPM || form.codigoTUSS || form.mnemonico,
      analise,
      labApoioId: form.tipoProcesso === "TERCEIRIZADO" ? form.labApoioId : null,
      integracaoAtiva: form.tipoProcesso === "TERCEIRIZADO" ? form.integracaoAtiva : false,
    };

    const setor = form.categoria.trim();
    if (setor && !isSetorPadrao(setor)) {
      try {
        const tenantId = await getCurrentTenantId();
        await addSetorCustomizado(setor, tenantId);
      } catch (e) { showError(e, { scope: "NovoExameDialog.setorCustomizado", silent: true }); }
    }
    try {
      payload.setorId = setor ? await resolveSetorIdByNome(setor) : null;
    } catch (e) {
      showError(e, { scope: "NovoExameDialog.resolveSetorId", silent: true });
      payload.setorId = null;
    }

    if (editData?.id) {
      const ok = await updateExameCatalogo(editData.id, payload);
      if (!ok) { toast({ title: "Erro ao salvar", description: "Não foi possível atualizar o exame.", variant: "destructive" }); return; }
      toast({ title: "Exame atualizado", description: `O exame "${form.mnemonico}" foi salvo com sucesso.` });
    } else {
      const novo = await addExameCatalogo({ ...payload, ativo: true, usadoEmAtendimento: false });
      if (!novo) { toast({ title: "Erro ao cadastrar", description: "Não foi possível criar o exame.", variant: "destructive" }); return; }
      toast({ title: "Exame cadastrado", description: `O exame "${form.mnemonico}" foi salvo. Defina o preço em Tabelas de Preço quando necessário.` });
    }
    onClose();
  };

  useBodyScrollLock(open);
  if (!open) return null;

  const showHistoricoBanner = !!editData?.id && (usageCount ?? 0) > 0;

  return createPortal((
    <TooltipProvider delayDuration={150}>
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] flex flex-col bg-card rounded-3xl border border-border shadow-[0_24px_80px_-12px_hsl(var(--foreground)/0.18)] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-primary/8 flex items-center justify-center shrink-0">
              <FlaskConical className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-foreground tracking-tight truncate">
                {editData?.id ? "Editar exame" : "Novo exame"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Identidade operacional. Parâmetros, layouts e referências ficam nos módulos próprios.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-px bg-border/50" />

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {showHistoricoBanner && (
            <div className="rounded-xl bg-warning/8 border border-warning/25 p-3 flex items-start gap-2">
              <History className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <div className="text-[11px] text-foreground/80 leading-relaxed">
                Este exame já possui <strong>{usageCount}</strong> laudo{usageCount === 1 ? "" : "s"} finalizado{usageCount === 1 ? "" : "s"}.
                Alterações operacionais não afetam laudos antigos — o snapshot regulatório (RDC&nbsp;786/2023) preserva metodologia, unidade e VR históricos.
              </div>
            </div>
          )}

          {/* ===== 1. IDENTIDADE ===== */}
          <div className="rounded-2xl border border-primary/15 bg-primary/[0.03] p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-primary" />
              <h3 className="text-[12px] font-semibold text-foreground">Identidade</h3>
            </div>

            <div>
              <label className={labelClass}>Nome do exame <span className="text-destructive">*</span></label>
              <input type="text" value={form.nome} onChange={(e) => updateField("nome", e.target.value)} className={inputClass} placeholder="Ex.: Hemograma completo" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Mnemônico <span className="text-destructive">*</span></label>
                <input type="text" value={form.mnemonico}
                  onChange={(e) => { setMnemonicoEdited(true); updateField("mnemonico", e.target.value.toUpperCase()); }}
                  className={inputClass} placeholder="Ex.: HMG" />
                {!editData?.id && !mnemonicoEdited && form.mnemonico && (
                  <p className="text-[10px] text-muted-foreground mt-1">Sugerido automaticamente — edite se quiser.</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Setor <span className="text-destructive">*</span></label>
                <ComboboxField
                  value={form.categoria}
                  onChange={(v) => updateField("categoria", v.toUpperCase())}
                  options={setoresOptions}
                  placeholder="Digite para buscar ou criar"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Sexo aplicável</label>
              <div className="relative">
                <select className={selectClass} value={form.sexoAplicavel}
                  onChange={(e) => updateField("sexoAplicavel", e.target.value as ExameFormData["sexoAplicavel"])}>
                  {SEXOS_APLICAVEIS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <ChevronIcon />
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card/60 p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-foreground">Exibir no portal do paciente</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Permite visualização online.</p>
              </div>
              <Switch checked={form.exibirPortal} onCheckedChange={(v) => updateField("exibirPortal", v)} />
            </div>
          </div>

          {/* ===== 2. COLETA ===== */}
          <div className="rounded-2xl border border-border/60 bg-card/40 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Beaker className="h-4 w-4 text-primary" />
              <h3 className="text-[12px] font-semibold text-foreground">Coleta</h3>
            </div>
            <p className="text-[10px] text-muted-foreground -mt-1 mb-1">
              Defaults operacionais de coleta. Layouts e snapshots podem ajustar metodologia, unidade e comportamento científico conforme reagente, método e versão do exame.
            </p>

            <div>
              <label className={labelClass}>Material padrão de coleta</label>
              <ComboboxField
                value={form.material}
                onChange={(v) => updateField("material", v)}
                options={MATERIAIS_PADRAO.map((m) => ({ value: m, label: m }))}
                placeholder="Digite ou selecione"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Tubo padrão de coleta</label>
                <ComboboxField
                  value={form.recipiente}
                  onChange={(v) => updateField("recipiente", v)}
                  options={RECIPIENTES.map((r) => ({ value: r.value, label: r.label, hint: r.cor !== "—" ? r.cor : undefined }))}
                  displayValue={(v) => RECIPIENTES.find((x) => x.value === v)?.label ?? v}
                  placeholder="Digite ou selecione"
                />
                {form.corTampa && form.corTampa !== "—" && (
                  <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1.5">
                    Tampa: <span className="font-medium text-foreground">{form.corTampa}</span>
                    <span className="inline-block h-2.5 w-2.5 rounded-full border border-border/60"
                      style={{ backgroundColor: RECIPIENTES.find((r) => r.value === form.recipiente)?.corHex }} />
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass}>Volume mínimo de coleta (mL)</label>
                <input type="number" step="0.1" min="0" value={form.volumeMinimoMl || ""}
                  onChange={(e) => updateField("volumeMinimoMl", parseFloat(e.target.value) || 0)}
                  className={inputClass} placeholder="2.0" />
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-foreground">Requer jejum</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Marque se o paciente precisa estar em jejum.</p>
                </div>
                <Switch checked={form.requerJejum} onCheckedChange={(v) => updateField("requerJejum", v)} />
              </div>
              {form.requerJejum && (
                <div>
                  <label className={labelClass}>Horas de jejum</label>
                  <input type="number" min="1" max="24" value={form.horasJejum || ""}
                    onChange={(e) => updateField("horasJejum", parseInt(e.target.value) || 0)}
                    className={inputClass} placeholder="8" />
                </div>
              )}
            </div>

            <div>
              <label className={labelClass}>Preparo do paciente</label>
              <textarea value={form.preparoPaciente} onChange={(e) => updateField("preparoPaciente", e.target.value)}
                rows={2} className={`${inputClass} resize-none`} placeholder="Ex.: Suspender medicamentos 48h antes." />
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-foreground">Disponível em urgência</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Permite resultado prioritário.</p>
                </div>
                <Switch checked={form.urgenciaDisponivel} onCheckedChange={(v) => updateField("urgenciaDisponivel", v)} />
              </div>
              {form.urgenciaDisponivel && (
                <div>
                  <label className={labelClass}>Prazo de urgência (horas)</label>
                  <input type="number" min="1" max="72" value={form.prazoUrgenciaHoras || ""}
                    onChange={(e) => updateField("prazoUrgenciaHoras", parseInt(e.target.value) || 0)}
                    className={inputClass} placeholder="2" />
                </div>
              )}
            </div>

            <div>
              <label className={labelClass}>Quantidade de etiquetas</label>
              <input type="number" min="1" max="20" value={form.quantidadeEtiquetas}
                onChange={(e) => updateField("quantidadeEtiquetas", Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                className={inputClass} />
            </div>
          </div>

          {/* ===== 3. FATURAMENTO + APOIO ===== */}
          <Section id="faturamento" label="Faturamento e Apoio"
            hint="Códigos oficiais, processamento interno/terceirizado"
            icon={FileText} open={openSections.faturamento}
            onToggle={() => setOpenSections((p) => ({ ...p, faturamento: !p.faturamento }))}>

            <div className="rounded-xl bg-primary/5 border border-primary/15 p-3 flex items-start gap-2">
              <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-[11px] text-foreground/80">
                Códigos oficiais (ANS, AMB, LOINC, SUS) — essenciais para faturamento e interoperabilidade.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>
                  CBHPM <span className="text-muted-foreground/60 font-normal">(AMB 2020)</span>
                  <Hint text="Código hierárquico de 8 dígitos da AMB 2020. Formato: 0.00.00.00-0." />
                </label>
                <input type="text" value={form.codigoCBHPM}
                  onChange={(e) => updateField("codigoCBHPM", e.target.value)}
                  className={`${inputClass} ${form.codigoCBHPM && !cbhpmCheck.ok ? "border-destructive/60" : ""}`}
                  placeholder="4.03.01.63-09" maxLength={13} />
                {form.codigoCBHPM && !cbhpmCheck.ok && (
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-destructive"><AlertCircle className="h-3 w-3" /> {cbhpmCheck.mensagem}</p>
                )}
                {form.codigoCBHPM && cbhpmCheck.ok && <OkCheck />}
              </div>
              <div>
                <label className={labelClass}>Porte CBHPM</label>
                <ComboboxField value={form.porteCBHPM}
                  onChange={(v) => updateField("porteCBHPM", v)}
                  options={PORTES_CBHPM.map((p) => ({ value: p.value, label: `${p.label} — ${p.descricao}` }))}
                  displayValue={(v) => { const p = PORTES_CBHPM.find((x) => x.value === v); return p ? `${p.label} — ${p.descricao}` : v; }}
                  placeholder="Digite ou selecione" allowCustom={false} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>
                  TUSS <span className="text-muted-foreground/60 font-normal">(8 dígitos)</span>
                  <Hint text="Código TUSS da ANS. Obrigatório para faturamento de convênios." />
                </label>
                <input type="text" inputMode="numeric" maxLength={8} value={form.codigoTUSS}
                  onChange={(e) => updateField("codigoTUSS", sanitizeTuss(e.target.value))}
                  className={`${inputClass} ${form.codigoTUSS && !tussCheck.ok ? "border-destructive/60" : ""}`}
                  placeholder="40301630" autoComplete="off" />
                {form.codigoTUSS && !tussCheck.ok && (
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-destructive"><AlertCircle className="h-3 w-3" /> {tussCheck.mensagem}</p>
                )}
                {form.codigoTUSS && tussCheck.ok && <OkCheck />}
              </div>
              <div>
                <label className={labelClass}>
                  LOINC <span className="text-muted-foreground/60 font-normal">(HL7/FHIR)</span>
                  <Hint text="Código internacional para interoperabilidade clínica (HL7/FHIR). Formato: NNNNN-N." />
                </label>
                <input type="text" value={form.codigoLOINC}
                  onChange={(e) => updateField("codigoLOINC", e.target.value)}
                  className={`${inputClass} ${form.codigoLOINC && !loincCheck.ok ? "border-destructive/60" : ""}`}
                  placeholder="2345-7" maxLength={7} />
                {form.codigoLOINC && !loincCheck.ok && (
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-destructive"><AlertCircle className="h-3 w-3" /> {loincCheck.mensagem}</p>
                )}
                {form.codigoLOINC && loincCheck.ok && <OkCheck />}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>SUS / SIGTAP <span className="text-muted-foreground/60 font-normal">(opcional)</span></label>
                <input type="text" inputMode="numeric" maxLength={10} value={form.codigoSUS}
                  onChange={(e) => updateField("codigoSUS", e.target.value.replace(/\D+/g, ""))}
                  className={inputClass} placeholder="0202010473" />
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-foreground">TUSS sem equivalente</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Sinaliza ausência de código TUSS oficial.</p>
                </div>
                <Switch checked={form.tussSemEquivalente} onCheckedChange={(v) => updateField("tussSemEquivalente", v)} />
              </div>
            </div>

            {/* Processamento */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <h4 className="text-[12px] font-semibold text-foreground">Processamento</h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => updateField("tipoProcesso", "INTERNO")}
                  className={`h-10 rounded-xl text-[12px] font-medium transition-all ${form.tipoProcesso === "INTERNO" ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border/60 text-muted-foreground hover:text-foreground"}`}>Interno</button>
                <button type="button" onClick={() => updateField("tipoProcesso", "TERCEIRIZADO")}
                  className={`h-10 rounded-xl text-[12px] font-medium transition-all ${form.tipoProcesso === "TERCEIRIZADO" ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border/60 text-muted-foreground hover:text-foreground"}`}>Terceirizado</button>
              </div>
              {form.tipoProcesso === "TERCEIRIZADO" && (
                <>
                  <div>
                    <label className={labelClass}>Laboratório de apoio <span className="text-destructive">*</span></label>
                    <div className="relative">
                      <select value={form.labApoioId ?? ""} onChange={(e) => updateField("labApoioId", e.target.value || null)} className={selectClass}>
                        <option value="">Selecione</option>
                        {labsApoio.map((lab) => <option key={lab.id} value={lab.id}>{lab.nome}</option>)}
                      </select>
                      <ChevronIcon />
                    </div>
                    {labsApoio.length === 0 && <p className="text-[10px] text-destructive mt-1">Nenhum laboratório de apoio ativo.</p>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>
                        Provider de integração
                        <Hint text="Driver do apoio que recebe os pedidos. Necessário para envio automático via API." />
                      </label>
                      <ComboboxField
                        value={form.providerIntegracao}
                        onChange={(v) => updateField("providerIntegracao", v.toUpperCase())}
                        options={[
                          { value: "HERMES_PARDINI", label: "Hermes Pardini" },
                          { value: "DASA", label: "DASA" },
                          { value: "FLEURY", label: "Fleury" },
                        ]}
                        placeholder="Selecione ou digite"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        Código no apoio
                        <Hint text="Código que o apoio usa para identificar este exame." />
                      </label>
                      <input type="text" value={form.codigoExameApoio}
                        onChange={(e) => updateField("codigoExameApoio", e.target.value.toUpperCase())}
                        className={inputClass} placeholder="Ex.: HEMOG, GLIC" />
                    </div>
                  </div>
                  <div className="rounded-xl bg-card/60 border border-border/60 p-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <Zap className={`h-4 w-4 mt-0.5 shrink-0 ${form.integracaoAtiva ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-foreground">Integração automática</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {form.integracaoAtiva ? "Envio e retorno automáticos via API." : "Resultado anexado manualmente."}
                        </p>
                      </div>
                    </div>
                    <Switch checked={form.integracaoAtiva} onCheckedChange={(v) => updateField("integracaoAtiva", v)} />
                  </div>
                </>
              )}
            </div>
          </Section>

          {/* Defaults regulatórios (metodologia/unidade) movidos para Layout + Parâmetros + Snapshot.
              Os campos persistem no payload via emptyForm como legacy_default / fallback do regulatorioResolver. */}
        </div>

        <div className="h-px bg-border/50" />

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between gap-3">
          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            <ClipboardCheck className="h-3 w-3" />
            <Snowflake className="h-3 w-3" />
            Fonte oficial do laudo: Layout + Parâmetros + Snapshot regulatório (RDC 786/2023).
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="h-10 px-5 rounded-2xl border border-border/60 bg-background text-[13px] font-medium text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 transition-all">Cancelar</button>
            <button onClick={handleSave} className="h-10 px-5 rounded-2xl bg-primary text-primary-foreground text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-sm">
              <Save className="h-4 w-4" /> Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
    </TooltipProvider>
  ), document.body);
};

export default NovoExameDialog;
