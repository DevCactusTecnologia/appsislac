import { useState, useEffect, useMemo } from "react";
import { X, Filter, Plus, Pencil, Trash2, Save, AlertTriangle, Copy, Sparkles, Wand2, Check, Grid3x3, List, Ruler } from "lucide-react";
import StandardDialog from "@/components/ui/standard-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComboboxField } from "@/components/configuracoes/_shared/ComboboxField";
import { useToast } from "@/hooks/use-toast";
import {
  type ValorReferencia, getValoresReferencia, addValorReferencia,
  updateValorReferencia, removeValorReferencia,
} from "@/data/valoresReferenciaStore";
import { loadParametros, getParametros, ExameParametro } from "@/data/exameParametrosStore";
import { parseValorReferencia, type FaixaCandidato } from "@/lib/parseValorReferencia";
import { formatFaixaIdade } from "@/lib/idadeFormat";
import MatrizValoresReferencia from "./MatrizValoresReferencia";
import FiltrosPorPerfil from "./FiltrosPorPerfil";
import GerenciarReguasDialog from "./GerenciarReguasDialog";

interface FiltrosDialogProps { open: boolean; onClose: () => void; exameNome?: string; exameId?: string; defaultMaximized?: boolean; }
type FormData = Omit<ValorReferencia, "id">;

const emptyForm = (exameNome: string): FormData => ({
  exameNome, parametroNome: "", sexo: "Ambos", idadeMin: "", idadeMax: "",
  unidadeIdade: "Anos", valorMin: "", valorMax: "", unidade: "", descricao: "",
});

const idadeParaAnos = (valor: string, unidade: string): number => {
  const n = parseFloat(valor) || 0;
  if (unidade === "Meses") return n / 12;
  if (unidade === "Dias") return n / 365;
  return n;
};

const detectarSobreposicao = (
  form: FormData, todas: ValorReferencia[], ignoreId?: number,
): ValorReferencia[] => {
  const min = idadeParaAnos(form.idadeMin || "0", form.unidadeIdade);
  const max = idadeParaAnos(form.idadeMax || "999", form.unidadeIdade);
  return todas.filter((r) => {
    if (r.id === ignoreId) return false;
    if (r.exameNome.toLowerCase() !== form.exameNome.toLowerCase()) return false;
    if (r.parametroNome.toLowerCase() !== form.parametroNome.toLowerCase()) return false;
    if (r.sexo !== form.sexo && r.sexo !== "Ambos" && form.sexo !== "Ambos") return false;
    const rMin = idadeParaAnos(r.idadeMin || "0", r.unidadeIdade);
    const rMax = idadeParaAnos(r.idadeMax || "999", r.unidadeIdade);
    return min <= rMax && rMin <= max;
  });
};

