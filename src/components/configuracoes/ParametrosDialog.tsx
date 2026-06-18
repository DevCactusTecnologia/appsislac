import { useState, useEffect, useMemo } from "react";
import {
  Settings2, Eye, EyeOff, Save, Trash2, GripVertical, Wand2, Plus, X,
  Sparkles, AlertOctagon, Search, Type, Hash, ListChecks, Sigma, Tag,
  KeyRound, ChevronDown, FlaskConical, Asterisk,
} from "lucide-react";
import StandardDialog from "@/components/ui/standard-dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  ExameParametro,
  ParametroTipo,
  loadParametros,
  getParametros,
  subscribeParametros,
  addParametro,
  updateParametro,
  removeParametro,
  reorderParametros,
  isChaveDuplicada,
} from "@/data/exameParametrosStore";
import { slugifyChave } from "@/lib/laudoTemplate";

const tiposComponente: { value: ParametroTipo; label: string; desc: string; icon: typeof Type }[] = [
  { value: "Texto", label: "Texto", desc: "Entrada livre", icon: Type },
  { value: "Número", label: "Número", desc: "Inteiro / decimal", icon: Hash },
  { value: "Select", label: "Lista", desc: "Opções fixas", icon: ListChecks },
  { value: "Formula", label: "Fórmula", desc: "Cálculo automático", icon: Sigma },
];

const tipoIcon = (t: ParametroTipo) => tiposComponente.find((x) => x.value === t)?.icon ?? Type;

interface ParametrosDialogProps {
  open: boolean;
  onClose: () => void;
  exameId?: string;
  exameNome?: string;
  defaultMaximized?: boolean;
}

