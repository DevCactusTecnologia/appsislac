/**
 * Diálogos de movimentação, histórico e reorganização IA da Soroteca.
 * Todos seguem o padrão flat (SorotecaDialogShell).
 */

import { useEffect, useState } from "react";
import { ArrowRight, History, Loader2, Sparkles, AlertTriangle, RotateCcw, MoveRight, Undo2, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  SorotecaDialogHeader,
  SorotecaDialogBody,
  SorotecaDialogFooter as SDFooter,
  Field,
} from "./SorotecaDialogShell";
import {
  type CompatibilidadeAviso,
  type MovimentacaoRow,
  type PlanoReorganizacao,
  desfazerMovimentacao,
  listarMovimentacoes,
  moverAmostra,
  sugerirReorganizacaoGaleria,
  validarCompatibilidade,
} from "@/data/sorotecaEstruturaStore";

const DIALOG_CONTENT_CLS = "sm:max-w-[640px] max-h-[92vh] overflow-y-auto p-0 gap-0";

// =================================================================
// Confirmar Movimentação (drag-and-drop)
// =================================================================
export function ConfirmarMovimentacaoDialog({
  open,
  onOpenChange,
  amostra,
  origem,
  destino,
  onConfirmed,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  amostra: { id: string; codigo_barra: string; paciente_nome?: string | null; tipo_material?: string } | null;
  origem: { id: string | null; codigo: string | null };
  destino: { id: string; codigo: string };
  onConfirmed: () => void;
}) {
  const [aviso, setAviso] = useState<CompatibilidadeAviso | null>(null);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !amostra) return;
    setAviso(null);
    setMotivo("");
    validarCompatibilidade(amostra.id, destino.id).then(setAviso);
  }, [open, amostra, destino.id]);

  async function submit() {
    if (!amostra) return;
    const precisaMotivo = aviso && !aviso.ok && aviso.severidade === "aviso";
    if (precisaMotivo && !motivo.trim()) {
      toast.error("Informe o motivo do override.");
      return;
    }
    setSaving(true);
    const res = await moverAmostra({
      amostra_id: amostra.id,
      destino_id: destino.id,
      motivo: precisaMotivo ? `override: ${motivo.trim()}` : motivo.trim() || "manual",
    });
    setSaving(false);
    if (!res.ok) {
      if (res.codigo === "posicao_ocupada") toast.error("Posição já está ocupada (concorrência). Tente outra.");
      else toast.error(`Falha ao mover: ${res.error}`);
      return;
    }
    toast.success(`Amostra movida para ${destino.codigo}`, {
      action: {
        label: "Desfazer",
        onClick: async () => {
          const u = await desfazerMovimentacao(res.mov_id);
          if (u.ok) { toast.success("Movimentação desfeita"); onConfirmed(); }
          else toast.error(`Falha ao desfazer: ${u.error}`);
        },
      },
    });
    onConfirmed();
    onOpenChange(false);
  }

  const bloqueado = aviso && !aviso.ok && aviso.severidade === "bloqueio";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_CONTENT_CLS}>
        <SorotecaDialogHeader
          icon={MoveRight}
          title="Mover amostra"
          description="Confirme a movimentação entre posições."
        />
        <SorotecaDialogBody>
          {amostra && (
            <div className="rounded-md border bg-muted/30 px-3 py-2.5 text-sm space-y-1">
              <div className="font-mono text-xs">{amostra.codigo_barra}</div>
              {amostra.paciente_nome && <div className="truncate"><span className="text-muted-foreground">Paciente:</span> {amostra.paciente_nome}</div>}
              {amostra.tipo_material && <div className="text-xs text-muted-foreground">{amostra.tipo_material}</div>}
            </div>
          )}
          <div className="flex items-center justify-center gap-3 py-1">
            <div className="rounded-md border px-3 py-2 text-center min-w-[90px]">
              <div className="text-[10px] uppercase text-muted-foreground">De</div>
              <div className="font-mono text-sm">{origem.codigo ?? "—"}</div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-center min-w-[90px]">
              <div className="text-[10px] uppercase text-primary">Para</div>
              <div className="font-mono text-sm text-primary">{destino.codigo}</div>
            </div>
          </div>

          {aviso === null && (
            <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Validando compatibilidade…</div>
          )}
          {aviso && !aviso.ok && (
            <div className={cn(
              "rounded-md border px-3 py-2.5 text-xs flex items-start gap-2",
              aviso.severidade === "bloqueio" ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-amber-500/40 bg-amber-500/5 text-amber-700",
            )}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <div>{aviso.mensagem}</div>
                {aviso.severidade === "aviso" && (
                  <Field label="Motivo do override" required>
                    <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: armazenamento temporário aprovado" />
                  </Field>
                )}
              </div>
            </div>
          )}
          {aviso?.ok && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Compatível com o destino.
            </div>
          )}
        </SorotecaDialogBody>
        <SDFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || !!bloqueado}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Confirmar movimentação
          </Button>
        </SDFooter>
      </DialogContent>
    </Dialog>
  );
}