const FiltrosDialog = ({ open, onClose, exameNome = "", exameId, defaultMaximized = true }: FiltrosDialogProps) => {
  const { toast } = useToast();
  const [referencias, setReferencias] = useState<ValorReferencia[]>([]);
  const [editando, setEditando] = useState<ValorReferencia | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm(exameNome));
  const [parametros, setParametros] = useState<ExameParametro[]>([]);
  const [showCopiar, setShowCopiar] = useState(false);
  const [copiarOrigem, setCopiarOrigem] = useState("");
  const [showImportar, setShowImportar] = useState(false);
  const [importarParametro, setImportarParametro] = useState("");
  const [candidatos, setCandidatos] = useState<(FaixaCandidato & { selecionado: boolean })[]>([]);
  const [aba, setAba] = useState<"perfil" | "matriz" | "lista">("perfil");
  const [reguasOpen, setReguasOpen] = useState(false);

  useEffect(() => {
    if (open) {
      const all = getValoresReferencia();
      setReferencias(exameNome ? all.filter((v) => v.exameNome.toLowerCase() === exameNome.toLowerCase()) : all);
      setEditando(null); setForm(emptyForm(exameNome));
      setShowCopiar(false); setCopiarOrigem("");
      setShowImportar(false); setImportarParametro(""); setCandidatos([]);
      setAba("matriz");
      if (exameId) loadParametros(exameId).then(() => setParametros(getParametros(exameId)));
    }
  }, [open, exameNome, exameId]);

  const todasReferencias = getValoresReferencia();
  const examesComReferencia = useMemo(() => {
    const set = new Set(todasReferencias.map((r) => r.exameNome));
    set.delete(exameNome);
    return Array.from(set).sort();
  }, [todasReferencias, exameNome]);

  const sobreposicoes = useMemo(
    () => form.parametroNome ? detectarSobreposicao(form, todasReferencias, editando?.id) : [],
    [form, todasReferencias, editando?.id],
  );

  const handleNovo = () => { setEditando(null); setForm(emptyForm(exameNome)); };
  const handleEditar = (ref: ValorReferencia) => { setEditando(ref); const { id, ...rest } = ref; setForm(rest); };
  const handleRemover = async (id: number) => {
    const ok = await removeValorReferencia(id);
    if (!ok) {
      toast({ title: "Erro ao remover", description: "Não foi possível remover. Tente novamente.", variant: "destructive" });
      return;
    }
    setReferencias((prev) => prev.filter((r) => r.id !== id));
    if (editando?.id === id) { setEditando(null); setForm(emptyForm(exameNome)); }
    toast({ title: "Valor de referência removido" });
  };
  const handleSalvar = async () => {
    if (!form.parametroNome.trim()) { toast({ title: "Selecione o parâmetro", variant: "destructive" }); return; }
    if (!form.valorMin && !form.valorMax) { toast({ title: "Preencha ao menos um valor de referência", variant: "destructive" }); return; }
    if (editando) {
      const ok = await updateValorReferencia(editando.id, form);
      if (!ok) {
        toast({ title: "Erro ao salvar", description: "Não foi possível atualizar a faixa.", variant: "destructive" });
        return;
      }
      setReferencias((prev) => prev.map((r) => (r.id === editando.id ? { ...form, id: editando.id } : r)));
      toast({ title: "Valor de referência atualizado" });
    } else {
      const novo = await addValorReferencia(form);
      if (!novo) {
        toast({ title: "Erro ao salvar", description: "Não foi possível criar a faixa. Verifique sua conexão.", variant: "destructive" });
        return;
      }
      setReferencias((prev) => [...prev, novo]);
      toast({ title: "Valor de referência adicionado" });
    }
    setEditando(null); setForm(emptyForm(exameNome));
  };

  const handleCopiarFaixas = async () => {
    if (!copiarOrigem) return;
    const origem = todasReferencias.filter((r) => r.exameNome === copiarOrigem);
    if (origem.length === 0) { toast({ title: "Exame de origem sem faixas", variant: "destructive" }); return; }
    let count = 0;
    for (const r of origem) {
      const { id, exameNome: _e, ...rest } = r;
      const novo = await addValorReferencia({ ...rest, exameNome });
      if (novo) {
        setReferencias((prev) => [...prev, novo]);
        count++;
      }
    }
    setShowCopiar(false); setCopiarOrigem("");
    toast({ title: `${count} faixa(s) copiada(s) de ${copiarOrigem}` });
  };

  const parametrosComTexto = useMemo(
    () => parametros.filter((p) => (p.valorReferencia ?? "").trim().length > 0),
    [parametros],
  );

  const handleParseTexto = (chaveParametroRotulo: string) => {
    setImportarParametro(chaveParametroRotulo);
    const p = parametros.find((x) => x.rotulo === chaveParametroRotulo);
    if (!p) { setCandidatos([]); return; }
    const lista = parseValorReferencia(p.valorReferencia);
    setCandidatos(lista.map((c) => ({ ...c, selecionado: true })));
  };

  const handleImportarFaixas = async () => {
    const selec = candidatos.filter((c) => c.selecionado);
    if (selec.length === 0) { toast({ title: "Selecione ao menos uma faixa", variant: "destructive" }); return; }
    let count = 0;
    for (const c of selec) {
      const novo = await addValorReferencia({
        exameNome,
        parametroNome: importarParametro,
        sexo: c.sexo,
        idadeMin: c.idadeMin,
        idadeMax: c.idadeMax,
        unidadeIdade: c.unidadeIdade,
        valorMin: c.valorMin,
        valorMax: c.valorMax,
        unidade: c.unidade,
        descricao: c.descricao,
      });
      if (novo) { setReferencias((prev) => [...prev, novo]); count++; }
    }
    setShowImportar(false); setImportarParametro(""); setCandidatos([]);
    toast({ title: `${count} faixa(s) importada(s) do texto descritivo` });
  };

  const refreshReferencias = () => {
    const all = getValoresReferencia();
    setReferencias(exameNome ? all.filter((v) => v.exameNome.toLowerCase() === exameNome.toLowerCase()) : all);
  };

  const headerActions = (
    <>
      <button
        onClick={() => setReguasOpen(true)}
        className="h-9 px-3 rounded-xl border border-border/60 bg-muted/30 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all duration-200 flex items-center gap-1.5"
      >
        <Ruler className="h-3.5 w-3.5" /> Réguas
      </button>
      {exameId && parametrosComTexto.length > 0 && (
        <button
          onClick={() => setShowImportar((v) => !v)}
          className="h-9 px-3 rounded-xl border border-border/60 bg-muted/30 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all duration-200 flex items-center gap-1.5"
        >
          <Wand2 className="h-3.5 w-3.5" /> Importar do texto
        </button>
      )}
      {exameNome && examesComReferencia.length > 0 && (
        <button
          onClick={() => setShowCopiar((v) => !v)}
          className="h-9 px-3 rounded-xl border border-border/60 bg-muted/30 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all duration-200 flex items-center gap-1.5"
        >
          <Copy className="h-3.5 w-3.5" /> Copiar de…
        </button>
      )}
      <button
        onClick={handleNovo}
        className="h-9 px-3 rounded-xl border border-border/60 bg-muted/30 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all duration-200 flex items-center gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" /> Nova faixa
      </button>
    </>
  );

  const footer = aba === "lista" ? (
    <>
      {editando && (
        <button
          onClick={() => handleRemover(editando.id)}
          className="h-10 px-4 rounded-xl border border-destructive/30 text-destructive text-[13px] font-medium flex items-center gap-2 hover:bg-destructive/10 transition-all duration-200 mr-auto"
        >
          <Trash2 className="h-3.5 w-3.5" /> Remover faixa
        </button>
      )}
      <button onClick={onClose} className="h-10 px-4 rounded-xl border border-border/60 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all duration-200">
        Fechar
      </button>
      <button
        onClick={handleSalvar}
        className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all duration-200"
      >
        <Save className="h-4 w-4" /> {editando ? "Atualizar" : "Adicionar"}
      </button>
    </>
  ) : (
    <button onClick={onClose} className="h-10 px-4 rounded-xl border border-border/60 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all duration-200">
      Fechar
    </button>
  );

  return (
    <>
    <StandardDialog
      open={open}
      onClose={onClose}
      icon={<Filter className="h-5 w-5 text-[hsl(var(--status-info))]" />}
      title="Valores de referência"
      subtitle={exameNome || "Todos os exames"}
      headerActions={headerActions}
      footer={footer}
      maxWidth="7xl"
      allowMaximize={true}
      defaultMaximized={defaultMaximized}
    >
      {/* Tabs */}
      <div className="px-6 pt-4">
        <div className="inline-flex items-center gap-1 rounded-xl bg-muted/40 p-1">
          <button
            onClick={() => setAba("matriz")}
            className={`h-8 px-3 rounded-lg text-[12px] font-medium flex items-center gap-1.5 transition-all ${aba === "matriz" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Grid3x3 className="h-3.5 w-3.5" /> Matriz
          </button>
          <button
            onClick={() => setAba("lista")}
            className={`h-8 px-3 rounded-lg text-[12px] font-medium flex items-center gap-1.5 transition-all ${aba === "lista" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <List className="h-3.5 w-3.5" /> Lista
          </button>
        </div>
      </div>

      {aba === "matriz" && (
        <div className="px-6 py-5">
          <MatrizValoresReferencia
            exameNome={exameNome}
            parametros={parametros.map((p) => p.rotulo)}
            referencias={referencias}
            onAbrirGerenciador={() => setReguasOpen(true)}
            onMutate={refreshReferencias}
          />
        </div>
      )}

      {aba === "lista" && <>
      {showCopiar && (
        <div className="px-6 pt-4">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 flex items-center gap-2">
            <span className="text-[12px] text-muted-foreground shrink-0">Copiar todas as faixas do exame:</span>
            <div className="flex-1 max-w-xs">
              <ComboboxField
                value={copiarOrigem}
                onChange={setCopiarOrigem}
                options={examesComReferencia.map((nome) => ({ value: nome, label: nome }))}
                placeholder="Digite ou selecione um exame"
                allowCustom={false}
              />
            </div>
            <button onClick={handleCopiarFaixas} disabled={!copiarOrigem} className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold disabled:opacity-50 hover:opacity-90 transition-all">Copiar</button>
            <button onClick={() => { setShowCopiar(false); setCopiarOrigem(""); }} className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {showImportar && (
        <div className="px-6 pt-4">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Wand2 className="h-3.5 w-3.5 text-[hsl(var(--status-info))] shrink-0" />
              <span className="text-[12px] text-muted-foreground shrink-0">Parâmetro:</span>
              <div className="flex-1 max-w-xs">
                <Select value={importarParametro} onValueChange={handleParseTexto}>
                  <SelectTrigger className="rounded-xl h-9 text-sm bg-background border-border/60">
                    <SelectValue placeholder="Selecione um parâmetro com texto" />
                  </SelectTrigger>
                  <SelectContent>
                    {parametrosComTexto.map((p) => (
                      <SelectItem key={p.id} value={p.rotulo}>{p.rotulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button
                onClick={handleImportarFaixas}
                disabled={candidatos.filter((c) => c.selecionado).length === 0}
                className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold disabled:opacity-50 hover:opacity-90 transition-all flex items-center gap-1.5"
              >
                <Check className="h-3.5 w-3.5" /> Importar selecionadas
              </button>
              <button onClick={() => { setShowImportar(false); setImportarParametro(""); setCandidatos([]); }} className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80"><X className="h-4 w-4" /></button>
            </div>

            {importarParametro && candidatos.length === 0 && (
              <p className="text-[12px] text-muted-foreground italic">Nenhuma faixa estruturada foi reconhecida no texto. Adicione manualmente.</p>
            )}

            {candidatos.length > 0 && (
              <div className="rounded-xl border border-border/40 overflow-hidden bg-background">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30 text-left bg-muted/30">
                      {["", "Sexo", "Idade", "Mín.", "Máx.", "Unid.", "Descrição"].map((h) => (
                        <th key={h} className="py-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {candidatos.map((c, i) => (
                      <tr key={i} className="border-b border-border/20">
                        <td className="py-1.5 px-2">
                          <input
                            type="checkbox"
                            checked={c.selecionado}
                            onChange={(e) => setCandidatos((prev) => prev.map((p, j) => j === i ? { ...p, selecionado: e.target.checked } : p))}
                            className="h-4 w-4 accent-primary cursor-pointer"
                          />
                        </td>
                        <td className="py-1 px-1">
                          <Select value={c.sexo} onValueChange={(v) => setCandidatos((prev) => prev.map((p, j) => j === i ? { ...p, sexo: v as ValorReferencia["sexo"] } : p))}>
                            <SelectTrigger className="rounded-lg h-8 text-[12px] bg-muted/30 border-border/60 px-2"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="Ambos">Ambos</SelectItem><SelectItem value="Masculino">M</SelectItem><SelectItem value="Feminino">F</SelectItem></SelectContent>
                          </Select>
                        </td>
                        <td className="py-1 px-1">
                          <div className="flex gap-1 items-center">
                            <Input className="rounded-lg h-8 text-[12px] bg-muted/30 border-border/60 w-12 px-1" value={c.idadeMin} onChange={(e) => setCandidatos((prev) => prev.map((p, j) => j === i ? { ...p, idadeMin: e.target.value } : p))} />
                            <span className="text-muted-foreground text-[10px]">–</span>
                            <Input className="rounded-lg h-8 text-[12px] bg-muted/30 border-border/60 w-12 px-1" value={c.idadeMax} onChange={(e) => setCandidatos((prev) => prev.map((p, j) => j === i ? { ...p, idadeMax: e.target.value } : p))} />
                          </div>
                        </td>
                        <td className="py-1 px-1"><Input className="rounded-lg h-8 text-[12px] bg-muted/30 border-border/60 w-16 px-1" value={c.valorMin} onChange={(e) => setCandidatos((prev) => prev.map((p, j) => j === i ? { ...p, valorMin: e.target.value } : p))} /></td>
                        <td className="py-1 px-1"><Input className="rounded-lg h-8 text-[12px] bg-muted/30 border-border/60 w-16 px-1" value={c.valorMax} onChange={(e) => setCandidatos((prev) => prev.map((p, j) => j === i ? { ...p, valorMax: e.target.value } : p))} /></td>
                        <td className="py-1 px-1"><Input className="rounded-lg h-8 text-[12px] bg-muted/30 border-border/60 w-20 px-1" value={c.unidade} onChange={(e) => setCandidatos((prev) => prev.map((p, j) => j === i ? { ...p, unidade: e.target.value } : p))} /></td>
                        <td className="py-1 px-1 text-[11px] text-muted-foreground" title={c.origem}>{c.descricao || <span className="opacity-50">{c.origem.slice(0, 40)}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="px-6 py-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
        {/* Table */}
        <div className="rounded-2xl border border-border/40 overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/30 flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Faixas {referencias.length > 0 && <span className="opacity-70 normal-case font-normal">({referencias.length})</span>}
            </span>
          </div>

          {referencias.length === 0 ? (
            <div className="py-12 px-5 text-center">
              <div className="h-12 w-12 rounded-2xl bg-[hsl(var(--status-info))]/5 mx-auto flex items-center justify-center mb-3">
                <Sparkles className="h-5 w-5 text-[hsl(var(--status-info))]/60" />
              </div>
              <p className="text-[13px] font-medium text-foreground mb-1">Nenhuma faixa de referência</p>
              <p className="text-[11px] text-muted-foreground mb-4">Adicione faixas para validação automática no laudo</p>
              <button
                onClick={handleNovo}
                className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold inline-flex items-center gap-1.5 hover:opacity-90 transition-all"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar primeira faixa
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 text-left">
                    {["Parâmetro", "Sexo", "Idade", "Mín.", "Máx.", "Unid.", ""].map(h => (
                      <th key={h} className="py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {referencias.map((ref) => (
                    <tr key={ref.id} className={`border-b border-border/20 hover:bg-muted/20 transition-all duration-200 cursor-pointer ${editando?.id === ref.id ? "bg-primary/5" : ""}`} onClick={() => handleEditar(ref)}>
                      <td className="py-2.5 px-3 text-[13px] font-medium text-foreground">{ref.parametroNome}</td>
                      <td className="py-2.5 px-3 text-[12px] text-muted-foreground">{ref.sexo}</td>
                      <td className="py-2.5 px-3 text-[12px] text-muted-foreground">{formatFaixaIdade(ref.idadeMin, ref.idadeMax, ref.unidadeIdade)}</td>
                      <td className="py-2.5 px-3 text-[13px] text-foreground">{ref.valorMin || "—"}</td>
                      <td className="py-2.5 px-3 text-[13px] text-foreground">{ref.valorMax || "—"}</td>
                      <td className="py-2.5 px-3 text-[12px] text-muted-foreground">{ref.unidade}</td>
                      <td className="py-2.5 px-3">
                        <button onClick={(e) => { e.stopPropagation(); handleRemover(ref.id); }} className="p-1 rounded-lg hover:bg-destructive/10 transition-all duration-200 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sidebar form */}
        <div className="rounded-2xl border border-border/40 overflow-hidden h-fit">
          <div className="px-4 py-2.5 bg-muted/30">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {editando ? `Editando #${editando.id}` : "Nova faixa"}
            </span>
          </div>
          <div className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Parâmetro *</Label>
              {parametros.length > 0 ? (
                <Select value={form.parametroNome} onValueChange={(v) => setForm((f) => ({ ...f, parametroNome: v }))}>
                  <SelectTrigger className="rounded-xl h-9 text-sm bg-muted/30 border-border/60"><SelectValue placeholder="Selecione um parâmetro" /></SelectTrigger>
                  <SelectContent>
                    {parametros.map((p) => <SelectItem key={p.id} value={p.rotulo}>{p.rotulo}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input className="rounded-xl h-9 text-sm bg-muted/30 border-border/60" value={form.parametroNome} onChange={(e) => setForm((f) => ({ ...f, parametroNome: e.target.value }))} placeholder="Ex: Hemoglobina" />
              )}
            </div>
            <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">Sexo</Label>
              <Select value={form.sexo} onValueChange={(v) => setForm((f) => ({ ...f, sexo: v as ValorReferencia["sexo"] }))}>
                <SelectTrigger className="rounded-xl h-9 text-sm bg-muted/30 border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Ambos">Ambos</SelectItem><SelectItem value="Masculino">Masculino</SelectItem><SelectItem value="Feminino">Feminino</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">Idade mín.</Label><Input className="rounded-xl h-9 text-sm bg-muted/30 border-border/60" value={form.idadeMin} onChange={(e) => setForm((f) => ({ ...f, idadeMin: e.target.value }))} placeholder="0" /></div>
              <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">Idade máx.</Label><Input className="rounded-xl h-9 text-sm bg-muted/30 border-border/60" value={form.idadeMax} onChange={(e) => setForm((f) => ({ ...f, idadeMax: e.target.value }))} placeholder="99" /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">Unidade de idade</Label>
              <Select value={form.unidadeIdade} onValueChange={(v) => setForm((f) => ({ ...f, unidadeIdade: v as ValorReferencia["unidadeIdade"] }))}>
                <SelectTrigger className="rounded-xl h-9 text-sm bg-muted/30 border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Anos">Anos</SelectItem><SelectItem value="Meses">Meses</SelectItem><SelectItem value="Dias">Dias</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">Valor mín.</Label><Input className="rounded-xl h-9 text-sm bg-muted/30 border-border/60" value={form.valorMin} onChange={(e) => setForm((f) => ({ ...f, valorMin: e.target.value }))} placeholder="0.0" /></div>
              <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">Valor máx.</Label><Input className="rounded-xl h-9 text-sm bg-muted/30 border-border/60" value={form.valorMax} onChange={(e) => setForm((f) => ({ ...f, valorMax: e.target.value }))} placeholder="10.0" /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">Unidade</Label><Input className="rounded-xl h-9 text-sm bg-muted/30 border-border/60" value={form.unidade} onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))} placeholder="mg/dL" /></div>
            <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">Descrição</Label><Input className="rounded-xl h-9 text-sm bg-muted/30 border-border/60" value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Adulto masculino" /></div>

            {sobreposicoes.length > 0 && (
              <div className="rounded-xl border border-[hsl(var(--status-warning))]/40 bg-[hsl(var(--status-warning))]/10 p-3 flex gap-2">
                <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-warning))] shrink-0 mt-0.5" />
                <div className="text-[11px] text-foreground/80 leading-relaxed">
                  <strong className="text-[hsl(var(--status-warning))]">Sobreposição</strong> com {sobreposicoes.length} faixa(s) existente(s). O motor de resolução pode escolher a errada.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </>}
    </StandardDialog>
    <GerenciarReguasDialog open={reguasOpen} onClose={() => setReguasOpen(false)} />
    </>
  );
};

export default FiltrosDialog;