const ParametrosDialog = ({ open, onClose, exameId, exameNome, defaultMaximized = true }: ParametrosDialogProps) => {
  const { toast } = useToast();
  const [parametros, setParametros] = useState<ExameParametro[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tipoSelecionado, setTipoSelecionado] = useState<ParametroTipo>("Texto");
  const [rotulo, setRotulo] = useState("");
  const [chave, setChave] = useState("");
  const [chaveAutoGen, setChaveAutoGen] = useState(true);
  const [abreviacao, setAbreviacao] = useState("");
  const [qtdCaracteres, setQtdCaracteres] = useState("");
  const [chaveApoio, setChaveApoio] = useState("");
  const [exibirAnterior, setExibirAnterior] = useState(false);
  const [exibirMapa, setExibirMapa] = useState(false);
  const [obrigatorio, setObrigatorio] = useState(false);
  const [valorReferencia, setValorReferencia] = useState("");
  const [opcoesSelect, setOpcoesSelect] = useState<string[]>([]);
  const [novaOpcao, setNovaOpcao] = useState("");
  const [casasDecimais, setCasasDecimais] = useState<number>(2);
  const [criticoMin, setCriticoMin] = useState<string>("");
  const [criticoMax, setCriticoMax] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!open || !exameId) return;
    loadParametros(exameId).then(setParametros);
    return subscribeParametros(exameId, () => setParametros([...getParametros(exameId)]));
  }, [open, exameId]);

  useEffect(() => {
    if (chaveAutoGen) setChave(slugifyChave(rotulo));
  }, [rotulo, chaveAutoGen]);

  const resetForm = () => {
    setSelectedId(null); setRotulo(""); setChave(""); setChaveAutoGen(true);
    setAbreviacao(""); setQtdCaracteres(""); setChaveApoio("");
    setExibirAnterior(false); setExibirMapa(false); setObrigatorio(false);
    setValorReferencia(""); setOpcoesSelect([]); setNovaOpcao("");
    setCasasDecimais(2);
    setCriticoMin(""); setCriticoMax("");
    setTipoSelecionado("Texto");
  };

  const selectParametro = (p: ExameParametro) => {
    setSelectedId(p.id); setTipoSelecionado(p.tipo);
    setRotulo(p.rotulo); setChave(p.chave); setChaveAutoGen(false);
    setAbreviacao(p.abreviacao); setQtdCaracteres(p.qtdCaracteres);
    setChaveApoio(p.chaveApoio);
    setExibirAnterior(p.exibirAnterior === "SIM");
    setExibirMapa(p.exibirMapa === "SIM");
    setObrigatorio(p.obrigatorio === "SIM");
    setValorReferencia(p.valorReferencia);
    const opcoesUpper = (p.opcoesSelect ?? []).map((o) => o.toUpperCase());
    setOpcoesSelect(opcoesUpper);
    setNovaOpcao(opcoesUpper.join(", "));
    setCasasDecimais(typeof p.casasDecimais === "number" ? p.casasDecimais : 2);
    setCriticoMin(p.criticoMin ?? "");
    setCriticoMax(p.criticoMax ?? "");
  };

  const chaveJaUsada = useMemo(
    () => exameId && chave ? isChaveDuplicada(exameId, chave, selectedId ?? undefined) : false,
    [exameId, chave, selectedId, parametros],
  );

  const handleSave = async () => {
    if (!exameId) return;
    if (!rotulo.trim() || !chave.trim() || !abreviacao.trim()) {
      toast({ title: "Campos obrigatórios", description: "Preencha rótulo, chave e abreviação.", variant: "destructive" });
      return;
    }
    if (chaveJaUsada) {
      toast({ title: "Chave duplicada", description: "Já existe outro parâmetro com esta chave.", variant: "destructive" });
      return;
    }
    if (tipoSelecionado === "Select" && opcoesSelect.length === 0) {
      toast({ title: "Opções obrigatórias", description: "Adicione ao menos uma opção para o tipo Select.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      tipo: tipoSelecionado, rotulo, chave: chave.toUpperCase(), abreviacao,
      qtdCaracteres, chaveApoio,
      exibirAnterior: exibirAnterior ? "SIM" : "NAO",
      exibirMapa: exibirMapa ? "SIM" : "NAO",
      obrigatorio: obrigatorio ? "SIM" : "NAO",
      valorReferencia,
      visivel: true,
      ordem: selectedId ? (parametros.find((p) => p.id === selectedId)?.ordem ?? parametros.length) : parametros.length,
      opcoesSelect,
      casasDecimais: (tipoSelecionado === "Número" || tipoSelecionado === "Formula") ? casasDecimais : 0,
      criticoMin: (tipoSelecionado === "Número" || tipoSelecionado === "Formula") ? criticoMin.trim() : "",
      criticoMax: (tipoSelecionado === "Número" || tipoSelecionado === "Formula") ? criticoMax.trim() : "",
    };
    let ok = false;
    if (selectedId) ok = await updateParametro(selectedId, exameId, payload);
    else { const novo = await addParametro(exameId, payload); ok = !!novo; }
    setSaving(false);
    if (ok) {
      toast({ title: selectedId ? "Parâmetro atualizado" : "Parâmetro criado" });
      resetForm();
    } else {
      toast({ title: "Erro ao salvar", description: "Verifique sua permissão ou se a chave já existe.", variant: "destructive" });
    }
  };

  const handleRemover = async () => {
    if (!selectedId || !exameId) return;
    const ok = await removeParametro(selectedId, exameId);
    if (ok) { toast({ title: "Parâmetro removido" }); resetForm(); }
    else toast({ title: "Erro ao remover", variant: "destructive" });
  };

  const toggleVisivel = async (p: ExameParametro) => {
    if (!exameId) return;
    await updateParametro(p.id, exameId, { visivel: !p.visivel });
  };

  const handleDragStart = (id: number) => setDragId(id);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = async (targetId: number) => {
    if (!exameId || !dragId || dragId === targetId) { setDragId(null); return; }
    const lista = [...parametros];
    const fromIdx = lista.findIndex((p) => p.id === dragId);
    const toIdx = lista.findIndex((p) => p.id === targetId);
    if (fromIdx === -1 || toIdx === -1) { setDragId(null); return; }
    const [moved] = lista.splice(fromIdx, 1);
    lista.splice(toIdx, 0, moved);
    const ordered = lista.map((p, i) => ({ id: p.id, ordem: i }));
    setParametros(lista.map((p, i) => ({ ...p, ordem: i })));
    setDragId(null);
    const ok = await reorderParametros(exameId, ordered);
    if (!ok) toast({ title: "Erro ao reordenar", variant: "destructive" });
  };

  const removeOpcao = (v: string) => {
    const novas = opcoesSelect.filter((o) => o !== v);
    setOpcoesSelect(novas);
    setNovaOpcao(novas.join(", "));
  };

  const handleOpcoesTextChange = (texto: string) => {
    setNovaOpcao(texto);
    const partes = texto
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);
    const unicas: string[] = [];
    for (const p of partes) if (!unicas.includes(p)) unicas.push(p);
    setOpcoesSelect(unicas);
  };

  // Design system tokens — alinhados ao FiltrosDialog (Valores de referência)
  const inputBase = "w-full h-10 px-3 bg-background border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200";
  const inputClass = `${inputBase} border-border/60 focus:border-primary/50`;
  const inputErrClass = `${inputBase} border-destructive/60 bg-destructive/5 focus:border-destructive focus:ring-destructive/20`;
  const textareaClass = "w-full px-3 py-2.5 bg-background border border-border/60 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all duration-200 resize-none";
  const labelClass = "text-[12px] font-medium text-foreground/80 mb-1.5 flex items-center gap-1";
  const sectionTitle = "text-[11px] font-semibold text-muted-foreground uppercase tracking-wider";

  const chavesDisponiveis = parametros.filter((p) => p.id !== selectedId && p.chave).map((p) => p.chave);

  const parametrosFiltrados = useMemo(() => {
    if (!busca.trim()) return parametros;
    const q = busca.trim().toLowerCase();
    return parametros.filter((p) =>
      p.rotulo.toLowerCase().includes(q) ||
      p.chave.toLowerCase().includes(q) ||
      p.abreviacao.toLowerCase().includes(q)
    );
  }, [parametros, busca]);

  const headerActions = (
    <button
      onClick={resetForm}
      className="h-9 px-3 rounded-xl border border-border/60 bg-muted/30 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all duration-200 flex items-center gap-1.5"
    >
      <Plus className="h-3.5 w-3.5" /> Novo parâmetro
    </button>
  );

  const footer = (
    <>
      {selectedId && (
        <button
          onClick={handleRemover}
          className="h-10 px-4 rounded-xl border border-destructive/30 text-destructive text-[13px] font-medium flex items-center gap-2 hover:bg-destructive/10 transition-all duration-200 mr-auto"
        >
          <Trash2 className="h-3.5 w-3.5" /> Remover
        </button>
      )}
      <button
        onClick={onClose}
        className="h-10 px-4 rounded-xl border border-border/60 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all duration-200"
      >
        Fechar
      </button>
      <button
        onClick={handleSave}
        disabled={saving || !exameId || !!chaveJaUsada}
        className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
      >
        <Save className="h-4 w-4" /> {saving ? "Salvando..." : selectedId ? "Atualizar" : "Adicionar"}
      </button>
    </>
  );

  const totalVisiveis = parametros.filter((p) => p.visivel).length;
  const totalObrigatorios = parametros.filter((p) => p.obrigatorio === "SIM").length;

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      icon={<Settings2 className="h-5 w-5 text-primary" />}
      title="Parâmetros do exame"
      subtitle={exameNome || "Defina os campos de resultado"}
      headerActions={headerActions}
      footer={footer}
      maxWidth="7xl"
      allowMaximize={true}
      defaultMaximized={defaultMaximized}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] h-full min-h-[600px]">
        {/* LEFT: List panel */}
        <aside className="border-r border-border/60 bg-muted/20 flex flex-col">
          {/* Search + stats */}
          <div className="p-4 border-b border-border/60 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar parâmetro..."
                className={`${inputBase} pl-9 border-border bg-background focus:border-primary/50`}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Total" value={parametros.length} />
              <Stat label="Visíveis" value={totalVisiveis} />
              <Stat label="Obrig." value={totalObrigatorios} />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2">
            {parametros.length === 0 ? (
              <EmptyState onCreate={resetForm} />
            ) : parametrosFiltrados.length === 0 ? (
              <div className="p-8 text-center text-[12px] text-muted-foreground">
                Nenhum parâmetro encontrado para "{busca}".
              </div>
            ) : (
              <ul className="space-y-1">
                {parametrosFiltrados.map((p) => {
                  const Icon = tipoIcon(p.tipo);
                  const isSel = selectedId === p.id;
                  return (
                    <li
                      key={p.id}
                      draggable
                      onDragStart={() => handleDragStart(p.id)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(p.id)}
                      onClick={() => selectParametro(p)}
                      className={`group relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer border transition-all duration-150 ${
                        isSel
                          ? "border-primary/40 bg-primary/5"
                          : "border-transparent hover:bg-background hover:border-border/60"
                      } ${dragId === p.id ? "opacity-40" : ""}`}
                    >
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 cursor-grab active:cursor-grabbing shrink-0" />
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isSel ? "bg-primary/10 text-primary" : "bg-muted/60 text-muted-foreground"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-[13px] font-medium truncate ${isSel ? "text-foreground" : "text-foreground/90"}`}>
                            {p.rotulo || "Sem rótulo"}
                          </p>
                          {p.obrigatorio === "SIM" && (
                            <Asterisk className="h-3 w-3 text-destructive shrink-0" />
                          )}
                        </div>
                        <p className="text-[10.5px] text-muted-foreground font-mono truncate">
                          ##{p.chave}##
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleVisivel(p); }}
                        className={`p-1.5 rounded-md transition-colors shrink-0 ${p.visivel ? "text-foreground/60 hover:bg-muted" : "text-muted-foreground/40 hover:bg-muted"}`}
                        title={p.visivel ? "Visível" : "Oculto"}
                      >
                        {p.visivel ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {parametros.length > 0 && (
            <div className="px-4 py-2 border-t border-border/60 text-[10.5px] text-muted-foreground/70 text-center">
              Arraste para reordenar
            </div>
          )}
        </aside>

        {/* RIGHT: Form */}
        <section className="flex flex-col overflow-y-auto">
          {/* Sticky header */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/60 px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-semibold text-foreground">
                {selectedId ? "Editar parâmetro" : "Novo parâmetro"}
              </h3>
              <p className="text-[11.5px] text-muted-foreground mt-0.5">
                {selectedId ? `ID #${selectedId}` : "Defina como o resultado será preenchido e exibido"}
              </p>
            </div>
            {selectedId && (
              <button
                onClick={resetForm}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> novo
              </button>
            )}
          </div>

          <div className="p-6 space-y-6 max-w-3xl">
            {/* STEP 1 — Type */}
            <FormSection step={1} title="Tipo de campo" desc="Como o usuário irá preencher este resultado.">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {tiposComponente.map((t) => {
                  const Icon = t.icon;
                  const active = tipoSelecionado === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTipoSelecionado(t.value)}
                      className={`p-3 rounded-lg border text-left transition-all duration-150 ${
                        active
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:border-foreground/30 hover:bg-muted/40"
                      }`}
                    >
                      <Icon className={`h-4 w-4 mb-2 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      <p className={`text-[12.5px] font-semibold ${active ? "text-foreground" : "text-foreground/90"}`}>{t.label}</p>
                      <p className="text-[10.5px] text-muted-foreground mt-0.5 truncate">{t.desc}</p>
                    </button>
                  );
                })}
              </div>
            </FormSection>

            {/* STEP 2 — Identification */}
            <FormSection step={2} title="Identificação" desc="Nome humano, abreviação e a chave técnica usada no layout.">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    <Tag className="h-3 w-3 text-muted-foreground" /> Rótulo
                    <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={rotulo}
                    onChange={(e) => setRotulo(e.target.value)}
                    className={inputClass}
                    placeholder="Ex: Hemoglobina"
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Abreviação <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={abreviacao}
                    onChange={(e) => setAbreviacao(e.target.value)}
                    className={inputClass}
                    placeholder="HB"
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  <KeyRound className="h-3 w-3 text-muted-foreground" /> Chave (placeholder)
                  <span className="text-destructive">*</span>
                  {chaveAutoGen && (
                    <span className="ml-1 text-[10px] font-normal text-primary/80 normal-case">auto</span>
                  )}
                </label>
                <input
                  type="text"
                  value={chave}
                  onChange={(e) => { setChave(e.target.value.toUpperCase()); setChaveAutoGen(false); }}
                  className={chaveJaUsada ? inputErrClass : inputClass}
                  placeholder="HEMOGLOBINA"
                />
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-[10.5px] text-muted-foreground">
                    Use no layout como{" "}
                    <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground/80">
                      ##{chave || "CHAVE"}##
                    </code>
                  </p>
                  {chaveJaUsada && (
                    <p className="text-[10.5px] text-destructive font-medium">Já existe</p>
                  )}
                </div>
              </div>
            </FormSection>

            {/* STEP 3 — Type specific */}
            {(tipoSelecionado === "Select" ||
              tipoSelecionado === "Número" ||
              tipoSelecionado === "Formula") && (
              <FormSection
                step={3}
                title="Configuração específica"
                desc="Regras adicionais conforme o tipo escolhido."
              >
                {tipoSelecionado === "Select" && (
                  <div>
                    <label className={labelClass}>
                      Opções da lista <span className="text-destructive">*</span>
                    </label>
                    <textarea
                      value={novaOpcao.toUpperCase()}
                      onChange={(e) => handleOpcoesTextChange(e.target.value)}
                      onBlur={() => setNovaOpcao(opcoesSelect.join(", "))}
                      rows={2}
                      className={`${textareaClass} min-h-[64px]`}
                      placeholder="Ex: Não reagente, Reagente +, Reagente ++, Traços"
                    />
                    <p className="text-[10.5px] text-muted-foreground mt-1.5">
                      Separe por vírgula. A ordem digitada é a ordem exibida.
                    </p>
                    {opcoesSelect.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {opcoesSelect.map((o) => (
                          <span
                            key={o}
                            className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-md bg-muted border border-border text-[11px] font-medium text-foreground/80"
                          >
                            {o.toUpperCase()}
                            <button
                              onClick={() => removeOpcao(o)}
                              className="ml-0.5 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {(tipoSelecionado === "Número" || tipoSelecionado === "Formula") && (
                  <div>
                    <label className={labelClass}>Casas decimais</label>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setCasasDecimais(n)}
                            className={`h-9 w-10 rounded-lg border text-[13px] font-semibold transition-all duration-150 ${
                              casasDecimais === n
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={casasDecimais}
                        onChange={(e) => {
                          const v = Math.max(0, Math.min(10, Number(e.target.value) || 0));
                          setCasasDecimais(v);
                        }}
                        className={`${inputClass} w-20`}
                      />
                      <p className="text-[10.5px] text-muted-foreground">
                        Ex.: <span className="font-mono text-foreground/70">{(1234.56789).toFixed(casasDecimais)}</span>
                      </p>
                    </div>
                  </div>
                )}

                {(tipoSelecionado === "Número" || tipoSelecionado === "Formula") && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/[0.03] p-3.5">
                    <div className="flex items-center gap-2 mb-2.5">
                      <AlertOctagon className="h-3.5 w-3.5 text-destructive" />
                      <span className="text-[11px] font-semibold text-destructive uppercase tracking-wider">
                        Valores críticos / pânico
                      </span>
                    </div>
                    <p className="text-[10.5px] text-muted-foreground mb-3 leading-relaxed">
                      Faixas que disparam alerta para o analista, evitando liberação de erros de
                      equipamento ou valores que ofereçam risco ao paciente.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Crítico baixo (&lt;)</label>
                        <input
                          type="text"
                          value={criticoMin}
                          onChange={(e) => setCriticoMin(e.target.value)}
                          className={inputClass}
                          placeholder="Ex: 2.5"
                          inputMode="decimal"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Crítico alto (&gt;)</label>
                        <input
                          type="text"
                          value={criticoMax}
                          onChange={(e) => setCriticoMax(e.target.value)}
                          className={inputClass}
                          placeholder="Ex: 6.5"
                          inputMode="decimal"
                        />
                      </div>
                    </div>
                    <p className="text-[10.5px] text-muted-foreground/80 mt-2 italic">
                      Deixe em branco para desabilitar o alerta naquele extremo.
                    </p>
                  </div>
                )}

                {tipoSelecionado === "Formula" && chavesDisponiveis.length > 0 && (
                  <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-3.5">
                    <p className="text-[11px] font-semibold text-primary mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                      <Wand2 className="h-3 w-3" /> Inserir chaves
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {chavesDisponiveis.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setValorReferencia((v) => `${v}##${c}##`)}
                          className="text-[10.5px] font-mono px-2 py-1 rounded-md bg-background border border-border text-foreground/80 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
                        >
                          ##{c}##
                        </button>
                      ))}
                    </div>
                    <p className="text-[10.5px] text-muted-foreground mt-2">
                      Ex.: <code className="font-mono">##HCT##/##HEM##</code>
                    </p>
                  </div>
                )}
              </FormSection>
            )}

            {/* STEP 4 — Reference / Formula */}
            <FormSection
              step={tipoSelecionado === "Texto" ? 3 : 4}
              title={tipoSelecionado === "Formula" ? "Fórmula" : "Valor de referência"}
              desc={
                tipoSelecionado === "Formula"
                  ? "Expressão que será calculada automaticamente."
                  : "Texto descritivo exibido junto ao resultado."
              }
            >
              <textarea
                value={valorReferencia}
                onChange={(e) => setValorReferencia(e.target.value)}
                rows={2}
                className={`${textareaClass} ${tipoSelecionado === "Formula" ? "font-mono" : ""}`}
                placeholder={
                  tipoSelecionado === "Formula"
                    ? "##CHAVE1##*0.5+##CHAVE2##"
                    : "Ex: 12.0 a 16.0 g/dL"
                }
              />
            </FormSection>

            {/* STEP 5 — Behavior */}
            <FormSection
              step={tipoSelecionado === "Texto" ? 4 : 5}
              title="Comportamento"
              desc="Como este parâmetro se comporta no atendimento e na bancada."
            >
              <div className="rounded-lg border border-border bg-background divide-y divide-border/60 overflow-hidden">
                {[
                  { label: "Obrigatório", desc: "Não é possível liberar resultado sem preencher", value: obrigatorio, set: setObrigatorio },
                  { label: "Exibir resultado anterior", desc: "Mostra o último valor registrado deste paciente", value: exibirAnterior, set: setExibirAnterior },
                  { label: "Exibir no mapa de trabalho", desc: "Aparece na grade de análise da bancada", value: exibirMapa, set: setExibirMapa },
                ].map((t) => (
                  <div key={t.label} className="flex items-center justify-between gap-3 px-3.5 py-3 hover:bg-muted/30 transition-colors">
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-medium text-foreground">{t.label}</p>
                      <p className="text-[10.5px] text-muted-foreground">{t.desc}</p>
                    </div>
                    <Switch checked={t.value} onCheckedChange={t.set} />
                  </div>
                ))}
              </div>
            </FormSection>

            {/* Advanced */}
            <details className="group rounded-lg border border-border bg-background overflow-hidden">
              <summary className="px-3.5 py-2.5 text-[12px] font-semibold text-foreground/80 cursor-pointer select-none hover:bg-muted/30 transition-colors flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
                  Avançado
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-3.5 pb-3.5 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border/60">
                <div>
                  <label className={labelClass}>Qtd. caracteres</label>
                  <input
                    type="text"
                    value={qtdCaracteres}
                    onChange={(e) => setQtdCaracteres(e.target.value)}
                    className={inputClass}
                    placeholder="—"
                  />
                </div>
                <div>
                  <label className={labelClass}>Chave Apoio</label>
                  <input
                    type="text"
                    value={chaveApoio}
                    onChange={(e) => setChaveApoio(e.target.value)}
                    className={inputClass}
                    placeholder="lab integrado"
                  />
                </div>
              </div>
            </details>
          </div>
        </section>
      </div>
    </StandardDialog>
  );
};

