// Painel "Padrão + Variações" — interface principal de Valores de Referência.
//
// Modelo (redesign aprovado em /docs/.../REDESIGN_VALORES_REFERENCIA.md):
//   PARÂMETRO ─┬─ Padrão (1 obrigatório)
//              ├─ Variação: Gestante, Recém-nascido, Criança, Adolescente,
//              │            Adulto, Idoso, Masculino, Feminino
//              └─ Personalizada (faixa etária livre — modo Avançado/Matriz)
//
// Layout: "Matriz de dados moderna" — cada parâmetro é um bloco com tabela de regras
// (1 linha por categoria), salva automaticamente ao sair do campo.

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ChevronDown, AlertTriangle, Eraser, EyeOff, Eye } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  type ValorReferencia, type CategoriaVR, type JejumVR, type OperadorVR, CATEGORIA_META,
  addValorReferencia, updateValorReferencia, removeValorReferencia,
} from "@/data/valoresReferenciaStore";
import type { ExameParametro } from "@/data/exameParametrosStore";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const JEJUM_LABEL: Record<JejumVR, string> = {
  qualquer: "Qualquer",
  com_jejum: "Com jejum",
  sem_jejum: "Sem jejum",
};
const OPERADOR_LABEL: Record<OperadorVR, string> = {
  entre: "Entre",
  menor: "<",
  menor_igual: "≤",
  maior: ">",
  maior_igual: "≥",
  igual: "=",
};
const OPERADOR_LABEL_LONGO: Record<OperadorVR, string> = {
  entre: "Entre (min–max)",
  menor: "< menor que",
  menor_igual: "≤ menor ou igual",
  maior: "> maior que",
  maior_igual: "≥ maior ou igual",
  igual: "= igual a",
};

// Paleta de chip por categoria — tons suaves, sem quebrar tema claro/escuro.
const CATEGORIA_CHIP: Record<CategoriaVR, string> = {
  padrao: "bg-primary/10 text-primary border-primary/20",
  gestante: "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:border-pink-500/30",
  recem_nascido: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
  crianca: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  adolescente: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30",
  adulto: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  idoso: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
  masculino: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30",
  feminino: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
  custom: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
};

