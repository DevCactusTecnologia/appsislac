import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Settings2, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  type ValorReferencia, addValorReferencia, removeValorReferencia, updateValorReferencia,
} from "@/data/valoresReferenciaStore";
import {
  loadReguas, getReguas, subscribeReguas, type ReguaEtaria,
} from "@/data/reguasEtariasStore";
import { fromDias, labelFaixa, toDias, vrCabeNaFaixa, type FaixaEtaria } from "@/lib/idadeFaixas";
import CoberturaEtariaBar from "./CoberturaEtariaBar";

interface Props {
  exameNome: string;
  /** Nomes de parâmetro disponíveis (do exameParametrosStore). */
  parametros: string[];
  /** VRs cadastrados para este exame. */
  referencias: ValorReferencia[];
  /** Botão "Gerenciar réguas" externo (opcional). */
  onAbrirGerenciador: () => void;
  /** Callback após mutação: parent refaz a lista local. */
  onMutate: () => void;
}

type Sexo = "Masculino" | "Feminino";
const SEXOS: Sexo[] = ["Masculino", "Feminino"];

const vrToDias = (vr: ValorReferencia) => ({
  de: toDias(vr.idadeMin || "0", vr.unidadeIdade),
  ate: toDias(vr.idadeMax || "999", vr.unidadeIdade),
});

