import { useEffect, useState } from "react";
import { Plus, Copy, Trash2, Save, Ruler, X, AlertTriangle } from "lucide-react";
import StandardDialog from "@/components/ui/standard-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ReguaEtaria, addRegua, duplicarRegua, getReguas, loadReguas,
  removeRegua, subscribeReguas, updateRegua,
} from "@/data/reguasEtariasStore";
import {
  analisarCobertura, fromDias, labelFaixa, MAX_DIAS, toDias, type FaixaEtaria, type UnidadeIdade,
} from "@/lib/idadeFaixas";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Quando informado, filtra/cria réguas no escopo desse exame (estilo Lareval). */
  exameNome?: string;
}

interface FaixaDraft {
  id: string;
  label: string;
  deValor: string; deUnidade: UnidadeIdade;
  ateValor: string; ateUnidade: UnidadeIdade;
}

const draftFromFaixa = (f: FaixaEtaria): FaixaDraft => {
  const dDe = fromDias(f.deDias);
  const dAte = fromDias(f.ateDias);
  return {
    id: f.id, label: f.label,
    deValor: dDe.valor, deUnidade: dDe.unidade,
    ateValor: f.ateDias >= MAX_DIAS ? "150" : dAte.valor,
    ateUnidade: f.ateDias >= MAX_DIAS ? "Anos" : dAte.unidade,
  };
};

const draftToFaixa = (d: FaixaDraft): FaixaEtaria => {
  const de = toDias(d.deValor || "0", d.deUnidade);
  const ate = toDias(d.ateValor || "0", d.ateUnidade);
  return { id: d.id, label: d.label || labelFaixa(de, ate), deDias: de, ateDias: ate };
};