// =================================================================
// Histórico de Movimentações
// =================================================================
export function HistoricoMovimentacoesDialog({
  open,
  onOpenChange,
  galeriaId,
  galeriaNome,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  galeriaId: string | null;
  galeriaNome?: string;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<MovimentacaoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [undoing, setUndoing] = useState<string | null>(null);

  async function load() {
    if (!galeriaId) return;
    setLoading(true);
    const data = await listarMovimentacoes({ galeria_id: galeriaId, limite: 100 });
    setRows(data);
    setLoading(false);
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, galeriaId]);

  async function undo(id: string) {
    setUndoing(id);
    const r = await desfazerMovimentacao(id);
    setUndoing(null);
    if (!r.ok) { toast.error(`Falha: ${r.error}`); return; }
    toast.success("Movimentação desfeita");
    onChanged();
    load();
  }

  // Apenas a última não-desfeita por amostra é elegível para undo
  const ultimaPorAmostra = new Map<string, string>();
  for (const r of rows) {
    if (r.motivo === "undo" || r.desfeita) continue;
    if (!ultimaPorAmostra.has(r.amostra_id)) ultimaPorAmostra.set(r.amostra_id, r.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_CONTENT_CLS, "sm:max-w-[760px]")}>
        <SorotecaDialogHeader
          icon={History}
          title="Histórico de movimentações"
          description={galeriaNome ? `Galeria ${galeriaNome} — últimas 100 movimentações` : "Últimas movimentações"}
        />
        <SorotecaDialogBody>
          {loading ? (
            <div className="text-center py-10 text-muted-foreground text-sm flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Nenhuma movimentação registrada.</div>
          ) : (
            <ul className="divide-y rounded-md border bg-card -mx-2">
              {rows.map((r) => {
                const elegivel = ultimaPorAmostra.get(r.amostra_id) === r.id && r.posicao_origem_id != null;
                return (
                  <li key={r.id} className="px-3 py-2.5 flex items-start gap-2 text-xs">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono">{r.amostra_codigo ?? r.amostra_id.slice(0, 8)}</span>
                        {r.motivo === "undo" && <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">undo</Badge>}
                        {r.desfeita && <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-amber-500/50 text-amber-700">desfeita</Badge>}
                        {r.lote_id && <Badge variant="outline" className="h-4 px-1.5 text-[9px]">IA</Badge>}
                      </div>
                      {r.paciente_nome && <div className="truncate text-muted-foreground">{r.paciente_nome}</div>}
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <span className="font-mono">{r.caminho_origem ?? "—"}</span>
                        <ArrowRight className="h-3 w-3" />
                        <span className="font-mono text-foreground">{r.caminho_destino ?? "—"}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("pt-BR")} · {r.executada_por_nome ?? "—"} · {r.motivo}
                      </div>
                    </div>
                    {elegivel && !r.desfeita && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => undo(r.id)} disabled={undoing === r.id}>
                        {undoing === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Undo2 className="h-3 w-3 mr-1" /> Desfazer</>}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SorotecaDialogBody>
        <SDFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button variant="outline" onClick={load} disabled={loading}><RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Recarregar</Button>
        </SDFooter>
      </DialogContent>
    </Dialog>
  );
}

// =================================================================
// Reorganizar Galeria com IA — preview + aplicação
// =================================================================
export function ReorganizarPreviewDialog({
  open,
  onOpenChange,
  galeriaId,
  galeriaNome,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  galeriaId: string | null;
  galeriaNome?: string;
  onApplied: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [plano, setPlano] = useState<PlanoReorganizacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [aplicando, setAplicando] = useState(false);
  const [progresso, setProgresso] = useState<{ feito: number; total: number; falhas: number } | null>(null);

  async function carregar() {
    if (!galeriaId) return;
    setLoading(true);
    setErro(null);
    setPlano(null);
    const r = await sugerirReorganizacaoGaleria(galeriaId);
    setLoading(false);
    if (!r.ok) { setErro(r.error); return; }
    setPlano(r.plano);
    setSelecionadas(new Set(r.plano.movimentacoes.map((_, i) => i)));
  }

  useEffect(() => {
    if (open) carregar();
    else { setPlano(null); setProgresso(null); setErro(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, galeriaId]);

  function toggle(i: number) {
    const ns = new Set(selecionadas);
    if (ns.has(i)) ns.delete(i); else ns.add(i);
    setSelecionadas(ns);
  }

  async function aplicar() {
    if (!plano) return;
    const lote = crypto.randomUUID();
    const itens = plano.movimentacoes.filter((_, i) => selecionadas.has(i));
    if (itens.length === 0) { toast.error("Selecione ao menos uma movimentação."); return; }
    setAplicando(true);
    setProgresso({ feito: 0, total: itens.length, falhas: 0 });
    let falhas = 0;
    // 2 passos: 1) liberar origens (mover para destinos cujos destinos estão livres),
    // 2) repetir até estabilizar. Estratégia simples: tenta cada item; se falhar por ocupada, deixa para próxima rodada.
    const pendentes = [...itens];
    let safety = 3;
    while (pendentes.length > 0 && safety-- > 0) {
      for (let i = pendentes.length - 1; i >= 0; i--) {
        const m = pendentes[i];
        const r = await moverAmostra({
          amostra_id: m.amostra_id,
          destino_id: m.posicao_destino_id,
          motivo: `IA: ${m.motivo}`,
          lote_id: lote,
        });
        if (r.ok) {
          pendentes.splice(i, 1);
          setProgresso((p) => p && { ...p, feito: p.feito + 1 });
        } else if (r.codigo !== "posicao_ocupada") {
          falhas++;
          pendentes.splice(i, 1);
          setProgresso((p) => p && { ...p, falhas: p.falhas + 1 });
        }
      }
    }
    falhas += pendentes.length;
    setAplicando(false);
    if (pendentes.length > 0) {
      toast.warning(`${pendentes.length} movimentação(ões) não puderam ser aplicadas (conflito de posição).`);
    }
    if (falhas === 0) toast.success("Reorganização aplicada com sucesso");
    else toast.message(`Aplicado parcialmente — ${falhas} falha(s).`);
    onApplied();
    if (falhas === 0) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_CONTENT_CLS, "sm:max-w-[860px]")}>
        <SorotecaDialogHeader
          icon={Sparkles}
          title="Reorganizar com IA"
          description={galeriaNome ? `Plano para galeria ${galeriaNome}` : "Plano sugerido"}
        />
        <SorotecaDialogBody>
          {loading && (
            <div className="text-center py-10 text-muted-foreground text-sm flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Gerando plano…</div>
          )}
          {erro && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive px-3 py-2 text-xs">{erro}</div>
          )}
          {plano && (
            <>
              <div className="rounded-md border bg-muted/30 px-3 py-2.5 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={plano.fonte === "ia" ? "default" : "secondary"} className="h-4 px-1.5 text-[9px]">{plano.fonte === "ia" ? "IA" : "Determinístico"}</Badge>
                  <span className="font-medium">{plano.movimentacoes.length} movimentação(ões)</span>
                </div>
                <div className="text-muted-foreground">{plano.resumo}</div>
                {plano.ganho_estimado && <div className="text-muted-foreground"><span className="font-medium text-foreground">Ganho:</span> {plano.ganho_estimado}</div>}
              </div>
              {plano.movimentacoes.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">Galeria já está bem organizada — nenhuma movimentação sugerida.</div>
              ) : (
                <ul className="divide-y rounded-md border bg-card max-h-[40vh] overflow-y-auto">
                  {plano.movimentacoes.map((m, i) => (
                    <li key={i} className="px-3 py-2 flex items-center gap-2 text-xs">
                      <Checkbox checked={selecionadas.has(i)} onCheckedChange={() => toggle(i)} disabled={aplicando} />
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono">{m.amostra_codigo}</span>
                          {m.paciente_nome && <span className="truncate text-muted-foreground">· {m.paciente_nome}</span>}
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <span className="font-mono text-foreground">{m.posicao_origem_codigo}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span className="font-mono text-primary">{m.posicao_destino_codigo}</span>
                          <span className="ml-2 truncate">· {m.motivo}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {progresso && (
                <div className="rounded-md border px-3 py-2 text-xs space-y-1">
                  <div>Progresso: <span className="font-medium tabular-nums">{progresso.feito}/{progresso.total}</span> {progresso.falhas > 0 && <span className="text-destructive">· {progresso.falhas} falha(s)</span>}</div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${(progresso.feito / progresso.total) * 100}%` }} />
                  </div>
                </div>
              )}
            </>
          )}
        </SorotecaDialogBody>
        <SDFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={aplicando}>Fechar</Button>
          <Button variant="outline" onClick={carregar} disabled={loading || aplicando}><RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Refazer plano</Button>
          <Button onClick={aplicar} disabled={!plano || plano.movimentacoes.length === 0 || aplicando || selecionadas.size === 0}>
            {aplicando ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Aplicando…</> : `Aplicar ${selecionadas.size > 0 ? `(${selecionadas.size})` : ""}`}
          </Button>
        </SDFooter>
      </DialogContent>
    </Dialog>
  );
}