/** Resumo "Sexo • Faixa etária" exibido sob o chip da categoria. */
const SEXO_LABEL: Record<"Ambos" | "Masculino" | "Feminino", string> = {
  Ambos: "Ambos sexos",
  Masculino: "♂ Masculino",
  Feminino: "♀ Feminino",
};
const diasParaLabel = (d: number): string => {
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.round(d / 30)}m`;
  return `${Math.round(d / 365)}a`;
};
const categoriaResumo = (cat: CategoriaVR): { sexo: string; idade: string } => {
  const m = CATEGORIA_META[cat];
  const sexo = SEXO_LABEL[m.sexo];
  let idade = "Qualquer idade";
  if (cat === "padrao") idade = "Fallback (sem filtro)";
  else if (cat === "custom") idade = "Faixa livre";
  else if (m.idadeMinDias !== null && m.idadeMaxDias !== null) {
    idade = `${diasParaLabel(m.idadeMinDias)} – ${diasParaLabel(m.idadeMaxDias)}`;
  } else if (m.idadeMinDias !== null) {
    idade = `≥ ${diasParaLabel(m.idadeMinDias)}`;
  } else if (m.idadeMaxDias !== null) {
    idade = `≤ ${diasParaLabel(m.idadeMaxDias)}`;
  }
  return { sexo, idade };
};

interface Props {
  exameNome: string;
  parametros: ExameParametro[];
  referencias: ValorReferencia[];
  onMutate: () => void;
}

const ORDEM_VARIACOES: CategoriaVR[] = [
  "gestante", "recem_nascido", "crianca", "adolescente", "adulto", "idoso", "masculino", "feminino",
];

const previewClass = (
  val: number, normMin: number | null, normMax: number | null, critMin: number | null, critMax: number | null,
) => {
  if ((critMin !== null && val < critMin) || (critMax !== null && val > critMax)) return "text-[hsl(var(--status-danger))]";
  if ((normMin !== null && val < normMin) || (normMax !== null && val > normMax)) return "text-[hsl(var(--status-warning))]";
  return "text-[hsl(var(--status-success))]";
};

const num = (s: string): number | null => {
  const n = parseFloat((s || "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

interface RowProps {
  vr: ValorReferencia | null;
  categoria: CategoriaVR;
  exameNome: string;
  parametro: ExameParametro;
  onMutate: () => void;
}

/** Template do grid de uma linha — compartilhado entre cabeçalho e linhas. */
const ROW_TPL =
  "grid-cols-[1.3fr_0.9fr_1.6fr_1.5fr_1.4fr_1.4fr_0.6fr_1fr_0.7fr]";

type SexoVR = "Ambos" | "Masculino" | "Feminino";
type UnidIdade = "Anos" | "Meses" | "Dias";

const RegraLinha = ({ vr, categoria, exameNome, parametro, onMutate }: RowProps) => {
  const { toast } = useToast();
  const meta = CATEGORIA_META[categoria];
  const exists = !!vr;
  const isPadrao = categoria === "padrao";
  const isGestante = categoria === "gestante";

  // Defaults para uma linha NOVA — se for variação por preset, herda sexo/idade do meta.
  const defaultSexo: SexoVR = vr?.sexo ?? meta.sexo;
  const defaultUnidIdade: UnidIdade = vr?.unidadeIdade
    ?? (meta.idadeMinDias !== null && meta.idadeMinDias < 30 ? "Dias"
        : meta.idadeMinDias !== null && meta.idadeMinDias < 365 ? "Meses" : "Anos");
  const defaultIdadeMin = vr?.idadeMin
    ?? (meta.idadeMinDias !== null
        ? String(defaultUnidIdade === "Anos" ? Math.round(meta.idadeMinDias / 365)
            : defaultUnidIdade === "Meses" ? Math.round(meta.idadeMinDias / 30)
            : meta.idadeMinDias)
        : "");
  const defaultIdadeMax = vr?.idadeMax
    ?? (meta.idadeMaxDias !== null
        ? String(defaultUnidIdade === "Anos" ? Math.round(meta.idadeMaxDias / 365)
            : defaultUnidIdade === "Meses" ? Math.round(meta.idadeMaxDias / 30)
            : meta.idadeMaxDias)
        : "");

  const [normMin, setNormMin] = useState(vr?.valorMin ?? "");
  const [normMax, setNormMax] = useState(vr?.valorMax ?? "");
  const [critMin, setCritMin] = useState(vr?.criticoMin ?? "");
  const [critMax, setCritMax] = useState(vr?.criticoMax ?? "");
  const [unidade, setUnidade] = useState(vr?.unidade ?? "");
  const [jejum, setJejum] = useState<JejumVR>((vr?.jejum as JejumVR) ?? "qualquer");
  const [operador, setOperador] = useState<OperadorVR>((vr?.operador as OperadorVR) ?? "entre");
  const [sexo, setSexo] = useState<SexoVR>(defaultSexo);
  const [idadeMin, setIdadeMin] = useState(defaultIdadeMin);
  const [idadeMax, setIdadeMax] = useState(defaultIdadeMax);
  const [unidadeIdade, setUnidadeIdade] = useState<UnidIdade>(defaultUnidIdade);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState<null | "remove" | "clear">(null);

  useEffect(() => {
    setNormMin(vr?.valorMin ?? "");
    setNormMax(vr?.valorMax ?? "");
    setCritMin(vr?.criticoMin ?? "");
    setCritMax(vr?.criticoMax ?? "");
    setUnidade(vr?.unidade ?? "");
    setJejum((vr?.jejum as JejumVR) ?? "qualquer");
    setOperador((vr?.operador as OperadorVR) ?? "entre");
    setSexo(vr?.sexo ?? defaultSexo);
    setIdadeMin(vr?.idadeMin ?? defaultIdadeMin);
    setIdadeMax(vr?.idadeMax ?? defaultIdadeMax);
    setUnidadeIdade(vr?.unidadeIdade ?? defaultUnidIdade);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vr?.id]);

  const dirty =
    (vr?.valorMin ?? "") !== normMin ||
    (vr?.valorMax ?? "") !== normMax ||
    (vr?.criticoMin ?? "") !== critMin ||
    (vr?.criticoMax ?? "") !== critMax ||
    (vr?.unidade ?? "") !== unidade ||
    (((vr?.jejum as JejumVR) ?? "qualquer")) !== jejum ||
    (((vr?.operador as OperadorVR) ?? "entre")) !== operador ||
    (vr?.sexo ?? defaultSexo) !== sexo ||
    (vr?.idadeMin ?? defaultIdadeMin) !== idadeMin ||
    (vr?.idadeMax ?? defaultIdadeMax) !== idadeMax ||
    (vr?.unidadeIdade ?? defaultUnidIdade) !== unidadeIdade;

  const nMin = num(normMin), nMax = num(normMax), cMin = num(critMin), cMax = num(critMax);
  const isEntre = operador === "entre";

  const previewVal = isEntre && nMin !== null && nMax !== null ? (nMin + nMax) / 2 : nMax;

  const buildPayload = (overrides?: Partial<ValorReferencia>): Omit<ValorReferencia, "id"> => ({
    exameNome,
    parametroNome: parametro.chave || parametro.rotulo,
    sexo: isGestante ? "Feminino" : (isPadrao ? "Ambos" : sexo),
    idadeMin: isPadrao ? "" : idadeMin,
    idadeMax: isPadrao ? "" : idadeMax,
    unidadeIdade,
    valorMin: isEntre ? normMin : "",
    valorMax: normMax,
    unidade,
    descricao: "",
    criticoMin: critMin, criticoMax: critMax,
    categoria,
    jejum,
    operador,
    ...overrides,
  });

  const persistir = async (payload: Omit<ValorReferencia, "id">): Promise<boolean> => {
    if (vr) return updateValorReferencia(vr.id, payload);
    return (await addValorReferencia(payload)) !== null;
  };

  const salvarSeNecessario = async () => {
    if (!dirty) return;
    if (isEntre && nMin !== null && nMax !== null && nMin > nMax) {
      toast({ title: "Mínimo normal maior que máximo", variant: "destructive" });
      return;
    }
    if (cMin !== null && cMax !== null && cMin > cMax) {
      toast({ title: "Mínimo crítico maior que máximo", variant: "destructive" });
      return;
    }
    if (!isPadrao && idadeMin && idadeMax) {
      const a = parseFloat(idadeMin), b = parseFloat(idadeMax);
      if (Number.isFinite(a) && Number.isFinite(b) && a > b) {
        toast({ title: "Idade mínima maior que máxima", variant: "destructive" });
        return;
      }
    }
    if (!exists && !normMin && !normMax && !critMin && !critMax && !unidade) return;
    setSaving(true);
    try {
      const ok = await persistir(buildPayload());
      if (ok) onMutate();
    } finally { setSaving(false); }
  };

  const limparESalvar = async () => {
    setConfirmOpen(null);
    setSaving(true);
    try {
      const ok = await persistir(buildPayload({
        valorMin: "", valorMax: "", criticoMin: "", criticoMax: "", unidade: "",
        jejum: "qualquer", operador: "entre",
      }));
      if (ok) {
        setNormMin(""); setNormMax(""); setCritMin(""); setCritMax(""); setUnidade("");
        setJejum("qualquer"); setOperador("entre");
        onMutate();
        toast({ title: "Valores limpos" });
      }
    } finally { setSaving(false); }
  };

  const remover = async () => {
    if (!vr) return;
    const id = vr.id;
    setConfirmOpen(null);
    setRemoving(true);
    try {
      const ok = await removeValorReferencia(id);
      if (ok) { onMutate(); toast({ title: "Removido" }); }
    } finally { setRemoving(false); }
  };

  const hasAnyValue = !!(normMin || normMax || critMin || critMax || unidade);
  const rowBg = isPadrao ? "bg-primary/[0.02]" : "";

  return (
    <div className={`grid ${ROW_TPL} gap-2 px-4 py-2.5 items-center hover:bg-muted/30 transition-colors ${rowBg} ${saving ? "opacity-70" : ""}`}>
      {/* Categoria */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm leading-none shrink-0">{meta.icon}</span>
        <span
          className={`inline-flex w-fit items-center px-2 py-0.5 rounded-md border text-[11px] font-medium truncate ${CATEGORIA_CHIP[categoria]}`}
          title={`${categoriaResumo(categoria).sexo} • ${categoriaResumo(categoria).idade}`}
        >
          {meta.label}
        </span>
      </div>

      {/* Sexo */}
      <div>
        {isPadrao ? (
          <div className="h-9 flex items-center justify-center text-[11px] text-muted-foreground/60">—</div>
        ) : (
          <Select
            value={sexo}
            onValueChange={(v) => setSexo(v as SexoVR)}
            disabled={isGestante}
          >
            <SelectTrigger
              className="h-9 text-[12px] px-2"
              onBlur={salvarSeNecessario}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Ambos" className="text-[12px]">Ambos</SelectItem>
              <SelectItem value="Masculino" className="text-[12px]">♂ Masculino</SelectItem>
              <SelectItem value="Feminino" className="text-[12px]">♀ Feminino</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Idade De – Até + Unidade */}
      <div>
        {isPadrao ? (
          <div className="h-9 flex items-center justify-center text-[11px] text-muted-foreground/60">qualquer idade</div>
        ) : (
          <div className="flex items-center gap-1">
            <Input
              value={idadeMin}
              onChange={(e) => setIdadeMin(e.target.value)}
              onBlur={salvarSeNecessario}
              placeholder="de"
              className="h-9 text-center text-[12px] px-1 w-full"
              inputMode="numeric"
            />
            <span className="text-muted-foreground/60 text-[10px]">–</span>
            <Input
              value={idadeMax}
              onChange={(e) => setIdadeMax(e.target.value)}
              onBlur={salvarSeNecessario}
              placeholder="até"
              className="h-9 text-center text-[12px] px-1 w-full"
              inputMode="numeric"
            />
            <Select
              value={unidadeIdade}
              onValueChange={(v) => setUnidadeIdade(v as UnidIdade)}
            >
              <SelectTrigger className="h-9 text-[11px] px-1.5 w-[64px]" onBlur={salvarSeNecessario}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Dias" className="text-[12px]">Dias</SelectItem>
                <SelectItem value="Meses" className="text-[12px]">Meses</SelectItem>
                <SelectItem value="Anos" className="text-[12px]">Anos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Condição: operador + jejum */}
      <div className="flex gap-1">
        <Select value={operador} onValueChange={(v) => { setOperador(v as OperadorVR); }}>
          <SelectTrigger className="h-9 text-[12px] px-2" onBlur={salvarSeNecessario}><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(OPERADOR_LABEL_LONGO) as OperadorVR[]).map((op) => (
              <SelectItem key={op} value={op} className="text-[12px]">{OPERADOR_LABEL_LONGO[op]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={jejum} onValueChange={(v) => setJejum(v as JejumVR)}>
          <SelectTrigger className="h-9 text-[12px] px-2" onBlur={salvarSeNecessario}><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(JEJUM_LABEL) as JejumVR[]).map((j) => (
              <SelectItem key={j} value={j} className="text-[12px]">{JEJUM_LABEL[j]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Faixa Normal */}
      <div className="flex items-center gap-1">
        {isEntre ? (
          <>
            <Input
              value={normMin} onChange={(e) => setNormMin(e.target.value)} onBlur={salvarSeNecessario}
              placeholder="min" className="h-9 text-center text-[12px] px-1"
            />
            <span className="text-muted-foreground/60 text-[10px]">–</span>
            <Input
              value={normMax} onChange={(e) => setNormMax(e.target.value)} onBlur={salvarSeNecessario}
              placeholder="max" className="h-9 text-center text-[12px] px-1"
            />
          </>
        ) : (
          <>
            <div className="text-[12px] text-muted-foreground font-semibold w-6 text-center">{OPERADOR_LABEL[operador]}</div>
            <Input
              value={normMax} onChange={(e) => setNormMax(e.target.value)} onBlur={salvarSeNecessario}
              placeholder="valor" className="h-9 text-center text-[12px] px-1"
            />
          </>
        )}
      </div>

      {/* Faixa Crítica */}
      <div className="flex items-center gap-1">
        <Input
          value={critMin} onChange={(e) => setCritMin(e.target.value)} onBlur={salvarSeNecessario}
          placeholder="min" className="h-9 text-center text-[12px] px-1 bg-destructive/[0.03] border-destructive/15 focus-visible:border-destructive/40"
        />
        <span className="text-muted-foreground/60 text-[10px]">–</span>
        <Input
          value={critMax} onChange={(e) => setCritMax(e.target.value)} onBlur={salvarSeNecessario}
          placeholder="max" className="h-9 text-center text-[12px] px-1 bg-destructive/[0.03] border-destructive/15 focus-visible:border-destructive/40"
        />
      </div>

      {/* Unidade */}
      <div>
        <Input
          value={unidade} onChange={(e) => setUnidade(e.target.value)} onBlur={salvarSeNecessario}
          placeholder="un." className="h-9 text-center text-[11px] px-1"
        />
      </div>

      {/* Preview */}
      <div className="flex justify-center">
        {previewVal !== null && exists ? (
          <div className="px-2 py-1 rounded-md bg-muted/50 border border-border/40 text-[11px] font-semibold flex items-center gap-1">
            <span className="text-foreground">{previewVal.toFixed(1)}</span>
            <span className={previewClass(previewVal, nMin, nMax, cMin, cMax)}>●</span>
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground/60 italic">
            {dirty ? "Não salvo" : "—"}
          </span>
        )}
      </div>

      {/* Ações */}
      <div className="flex items-center justify-end gap-0.5">
        {exists && hasAnyValue && (
          <button
            onClick={() => setConfirmOpen("clear")} disabled={saving}
            className="h-8 w-8 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
            title="Limpar valores"
          >
            <Eraser className="h-3.5 w-3.5" />
          </button>
        )}
        {exists && (
          <button
            onClick={() => setConfirmOpen("remove")} disabled={removing}
            className="h-8 w-8 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors"
            title={isPadrao ? "Remover regra padrão" : "Remover variação"}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <AlertDialog open={confirmOpen !== null} onOpenChange={(o) => !o && setConfirmOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {confirmOpen === "clear" ? (
                <><Eraser className="h-4 w-4 text-muted-foreground" /> Limpar valores?</>
              ) : (
                <><Trash2 className="h-4 w-4 text-destructive" /> {isPadrao ? "Remover regra padrão?" : `Remover variação "${meta.label}"?`}</>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmOpen === "clear" ? (
                <>Os limites <strong>Normal</strong>, <strong>Crítico</strong> e <strong>Unidade</strong> desta regra ficarão em branco. A linha continua salva, sem valores.</>
              ) : isPadrao ? (
                <>A regra <strong>Padrão</strong> deste parâmetro será removida. Sem ela, apenas variações específicas (sexo / idade / gestante) serão aplicadas.</>
              ) : (
                <>Esta variação <strong>{meta.label}</strong> será removida. Esta ação não pode ser desfeita.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmOpen === "clear" ? limparESalvar : remover}
              disabled={saving || removing}
              className={confirmOpen === "clear" ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
            >
              {confirmOpen === "clear" ? "Limpar" : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const ParametroBloco = ({
  exameNome, parametro, refs, onMutate, onHide,
}: { exameNome: string; parametro: ExameParametro; refs: ValorReferencia[]; onMutate: () => void; onHide: () => void }) => {

  const chave = (parametro.chave || parametro.rotulo).toLowerCase();
  const meusRefs = useMemo(
    () => refs.filter((r) => (r.parametroNome || "").toLowerCase() === chave),
    [refs, chave],
  );

  const padrao = meusRefs.find((r) => r.categoria === "padrao") ?? null;
  const variacoes = ORDEM_VARIACOES
    .map((cat) => ({ cat, vr: meusRefs.find((r) => r.categoria === cat) ?? null }))
    .filter((x) => x.vr !== null);

  const variacoesDisponiveis = ORDEM_VARIACOES.filter(
    (cat) => !meusRefs.some((r) => r.categoria === cat),
  );

  const adicionarVariacao = async (cat: CategoriaVR) => {
    const meta = CATEGORIA_META[cat];
    await addValorReferencia({
      exameNome,
      parametroNome: parametro.chave || parametro.rotulo,
      sexo: meta.sexo,
      idadeMin: "", idadeMax: "", unidadeIdade: "Anos",
      valorMin: padrao?.valorMin ?? "", valorMax: padrao?.valorMax ?? "",
      unidade: padrao?.unidade ?? "",
      descricao: "",
      criticoMin: padrao?.criticoMin ?? "", criticoMax: padrao?.criticoMax ?? "",
      categoria: cat,
    });
    onMutate();
  };

  const customs = meusRefs.filter((r) => r.categoria === "custom");
  const [customParaRemover, setCustomParaRemover] = useState<ValorReferencia | null>(null);

  // Sempre exibe a linha Padrão (mesmo sem valores) para permitir edição inicial.
  const linhas: Array<{ cat: CategoriaVR; vr: ValorReferencia | null }> = [
    { cat: "padrao", vr: padrao },
    ...variacoes,
  ];

  return (
    <section className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
      {/* Header do parâmetro */}
      <header className="px-5 py-4 border-b border-border/40 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3 min-w-0">
          <h3 className="text-[15px] font-semibold text-foreground truncate">{parametro.rotulo}</h3>
          {parametro.abreviacao && (
            <span className="text-[11px] text-muted-foreground hidden sm:inline">{parametro.abreviacao}</span>
          )}
          <span className="px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px] font-medium border border-border/40 shrink-0">
            {meusRefs.length} {meusRefs.length === 1 ? "regra" : "regras"}
          </span>
        </div>
        <button
          onClick={onHide}
          className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors"
          title="Ocultar este parâmetro da tela"
        >
          <EyeOff className="h-4 w-4" />
        </button>
      </header>

      {/* Cabeçalho da tabela */}
      <div className="grid grid-cols-12 gap-3 px-5 py-2.5 bg-muted/40 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/30">
        <div className="col-span-2">Categoria</div>
        <div className="col-span-2">Condição</div>
        <div className="col-span-2 text-center">Faixa Normal</div>
        <div className="col-span-2 text-center">Faixa Crítica</div>
        <div className="col-span-1 text-center">Unidade</div>
        <div className="col-span-2 text-center">Preview</div>
        <div className="col-span-1 text-right">Ações</div>
      </div>

      {/* Linhas */}
      <div className="divide-y divide-border/30">
        {linhas.map(({ cat, vr }) => (
          <RegraLinha key={cat} vr={vr} categoria={cat} exameNome={exameNome} parametro={parametro} onMutate={onMutate} />
        ))}
      </div>

      {/* Personalizadas (custom) */}
      {customs.length > 0 && (
        <div className="px-5 py-3 bg-amber-500/[0.04] border-t border-amber-500/20 space-y-1.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <div className="text-[11px] text-foreground/80">
              <strong>{customs.length}</strong> regra(s) personalizada(s) (faixa etária livre):
            </div>
          </div>
          <div className="space-y-1 pl-5">
            {customs.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-[11px] bg-background/60 rounded px-2 py-1 border border-border/40">
                <span className="truncate">
                  {c.sexo} • {c.idadeMin || "0"}–{c.idadeMax || "∞"} {c.unidadeIdade} • {c.valorMin}–{c.valorMax} {c.unidade}
                </span>
                <button
                  onClick={() => setCustomParaRemover(c)}
                  className="h-6 w-6 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center shrink-0 ml-2"
                  title="Remover"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="px-5 py-3 bg-muted/30 border-t border-border/40 flex items-center justify-between">
        {variacoesDisponiveis.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-semibold text-[13px] transition-colors group">
                <span className="p-1 rounded bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                </span>
                Adicionar variação
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              {variacoesDisponiveis.map((cat) => {
                const m = CATEGORIA_META[cat];
                const r = categoriaResumo(cat);
                return (
                  <DropdownMenuItem key={cat} onClick={() => adicionarVariacao(cat)} className="gap-2 text-[13px] py-2">
                    <span className="text-base leading-none">{m.icon}</span>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium">{m.label}</span>
                      <span className="text-[10px] text-muted-foreground truncate">{r.sexo} • {r.idade}</span>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-[11px] text-muted-foreground">Todas as variações configuradas.</span>
        )}
        <span className="text-[11px] text-muted-foreground/70">Alterações salvas automaticamente ao sair do campo.</span>
      </footer>

      <AlertDialog open={customParaRemover !== null} onOpenChange={(o) => !o && setCustomParaRemover(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" /> Remover regra personalizada?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {customParaRemover && (
                <>A regra <strong>{customParaRemover.sexo} • {customParaRemover.idadeMin || "0"}–{customParaRemover.idadeMax || "∞"} {customParaRemover.unidadeIdade}</strong> será removida deste parâmetro. Esta ação não pode ser desfeita.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const id = customParaRemover?.id;
                setCustomParaRemover(null);
                if (id) {
                  const ok = await removeValorReferencia(id);
                  if (ok) onMutate();
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

const ValoresReferenciaPanel = ({ exameNome, parametros, referencias, onMutate }: Props) => {
  const storageKey = `vr.hiddenParams.${exameNome}`;
  const [hidden, setHidden] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch { return new Set(); }
  });

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify([...hidden])); } catch { /* ignore */ }
  }, [hidden, storageKey]);

  const hide = (id: string) => setHidden((s) => new Set(s).add(id));
  const show = (id: string) => setHidden((s) => { const n = new Set(s); n.delete(id); return n; });

  if (parametros.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
        Este exame ainda não tem parâmetros. Cadastre parâmetros antes de definir valores de referência.
      </div>
    );
  }

  const visiveis = parametros.filter((p) => !hidden.has(String(p.id)));
  const ocultos = parametros.filter((p) => hidden.has(String(p.id)));

  return (
    <div className="space-y-5">
      {ocultos.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="text-[11px] text-muted-foreground">
              <strong>{ocultos.length}</strong> parâmetro(s) oculto(s) nesta tela:
            </div>
            <button
              onClick={() => setHidden(new Set())}
              className="ml-auto text-[11px] text-primary hover:underline font-medium"
            >
              Reexibir todos
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ocultos.map((p) => (
              <button
                key={p.id}
                onClick={() => show(String(p.id))}
                className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background hover:bg-muted px-2 py-1 text-[11px] text-foreground"
                title="Reexibir parâmetro"
              >
                <Eye className="h-3 w-3 text-muted-foreground" />
                <span className="truncate max-w-[160px]">{p.rotulo}</span>
                <Plus className="h-3 w-3 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}

      {visiveis.map((p) => (
        <ParametroBloco
          key={p.id}
          exameNome={exameNome}
          parametro={p}
          refs={referencias}
          onMutate={onMutate}
          onHide={() => hide(String(p.id))}
        />
      ))}
    </div>
  );
};

export default ValoresReferenciaPanel;
