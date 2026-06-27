// Diálogo "Aplicar template / Criar matriz" — geração em lote de variações de VR.
//
// Dois modos:
//   1) Templates clínicos prontos (Triglicérides, Colesterol LDL/Não-HDL, Glicemia).
//      Match por substring no nome do exame OU parâmetro. Cada template já vem
//      com idade × jejum/risco mapeados conforme literatura padrão (SBC/SBPC).
//   2) Matriz personalizada: usuário escolhe dimensões ativas (Idade × Jejum × Risco CV
//      — habilitadas conforme toggles do parâmetro) e preenche uma grade. O dialog
//      gera N linhas de VR (uma por combinação preenchida).
//
// Por trás chama `addValorReferencia` linha a linha (sem alterar o resolver/banco).

import { useMemo, useState } from "react";
import { Plus, Sparkles, Grid3x3, Loader2, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  addValorReferencia, type ValorReferencia, type JejumVR, type RiscoCV, type OperadorVR,
} from "@/data/valoresReferenciaStore";
import type { ExameParametro } from "@/data/exameParametrosStore";

type UnidIdade = "Anos" | "Meses" | "Dias";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  exameNome: string;
  parametro: ExameParametro;
  onCreated: () => void;
}

interface FaixaIdade {
  label: string;
  de: string;
  ate: string;
  unidade: UnidIdade;
}

interface TemplatePreset {
  id: string;
  label: string;
  fonte: string;
  /** Substrings que ativam o template (testado contra nome do exame + parâmetro, lowercase). */
  match: string[];
  unidade: string;
  /** Rótulo curto da régua: ex.: "Idade × Jejum". */
  resumo: string;
  linhas: Array<{
    faixa: { label: string; de: string; ate: string; unidade: UnidIdade };
    jejum?: JejumVR;
    riscoCv?: RiscoCV;
    operador: OperadorVR;
    valor: string;
  }>;
}

const TEMPLATES: TemplatePreset[] = [
  {
    id: "triglicerides",
    label: "Triglicérides — SBC 2017 (idade × jejum)",
    fonte: "Diretriz SBC 2017",
    match: ["triglic"],
    unidade: "mg/dL",
    resumo: "Idade × Jejum — 6 linhas",
    linhas: [
      { faixa: { label: "0–9 anos",   de: "0",  ate: "9",   unidade: "Anos" }, jejum: "com_jejum", operador: "menor", valor: "75"  },
      { faixa: { label: "0–9 anos",   de: "0",  ate: "9",   unidade: "Anos" }, jejum: "sem_jejum", operador: "menor", valor: "85"  },
      { faixa: { label: "10–19 anos", de: "10", ate: "19",  unidade: "Anos" }, jejum: "com_jejum", operador: "menor", valor: "90"  },
      { faixa: { label: "10–19 anos", de: "10", ate: "19",  unidade: "Anos" }, jejum: "sem_jejum", operador: "menor", valor: "100" },
      { faixa: { label: "≥ 20 anos",  de: "20", ate: "150", unidade: "Anos" }, jejum: "com_jejum", operador: "menor", valor: "150" },
      { faixa: { label: "≥ 20 anos",  de: "20", ate: "150", unidade: "Anos" }, jejum: "sem_jejum", operador: "menor", valor: "175" },
    ],
  },
  {
    id: "ldl",
    label: "LDL-Colesterol — SBC (idade × risco CV)",
    fonte: "Diretriz SBC",
    match: ["ldl"],
    unidade: "mg/dL",
    resumo: "Idade × Risco CV — 5 linhas",
    linhas: [
      { faixa: { label: "0–19 anos", de: "0",  ate: "19",  unidade: "Anos" }, operador: "menor", valor: "110" },
      { faixa: { label: "≥ 20 anos", de: "20", ate: "150", unidade: "Anos" }, riscoCv: "baixo",         operador: "menor", valor: "130" },
      { faixa: { label: "≥ 20 anos", de: "20", ate: "150", unidade: "Anos" }, riscoCv: "intermediario", operador: "menor", valor: "100" },
      { faixa: { label: "≥ 20 anos", de: "20", ate: "150", unidade: "Anos" }, riscoCv: "alto",          operador: "menor", valor: "70"  },
      { faixa: { label: "≥ 20 anos", de: "20", ate: "150", unidade: "Anos" }, riscoCv: "muito_alto",    operador: "menor", valor: "50"  },
    ],
  },
  {
    id: "nao-hdl",
    label: "Não-HDL Colesterol — SBC (idade × risco CV)",
    fonte: "Diretriz SBC",
    match: ["nao-hdl", "não-hdl", "nao hdl", "não hdl", "naohdl"],
    unidade: "mg/dL",
    resumo: "Idade × Risco CV — 5 linhas",
    linhas: [
      { faixa: { label: "0–19 anos", de: "0",  ate: "19",  unidade: "Anos" }, operador: "menor", valor: "145" },
      { faixa: { label: "≥ 20 anos", de: "20", ate: "150", unidade: "Anos" }, riscoCv: "baixo",         operador: "menor", valor: "160" },
      { faixa: { label: "≥ 20 anos", de: "20", ate: "150", unidade: "Anos" }, riscoCv: "intermediario", operador: "menor", valor: "130" },
      { faixa: { label: "≥ 20 anos", de: "20", ate: "150", unidade: "Anos" }, riscoCv: "alto",          operador: "menor", valor: "100" },
      { faixa: { label: "≥ 20 anos", de: "20", ate: "150", unidade: "Anos" }, riscoCv: "muito_alto",    operador: "menor", valor: "80"  },
    ],
  },
  {
    id: "glicemia",
    label: "Glicemia — SBD (jejum)",
    fonte: "Diretriz SBD",
    match: ["glic", "glicose"],
    unidade: "mg/dL",
    resumo: "Jejum — 2 linhas",
    linhas: [
      { faixa: { label: "Adultos", de: "18", ate: "150", unidade: "Anos" }, jejum: "com_jejum", operador: "entre", valor: "70-99" },
      { faixa: { label: "Adultos", de: "18", ate: "150", unidade: "Anos" }, jejum: "sem_jejum", operador: "menor", valor: "140"  },
    ],
  },
];