/* ---------- subcomponents ---------- */

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-lg bg-background border border-border/60 px-2 py-1.5 text-center">
    <p className="text-[15px] font-semibold text-foreground leading-none">{value}</p>
    <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{label}</p>
  </div>
);

const EmptyState = ({ onCreate }: { onCreate: () => void }) => (
  <div className="py-10 px-4 text-center">
    <div className="h-12 w-12 rounded-xl bg-primary/10 mx-auto flex items-center justify-center mb-3">
      <Sparkles className="h-5 w-5 text-primary" />
    </div>
    <p className="text-[13px] font-medium text-foreground mb-1">Nenhum parâmetro</p>
    <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
      Comece criando o primeiro campo de resultado para este exame.
    </p>
    <button
      onClick={onCreate}
      className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
    >
      <Plus className="h-3.5 w-3.5" /> Criar primeiro
    </button>
  </div>
);

const FormSection = ({
  step, title, desc, children,
}: { step: number; title: string; desc: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <header className="flex items-start gap-3">
      <div className="h-6 w-6 rounded-md bg-muted border border-border flex items-center justify-center text-[11px] font-semibold text-muted-foreground shrink-0">
        {step}
      </div>
      <div className="min-w-0 -mt-0.5">
        <h4 className="text-[13px] font-semibold text-foreground">{title}</h4>
        <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </header>
    <div className="pl-9 space-y-3">{children}</div>
  </section>
);

export default ParametrosDialog;