const MatrizValoresReferencia = ({
  exameNome, parametros, referencias, onAbrirGerenciador, onMutate,
}: Props) => {
  const { toast } = useToast();
  const [reguas, setReguas] = useState<ReguaEtaria[]>([]);
  const [reguaId, setReguaId] = useState<string>("sys:pediatrica-sysmex");
  const [parametro, setParametro] = useState<string>(parametros[0] ?? "");
  const [unidade, setUnidade] = useState<string>("");
  const [draft, setDraft] = useState<Record<string, { min: string; max: string }>>({});

  useEffect(() => {
    loadReguas().then(setReguas);
    return subscribeReguas(() => setReguas(getReguas()));
  }, []);

  useEffect(() => {
    if (!parametro && parametros.length > 0) setParametro(parametros[0]);
  }, [parametros, parametro]);

  const regua = useMemo(
    () => reguas.find((r) => r.id === reguaId) ?? reguas[0],
    [reguas, reguaId],
  );

  const refsDoParametro = useMemo(
    () => referencias.filter(
      (r) => r.parametroNome.toLowerCase() === parametro.toLowerCase(),
    ),
    [referencias, parametro],
  );

  // Unidade default: pega a primeira encontrada nos VRs deste parâmetro.
  useEffect(() => {
    const u = refsDoParametro.find((r) => r.unidade)?.unidade ?? "";
    setUnidade(u);
    setDraft({});
  }, [parametro, refsDoParametro.length]);

  const cellKey = (sexo: Sexo, faixaId: string) => `${sexo}|${faixaId}`;

  // Mapa célula → VR encaixado (sexo exato + intervalo contido na faixa).
  const cellMap = useMemo(() => {
    const map: Record<string, ValorReferencia | undefined> = {};
    if (!regua) return map;
    for (const sexo of SEXOS) {
      for (const f of regua.faixas) {
        const candidato = refsDoParametro.find((r) => {
          if (r.sexo !== sexo) return false;
          const { de, ate } = vrToDias(r);
          return vrCabeNaFaixa(de, ate, f.deDias, f.ateDias);
        });
        map[cellKey(sexo, f.id)] = candidato;
      }
    }
    return map;
  }, [refsDoParametro, regua]);

  // VRs que NÃO encaixam em nenhuma faixa da régua atual (cross-faixa, "Ambos", etc.)
  const foraDaRegua = useMemo(() => {
    if (!regua) return [] as ValorReferencia[];
    return refsDoParametro.filter((r) => {
      if (r.sexo === "Ambos") return true;
      const { de, ate } = vrToDias(r);
      return !regua.faixas.some((f) => vrCabeNaFaixa(de, ate, f.deDias, f.ateDias));
    });
  }, [refsDoParametro, regua]);

  // Faixas (em dias) cobertas por VRs por sexo — alimenta a barra de cobertura.
  const faixasCobertasPorSexo = useMemo(() => {
    const por: Record<Sexo, FaixaEtaria[]> = { Masculino: [], Feminino: [] };
    for (const r of refsDoParametro) {
      const { de, ate } = vrToDias(r);
      const item: FaixaEtaria = { id: `vr-${r.id}`, label: labelFaixa(de, ate), deDias: de, ateDias: ate };
      if (r.sexo === "Ambos") { por.Masculino.push(item); por.Feminino.push(item); }
      else if (r.sexo === "Masculino" || r.sexo === "Feminino") por[r.sexo].push(item);
    }
    return por;
  }, [refsDoParametro]);

  if (!regua) {
    return <div className="p-6 text-center text-sm text-muted-foreground">Carregando réguas…</div>;
  }

  const getDraft = (sexo: Sexo, f: FaixaEtaria): { min: string; max: string } => {
    const k = cellKey(sexo, f.id);
    if (draft[k]) return draft[k];
    const vr = cellMap[k];
    return { min: vr?.valorMin ?? "", max: vr?.valorMax ?? "" };
  };

  const setCellDraft = (sexo: Sexo, f: FaixaEtaria, patch: Partial<{ min: string; max: string }>) => {
    const k = cellKey(sexo, f.id);
    const atual = getDraft(sexo, f);
    setDraft((d) => ({ ...d, [k]: { ...atual, ...patch } }));
  };

  const persistCell = async (sexo: Sexo, f: FaixaEtaria) => {
    const k = cellKey(sexo, f.id);
    const valores = draft[k];
    if (!valores) return;
    const vr = cellMap[k];
    const ambosVazios = !valores.min.trim() && !valores.max.trim();

    if (vr && ambosVazios) {
      const ok = await removeValorReferencia(vr.id);
      if (ok) toast({ title: "Faixa removida" });
      setDraft((d) => { const c = { ...d }; delete c[k]; return c; });
      onMutate();
      return;
    }
    if (ambosVazios) { setDraft((d) => { const c = { ...d }; delete c[k]; return c; }); return; }

    if (vr) {
      // mantém a unidadeIdade original do registro
      const ok = await updateValorReferencia(vr.id, {
        ...vr,
        valorMin: valores.min.trim(),
        valorMax: valores.max.trim(),
        unidade: unidade.trim() || vr.unidade,
      });
      if (!ok) { toast({ title: "Erro ao salvar", variant: "destructive" }); return; }
    } else {
      const idadeMinFmt = fromDias(f.deDias);
      const idadeMaxFmt = fromDias(f.ateDias);
      // grava na mesma unidade do mín, convertendo o máx
      const unidadeIdade = idadeMinFmt.unidade;
      const idadeMaxStr = unidadeIdade === idadeMaxFmt.unidade
        ? idadeMaxFmt.valor
        : String(toDias(idadeMaxFmt.valor, idadeMaxFmt.unidade) /
            (unidadeIdade === "Anos" ? 365 : unidadeIdade === "Meses" ? 30 : 1));
      const novo = await addValorReferencia({
        exameNome,
        parametroNome: parametro,
        sexo,
        idadeMin: idadeMinFmt.valor,
        idadeMax: idadeMaxStr,
        unidadeIdade,
        valorMin: valores.min.trim(),
        valorMax: valores.max.trim(),
        unidade: unidade.trim(),
        descricao: `${sexo} • ${f.label}`,
      });
      if (!novo) { toast({ title: "Erro ao salvar", variant: "destructive" }); return; }
    }
    setDraft((d) => { const c = { ...d }; delete c[k]; return c; });
    onMutate();
  };

  const copiarSexo = async (de: Sexo, para: Sexo) => {
    let count = 0;
    for (const f of regua.faixas) {
      const origem = cellMap[cellKey(de, f.id)];
      if (!origem) continue;
      const destino = cellMap[cellKey(para, f.id)];
      if (destino) {
        const ok = await updateValorReferencia(destino.id, {
          ...destino,
          valorMin: origem.valorMin, valorMax: origem.valorMax, unidade: origem.unidade || unidade,
        });
        if (ok) count++;
      } else {
        const idadeMinFmt = fromDias(f.deDias);
        const idadeMaxFmt = fromDias(f.ateDias);
        const unidadeIdade = idadeMinFmt.unidade;
        const novo = await addValorReferencia({
          exameNome, parametroNome: parametro, sexo: para,
          idadeMin: idadeMinFmt.valor,
          idadeMax: unidadeIdade === idadeMaxFmt.unidade
            ? idadeMaxFmt.valor
            : String(toDias(idadeMaxFmt.valor, idadeMaxFmt.unidade) /
                (unidadeIdade === "Anos" ? 365 : unidadeIdade === "Meses" ? 30 : 1)),
          unidadeIdade,
          valorMin: origem.valorMin, valorMax: origem.valorMax,
          unidade: origem.unidade || unidade,
          descricao: `${para} • ${f.label} (cópia de ${de})`,
        });
        if (novo) count++;
      }
    }
    setDraft({});
    onMutate();
    toast({ title: `${count} faixa(s) copiada(s) de ${de} para ${para}` });
  };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/40 bg-muted/20 p-3">
        <div className="space-y-1.5 min-w-[200px] flex-1">
          <Label className="text-[11px] text-muted-foreground">Parâmetro</Label>
          {parametros.length > 0 ? (
            <Select value={parametro} onValueChange={setParametro}>
              <SelectTrigger className="rounded-xl h-9 text-sm bg-background border-border/60">
                <SelectValue placeholder="Selecione um parâmetro" />
              </SelectTrigger>
              <SelectContent>
                {parametros.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Input className="rounded-xl h-9 text-sm bg-background border-border/60"
              value={parametro} onChange={(e) => setParametro(e.target.value)}
              placeholder="Ex: Hemoglobina" />
          )}
        </div>

        <div className="space-y-1.5 min-w-[200px] flex-1">
          <Label className="text-[11px] text-muted-foreground">Régua etária</Label>
          <Select value={reguaId} onValueChange={setReguaId}>
            <SelectTrigger className="rounded-xl h-9 text-sm bg-background border-border/60"><SelectValue /></SelectTrigger>
            <SelectContent>
              {reguas.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.nome}{r.sistema ? " (sistema)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 w-[140px]">
          <Label className="text-[11px] text-muted-foreground">Unidade</Label>
          <Input className="rounded-xl h-9 text-sm bg-background border-border/60"
            value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="g/dL" />
        </div>

        <button
          onClick={onAbrirGerenciador}
          className="h-9 px-3 rounded-xl border border-border/60 bg-background text-[12px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all flex items-center gap-1.5"
        >
          <Settings2 className="h-3.5 w-3.5" /> Gerenciar réguas
        </button>
      </div>

      {/* Validador de cobertura */}
      {parametro && (
        <div className="rounded-2xl border border-border/40 p-4 space-y-3 bg-background">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Cobertura por sexo (0d → 150a)
          </div>
          {SEXOS.map((s) => (
            <CoberturaEtariaBar key={s} sexo={s} faixas={faixasCobertasPorSexo[s]} />
          ))}
        </div>
      )}

      {/* Matriz */}
      {parametro && (
        <div className="rounded-2xl border border-border/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border/30">
                  <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider sticky left-0 bg-muted/30 z-10">
                    Sexo
                  </th>
                  {regua.faixas.map((f) => (
                    <th key={f.id} className="text-center py-2.5 px-2 text-[11px] font-semibold text-foreground">
                      <div>{f.label}</div>
                      <div className="text-[9px] font-normal text-muted-foreground mt-0.5">
                        {labelFaixa(f.deDias, f.ateDias)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SEXOS.map((sexo) => (
                  <tr key={sexo} className="border-b border-border/20">
                    <td className="py-2 px-3 text-[12px] font-medium text-foreground sticky left-0 bg-background z-10 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span>{sexo === "Masculino" ? "♂" : "♀"}</span>
                        <span>{sexo}</span>
                      </div>
                    </td>
                    {regua.faixas.map((f) => {
                      const v = getDraft(sexo, f);
                      const has = !!cellMap[cellKey(sexo, f.id)];
                      return (
                        <td key={f.id} className={`py-1.5 px-1.5 ${has ? "bg-primary/[0.03]" : ""}`}>
                          <div className="flex items-center gap-1 justify-center">
                            <Input
                              className="rounded-lg h-8 text-[12px] bg-muted/30 border-border/60 w-16 px-1.5 text-center"
                              value={v.min}
                              placeholder="—"
                              onChange={(e) => setCellDraft(sexo, f, { min: e.target.value })}
                              onBlur={() => persistCell(sexo, f)}
                            />
                            <span className="text-muted-foreground text-[10px]">–</span>
                            <Input
                              className="rounded-lg h-8 text-[12px] bg-muted/30 border-border/60 w-16 px-1.5 text-center"
                              value={v.max}
                              placeholder="—"
                              onChange={(e) => setCellDraft(sexo, f, { max: e.target.value })}
                              onBlur={() => persistCell(sexo, f)}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-3 py-2.5 bg-muted/20 border-t border-border/30 flex flex-wrap items-center gap-2">
            <button
              onClick={() => copiarSexo("Masculino", "Feminino")}
              className="h-8 px-3 rounded-lg border border-border/60 bg-background text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all flex items-center gap-1.5"
            >
              <ArrowRightLeft className="h-3 w-3" /> Copiar ♂ → ♀
            </button>
            <button
              onClick={() => copiarSexo("Feminino", "Masculino")}
              className="h-8 px-3 rounded-lg border border-border/60 bg-background text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all flex items-center gap-1.5"
            >
              <ArrowRightLeft className="h-3 w-3" /> Copiar ♀ → ♂
            </button>
            <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" /> As alterações são salvas ao sair do campo.
            </span>
          </div>
        </div>
      )}

      {/* VRs fora da régua atual */}
      {foraDaRegua.length > 0 && (
        <div className="rounded-2xl border border-[hsl(var(--status-warning))]/40 bg-[hsl(var(--status-warning))]/5 p-3">
          <div className="text-[11px] font-semibold text-[hsl(var(--status-warning))] uppercase tracking-wider mb-2">
            {foraDaRegua.length} faixa(s) fora da régua atual
          </div>
          <p className="text-[11px] text-muted-foreground mb-2">
            Estas faixas existem para o parâmetro mas não encaixam nas colunas desta régua (sexo "Ambos" ou intervalo cruzando faixas). Trocar a régua não as altera; edite-as na aba <strong>Lista</strong>.
          </p>
          <ul className="space-y-1">
            {foraDaRegua.map((r) => (
              <li key={r.id} className="text-[12px] text-foreground flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-muted text-[10px]">{r.sexo}</span>
                <span className="text-muted-foreground">{r.idadeMin}–{r.idadeMax} {r.unidadeIdade}</span>
                <span className="font-medium">{r.valorMin || "—"} a {r.valorMax || "—"} {r.unidade}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MatrizValoresReferencia;