const GerenciarReguasDialog = ({ open, onClose, exameNome }: Props) => {
  const { toast } = useToast();
  const exameNorm = (exameNome ?? "").trim().toLowerCase();
  const [todas, setTodas] = useState<ReguaEtaria[]>([]);
  const [selecionadaId, setSelecionadaId] = useState<string>("");
  const [nome, setNome] = useState("");
  const [escopo, setEscopo] = useState<"global" | "exame">(exameNorm ? "exame" : "global");
  const [faixas, setFaixas] = useState<FaixaDraft[]>([]);

  // Filtra a lista para o contexto atual: presets + globais + as desse exame.
  const reguas = exameNorm
    ? todas.filter((r) => !r.exameNome || r.exameNome === exameNorm)
    : todas;

  useEffect(() => {
    if (!open) return;
    loadReguas().then((r) => { setTodas(r); if (!selecionadaId) setSelecionadaId(r[0]?.id ?? ""); });
    return subscribeReguas(() => setTodas(getReguas()));
  }, [open, selecionadaId]);

  const sel = reguas.find((r) => r.id === selecionadaId);

  useEffect(() => {
    if (!sel) { setNome(""); setFaixas([]); return; }
    setNome(sel.nome);
    setEscopo(sel.exameNome ? "exame" : "global");
    setFaixas(sel.faixas.map(draftFromFaixa));
  }, [selecionadaId, reguas.length]);

  const isSistema = !!sel?.sistema;

  const cobertura = (() => {
    const fxs = faixas.map(draftToFaixa);
    return analisarCobertura(fxs);
  })();

  const handleNova = async () => {
    const nova = await addRegua({
      nome: exameNorm ? `Faixas ${exameNome}` : "Nova régua",
      exameNome: exameNorm || undefined,
      faixas: [{ id: "f1", label: "0–150a", deDias: 0, ateDias: MAX_DIAS }],
    });
    setSelecionadaId(nova.id);
    toast({ title: exameNorm ? `Régua criada para ${exameNome}` : "Régua criada" });
  };

  const handleDuplicar = async () => {
    if (!sel) return;
    const nova = await duplicarRegua(sel.id);
    if (nova) { setSelecionadaId(nova.id); toast({ title: "Régua duplicada" }); }
  };

  const handleRemover = async () => {
    if (!sel || sel.sistema) return;
    const ok = await removeRegua(sel.id);
    if (ok) { setSelecionadaId(reguas[0]?.id ?? ""); toast({ title: "Régua removida" }); }
  };

  const handleSalvar = async () => {
    if (!sel || sel.sistema) return;
    const ok = await updateRegua(sel.id, { nome: nome.trim() || sel.nome, faixas: faixas.map(draftToFaixa) });
    if (ok) toast({ title: "Régua salva" });
    else toast({ title: "Erro ao salvar", variant: "destructive" });
  };

  const addFaixa = () => {
    const last = faixas[faixas.length - 1];
    const novaDeDias = last ? draftToFaixa(last).ateDias + 1 : 0;
    setFaixas((prev) => [...prev, draftFromFaixa({
      id: `f_${Date.now()}`, label: "", deDias: novaDeDias, ateDias: MAX_DIAS,
    })]);
  };

  const removeFaixa = (id: string) => setFaixas((prev) => prev.filter((f) => f.id !== id));

  const updateFaixa = (id: string, patch: Partial<FaixaDraft>) =>
    setFaixas((prev) => prev.map((f) => f.id === id ? { ...f, ...patch } : f));

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      icon={<Ruler className="h-5 w-5 text-primary" />}
      title="Réguas etárias"
      subtitle="Presets de faixas reutilizáveis em vários parâmetros"
      maxWidth="5xl"
      footer={
        <>
          {sel && !isSistema && (
            <button
              onClick={handleRemover}
              className="h-10 px-4 rounded-xl border border-destructive/30 text-destructive text-[13px] font-medium flex items-center gap-2 hover:bg-destructive/10 transition-all mr-auto"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remover
            </button>
          )}
          <button onClick={onClose} className="h-10 px-4 rounded-xl border border-border/60 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all">Fechar</button>
          {sel && !isSistema && (
            <button
              onClick={handleSalvar}
              className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all"
            >
              <Save className="h-4 w-4" /> Salvar régua
            </button>
          )}
        </>
      }
    >
      <div className="px-6 py-5 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
        {/* Lista lateral */}
        <div className="rounded-2xl border border-border/40 overflow-hidden h-fit">
          <div className="px-3 py-2.5 bg-muted/30 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Réguas</span>
            <button onClick={handleNova} className="h-7 px-2 rounded-lg text-[11px] font-medium text-primary hover:bg-primary/10 flex items-center gap-1">
              <Plus className="h-3 w-3" /> Nova
            </button>
          </div>
          <ul className="divide-y divide-border/20">
            {reguas.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setSelecionadaId(r.id)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-muted/30 transition-all ${selecionadaId === r.id ? "bg-primary/5" : ""}`}
                >
                  <div className="text-[13px] font-medium text-foreground">{r.nome}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {r.faixas.length} faixa(s){r.sistema ? " • sistema" : ""}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Editor */}
        {sel ? (
          <div className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="space-y-1.5 flex-1">
                <Label className="text-[11px] text-muted-foreground">Nome da régua</Label>
                <Input
                  className="rounded-xl h-9 text-sm bg-muted/30 border-border/60"
                  value={nome} onChange={(e) => setNome(e.target.value)}
                  disabled={isSistema}
                />
              </div>
              <button
                onClick={handleDuplicar}
                className="h-9 px-3 rounded-xl border border-border/60 bg-muted/30 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all flex items-center gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" /> Duplicar
              </button>
            </div>

            {isSistema && (
              <div className="rounded-xl border border-border/40 bg-muted/30 p-3 text-[11px] text-muted-foreground">
                Esta é uma régua de <strong>sistema</strong> — somente leitura. Use <strong>Duplicar</strong> para criar uma versão editável.
              </div>
            )}

            {/* Cobertura visual */}
            <div className="rounded-xl border border-border/40 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-foreground">Cobertura 0d → 150a</span>
                <span className={cobertura.cobre0a150 && cobertura.overlaps.length === 0 ? "text-status-success" : "text-status-warning"}>
                  {cobertura.cobre0a150 && cobertura.overlaps.length === 0
                    ? "Cobertura íntegra"
                    : `${cobertura.gaps.length} gap(s) • ${cobertura.overlaps.length} sobreposição(ões)`}
                </span>
              </div>
              <div className="relative h-2.5 rounded-full bg-muted overflow-hidden border border-border/40">
                {faixas.map((d) => {
                  const f = draftToFaixa(d);
                  const toPct = (x: number) => (Math.log(Math.max(1, x + 1)) / Math.log(MAX_DIAS + 1)) * 100;
                  return (
                    <div key={d.id} className="absolute top-0 bottom-0 bg-primary/40 border-x border-primary/60"
                      style={{ left: `${toPct(f.deDias)}%`, width: `${Math.max(0.5, toPct(f.ateDias) - toPct(f.deDias))}%` }}
                      title={d.label || labelFaixa(f.deDias, f.ateDias)} />
                  );
                })}
              </div>
              {(cobertura.gaps.length > 0 || cobertura.overlaps.length > 0) && (
                <div className="flex items-start gap-1.5 text-[11px] text-status-warning pt-1">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{cobertura.gaps.map((g) => `gap ${labelFaixa(g.de, g.ate)}`).concat(cobertura.overlaps.map((o) => `overlap ${labelFaixa(o.de, o.ate)}`)).join(" • ")}</span>
                </div>
              )}
            </div>

            {/* Tabela de faixas */}
            <div className="rounded-xl border border-border/40 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/30 text-left">
                    {["Rótulo", "De", "Unid.", "Até", "Unid.", ""].map((h, i) => (
                      <th key={i} className="py-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {faixas.map((d) => (
                    <tr key={d.id} className="border-b border-border/20">
                      <td className="py-1.5 px-2">
                        <Input className="rounded-lg h-8 text-[12px] bg-muted/30 border-border/60 w-32 px-2"
                          disabled={isSistema}
                          value={d.label} onChange={(e) => updateFaixa(d.id, { label: e.target.value })}
                          placeholder="ex.: 0–3m" />
                      </td>
                      <td className="py-1.5 px-2">
                        <Input className="rounded-lg h-8 text-[12px] bg-muted/30 border-border/60 w-20 px-2"
                          disabled={isSistema}
                          value={d.deValor} onChange={(e) => updateFaixa(d.id, { deValor: e.target.value })} />
                      </td>
                      <td className="py-1.5 px-2">
                        <Select value={d.deUnidade} onValueChange={(v) => updateFaixa(d.id, { deUnidade: v as UnidadeIdade })} disabled={isSistema}>
                          <SelectTrigger className="rounded-lg h-8 text-[12px] bg-muted/30 border-border/60 w-24 px-2"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="Dias">Dias</SelectItem><SelectItem value="Meses">Meses</SelectItem><SelectItem value="Anos">Anos</SelectItem></SelectContent>
                        </Select>
                      </td>
                      <td className="py-1.5 px-2">
                        <Input className="rounded-lg h-8 text-[12px] bg-muted/30 border-border/60 w-20 px-2"
                          disabled={isSistema}
                          value={d.ateValor} onChange={(e) => updateFaixa(d.id, { ateValor: e.target.value })} />
                      </td>
                      <td className="py-1.5 px-2">
                        <Select value={d.ateUnidade} onValueChange={(v) => updateFaixa(d.id, { ateUnidade: v as UnidadeIdade })} disabled={isSistema}>
                          <SelectTrigger className="rounded-lg h-8 text-[12px] bg-muted/30 border-border/60 w-24 px-2"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="Dias">Dias</SelectItem><SelectItem value="Meses">Meses</SelectItem><SelectItem value="Anos">Anos</SelectItem></SelectContent>
                        </Select>
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        {!isSistema && (
                          <button onClick={() => removeFaixa(d.id)} className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!isSistema && (
                <div className="px-2 py-2 bg-muted/20 border-t border-border/30">
                  <button onClick={addFaixa} className="h-8 px-3 rounded-lg text-[11px] font-medium text-primary hover:bg-primary/10 flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Adicionar faixa
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Selecione uma régua à esquerda.</div>
        )}
      </div>
    </StandardDialog>
  );
};

export default GerenciarReguasDialog;