const VariacaoMatrizDialog = ({ open, onOpenChange, exameNome, parametro, onCreated }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("templates");

  const parametroNome = parametro.chave || parametro.rotulo;
  const haystack = `${exameNome} ${parametro.rotulo} ${parametro.chave ?? ""}`.toLowerCase();
  const templatesRelevantes = useMemo(
    () => TEMPLATES.filter((t) => t.match.some((m) => haystack.includes(m))),
    [haystack],
  );
  const outrosTemplates = useMemo(
    () => TEMPLATES.filter((t) => !t.match.some((m) => haystack.includes(m))),
    [haystack],
  );

  // -------- MATRIZ PERSONALIZADA --------
  const usaJejum = !!parametro.sensivelJejum;
  const usaRisco = !!parametro.estratificadoRiscoCv;

  const [faixas, setFaixas] = useState<FaixaIdade[]>([
    { label: "0–9 anos",   de: "0",  ate: "9",   unidade: "Anos" },
    { label: "10–19 anos", de: "10", ate: "19",  unidade: "Anos" },
    { label: "≥ 20 anos",  de: "20", ate: "150", unidade: "Anos" },
  ]);
  const [operador, setOperador] = useState<OperadorVR>("menor");
  const [unidade, setUnidade] = useState("mg/dL");
  // chave: `${faixaIdx}-${col}` → valor digitado
  const [cells, setCells] = useState<Record<string, string>>({});

  const colunas: Array<{ key: string; label: string; jejum?: JejumVR; riscoCv?: RiscoCV }> = useMemo(() => {
    if (usaJejum && usaRisco) {
      // Combina jejum × risco (raro, mas suportado)
      const out: typeof colunas = [];
      (["com_jejum", "sem_jejum"] as JejumVR[]).forEach((j) => {
        (["baixo", "intermediario", "alto", "muito_alto"] as RiscoCV[]).forEach((r) => {
          out.push({ key: `${j}-${r}`, label: `${j === "com_jejum" ? "Com jejum" : "Sem jejum"} • ${r}`, jejum: j, riscoCv: r });
        });
      });
      return out;
    }
    if (usaJejum) {
      return [
        { key: "com_jejum", label: "Com jejum", jejum: "com_jejum" },
        { key: "sem_jejum", label: "Sem jejum", jejum: "sem_jejum" },
      ];
    }
    if (usaRisco) {
      return [
        { key: "baixo",         label: "Risco baixo",         riscoCv: "baixo" },
        { key: "intermediario", label: "Risco intermediário", riscoCv: "intermediario" },
        { key: "alto",          label: "Risco alto",          riscoCv: "alto" },
        { key: "muito_alto",    label: "Risco muito alto",    riscoCv: "muito_alto" },
      ];
    }
    return [{ key: "valor", label: "Valor" }];
  }, [usaJejum, usaRisco]);

  const addFaixa = () =>
    setFaixas((xs) => [...xs, { label: "Nova faixa", de: "", ate: "", unidade: "Anos" }]);
  const updFaixa = (i: number, patch: Partial<FaixaIdade>) =>
    setFaixas((xs) => xs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const rmFaixa = (i: number) => setFaixas((xs) => xs.filter((_, idx) => idx !== i));

  // -------- AÇÕES --------
  const baseVR = (extras: Partial<ValorReferencia>): Omit<ValorReferencia, "id"> => ({
    exameNome,
    parametroNome,
    sexo: "Ambos",
    idadeMin: "",
    idadeMax: "",
    unidadeIdade: "Anos",
    unidadeIdadeMax: "Anos",
    valorMin: "",
    valorMax: "",
    unidade,
    descricao: "",
    criticoMin: "",
    criticoMax: "",
    categoria: "custom",
    jejum: "qualquer",
    riscoCv: "qualquer",
    operador: "entre",
    ...extras,
  });

  const aplicarTemplate = async (tpl: TemplatePreset) => {
    setLoading(true);
    let ok = 0;
    try {
      for (const l of tpl.linhas) {
        const isEntre = l.operador === "entre" && l.valor.includes("-");
        const [vMin, vMax] = isEntre ? l.valor.split("-").map((s) => s.trim()) : ["", l.valor];
        const r = await addValorReferencia(baseVR({
          unidade: tpl.unidade,
          idadeMin: l.faixa.de,
          idadeMax: l.faixa.ate,
          unidadeIdade: l.faixa.unidade,
          unidadeIdadeMax: l.faixa.unidade,
          operador: l.operador,
          valorMin: vMin,
          valorMax: vMax,
          jejum: l.jejum ?? "qualquer",
          riscoCv: l.riscoCv ?? "qualquer",
        }));
        if (r) ok++;
      }
      toast({ title: `Template aplicado`, description: `${ok} regra(s) criada(s).` });
      onCreated();
      onOpenChange(false);
    } finally { setLoading(false); }
  };

  const aplicarMatriz = async () => {
    const entries = Object.entries(cells).filter(([, v]) => v.trim() !== "");
    if (entries.length === 0) {
      toast({ title: "Preencha pelo menos uma célula", variant: "destructive" });
      return;
    }
    setLoading(true);
    let ok = 0;
    try {
      for (const [key, valor] of entries) {
        const [faixaIdx, colKey] = key.split("|");
        const f = faixas[Number(faixaIdx)];
        const col = colunas.find((c) => c.key === colKey);
        if (!f || !col) continue;
        const isEntre = operador === "entre" && valor.includes("-");
        const [vMin, vMax] = isEntre ? valor.split("-").map((s) => s.trim()) : ["", valor];
        const r = await addValorReferencia(baseVR({
          idadeMin: f.de,
          idadeMax: f.ate,
          unidadeIdade: f.unidade,
          unidadeIdadeMax: f.unidade,
          operador,
          valorMin: vMin,
          valorMax: vMax,
          jejum: col.jejum ?? "qualquer",
          riscoCv: col.riscoCv ?? "qualquer",
        }));
        if (r) ok++;
      }
      toast({ title: "Matriz aplicada", description: `${ok} regra(s) criada(s).` });
      setCells({});
      onCreated();
      onOpenChange(false);
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Criar variações em lote — {parametro.rotulo}
          </DialogTitle>
          <DialogDescription>
            Aplique um template clínico pronto ou monte uma matriz personalizada.
            Cada célula preenchida vira uma linha na aba "Valores de referência".
          </DialogDescription>
        </DialogHeader>

        <div className="w-full">
          <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5 mb-3">
            <button
              type="button"
              onClick={() => setTab("templates")}
              className={cn(
                "inline-flex items-center px-3 py-1.5 rounded-[5px] text-[12px] font-medium transition-colors",
                tab === "templates" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Templates clínicos
            </button>
            <button
              type="button"
              onClick={() => setTab("matriz")}
              className={cn(
                "inline-flex items-center px-3 py-1.5 rounded-[5px] text-[12px] font-medium transition-colors",
                tab === "matriz" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Grid3x3 className="h-3.5 w-3.5 mr-1.5" /> Matriz personalizada
            </button>
          </div>

          {tab === "templates" && (
          <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">

            {templatesRelevantes.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-primary font-semibold mb-2">
                  Sugeridos para este exame
                </div>
                <div className="grid gap-2">
                  {templatesRelevantes.map((t) => (
                    <TemplateCard key={t.id} tpl={t} loading={loading} onApply={() => aplicarTemplate(t)} />
                  ))}
                </div>
              </div>
            )}
            {outrosTemplates.length > 0 && (
              <div className="pt-2">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  Outros templates disponíveis
                </div>
                <div className="grid gap-2">
                  {outrosTemplates.map((t) => (
                    <TemplateCard key={t.id} tpl={t} loading={loading} onApply={() => aplicarTemplate(t)} />
                  ))}
                </div>
              </div>
            )}
            {TEMPLATES.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                Nenhum template disponível.
              </div>
            )}
          </div>
          )}

          {tab === "matriz" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px]">Operador (todas as células)</Label>
                <Select value={operador} onValueChange={(v) => setOperador(v as OperadorVR)}>
                  <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="menor">&lt; menor que</SelectItem>
                    <SelectItem value="menor_igual">≤ menor ou igual</SelectItem>
                    <SelectItem value="maior">&gt; maior que</SelectItem>
                    <SelectItem value="maior_igual">≥ maior ou igual</SelectItem>
                    <SelectItem value="entre">Entre (use "70-99")</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">Unidade</Label>
                <Input value={unidade} onChange={(e) => setUnidade(e.target.value)} className="h-9 text-[12px]" />
              </div>
            </div>

            {!usaJejum && !usaRisco && (
              <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5">
                Sem dimensão de Jejum/Risco CV ativa no parâmetro — a matriz vira uma coluna única "Valor".
                Ative os toggles em <strong>Editar parâmetro → Comportamento</strong> para ter mais colunas.
              </div>
            )}

            <div className="border border-border/50 rounded-lg overflow-auto max-h-[50vh]">
              <table className="w-full text-[12px]">
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-2 py-2 sticky left-0 bg-muted/40 z-10">Faixa etária</th>
                    {colunas.map((c) => (
                      <th key={c.key} className="text-center px-2 py-2 whitespace-nowrap">{c.label}</th>
                    ))}
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {faixas.map((f, i) => (
                    <tr key={i} className="hover:bg-muted/20">
                      <td className="px-2 py-1.5 sticky left-0 bg-background z-10">
                        <div className="flex items-center gap-1">
                          <Input
                            value={f.de}
                            onChange={(e) => updFaixa(i, { de: e.target.value })}
                            className="h-8 w-14 text-center text-[12px] px-1"
                            placeholder="de"
                          />
                          <span className="text-muted-foreground/60">–</span>
                          <Input
                            value={f.ate}
                            onChange={(e) => updFaixa(i, { ate: e.target.value })}
                            className="h-8 w-14 text-center text-[12px] px-1"
                            placeholder="até"
                          />
                          <Select value={f.unidade} onValueChange={(v) => updFaixa(i, { unidade: v as UnidIdade })}>
                            <SelectTrigger className="h-8 text-[11px] px-1.5 w-[64px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Dias">Dias</SelectItem>
                              <SelectItem value="Meses">Meses</SelectItem>
                              <SelectItem value="Anos">Anos</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                      {colunas.map((c) => {
                        const k = `${i}|${c.key}`;
                        return (
                          <td key={c.key} className="px-2 py-1.5">
                            <Input
                              value={cells[k] ?? ""}
                              onChange={(e) => setCells((s) => ({ ...s, [k]: e.target.value }))}
                              className="h-8 text-center text-[12px]"
                              placeholder={operador === "entre" ? "min-max" : "valor"}
                            />
                          </td>
                        );
                      })}
                      <td className="px-1">
                        <button
                          onClick={() => rmFaixa(i)}
                          className="h-7 w-7 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center"
                          title="Remover faixa"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="outline" size="sm" onClick={addFaixa} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Adicionar faixa etária
            </Button>
          </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          {tab === "matriz" && (
            <Button onClick={aplicarMatriz} disabled={loading} className="gap-1.5">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Criar regras
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const TemplateCard = ({ tpl, loading, onApply }: { tpl: TemplatePreset; loading: boolean; onApply: () => void }) => (
  <div className="border border-border/50 rounded-lg p-3 flex items-start justify-between gap-3 hover:border-primary/40 transition-colors">
    <div className="min-w-0">
      <div className="text-[13px] font-semibold text-foreground">{tpl.label}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">
        {tpl.resumo} • {tpl.unidade} • <span className="italic">{tpl.fonte}</span>
      </div>
    </div>
    <Button size="sm" onClick={onApply} disabled={loading} className="gap-1.5 shrink-0">
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      Aplicar
    </Button>
  </div>
);

export default VariacaoMatrizDialog;
