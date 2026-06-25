// Painel "Padrão + Variações" — interface principal de Valores de Referência.
//
// Modelo (redesign aprovado em /docs/.../REDESIGN_VALORES_REFERENCIA.md):
//   PARÂMETRO ─┬─ Padrão (1 obrigatório)
//              ├─ Variação: Gestante, Recém-nascido, Criança, Adolescente,
//              │            Adulto, Idoso, Masculino, Feminino
//              └─ Personalizada (faixa etária livre — modo Avançado/Matriz)
//
// Resolver: maior prioridade compatível com sexo+idade+gestante vence.

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Check, X, ChevronDown, AlertTriangle, Eraser } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  type ValorReferencia, type CategoriaVR, CATEGORIA_META,
  addValorReferencia, updateValorReferencia, removeValorReferencia,
} from "@/data/valoresReferenciaStore";
import type { ExameParametro } from "@/data/exameParametrosStore";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

interface CardProps {
  vr: ValorReferencia | null;            // null = ainda não existe (card placeholder)
  categoria: CategoriaVR;
  exameNome: string;
  parametro: ExameParametro;
  onMutate: () => void;
}

const ValorCard = ({ vr, categoria, exameNome, parametro, onMutate }: CardProps) => {
  const { toast } = useToast();
  const meta = CATEGORIA_META[categoria];
  const exists = !!vr;

  const [normMin, setNormMin] = useState(vr?.valorMin ?? "");
  const [normMax, setNormMax] = useState(vr?.valorMax ?? "");
  const [critMin, setCritMin] = useState(vr?.criticoMin ?? "");
  const [critMax, setCritMax] = useState(vr?.criticoMax ?? "");
  const [unidade, setUnidade] = useState(vr?.unidade ?? "");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState<null | "remove" | "clear">(null);

  useEffect(() => {
    setNormMin(vr?.valorMin ?? "");
    setNormMax(vr?.valorMax ?? "");
    setCritMin(vr?.criticoMin ?? "");
    setCritMax(vr?.criticoMax ?? "");
    setUnidade(vr?.unidade ?? "");
  }, [vr?.id]);

  const dirty =
    (vr?.valorMin ?? "") !== normMin ||
    (vr?.valorMax ?? "") !== normMax ||
    (vr?.criticoMin ?? "") !== critMin ||
    (vr?.criticoMax ?? "") !== critMax ||
    (vr?.unidade ?? "") !== unidade;

  const nMin = num(normMin), nMax = num(normMax), cMin = num(critMin), cMax = num(critMax);
  const previewOk = nMin !== null ? (nMin + nMax!) / 2 : null;
  const isPadrao = categoria === "padrao";

  const validar = (): string | null => {
    if (!normMin && !normMax) return "Informe ao menos um limite normal";
    if (nMin !== null && nMax !== null && nMin > nMax) return "Mínimo normal > máximo";
    if (cMin !== null && cMax !== null && cMin > cMax) return "Mínimo crítico > máximo";
    return null;
  };

  const persistir = async (payload: Omit<ValorReferencia, "id">) => {
    if (vr) await updateValorReferencia(vr.id, payload);
    else await addValorReferencia(payload);
  };

  const buildPayload = (overrides?: Partial<ValorReferencia>): Omit<ValorReferencia, "id"> => ({
    exameNome,
    parametroNome: parametro.chave || parametro.rotulo,
    sexo: meta.sexo,
    idadeMin: "", idadeMax: "", unidadeIdade: "Anos",
    valorMin: normMin, valorMax: normMax,
    unidade,
    descricao: "",
    criticoMin: critMin, criticoMax: critMax,
    categoria,
    ...overrides,
  });

  const salvar = async () => {
    const err = validar();
    if (err) { toast({ title: err, variant: "destructive" }); return; }
    setSaving(true);
    try {
      await persistir(buildPayload());
      onMutate();
      toast({ title: vr ? "Atualizado" : "Adicionado" });
    } finally { setSaving(false); }
  };

  const limparESalvar = async () => {
    setSaving(true);
    try {
      await persistir(buildPayload({
        valorMin: "", valorMax: "", criticoMin: "", criticoMax: "", unidade: "",
      }));
      setNormMin(""); setNormMax(""); setCritMin(""); setCritMax(""); setUnidade("");
      onMutate();
      toast({ title: "Valores limpos" });
    } finally { setSaving(false); setConfirmOpen(null); }
  };

  const remover = async () => {
    if (!vr) return;
    setRemoving(true);
    try { await removeValorReferencia(vr.id); onMutate(); toast({ title: "Removido" }); }
    finally { setRemoving(false); setConfirmOpen(null); }
  };

  const borderClass = isPadrao
    ? "border-primary/30 bg-primary/5"
    : exists ? "border-border/60" : "border-dashed border-border/40 bg-muted/10";

  const hasAnyValue = !!(normMin || normMax || critMin || critMax || unidade);

  return (
    <div className={`rounded-xl border ${borderClass} p-3 transition-all`}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{meta.icon}</span>
          <div>
            <div className="text-[13px] font-semibold text-foreground leading-tight">{meta.label}</div>
            <div className="text-[10px] text-muted-foreground">
              {isPadrao
                ? "Vale para todos os pacientes"
                : meta.sexo !== "Ambos" ? `${meta.sexo}${meta.idadeMinDias !== null ? ` • ${meta.idadeMinDias}–${meta.idadeMaxDias ?? "∞"}d` : ""}`
                : meta.idadeMinDias !== null ? `${meta.idadeMinDias}–${meta.idadeMaxDias ?? "∞"}d` : "Categoria"}
            </div>
          </div>
        </div>
        {exists && (
          <button
            onClick={remover} disabled={removing}
            className="h-7 w-7 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center"
            title={isPadrao ? "Remover regra padrão" : "Remover variação"}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-[88px_1fr_8px_1fr_60px] gap-1.5 items-center text-[12px]">
        <div className="text-[11px] text-muted-foreground font-medium">Normal</div>
        <Input value={normMin} onChange={(e) => setNormMin(e.target.value)} placeholder="min" className="h-8 text-[12px]" />
        <span className="text-muted-foreground text-center">–</span>
        <Input value={normMax} onChange={(e) => setNormMax(e.target.value)} placeholder="max" className="h-8 text-[12px]" />
        <Input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="un." className="h-8 text-[11px] px-1.5" />

        <div className="text-[11px] text-muted-foreground font-medium">Crítico</div>
        <Input value={critMin} onChange={(e) => setCritMin(e.target.value)} placeholder="min" className="h-8 text-[12px]" />
        <span className="text-muted-foreground text-center">–</span>
        <Input value={critMax} onChange={(e) => setCritMax(e.target.value)} placeholder="max" className="h-8 text-[12px]" />
        <div />
      </div>

      {(nMin !== null && nMax !== null) && (
        <div className="mt-2 pt-2 border-t border-border/30 flex items-center gap-3 text-[11px]">
          <span className="text-muted-foreground">Preview:</span>
          {previewOk !== null && (
            <span className={`${previewClass(previewOk, nMin, nMax, cMin, cMax)} font-medium`}>
              {previewOk.toFixed(1)} → NORMAL
            </span>
          )}
          {cMin !== null && (
            <span className={`${previewClass(cMin - 0.1, nMin, nMax, cMin, cMax)} font-medium`}>
              {(cMin - 0.1).toFixed(1)} → CRÍTICO
            </span>
          )}
        </div>
      )}

      {dirty && (
        <div className="mt-2 flex items-center justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => {
            setNormMin(vr?.valorMin ?? ""); setNormMax(vr?.valorMax ?? "");
            setCritMin(vr?.criticoMin ?? ""); setCritMax(vr?.criticoMax ?? "");
            setUnidade(vr?.unidade ?? "");
          }} className="h-7 px-2 text-[11px]">
            <X className="h-3 w-3 mr-1" /> Cancelar
          </Button>
          <Button size="sm" onClick={salvar} disabled={saving} className="h-7 px-2.5 text-[11px]">
            <Check className="h-3 w-3 mr-1" /> Salvar
          </Button>
        </div>
      )}
    </div>
  );
};

