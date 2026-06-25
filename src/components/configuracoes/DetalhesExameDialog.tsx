import { useState, useEffect } from "react";
import { FlaskConical, Pencil, Trash2, Plus, Copy, Star, Sliders, Filter, Sparkles, Layers } from "lucide-react";
import StandardDialog from "@/components/ui/standard-dialog";
import LayoutDialog from "./LayoutDialog";
import ParametrosDialog from "./ParametrosDialog";
import FiltrosDialog from "./FiltrosDialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ExameLayout, loadLayouts, getLayouts, subscribeLayouts,
  removeLayout, updateLayout, addLayout,
} from "@/data/exameLayoutsStore";

interface DetalhesExameDialogProps {
  open: boolean;
  onClose: () => void;
  exame: { id: string; mnemonico: string; nome: string; categoria: string; codigo: string; setorNome?: string } | null;
  onEdit: () => void;
}

type TabKey = "layouts" | "parametros" | "referencia";

const formatarData = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const DetalhesExameDialog = ({ open, onClose, exame, onEdit }: DetalhesExameDialogProps) => {
  const { toast } = useToast();
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [editingLayout, setEditingLayout] = useState<ExameLayout | null>(null);
  const [layouts, setLayouts] = useState<ExameLayout[]>([]);
  const [removeTarget, setRemoveTarget] = useState<ExameLayout | null>(null);
  const [tab, setTab] = useState<TabKey>("layouts");

  useEffect(() => {
    if (!open || !exame?.id) return;
    loadLayouts(exame.id).then(setLayouts);
    return subscribeLayouts(exame.id, () => setLayouts([...getLayouts(exame.id)]));
  }, [open, exame?.id, layoutOpen]);

  useEffect(() => { setTab("layouts"); }, [exame?.id]);

  if (!exame) return null;

  const openNewLayout = () => { setEditingLayout(null); setLayoutOpen(true); };
  const openEditLayout = (layout: ExameLayout) => { setEditingLayout(layout); setLayoutOpen(true); };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    const ok = await removeLayout(removeTarget.id, exame.id);
    if (ok) toast({ title: "Layout removido" });
    else toast({ title: "Erro ao remover", description: "Verifique sua permissão.", variant: "destructive" });
    setRemoveTarget(null);
  };

  const handleTogglePadrao = async (layout: ExameLayout) => {
    if (layout.padrao) return;
    const ok = await updateLayout(layout.id, exame.id, { padrao: true });
    if (ok) toast({ title: `"${layout.nome}" definido como padrão` });
    else toast({ title: "Erro ao definir padrão", variant: "destructive" });
  };

  const handleDuplicar = async (layout: ExameLayout) => {
    const novo = await addLayout(exame.id, {
      nome: `${layout.nome} (cópia)`, conteudo: layout.conteudo,
      padrao: false, criadoPor: layout.criadoPor,
    });
    if (novo) toast({ title: "Layout duplicado" });
    else toast({ title: "Erro ao duplicar", variant: "destructive" });
  };

  const headerActions = (
    <button
      onClick={onEdit}
      className="h-9 px-3 rounded-xl border border-border/60 bg-muted/30 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all duration-200 flex items-center gap-1.5"
    >
      <Pencil className="h-3.5 w-3.5" /> Editar exame
    </button>
  );

  const tabs: Array<{ key: TabKey; label: string; icon: typeof Layers; hint: string; count?: number }> = [
    { key: "layouts", label: "Layouts", icon: Layers, hint: "Motor científico do laudo", count: layouts.length || undefined },
    { key: "parametros", label: "Parâmetros", icon: Sliders, hint: "Campos, críticos e formatação" },
    { key: "referencia", label: "Valores de referência", icon: Filter, hint: "Faixas por sexo e idade" },
  ];

  return (
    <>
      <StandardDialog
        open={open}
        onClose={onClose}
        icon={<FlaskConical className="h-5 w-5 text-primary" />}
        title={exame.nome}
        subtitle={`${exame.mnemonico} • ${exame.setorNome || exame.categoria || "Sem setor"}`}
        headerActions={headerActions}
        maxWidth="7xl"
        defaultMaximized={true}
      >
        <div className="flex flex-col h-full min-h-0">
          {/* Tab bar persistente — segmented modern */}
          <div className="px-6 pt-4 pb-3 border-b border-border/40 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="inline-flex items-center gap-1 rounded-2xl bg-muted/40 p-1 shadow-sm">
              {tabs.map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`group relative h-10 px-4 rounded-xl text-[12.5px] font-medium flex items-center gap-2 transition-all duration-200 ${
                      active
                        ? "bg-background text-foreground shadow-[0_1px_3px_hsl(var(--foreground)/0.08)]"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                    }`}
                    title={t.hint}
                  >
                    <Icon className={`h-4 w-4 transition-colors ${active ? "text-primary" : ""}`} />
                    <span>{t.label}</span>
                    {t.count !== undefined && (
                      <span className={`ml-0.5 text-[10.5px] px-1.5 py-0.5 rounded-md font-semibold ${active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conteúdo da aba ativa */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {tab === "layouts" && (
              <div className="h-full overflow-auto px-6 py-5">
                <div className="rounded-2xl border border-border/40 overflow-hidden">
                  <div className="px-5 py-3 bg-muted/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Layouts científicos do laudo
                      </span>
                    </div>
                    <button
                      onClick={openNewLayout}
                      className="h-7 px-2.5 rounded-lg text-[11px] font-medium text-primary hover:bg-primary/10 transition-all duration-200 flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Novo layout
                    </button>
                  </div>

                  {layouts.length === 0 ? (
                    <div className="py-12 px-5 text-center">
                      <div className="h-12 w-12 rounded-2xl bg-primary/5 mx-auto flex items-center justify-center mb-3">
                        <Sparkles className="h-5 w-5 text-primary/60" />
                      </div>
                      <p className="text-[13px] font-medium text-foreground mb-1">Nenhum layout cadastrado</p>
                      <p className="text-[11px] text-muted-foreground mb-4">O layout é o motor científico do laudo: define metodologia, unidade, VR, cálculos e renderização final.</p>
                      <button
                        onClick={openNewLayout}
                        className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold inline-flex items-center gap-1.5 hover:opacity-90 transition-all"
                      >
                        <Plus className="h-3.5 w-3.5" /> Criar primeiro layout
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/20">
                      {layouts.map((layout) => (
                        <div
                          key={layout.id}
                          className={`group flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-all duration-200 ${layout.padrao ? "bg-primary/[0.03]" : ""}`}
                        >
                          <button
                            onClick={() => handleTogglePadrao(layout)}
                            disabled={layout.padrao}
                            title={layout.padrao ? "Layout padrão (em uso)" : "Definir como padrão"}
                            className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 ${
                              layout.padrao
                                ? "text-primary bg-primary/10 cursor-default"
                                : "text-muted-foreground/40 hover:text-primary hover:bg-primary/10"
                            }`}
                          >
                            <Star className={`h-4 w-4 ${layout.padrao ? "fill-primary" : ""}`} />
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-[13px] font-medium text-foreground truncate">{layout.nome}</p>
                              {layout.padrao && (
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/80">Padrão</span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {layout.criadoPor || "—"} • {formatarData(layout.criadoEm)}
                            </p>
                          </div>

                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button onClick={() => openEditLayout(layout)} className="p-1.5 rounded-lg hover:bg-muted/80 transition-all duration-200 text-muted-foreground hover:text-foreground" title="Editar">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleDuplicar(layout)} className="p-1.5 rounded-lg hover:bg-muted/80 transition-all duration-200 text-muted-foreground hover:text-foreground" title="Duplicar">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            {!layout.padrao && (
                              <button onClick={() => setRemoveTarget(layout)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-all duration-200 text-muted-foreground hover:text-destructive" title="Remover">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === "parametros" && (
              <ParametrosDialog
                key={`params-${exame.id}`}
                open={true}
                onClose={onClose}
                exameId={exame.id}
                exameNome={exame.nome}
                embedded
              />
            )}

            {tab === "referencia" && (
              <FiltrosDialog
                key={`vr-${exame.id}`}
                open={true}
                onClose={onClose}
                exameId={exame.id}
                exameNome={exame.nome}
                embedded
              />
            )}
          </div>
        </div>
      </StandardDialog>

      <LayoutDialog open={layoutOpen} onClose={() => setLayoutOpen(false)} exame={exame} editData={editingLayout} defaultMaximized={true} />

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover layout?</AlertDialogTitle>
            <AlertDialogDescription>
              O layout <strong>"{removeTarget?.nome}"</strong> será removido permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default DetalhesExameDialog;
