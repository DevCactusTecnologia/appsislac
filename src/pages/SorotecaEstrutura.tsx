/**
 * Soroteca 2.0 — Fase 2: Estrutura Física
 *
 * CRUD simples em três colunas (Local → Galeria → Posição).
 * Sem drag-and-drop, sem abstrações desnecessárias.
 */

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Boxes, Layers, MapPin, Loader2, RefreshCw, Pencil, Thermometer, ListPlus, Hash, Grid3x3, ChevronRight, ArrowLeft, History, Sparkles } from "lucide-react";
import { ConfirmarMovimentacaoDialog, HistoricoMovimentacoesDialog, ReorganizarPreviewDialog } from "@/components/soroteca/MovimentacaoDialogs";
import {
  SorotecaDialogHeader,
  SorotecaDialogBody,
  SorotecaDialogFooter as SDFooter,
  Field,
  Section,
} from "@/components/soroteca/SorotecaDialogShell";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { SorotecaShell } from "@/components/soroteca/SorotecaShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { resolveMaterialNome } from "@/data/materiaisAmostraStore";

import {
  type Galeria,
  type LocalArmazenamento,
  type LocalTipo,
  type PosicaoEnriquecida,
  type PosicaoGaleria,
  type OcupacaoLocal,
  atualizarGaleria,
  atualizarLocal,
  atualizarPosicao,
  criarGaleria,
  criarLocal,
  criarPosicao,
  criarPosicoesEmLote,
  criarPosicoesGrid2D,
  listarGalerias,
  listarLocais,
  listarPosicoesComOcupacao,
  ocupacaoPorLocal,
  removerGaleria,
  removerLocal,
  removerPosicao,
} from "@/data/sorotecaEstruturaStore";


const TIPOS: { value: LocalTipo; label: string }[] = [
  { value: "geladeira", label: "Geladeira" },
  { value: "freezer", label: "Freezer" },
  { value: "armario", label: "Armário" },
  { value: "sala", label: "Sala" },
  { value: "outro", label: "Outro" },
];

function LegendDot({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("inline-block h-2.5 w-2.5 rounded-sm border", cls)} />
      {label}
    </span>
  );
}


