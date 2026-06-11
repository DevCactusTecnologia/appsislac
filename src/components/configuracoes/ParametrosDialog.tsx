import { useState, useEffect, useMemo } from "react";
import { Settings2, Eye, EyeOff, Pencil, Save, Trash2, GripVertical, Wand2, Plus, X, Sparkles, AlertOctagon } from "lucide-react";
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

const tiposComponente: { value: ParametroTipo; label: string; desc: string }[] = [
  { value: "Texto", label: "Texto", desc: "Entrada livre" },
  { value: "Número", label: "Número", desc: "Inteiro / decimal" },
  { value: "Select", label: "Select", desc: "Lista de opções" },
  { value: "Formula", label: "Fórmula", desc: "Cálculo automático" },
];

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

  const addOpcao = () => {
    const v = novaOpcao.trim();
    if (!v || opcoesSelect.includes(v)) return;
    setOpcoesSelect([...opcoesSelect, v]);
    setNovaOpcao("");
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
    // remove duplicatas preservando ordem
    const unicas: string[] = [];
    for (const p of partes) if (!unicas.includes(p)) unicas.push(p);
    setOpcoesSelect(unicas);
  };

  const inputClass = "w-full px-3 py-2 bg-muted/30 border border-border/60 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all duration-200";
  const inputErrClass = "w-full px-3 py-2 bg-destructive/5 border border-destructive/40 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-destructive/30 transition-all duration-200";
  const labelClass = "text-[11px] font-medium text-muted-foreground mb-1.5 block";

  const chavesDisponiveis = parametros.filter((p) => p.id !== selectedId && p.chave).map((p) => p.chave);

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
      <button onClick={onClose} className="h-10 px-4 rounded-xl border border-border/60 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all duration-200">
        Fechar
      </button>
      <button
        onClick={handleSave}
        disabled={saving || !exameId || !!chaveJaUsada}
        className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all duration-200"
      >
        <Save className="h-4 w-4" /> {saving ? "Salvando..." : selectedId ? "Atualizar" : "Adicionar"}
      </button>
    </>
  );

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      icon={<Settings2 className="h-5 w-5 text-accent" />}
      title="Parâmetros do exame"
      subtitle={exameNome || "Defina os campos de resultado"}
      headerActions={headerActions}
      footer={footer}
      maxWidth="5xl"
      allowMaximize={true}
      defaultMaximized={defaultMaximized}
    >
      <div className="px-6 py-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5">
        {/* List */}
        <div className="rounded-2xl border border-border/40 overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 bg-muted/30 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Parâmetros {parametros.length > 0 && <span className="opacity-70 normal-case font-normal">({parametros.length})</span>}
            </span>
            {parametros.length > 0 && (
              <span className="text-[10px] text-muted-foreground/70">Arraste para reordenar</span>
            )}
          </div>

          {parametros.length === 0 ? (
            <div className="py-12 px-5 text-center">
              <div className="h-12 w-12 rounded-2xl bg-accent/5 mx-auto flex items-center justify-center mb-3">
                <Sparkles className="h-5 w-5 text-accent/60" />
              </div>
              <p className="text-[13px] font-medium text-foreground mb-1">Nenhum parâmetro cadastrado</p>
              <p className="text-[11px] text-muted-foreground">Preencha o formulário ao lado para criar o primeiro</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 text-left">
                    {["", "Rótulo", "Chave", "Tipo", ""].map((h, i) => (
                      <th key={i} className="py-2 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parametros.map((p) => (
                    <tr
                      key={p.id}
                      draggable
                      onDragStart={() => handleDragStart(p.id)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(p.id)}
                      className={`border-b border-border/20 hover:bg-muted/20 transition-all duration-200 cursor-pointer ${selectedId === p.id ? "bg-primary/5" : ""} ${dragId === p.id ? "opacity-50" : ""}`}
                      onClick={() => selectParametro(p)}
                    >
                      <td className="py-2 px-2 text-muted-foreground/60 cursor-grab active:cursor-grabbing"><GripVertical className="h-4 w-4" /></td>
                      <td className="py-2 px-3 text-[13px] font-medium text-foreground">{p.rotulo}</td>
                      <td className="py-2 px-3 text-muted-foreground font-mono text-[11px]">##{p.chave}##</td>
                      <td className="py-2 px-3 text-[12px] text-muted-foreground">{p.tipo}</td>
                      <td className="py-2 px-3">
                        <button onClick={(e) => { e.stopPropagation(); toggleVisivel(p); }} className="p-1 rounded-lg hover:bg-muted/80 transition-all duration-200 text-muted-foreground" title={p.visivel ? "Visível" : "Oculto"}>
                          {p.visivel ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-border/40 overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 bg-muted/30">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {selectedId ? `Editando #${selectedId}` : "Novo parâmetro"}
            </span>
          </div>
          <div className="p-4 space-y-4">
            {/* Type selector */}
            <div>
              <label className={labelClass}>Tipo de campo</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {tiposComponente.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTipoSelecionado(t.value)}
                    className={`p-2.5 rounded-xl border text-left transition-all duration-200 ${tipoSelecionado === t.value ? "border-primary/40 bg-primary/5" : "border-border/40 hover:border-border/80 hover:bg-muted/30"}`}
                  >
                    <p className="text-[12px] font-semibold text-foreground">{t.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Identification */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Rótulo *</label>
                <input type="text" value={rotulo} onChange={(e) => setRotulo(e.target.value)} className={inputClass} placeholder="Ex: Hemoglobina" />
              </div>
              <div>
                <label className={labelClass}>Abreviação *</label>
                <input type="text" value={abreviacao} onChange={(e) => setAbreviacao(e.target.value)} className={inputClass} placeholder="HB" />
              </div>
            </div>

            <div>
              <label className={labelClass}>
                Chave (placeholder) * {chaveAutoGen && <span className="text-primary/70 normal-case">(gerada automaticamente)</span>}
              </label>
              <input
                type="text"
                value={chave}
                onChange={(e) => { setChave(e.target.value.toUpperCase()); setChaveAutoGen(false); }}
                className={chaveJaUsada ? inputErrClass : inputClass}
                placeholder="HEMOGLOBINA"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Use no layout como <code className="font-mono bg-muted px-1 py-0.5 rounded">##{chave || "CHAVE"}##</code>
              </p>
              {chaveJaUsada && <p className="text-[10px] text-destructive mt-1">Esta chave já existe neste exame</p>}
            </div>

            {/* Conditional: Select options */}
            {tipoSelecionado === "Select" && (
              <div className="rounded-xl border border-border/40 p-3 bg-muted/20">
                <label className={labelClass}>Opções da lista *</label>
                <textarea
                  value={novaOpcao.toUpperCase()}
                  onChange={(e) => handleOpcoesTextChange(e.target.value)}
                  onBlur={() => setNovaOpcao(opcoesSelect.join(", "))}
                  rows={2}
                  className={`${inputClass} resize-y min-h-[64px]`}
                  placeholder="Ex: Não reagente, Reagente +, Reagente ++, Traços"
                />
                <p className="text-[10px] text-muted-foreground mt-1.5 mb-2">
                  Separe as opções por vírgula. A ordem digitada é a ordem exibida.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {opcoesSelect.length === 0 && <span className="text-[11px] text-muted-foreground/70 italic">Nenhuma opção</span>}
                  {opcoesSelect.map((o) => (
                    <span key={o} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-card border border-border/60 text-[11px]">
                      {o.toUpperCase()}
                      <button onClick={() => removeOpcao(o)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Conditional: decimal places (Número e Fórmula) */}
            {(tipoSelecionado === "Número" || tipoSelecionado === "Formula") && (
              <div className="rounded-xl border border-border/40 p-3 bg-muted/20">
                <label className={labelClass}>Casas decimais</label>
                <div className="flex items-center gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {[0, 1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setCasasDecimais(n)}
                        className={`h-8 w-9 rounded-lg border text-[12px] font-semibold transition-all duration-200 ${casasDecimais === n ? "border-primary/40 bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"}`}
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
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Define quantas casas após a vírgula serão exibidas no resultado (ex.: {(1234.56789).toFixed(casasDecimais)})
                </p>
              </div>
            )}

            {/* Conditional: Valores críticos / pânico (somente Número e Fórmula) */}
            {(tipoSelecionado === "Número" || tipoSelecionado === "Formula") && (
              <div className="rounded-xl border border-status-danger/30 p-3 bg-status-danger/5">
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertOctagon className="h-3.5 w-3.5 text-status-danger" />
                  <label className="text-[11px] font-semibold text-status-danger uppercase tracking-wider">
                    Valores críticos / pânico
                  </label>
                </div>
                <p className="text-[10px] text-muted-foreground mb-2.5">
                  Faixas de pânico que disparam alerta para o analista. Use para evitar liberação
                  de erros de equipamento ou valores que oferecem risco ao paciente.
                </p>
                <div className="grid grid-cols-2 gap-2">
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
                <p className="text-[10px] text-muted-foreground mt-2 italic">
                  Deixe em branco para desabilitar o alerta de pânico naquele extremo.
                </p>
              </div>
            )}

            {/* Conditional: Formula helper */}
            {tipoSelecionado === "Formula" && chavesDisponiveis.length > 0 && (
              <div className="rounded-xl border border-primary/20 p-3 bg-primary/5">
                <p className="text-[11px] font-medium text-primary mb-2 flex items-center gap-1.5">
                  <Wand2 className="h-3 w-3" /> Clique para inserir
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {chavesDisponiveis.map((c) => (
                    <button
                      key={c} type="button"
                      onClick={() => setValorReferencia((v) => `${v}##${c}##`)}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-card border border-border hover:bg-primary/10 transition-all"
                    >##{c}##</button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">Ex.: <code>##HCT##/##HEM##</code></p>
              </div>
            )}

            {/* Reference text or formula */}
            <div>
              <label className={labelClass}>{tipoSelecionado === "Formula" ? "Fórmula *" : "Valor de referência (texto descritivo)"}</label>
              <textarea
                value={valorReferencia}
                onChange={(e) => setValorReferencia(e.target.value)}
                rows={2}
                className={`${inputClass} resize-none ${tipoSelecionado === "Formula" ? "font-mono" : ""}`}
                placeholder={tipoSelecionado === "Formula" ? "##CHAVE1##*0.5+##CHAVE2##" : "Ex: 12.0 a 16.0 g/dL"}
              />
            </div>

            {/* Toggles */}
            <div className="rounded-xl border border-border/40 bg-muted/10 divide-y divide-border/20">
              {[
                { label: "Obrigatório", desc: "Não é possível liberar resultado sem preencher", value: obrigatorio, set: setObrigatorio },
                { label: "Exibir resultado anterior", desc: "Mostra o último valor registrado deste paciente", value: exibirAnterior, set: setExibirAnterior },
                { label: "Exibir no mapa de trabalho", desc: "Aparece na grade de análise da bancada", value: exibirMapa, set: setExibirMapa },
              ].map((t) => (
                <div key={t.label} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-foreground">{t.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{t.desc}</p>
                  </div>
                  <Switch checked={t.value} onCheckedChange={t.set} />
                </div>
              ))}
            </div>

            {/* Advanced (collapsed-style) */}
            <details className="rounded-xl border border-border/40 bg-muted/10">
              <summary className="px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none hover:text-foreground">
                Avançado
              </summary>
              <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>Qtd. caracteres</label>
                  <input type="text" value={qtdCaracteres} onChange={(e) => setQtdCaracteres(e.target.value)} className={inputClass} placeholder="—" />
                </div>
                <div>
                  <label className={labelClass}>Chave Apoio</label>
                  <input type="text" value={chaveApoio} onChange={(e) => setChaveApoio(e.target.value)} className={inputClass} placeholder="lab integrado" />
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </StandardDialog>
  );
};

export default ParametrosDialog;