const ParametroBloco = ({
  exameNome, parametro, refs, onMutate,
}: { exameNome: string; parametro: ExameParametro; refs: ValorReferencia[]; onMutate: () => void }) => {
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

  // Variações "custom" (faixas etárias arbitrárias do modo Avançado) — exibidas como cards somente-leitura com link.
  const customs = meusRefs.filter((r) => r.categoria === "custom");

  return (
    <div className="rounded-2xl border border-border/40 bg-background p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[14px] font-semibold text-foreground">{parametro.rotulo}</div>
          {parametro.abreviacao && (
            <div className="text-[11px] text-muted-foreground">{parametro.abreviacao}</div>
          )}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {meusRefs.length} {meusRefs.length === 1 ? "regra" : "regras"}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <ValorCard vr={padrao} categoria="padrao" exameNome={exameNome} parametro={parametro} onMutate={onMutate} />
        {variacoes.map(({ cat, vr }) => (
          <ValorCard key={cat} vr={vr} categoria={cat} exameNome={exameNome} parametro={parametro} onMutate={onMutate} />
        ))}
      </div>

      {customs.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-1.5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
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
                  onClick={async () => {
                    if (!window.confirm("Remover esta regra personalizada?")) return;
                    await removeValorReferencia(c.id);
                    onMutate();
                  }}
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

      {variacoesDisponiveis.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full rounded-lg border border-dashed border-border/50 py-2 text-[12px] text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 flex items-center justify-center gap-1.5 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Adicionar variação <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-56">
            {variacoesDisponiveis.map((cat) => {
              const m = CATEGORIA_META[cat];
              return (
                <DropdownMenuItem key={cat} onClick={() => adicionarVariacao(cat)} className="gap-2">
                  <span>{m.icon}</span> <span>{m.label}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

const ValoresReferenciaPanel = ({ exameNome, parametros, referencias, onMutate }: Props) => {
  if (parametros.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
        Este exame ainda não tem parâmetros. Cadastre parâmetros antes de definir valores de referência.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {parametros.map((p) => (
        <ParametroBloco key={p.id} exameNome={exameNome} parametro={p} refs={referencias} onMutate={onMutate} />
      ))}
    </div>
  );
};

export default ValoresReferenciaPanel;