export default function SorotecaEstrutura() {
  const navigate = useNavigate();

  const [locais, setLocais] = useState<LocalArmazenamento[]>([]);
  const [galerias, setGalerias] = useState<Galeria[]>([]);
  const [posicoes, setPosicoes] = useState<PosicaoEnriquecida[]>([]);
  const [ocupacao, setOcupacao] = useState<Record<string, OcupacaoLocal>>({});

  const [localSel, setLocalSel] = useState<string | null>(null);
  const [galeriaSel, setGaleriaSel] = useState<string | null>(null);
  // mobile breadcrumb-style navigation: which level is visible <lg
  const [mobileView, setMobileView] = useState<"locais" | "galerias" | "posicoes">("locais");

  const [loading, setLoading] = useState(true);

  // dialogs
  const [novoLocalOpen, setNovoLocalOpen] = useState(false);
  const [novaGaleriaOpen, setNovaGaleriaOpen] = useState(false);
  const [novaPosicaoOpen, setNovaPosicaoOpen] = useState(false);
  const [editarLocal, setEditarLocal] = useState<LocalArmazenamento | null>(null);
  const [editarGaleria, setEditarGaleria] = useState<Galeria | null>(null);
  const [editarPosicao, setEditarPosicao] = useState<PosicaoGaleria | null>(null);
  const [confirmar, setConfirmar] = useState<{ tipo: "local" | "galeria" | "posicao"; id: string; nome: string } | null>(null);

  // Drag & drop + movimentação
  const [draggingPos, setDraggingPos] = useState<string | null>(null);
  const [overPos, setOverPos] = useState<string | null>(null);
  const [moverPayload, setMoverPayload] = useState<{
    amostra: { id: string; codigo_barra: string; paciente_nome?: string | null; material_id?: string | null };
    origem: { id: string; codigo: string };
    destino: { id: string; codigo: string };
  } | null>(null);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [reorgOpen, setReorgOpen] = useState(false);


  // ---------- carregamento ----------
  async function refreshLocais() {
    setLoading(true);
    const [data, oc] = await Promise.all([listarLocais(), ocupacaoPorLocal()]);
    setLocais(data);
    setOcupacao(oc);
    setLoading(false);
    if (!data.find((l) => l.id === localSel)) {
      setLocalSel(data[0]?.id ?? null);
    }
  }

  async function refreshGalerias(localId: string | null) {
    if (!localId) {
      setGalerias([]);
      setGaleriaSel(null);
      return;
    }
    const data = await listarGalerias(localId);
    setGalerias(data);
    if (!data.find((g) => g.id === galeriaSel)) {
      setGaleriaSel(data[0]?.id ?? null);
    }
  }

  async function refreshPosicoes(galeriaId: string | null) {
    if (!galeriaId) {
      setPosicoes([]);
      return;
    }
    const data = await listarPosicoesComOcupacao(galeriaId);
    setPosicoes(data);
  }

  useEffect(() => {
    refreshLocais();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshGalerias(localSel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSel]);

  useEffect(() => {
    refreshPosicoes(galeriaSel);
  }, [galeriaSel]);

  // Resumo de posições da galeria selecionada
  const resumoGaleria = useMemo(() => {
    const r = { total: posicoes.length, ocupadas: 0, livres: 0, vencendo: 0, vencida: 0, inativa: 0 };
    for (const p of posicoes) {
      if (p.status === "livre") r.livres++;
      else if (p.status === "ocupada") r.ocupadas++;
      else if (p.status === "vencendo") { r.ocupadas++; r.vencendo++; }
      else if (p.status === "vencida") { r.ocupadas++; r.vencida++; }
      else r.inativa++;
    }
    return r;
  }, [posicoes]);


  // ---------- deleções ----------
  async function executarRemocao() {
    if (!confirmar) return;
    let res: { ok: boolean; error?: string } = { ok: false };
    if (confirmar.tipo === "local") res = await removerLocal(confirmar.id);
    if (confirmar.tipo === "galeria") res = await removerGaleria(confirmar.id);
    if (confirmar.tipo === "posicao") res = await removerPosicao(confirmar.id);
    if (!res.ok) {
      toast.error(`Não foi possível remover: ${res.error ?? "erro desconhecido"}`);
    } else {
      toast.success("Removido com sucesso");
      if (confirmar.tipo === "local") refreshLocais();
      if (confirmar.tipo === "galeria") refreshGalerias(localSel);
      if (confirmar.tipo === "posicao") refreshPosicoes(galeriaSel);
    }
    setConfirmar(null);
  }

  const localAtual = locais.find((l) => l.id === localSel);
  const galeriaAtual = galerias.find((g) => g.id === galeriaSel);

  return (
    <SorotecaShell
      title="Estrutura Física"
      description="Hierarquia de armazenamento — Local → Galeria → Posição."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refreshLocais()}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/soroteca")}>
            Voltar
          </Button>
        </div>
      }
    >
      {/* Heatmap de ocupação por local */}
      {locais.length > 0 && (
        <div className="rounded-lg border bg-card p-3 sm:p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Ocupação por local
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {locais.length} {locais.length === 1 ? "local" : "locais"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {locais.map((l) => {
              const o = ocupacao[l.id];
              const pct = o?.pct ?? 0;
              const tone =
                pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    setLocalSel(l.id);
                    setMobileView("galerias");
                  }}
                  className={cn(
                    "text-left rounded-md border p-2.5 transition-colors hover:border-primary/50",
                    localSel === l.id && "border-primary bg-primary/5",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{l.nome}</span>
                    <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
                      {o ? `${o.ocupadas}/${o.total}` : "—"}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full transition-all", tone)}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground capitalize flex items-center justify-between">
                    <span>{l.tipo}{l.temperatura_min != null && l.temperatura_max != null && ` · ${l.temperatura_min}°C–${l.temperatura_max}°C`}</span>
                    <span className="tabular-nums">{Math.round(pct)}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Breadcrumb mobile */}
      <nav className="lg:hidden flex items-center gap-1 text-xs mb-3 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setMobileView("locais")}
          className={cn("px-2 py-1 rounded-md whitespace-nowrap", mobileView === "locais" ? "bg-muted font-medium" : "text-muted-foreground")}
        >
          Locais
        </button>
        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        <button
          type="button"
          disabled={!localSel}
          onClick={() => setMobileView("galerias")}
          className={cn("px-2 py-1 rounded-md whitespace-nowrap disabled:opacity-40", mobileView === "galerias" ? "bg-muted font-medium" : "text-muted-foreground")}
        >
          {localAtual?.nome ?? "Galerias"}
        </button>
        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        <button
          type="button"
          disabled={!galeriaSel}
          onClick={() => setMobileView("posicoes")}
          className={cn("px-2 py-1 rounded-md whitespace-nowrap disabled:opacity-40", mobileView === "posicoes" ? "bg-muted font-medium" : "text-muted-foreground")}
        >
          {galeriaAtual?.nome ?? "Posições"}
        </button>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[260px_260px_1fr] gap-4 items-start">

        {/* ------------- LOCAIS ------------- */}
        <section className={cn("rounded-lg border bg-card", "lg:block", mobileView !== "locais" && "hidden md:block")}>
          <header className="flex items-center justify-between px-3 py-2 border-b">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Locais
              <span className="text-xs text-muted-foreground font-normal">({locais.length})</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setNovoLocalOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </header>
          <ul className="max-h-[60vh] overflow-y-auto">
            {loading && (
              <li className="px-3 py-6 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </li>
            )}
            {!loading && locais.length === 0 && (
              <li className="px-3 py-8 text-center text-muted-foreground text-sm">
                Nenhum local cadastrado.
              </li>
            )}
            {locais.map((l) => (
              <li
                key={l.id}
                className={cn(
                  "group flex items-center gap-2 px-3 py-2 border-b last:border-b-0 cursor-pointer text-sm",
                  localSel === l.id ? "bg-muted/60" : "hover:bg-muted/30",
                )}
                onClick={() => {
                  setLocalSel(l.id);
                  setMobileView("galerias");
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{l.nome}</div>
                  <div className="text-[11px] text-muted-foreground capitalize">
                    {l.tipo}
                    {l.temperatura_min != null && l.temperatura_max != null && (
                      <> • {l.temperatura_min}°C a {l.temperatura_max}°C</>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditarLocal(l);
                    }}
                    aria-label="Editar local"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmar({ tipo: "local", id: l.id, nome: l.nome });
                    }}
                    aria-label="Remover local"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------- GALERIAS ------------- */}
        <section className={cn("rounded-lg border bg-card", "lg:block", mobileView !== "galerias" && "hidden md:block")}>
          <header className="flex items-center justify-between px-3 py-2 border-b">
            <div className="flex items-center gap-2 text-sm font-semibold min-w-0">
              <button
                type="button"
                className="lg:hidden p-1 -ml-1 text-muted-foreground"
                onClick={() => setMobileView("locais")}
                aria-label="Voltar"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">Galerias</span>
              <span className="text-xs text-muted-foreground font-normal shrink-0">({galerias.length})</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setNovaGaleriaOpen(true)}
              disabled={!localSel}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </header>
          {!localSel ? (
            <div className="px-3 py-8 text-center text-muted-foreground text-sm">
              Selecione um local.
            </div>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {galerias.length === 0 && (
                <li className="px-3 py-8 text-center text-muted-foreground text-sm">
                  Nenhuma galeria em <strong>{localAtual?.nome}</strong>.
                </li>
              )}
              {galerias.map((g) => (
                <li
                  key={g.id}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-2 border-b last:border-b-0 cursor-pointer text-sm",
                    galeriaSel === g.id ? "bg-muted/60" : "hover:bg-muted/30",
                  )}
                  onClick={() => {
                    setGaleriaSel(g.id);
                    setMobileView("posicoes");
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{g.nome}</div>
                    <div className="text-[11px] text-muted-foreground">Ordem {g.ordem}</div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditarGaleria(g);
                      }}
                      aria-label="Editar galeria"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmar({ tipo: "galeria", id: g.id, nome: g.nome });
                      }}
                      aria-label="Remover galeria"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ------------- POSIÇÕES (mapa visual) ------------- */}
        <section className={cn("rounded-lg border bg-card md:col-span-2 lg:col-span-1", "lg:block", mobileView !== "posicoes" && "hidden md:block")}>
          <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b">
            <div className="flex items-center gap-2 text-sm font-semibold min-w-0">
              <button
                type="button"
                className="lg:hidden p-1 -ml-1 text-muted-foreground"
                onClick={() => setMobileView("galerias")}
                aria-label="Voltar"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <Boxes className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{galeriaAtual?.nome ?? "Posições"}</span>
            </div>
            {galeriaSel && resumoGaleria.total > 0 && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
                <span><strong className="text-foreground">{resumoGaleria.ocupadas}</strong>/{resumoGaleria.total} ocupadas</span>
                <span>·</span>
                <span>{Math.round((resumoGaleria.ocupadas / resumoGaleria.total) * 100)}%</span>
                {resumoGaleria.vencendo > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-amber-600">{resumoGaleria.vencendo} vencendo</span>
                  </>
                )}
                {resumoGaleria.vencida > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-destructive">{resumoGaleria.vencida} vencida</span>
                  </>
                )}
              </div>
            )}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setHistoricoOpen(true)}
                disabled={!galeriaSel}
                title="Histórico de movimentações"
              >
                <History className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setReorgOpen(true)}
                disabled={!galeriaSel || resumoGaleria.ocupadas < 2}
                title="Reorganizar com IA"
                className="text-primary"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setNovaPosicaoOpen(true)}
                disabled={!galeriaSel}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {!galeriaSel ? (
            <div className="px-3 py-8 text-center text-muted-foreground text-sm">
              Selecione uma galeria.
            </div>
          ) : posicoes.length === 0 ? (
            <div className="px-3 py-8 text-center text-muted-foreground text-sm">
              Nenhuma posição em <strong>{galeriaAtual?.nome}</strong>.
            </div>
          ) : (
            <>
              <div className="p-3 grid gap-1.5 max-h-[60vh] overflow-y-auto" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))" }}>
                <TooltipProvider delayDuration={150}>
                  {posicoes.map((pe) => {
                    const p = pe.posicao;
                    const isDragging = draggingPos === p.id;
                    const isOver = overPos === p.id;
                    const canDrop = pe.status === "livre" && draggingPos != null && draggingPos !== p.id;
                    const tone =
                      pe.status === "livre" ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-700"
                      : pe.status === "ocupada" ? "border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary"
                      : pe.status === "vencendo" ? "border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700"
                      : pe.status === "vencida" ? "border-destructive/50 bg-destructive/10 hover:bg-destructive/20 text-destructive"
                      : "border-muted bg-muted/40 text-muted-foreground";
                    return (
                      <Tooltip key={p.id}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            draggable={!!pe.amostra}
                            onDragStart={(e) => {
                              if (!pe.amostra) return;
                              setDraggingPos(p.id);
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", pe.amostra.id);
                            }}
                            onDragEnd={() => { setDraggingPos(null); setOverPos(null); }}
                            onDragOver={(e) => {
                              if (pe.status !== "livre" || !draggingPos || draggingPos === p.id) return;
                              e.preventDefault();
                              e.dataTransfer.dropEffect = "move";
                              if (overPos !== p.id) setOverPos(p.id);
                            }}
                            onDragLeave={() => { if (overPos === p.id) setOverPos(null); }}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (pe.status !== "livre" || !draggingPos) return;
                              const origemPos = posicoes.find((x) => x.posicao.id === draggingPos);
                              if (!origemPos?.amostra) return;
                              setMoverPayload({
                                amostra: {
                                  id: origemPos.amostra.id,
                                  codigo_barra: origemPos.amostra.codigo_barra,
                                  paciente_nome: origemPos.amostra.paciente_nome,
                                  material_id: origemPos.amostra.material_id,
                                },
                                origem: { id: origemPos.posicao.id, codigo: origemPos.posicao.codigo },
                                destino: { id: p.id, codigo: p.codigo },
                              });
                              setDraggingPos(null);
                              setOverPos(null);
                            }}
                            className={cn(
                              "group relative rounded-md border px-1.5 py-2 text-center text-[11px] font-mono cursor-pointer transition-all min-h-[44px]",
                              tone,
                              pe.amostra && "cursor-grab active:cursor-grabbing",
                              isDragging && "opacity-40 scale-95",
                              canDrop && "ring-2 ring-primary/40",
                              isOver && canDrop && "ring-2 ring-primary scale-105 bg-primary/15",
                            )}
                            onClick={() => setEditarPosicao(p)}
                          >
                            <span className="block truncate">{p.codigo}</span>
                            <button
                              type="button"
                              className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmar({ tipo: "posicao", id: p.id, nome: p.codigo });
                              }}
                              aria-label="Remover posição"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-[260px]">
                          <div className="font-semibold">{p.codigo}</div>
                          {pe.status === "livre" && <div className="text-muted-foreground">Livre {draggingPos && draggingPos !== p.id ? "— solte aqui" : ""}</div>}
                          {pe.status === "inativa" && <div className="text-muted-foreground">Inativa</div>}
                          {pe.amostra && (
                            <div className="space-y-0.5 mt-0.5">
                              <div className="truncate"><span className="text-muted-foreground">Paciente:</span> {pe.amostra.paciente_nome ?? "—"}</div>
                              <div className="truncate"><span className="text-muted-foreground">Protocolo:</span> {pe.amostra.protocolo ?? "—"}</div>
                              <div className="truncate"><span className="text-muted-foreground">Material:</span> {resolveMaterialNome(pe.amostra.material_id)}</div>
                              <div className="truncate"><span className="text-muted-foreground">Armazenado:</span> {new Date(pe.amostra.data_alocacao).toLocaleDateString("pt-BR")}</div>
                              {pe.amostra.data_expurgo && (
                                <div className="truncate">
                                  <span className="text-muted-foreground">Expurgo:</span>{" "}
                                  {new Date(pe.amostra.data_expurgo).toLocaleDateString("pt-BR")}
                                  {pe.amostra.dias_para_expurgo != null && (
                                    <span className={cn("ml-1", pe.amostra.dias_para_expurgo < 0 ? "text-destructive" : pe.amostra.dias_para_expurgo <= 7 ? "text-amber-600" : "text-muted-foreground")}>
                                      ({pe.amostra.dias_para_expurgo < 0 ? `${-pe.amostra.dias_para_expurgo}d vencida` : `${pe.amostra.dias_para_expurgo}d`})
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className="text-[10px] text-muted-foreground italic mt-1">Arraste para mover</div>
                            </div>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}

                </TooltipProvider>
              </div>
              {/* Legenda */}
              <div className="border-t px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                <LegendDot cls="bg-emerald-500/30 border-emerald-500/50" label="Livre" />
                <LegendDot cls="bg-primary/30 border-primary/50" label="Ocupada" />
                <LegendDot cls="bg-amber-500/40 border-amber-500/60" label="Vencendo ≤7d" />
                <LegendDot cls="bg-destructive/40 border-destructive/60" label="Vencida" />
                <LegendDot cls="bg-muted border-muted-foreground/30" label="Inativa" />
              </div>
            </>
          )}
        </section>
      </div>




      {/* ----- dialogs ----- */}
      <NovoLocalDialog
        open={novoLocalOpen}
        onOpenChange={setNovoLocalOpen}
        onCreated={() => refreshLocais()}
      />
      <NovaGaleriaDialog
        open={novaGaleriaOpen}
        onOpenChange={setNovaGaleriaOpen}
        localId={localSel}
        localNome={localAtual?.nome}
        onCreated={() => refreshGalerias(localSel)}
      />
      <NovasPosicoesDialog
        open={novaPosicaoOpen}
        onOpenChange={setNovaPosicaoOpen}
        galeriaId={galeriaSel}
        galeriaNome={galeriaAtual?.nome}
        onCreated={() => refreshPosicoes(galeriaSel)}
      />

      <EditarLocalDialog
        local={editarLocal}
        onOpenChange={(o) => !o && setEditarLocal(null)}
        onSaved={() => refreshLocais()}
      />
      <EditarGaleriaDialog
        galeria={editarGaleria}
        onOpenChange={(o) => !o && setEditarGaleria(null)}
        onSaved={() => refreshGalerias(localSel)}
      />
      <EditarPosicaoDialog
        posicao={editarPosicao}
        onOpenChange={(o) => !o && setEditarPosicao(null)}
        onSaved={() => refreshPosicoes(galeriaSel)}
      />

      <ConfirmarMovimentacaoDialog
        open={!!moverPayload}
        onOpenChange={(o) => !o && setMoverPayload(null)}
        amostra={moverPayload?.amostra ?? null}
        origem={moverPayload ? { id: moverPayload.origem.id, codigo: moverPayload.origem.codigo } : { id: null, codigo: null }}
        destino={moverPayload?.destino ?? { id: "", codigo: "" }}
        onConfirmed={() => { setMoverPayload(null); refreshPosicoes(galeriaSel); }}
      />
      <HistoricoMovimentacoesDialog
        open={historicoOpen}
        onOpenChange={setHistoricoOpen}
        galeriaId={galeriaSel}
        galeriaNome={galeriaAtual?.nome}
        onChanged={() => refreshPosicoes(galeriaSel)}
      />
      <ReorganizarPreviewDialog
        open={reorgOpen}
        onOpenChange={setReorgOpen}
        galeriaId={galeriaSel}
        galeriaNome={galeriaAtual?.nome}
        onApplied={() => refreshPosicoes(galeriaSel)}
      />

      <AlertDialog open={!!confirmar} onOpenChange={(open) => !open && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {confirmar?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Itens filhos (galerias/posições) também serão
              removidos. Itens com amostras alocadas não podem ser apagados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={executarRemocao}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SorotecaShell>
  );

}

// =================================================================
// Subdialogs — padrão flat tenant (SorotecaDialogShell)
// =================================================================

const DIALOG_CONTENT_CLS =
  "sm:max-w-[560px] max-h-[92vh] overflow-y-auto p-0 gap-0";

function NovoLocalDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<LocalTipo>("geladeira");
  const [tmin, setTmin] = useState("");
  const [tmax, setTmax] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome("");
      setTipo("geladeira");
      setTmin("");
      setTmax("");
      setObservacao("");
    }
  }, [open]);

  async function submit() {
    if (!nome.trim()) {
      toast.error("Informe o nome do local.");
      return;
    }
    setSaving(true);
    const res = await criarLocal({
      nome,
      tipo,
      temperatura_min: tmin ? Number(tmin) : null,
      temperatura_max: tmax ? Number(tmax) : null,
      observacao: observacao.trim() || null,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(`Falha ao criar local: ${res.error ?? "erro"}`);
      return;
    }
    toast.success("Local criado");
    onCreated();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_CONTENT_CLS}>
        <SorotecaDialogHeader
          icon={MapPin}
          title="Novo local"
          description="Cadastre uma geladeira, freezer, armário ou sala. Tudo o que armazena amostras vive aqui."
        />
        <SorotecaDialogBody>
          <Section title="Identificação">
            <Field label="Nome" htmlFor="local-nome" required>
              <Input
                id="local-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Geladeira 01"
                autoFocus
              />
            </Field>
            <Field label="Tipo" required>
              <Select value={tipo} onValueChange={(v) => setTipo(v as LocalTipo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Section>

          <Section title="Faixa de temperatura" hint="opcional — exibida na triagem">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mínima" htmlFor="tmin" hint="°C">
                <div className="relative">
                  <Thermometer className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    id="tmin"
                    type="number"
                    value={tmin}
                    onChange={(e) => setTmin(e.target.value)}
                    className="pl-8"
                    placeholder="2"
                  />
                </div>
              </Field>
              <Field label="Máxima" htmlFor="tmax" hint="°C">
                <div className="relative">
                  <Thermometer className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    id="tmax"
                    type="number"
                    value={tmax}
                    onChange={(e) => setTmax(e.target.value)}
                    className="pl-8"
                    placeholder="8"
                  />
                </div>
              </Field>
            </div>
          </Section>

          <Section title="Observação" hint="opcional">
            <Input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: Geladeira do corredor norte, controle de temperatura por termômetro digital."
            />
          </Section>
        </SorotecaDialogBody>
        <SDFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            <Plus className="h-4 w-4 mr-1.5" />
            Criar local
          </Button>
        </SDFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovaGaleriaDialog({
  open,
  onOpenChange,
  localId,
  localNome,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localId: string | null;
  localNome?: string;
  onCreated: () => void;
}) {
  const [nome, setNome] = useState("");
  const [ordem, setOrdem] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome("");
      setOrdem("0");
    }
  }, [open]);

  async function submit() {
    if (!localId || !nome.trim()) return;
    setSaving(true);
    const res = await criarGaleria({ local_id: localId, nome, ordem: Number(ordem) || 0 });
    setSaving(false);
    if (!res.ok) {
      toast.error(`Falha ao criar galeria: ${res.error ?? "erro"}`);
      return;
    }
    toast.success("Galeria criada");
    onCreated();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_CONTENT_CLS}>
        <SorotecaDialogHeader
          icon={Layers}
          title="Nova galeria"
          description={
            localNome
              ? `Subdivisão de ${localNome} (bandeja, rack, prateleira).`
              : "Subdivisão do local (bandeja, rack, prateleira)."
          }
        />
        <SorotecaDialogBody>
          <Section title="Identificação">
            <Field label="Nome" htmlFor="g-nome" required>
              <Input
                id="g-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Bandeja A"
                autoFocus
              />
            </Field>
            <Field label="Ordem de exibição" htmlFor="g-ordem" hint="quanto menor, mais acima">
              <Input
                id="g-ordem"
                type="number"
                value={ordem}
                onChange={(e) => setOrdem(e.target.value)}
              />
            </Field>
          </Section>
        </SorotecaDialogBody>
        <SDFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || !nome.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            <Plus className="h-4 w-4 mr-1.5" />
            Criar galeria
          </Button>
        </SDFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovasPosicoesDialog({
  open,
  onOpenChange,
  galeriaId,
  galeriaNome,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  galeriaId: string | null;
  galeriaNome?: string;
  onCreated: () => void;
}) {
  const [modo, setModo] = useState<"individual" | "lote" | "grid">("grid");
  const [codigo, setCodigo] = useState("");
  const [prefixo, setPrefixo] = useState("A");
  const [inicio, setInicio] = useState("1");
  const [fim, setFim] = useState("10");
  const [linhas, setLinhas] = useState("8");
  const [colunas, setColunas] = useState("12");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCodigo("");
      setPrefixo("A");
      setInicio("1");
      setFim("10");
      setLinhas("8");
      setColunas("12");
      setModo("grid");
    }
  }, [open]);

  const ini = Number(inicio);
  const fi = Number(fim);
  const lotePreviewTotal =
    Number.isFinite(ini) && Number.isFinite(fi) && fi >= ini ? fi - ini + 1 : 0;
  const nLin = Math.max(0, Math.min(26, Number(linhas) || 0));
  const nCol = Math.max(0, Math.min(99, Number(colunas) || 0));
  const gridTotal = nLin * nCol;
  const gridPreview: string[] = [];
  if (gridTotal > 0) {
    outer: for (let l = 0; l < nLin; l++) {
      for (let c = 1; c <= nCol; c++) {
        gridPreview.push(`${String.fromCharCode(65 + l)}${c}`);
        if (gridPreview.length >= 6) break outer;
      }
    }
  }

  async function submit() {
    if (!galeriaId) return;
    setSaving(true);
    if (modo === "individual") {
      if (!codigo.trim()) { toast.error("Informe o código."); setSaving(false); return; }
      const res = await criarPosicao({ galeria_id: galeriaId, codigo });
      setSaving(false);
      if (!res.ok) { toast.error(`Falha: ${res.error ?? "erro"}`); return; }
      toast.success("Posição criada");
    } else if (modo === "lote") {
      if (!Number.isFinite(ini) || !Number.isFinite(fi) || fi < ini) {
        toast.error("Intervalo inválido."); setSaving(false); return;
      }
      const res = await criarPosicoesEmLote({ galeria_id: galeriaId, prefixo, inicio: ini, fim: fi });
      setSaving(false);
      if (!res.ok) { toast.error(`Falha: ${res.error ?? "erro"}`); return; }
      toast.success(`${res.total} posições criadas`);
    } else {
      if (nLin < 1 || nCol < 1) { toast.error("Informe linhas e colunas."); setSaving(false); return; }
      const res = await criarPosicoesGrid2D({ galeria_id: galeriaId, linhas: nLin, colunas: nCol });
      setSaving(false);
      if (!res.ok) { toast.error(`Falha: ${res.error ?? "erro"}`); return; }
      toast.success(`${res.total} posições criadas`);
    }
    onCreated();
    onOpenChange(false);
  }

  const tabBtn = (target: typeof modo, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      className={cn(
        "rounded-md px-2 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5",
        modo === target ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
      onClick={() => setModo(target)}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_CONTENT_CLS}>
        <SorotecaDialogHeader
          icon={Boxes}
          title="Novas posições"
          description={
            galeriaNome
              ? `Adicione slots a ${galeriaNome}. Use Grid para racks padrão (96 poços), Lote para sequências lineares ou Individual.`
              : "Crie posições em grid 2D, em lote linear ou individualmente."
          }
        />
        <SorotecaDialogBody>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted rounded-lg">
            {tabBtn("grid", <Grid3x3 className="h-3.5 w-3.5" />, "Grid 2D")}
            {tabBtn("lote", <ListPlus className="h-3.5 w-3.5" />, "Lote")}
            {tabBtn("individual", <Hash className="h-3.5 w-3.5" />, "Individual")}
          </div>

          {modo === "individual" && (
            <Section title="Posição">
              <Field label="Código" htmlFor="pos-codigo" required>
                <Input id="pos-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex.: A12" className="font-mono" autoFocus />
              </Field>
            </Section>
          )}

          {modo === "lote" && (
            <Section title="Geração linear" hint={lotePreviewTotal > 0 ? `${lotePreviewTotal} posições` : undefined}>
              <Field label="Prefixo" htmlFor="pref" hint="opcional">
                <Input id="pref" value={prefixo} onChange={(e) => setPrefixo(e.target.value)} placeholder="A" className="font-mono" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="De" htmlFor="ini" required>
                  <Input id="ini" type="number" value={inicio} onChange={(e) => setInicio(e.target.value)} />
                </Field>
                <Field label="Até" htmlFor="fi" required>
                  <Input id="fi" type="number" value={fim} onChange={(e) => setFim(e.target.value)} />
                </Field>
              </div>
              {lotePreviewTotal > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs text-foreground/80">
                  <span className="font-semibold">Pré-visualização:</span>{" "}
                  <span className="font-mono">{prefixo}{inicio}</span>
                  {lotePreviewTotal > 2 && (<>, <span className="font-mono">{prefixo}{ini + 1}</span>, … ,</>)}
                  {lotePreviewTotal === 2 && <>, </>}
                  <span className="font-mono"> {prefixo}{fim}</span>
                </div>
              )}
            </Section>
          )}

          {modo === "grid" && (
            <Section title="Grid 2D (rack padrão)" hint={gridTotal > 0 ? `${gridTotal} posições` : undefined}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Linhas" htmlFor="lin" hint="A..Z (máx 26)" required>
                  <Input id="lin" type="number" min={1} max={26} value={linhas} onChange={(e) => setLinhas(e.target.value)} />
                </Field>
                <Field label="Colunas" htmlFor="col" hint="1..99" required>
                  <Input id="col" type="number" min={1} max={99} value={colunas} onChange={(e) => setColunas(e.target.value)} />
                </Field>
              </div>
              {gridTotal > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs text-foreground/80 space-y-1">
                  <div>
                    <span className="font-semibold">{gridTotal} posições</span> — formato{" "}
                    <span className="font-mono">{String.fromCharCode(65)}1 … {String.fromCharCode(64 + nLin)}{nCol}</span>
                  </div>
                  <div className="text-muted-foreground">
                    Ex.: {gridPreview.map((g) => <span key={g} className="font-mono mr-1">{g}</span>)}…
                  </div>
                </div>
              )}
            </Section>
          )}
        </SorotecaDialogBody>
        <SDFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            <Plus className="h-4 w-4 mr-1.5" />
            {modo === "grid" && gridTotal > 0 ? `Criar ${gridTotal} posições`
              : modo === "lote" && lotePreviewTotal > 0 ? `Criar ${lotePreviewTotal} posições`
              : "Criar"}
          </Button>
        </SDFooter>
      </DialogContent>
    </Dialog>
  );
}


