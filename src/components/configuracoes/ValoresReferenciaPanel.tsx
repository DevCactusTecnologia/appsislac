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
import { Plus, Trash2, Check, X, ChevronDown, AlertTriangle, Eraser, Coffee, EyeOff, Eye } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  type ValorReferencia, type CategoriaVR, type JejumVR, type OperadorVR, CATEGORIA_META,
  addValorReferencia, updateValorReferencia, removeValorReferencia,
} from "@/data/valoresReferenciaStore";
import type { ExameParametro } from "@/data/exameParametrosStore";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
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
  entre: "Entre (min–max)",
  menor: "< menor que",
  menor_igual: "≤ menor ou igual",
  maior: "> maior que",
  maior_igual: "≥ maior ou igual",
  igual: "= igual a",
};
const OPERADOR_SIMBOLO: Record<OperadorVR, string> = {
  entre: "–", menor: "<", menor_igual: "≤", maior: ">", maior_igual: "≥", igual: "=",
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
  const [jejum, setJejum] = useState<JejumVR>((vr?.jejum as JejumVR) ?? "qualquer");
  const [operador, setOperador] = useState<OperadorVR>((vr?.operador as OperadorVR) ?? "entre");
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
  }, [vr?.id]);

  const dirty =
    (vr?.valorMin ?? "") !== normMin ||
    (vr?.valorMax ?? "") !== normMax ||
    (vr?.criticoMin ?? "") !== critMin ||
    (vr?.criticoMax ?? "") !== critMax ||
    (vr?.unidade ?? "") !== unidade ||
    (((vr?.jejum as JejumVR) ?? "qualquer")) !== jejum ||
    (((vr?.operador as OperadorVR) ?? "entre")) !== operador;

  const nMin = num(normMin), nMax = num(normMax), cMin = num(critMin), cMax = num(critMax);
  const previewOk = nMin !== null ? (nMin + nMax!) / 2 : null;
  const isPadrao = categoria === "padrao";
  const isEntre = operador === "entre";

  const validar = (): string | null => {
    if (isEntre) {
      if (!normMin && !normMax) return "Informe ao menos um limite normal";
      if (nMin !== null && nMax !== null && nMin > nMax) return "Mínimo normal > máximo";
    } else {
      if (!normMax) return "Informe o valor de referência";
    }
    if (cMin !== null && cMax !== null && cMin > cMax) return "Mínimo crítico > máximo";
    return null;
  };

  const persistir = async (payload: Omit<ValorReferencia, "id">): Promise<boolean> => {
    if (vr) return updateValorReferencia(vr.id, payload);
    return (await addValorReferencia(payload)) !== null;
  };

  const buildPayload = (overrides?: Partial<ValorReferencia>): Omit<ValorReferencia, "id"> => ({
    exameNome,
    parametroNome: parametro.chave || parametro.rotulo,
    sexo: meta.sexo,
    idadeMin: "", idadeMax: "", unidadeIdade: "Anos",
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


  const salvar = async () => {
    const err = validar();
    if (err) { toast({ title: err, variant: "destructive" }); return; }
    setSaving(true);
    try {
      const ok = await persistir(buildPayload());
      if (ok) {
        onMutate();
        toast({ title: vr ? "Atualizado" : "Adicionado" });
      }
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
    }
    finally { setRemoving(false); }
  };

  const borderClass = isPadrao
    ? "border-primary/30 bg-primary/5"
    : exists ? "border-border/60" : "border-dashed border-border/40 bg-muted/10";

  const hasAnyValue = !!(normMin || normMax || critMin || critMax || unidade);

  return (
    <div className={`rounded-xl border ${borderClass} p-3 transition-all`}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base leading-none">{meta.icon}</span>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-foreground leading-tight truncate">
              {meta.label}
              {jejum !== "qualquer" && (
                <span className="ml-1.5 inline-flex items-center gap-1 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 px-1.5 py-[1px] text-[10px] font-medium align-middle">
                  <Coffee className="h-2.5 w-2.5" /> {JEJUM_LABEL[jejum]}
                </span>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              {isPadrao
                ? "Vale para todos os pacientes"
                : meta.sexo !== "Ambos" ? `${meta.sexo}${meta.idadeMinDias !== null ? ` • ${meta.idadeMinDias}–${meta.idadeMaxDias ?? "∞"}d` : ""}`
                : meta.idadeMinDias !== null ? `${meta.idadeMinDias}–${meta.idadeMaxDias ?? "∞"}d` : "Categoria"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {exists && hasAnyValue && (
            <button
              onClick={() => setConfirmOpen("clear")} disabled={saving}
              className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"
              title="Limpar valores (salvar em branco)"
            >
              <Eraser className="h-3.5 w-3.5" />
            </button>
          )}
          {exists && (
            <button
              onClick={() => setConfirmOpen("remove")} disabled={removing}
              className="h-7 w-7 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center"
              title={isPadrao ? "Remover regra padrão" : "Remover variação"}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Operador + Jejum (controles avançados, compactos) */}
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Operador</div>
          <Select value={operador} onValueChange={(v) => setOperador(v as OperadorVR)}>
            <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(OPERADOR_LABEL) as OperadorVR[]).map((op) => (
                <SelectItem key={op} value={op} className="text-[12px]">{OPERADOR_LABEL[op]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Jejum</div>
          <Select value={jejum} onValueChange={(v) => setJejum(v as JejumVR)}>
            <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(JEJUM_LABEL) as JejumVR[]).map((j) => (
                <SelectItem key={j} value={j} className="text-[12px]">{JEJUM_LABEL[j]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-[88px_1fr_8px_1fr_60px] gap-1.5 items-center text-[12px]">
        <div className="text-[11px] text-muted-foreground font-medium">
          {isEntre ? "Normal" : `Limite ${OPERADOR_SIMBOLO[operador]}`}
        </div>
        {isEntre ? (
          <>
            <Input value={normMin} onChange={(e) => setNormMin(e.target.value)} placeholder="min" className="h-8 text-[12px]" />
            <span className="text-muted-foreground text-center">–</span>
            <Input value={normMax} onChange={(e) => setNormMax(e.target.value)} placeholder="max" className="h-8 text-[12px]" />
          </>
        ) : (
          <>
            <div className="col-span-2 flex items-center justify-center text-muted-foreground text-[12px] font-medium">{OPERADOR_SIMBOLO[operador]}</div>
            <Input value={normMax} onChange={(e) => setNormMax(e.target.value)} placeholder="valor" className="h-8 text-[12px]" />
          </>
        )}
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
                <>Os limites <strong>Normal</strong>, <strong>Crítico</strong> e <strong>Unidade</strong> desta regra ficarão em branco. O cartão continua salvo, sem valores. Você pode preenchê-los novamente a qualquer momento.</>
              ) : isPadrao ? (
                <>A regra <strong>Padrão</strong> deste parâmetro será removida. Sem ela, apenas variações específicas (sexo / idade / gestante) serão aplicadas.</>
              ) : (
                <>A variação <strong>{meta.label}</strong> deste parâmetro será removida. Esta ação não pode ser desfeita.</>
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

  // Variações "custom" (faixas etárias arbitrárias do modo Avançado) — exibidas como cards somente-leitura com link.
  const customs = meusRefs.filter((r) => r.categoria === "custom");
  const [customParaRemover, setCustomParaRemover] = useState<ValorReferencia | null>(null);


  return (
    <div className="rounded-2xl border border-border/40 bg-background p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[14px] font-semibold text-foreground">{parametro.rotulo}</div>
          {parametro.abreviacao && (
            <div className="text-[11px] text-muted-foreground">{parametro.abreviacao}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {meusRefs.length} {meusRefs.length === 1 ? "regra" : "regras"}
          </div>
          <button
            onClick={onHide}
            className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"
            title="Ocultar este parâmetro da tela"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
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
    </div>
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
    <div className="space-y-4">
      {ocultos.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="text-[11px] text-muted-foreground">
              <strong>{ocultos.length}</strong> parâmetro(s) oculto(s) nesta tela:
            </div>
            <button
              onClick={() => setHidden(new Set())}
              className="ml-auto text-[11px] text-primary hover:underline"
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