function EditarLocalDialog({
  local,
  onOpenChange,
  onSaved,
}: {
  local: LocalArmazenamento | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<LocalTipo>("geladeira");
  const [tmin, setTmin] = useState("");
  const [tmax, setTmax] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (local) {
      setNome(local.nome);
      setTipo(local.tipo);
      setTmin(local.temperatura_min != null ? String(local.temperatura_min) : "");
      setTmax(local.temperatura_max != null ? String(local.temperatura_max) : "");
      setObservacao(local.observacao ?? "");
    }
  }, [local]);

  async function submit() {
    if (!local) return;
    if (!nome.trim()) {
      toast.error("Informe o nome do local.");
      return;
    }
    setSaving(true);
    const res = await atualizarLocal(local.id, {
      nome,
      tipo,
      temperatura_min: tmin ? Number(tmin) : null,
      temperatura_max: tmax ? Number(tmax) : null,
      observacao: observacao.trim() || null,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(`Falha ao salvar: ${res.error ?? "erro"}`);
      return;
    }
    toast.success("Local atualizado");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={!!local} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_CONTENT_CLS}>
        <SorotecaDialogHeader
          icon={Pencil}
          title="Editar local"
          description={local ? `Atualize os dados de ${local.nome}.` : ""}
          tone="muted"
        />
        <SorotecaDialogBody>
          <Section title="Identificação">
            <Field label="Nome" htmlFor="edit-local-nome" required>
              <Input
                id="edit-local-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Tipo" required>
              <Select value={tipo} onValueChange={(v) => setTipo(v as LocalTipo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Section>

          <Section title="Faixa de temperatura" hint="opcional">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mínima" htmlFor="edit-tmin" hint="°C">
                <div className="relative">
                  <Thermometer className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    id="edit-tmin"
                    type="number"
                    value={tmin}
                    onChange={(e) => setTmin(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </Field>
              <Field label="Máxima" htmlFor="edit-tmax" hint="°C">
                <div className="relative">
                  <Thermometer className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    id="edit-tmax"
                    type="number"
                    value={tmax}
                    onChange={(e) => setTmax(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </Field>
            </div>
          </Section>

          <Section title="Observação" hint="opcional">
            <Input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Notas internas sobre este local."
            />
          </Section>
        </SorotecaDialogBody>
        <SDFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Salvar alterações
          </Button>
        </SDFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditarGaleriaDialog({
  galeria,
  onOpenChange,
  onSaved,
}: {
  galeria: Galeria | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [ordem, setOrdem] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (galeria) {
      setNome(galeria.nome);
      setOrdem(String(galeria.ordem));
    }
  }, [galeria]);

  async function submit() {
    if (!galeria || !nome.trim()) return;
    setSaving(true);
    const res = await atualizarGaleria(galeria.id, { nome, ordem: Number(ordem) || 0 });
    setSaving(false);
    if (!res.ok) {
      toast.error(`Falha ao salvar: ${res.error ?? "erro"}`);
      return;
    }
    toast.success("Galeria atualizada");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={!!galeria} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_CONTENT_CLS}>
        <SorotecaDialogHeader
          icon={Pencil}
          title="Editar galeria"
          description={galeria ? `Atualize os dados de ${galeria.nome}.` : ""}
          tone="muted"
        />
        <SorotecaDialogBody>
          <Section title="Identificação">
            <Field label="Nome" htmlFor="edit-g-nome" required>
              <Input
                id="edit-g-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Ordem de exibição" htmlFor="edit-g-ordem">
              <Input
                id="edit-g-ordem"
                type="number"
                value={ordem}
                onChange={(e) => setOrdem(e.target.value)}
              />
            </Field>
          </Section>
        </SorotecaDialogBody>
        <SDFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || !nome.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Salvar alterações
          </Button>
        </SDFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditarPosicaoDialog({
  posicao,
  onOpenChange,
  onSaved,
}: {
  posicao: PosicaoGaleria | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [ordem, setOrdem] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (posicao) {
      setCodigo(posicao.codigo);
      setOrdem(String(posicao.ordem));
    }
  }, [posicao]);

  async function submit() {
    if (!posicao || !codigo.trim()) return;
    setSaving(true);
    const res = await atualizarPosicao(posicao.id, {
      codigo,
      ordem: Number(ordem) || 0,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(`Falha ao salvar: ${res.error ?? "erro"}`);
      return;
    }
    toast.success("Posição atualizada");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={!!posicao} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_CONTENT_CLS}>
        <SorotecaDialogHeader
          icon={Pencil}
          title="Editar posição"
          description={
            posicao
              ? `Renomeie ou reordene a posição ${posicao.codigo}.`
              : ""
          }
          tone="muted"
        />
        <SorotecaDialogBody>
          <Section title="Posição">
            <Field label="Código" htmlFor="edit-p-codigo" required>
              <Input
                id="edit-p-codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="font-mono"
                autoFocus
              />
            </Field>
            <Field label="Ordem de exibição" htmlFor="edit-p-ordem">
              <Input
                id="edit-p-ordem"
                type="number"
                value={ordem}
                onChange={(e) => setOrdem(e.target.value)}
              />
            </Field>
          </Section>
        </SorotecaDialogBody>
        <SDFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || !codigo.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Salvar alterações
          </Button>
        </SDFooter>
      </DialogContent>
    </Dialog>
  );
}

