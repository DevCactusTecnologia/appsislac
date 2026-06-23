/**
 * Soroteca — Expurgo Programado (Fase 7)
 *
 * Fluxo: Critério → Pré-visualização → Lote PROGRAMADO →
 *        Execução item a item (EXECUTADO/PULADO) → Conclusão.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Trash2,
  CalendarClock,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ListChecks,
  Play,
  Ban,
  PackageX,
  Clock,
  FileText,
  SkipForward,
} from "lucide-react";

import { toast } from "sonner";
import { SorotecaShell } from "@/components/soroteca/SorotecaShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SorotecaDialogHeader,
  SorotecaDialogBody,
  SorotecaDialogFooter as SDFooter,
  Field,
  Section,
} from "@/components/soroteca/SorotecaDialogShell";
import { cn } from "@/lib/utils";
import {
  type ExpurgoLote,
  type ExpurgoItem,
  type ExpurgoLoteStatus,
  listarLotes,
  obterLote,
  listarItens,
  preverCandidatas,
  criarLote,
  iniciarExecucao,
  executarItem,
  pularItem,
  concluirLote,
  cancelarLote,
} from "@/data/sorotecaExpurgoStore";
import { listarMateriaisAmostra, type MaterialAmostra } from "@/data/materiaisAmostraStore";

type Tab = "ATIVOS" | "TODOS" | ExpurgoLoteStatus;

const TABS: { id: Tab; label: string }[] = [
  { id: "ATIVOS", label: "Ativos" },
  { id: "PROGRAMADO", label: "Programados" },
  { id: "EM_EXECUCAO", label: "Em execução" },
  { id: "CONCLUIDO", label: "Concluídos" },
  { id: "CANCELADO", label: "Cancelados" },
  { id: "TODOS", label: "Todos" },
];

const statusBadge = (s: ExpurgoLoteStatus) => {
  const map: Record<ExpurgoLoteStatus, string> = {
    PROGRAMADO: "bg-blue-100 text-blue-800 border-blue-300",
    EM_EXECUCAO: "bg-amber-100 text-amber-800 border-amber-300",
    CONCLUIDO: "bg-emerald-100 text-emerald-800 border-emerald-300",
    CANCELADO: "bg-zinc-100 text-zinc-700 border-zinc-300",
  };
  return map[s];
};

const statusLabel: Record<ExpurgoLoteStatus, string> = {
  PROGRAMADO: "Programado",
  EM_EXECUCAO: "Em execução",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

function formatDate(s: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("pt-BR");
  } catch {
    return s;
  }
}

function formatDateTime(s: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}


export default function SorotecaExpurgo() {
  const [tab, setTab] = useState<Tab>("ATIVOS");
  const [lotes, setLotes] = useState<ExpurgoLote[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNovo, setOpenNovo] = useState(false);
  const [openDetalhe, setOpenDetalhe] = useState<ExpurgoLote | null>(null);

  async function recarregar() {
    setLoading(true);
    try {
      const status =
        tab === "TODOS" || tab === "ATIVOS" ? undefined : (tab as ExpurgoLoteStatus);
      const data = await listarLotes(status);
      const filtrados =
        tab === "ATIVOS"
          ? data.filter((l) => l.status === "PROGRAMADO" || l.status === "EM_EXECUCAO")
          : data;
      setLotes(filtrados);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <SorotecaShell
      title="Expurgo Programado"
      description="Agende e execute o descarte de amostras com auditoria completa."
      actions={
        <Button onClick={() => setOpenNovo(true)} className="h-9">
          <Plus className="h-4 w-4 mr-2" />
          Novo lote
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2">


        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-3 h-9 rounded-lg border text-sm",
              tab === t.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border hover:bg-muted"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-12 text-center">Carregando...</div>
      ) : lotes.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <PackageX className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum lote de expurgo encontrado.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {lotes.map((l) => (
            <LoteCard key={l.id} lote={l} onOpen={() => setOpenDetalhe(l)} />
          ))}
        </div>
      )}

      <NovoLoteDialog
        open={openNovo}
        onOpenChange={setOpenNovo}
        onCreated={() => {
          setOpenNovo(false);
          recarregar();
        }}
      />

      {openDetalhe && (
        <DetalheLoteDialog
          lote={openDetalhe}
          open={!!openDetalhe}
          onOpenChange={(o) => !o && setOpenDetalhe(null)}
          onChanged={recarregar}
        />
      )}
    </SorotecaShell>
  );

}

// ---------------------------------------------------------------------------
// Card de lote
// ---------------------------------------------------------------------------
function LoteCard({ lote, onOpen }: { lote: ExpurgoLote; onOpen: () => void }) {
  const pct =
    lote.total_itens > 0
      ? Math.round(((lote.total_executados + lote.total_pulados) / lote.total_itens) * 100)
      : 0;

  return (
    <button
      onClick={onOpen}
      className="text-left border border-border rounded-lg p-4 hover:bg-muted/50 transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{lote.titulo}</span>
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded border",
                statusBadge(lote.status)
              )}
            >
              {statusLabel[lote.status]}
            </span>
          </div>
          {lote.descricao && (
            <p className="text-xs text-muted-foreground mt-1">{lote.descricao}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              {formatDate(lote.data_programada)}
            </span>
            <span>
              {lote.total_executados + lote.total_pulados} / {lote.total_itens} processados
            </span>
            <span>{lote.total_executados} descartadas</span>
            {lote.total_pulados > 0 && <span>{lote.total_pulados} puladas</span>}
          </div>
        </div>
        <div className="text-right text-sm font-medium tabular-nums">{pct}%</div>
      </div>
      <div className="mt-3 h-1.5 bg-muted rounded">
        <div
          className="h-full bg-primary rounded transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Diálogo: novo lote
// ---------------------------------------------------------------------------
function NovoLoteDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataProgramada, setDataProgramada] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [materiais, setMateriais] = useState<MaterialAmostra[]>([]);
  const [materialIds, setMaterialIds] = useState<string[]>([]);
  const [coletaAte, setColetaAte] = useState("");
  const [validadeAte, setValidadeAte] = useState("");
  const [candidatas, setCandidatas] = useState<any[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) {
      setTitulo("");
      setDescricao("");
      setDataProgramada(new Date().toISOString().slice(0, 10));
      setMaterialIds([]);
      setColetaAte("");
      setValidadeAte("");
      setCandidatas([]);
      setSelecionadas(new Set());
      listarMateriaisAmostra({ pageSize: 200 }).then((r) => setMateriais(r.rows));
    }
  }, [open]);

  async function preview() {
    setCarregando(true);
    try {
      const data = await preverCandidatas({
        material_ids: materialIds.length ? materialIds : undefined,
        coleta_ate: coletaAte ? `${coletaAte}T23:59:59.999Z` : undefined,
        validade_ate: validadeAte ? `${validadeAte}T23:59:59.999Z` : undefined,
      });
      setCandidatas(data);
      setSelecionadas(new Set(data.map((d) => d.id)));
      if (data.length === 0) toast.info("Nenhuma amostra encontrada para o critério.");
      else toast.success(`${data.length} amostra(s) candidata(s).`);
    } catch (e: any) {
      toast.error("Erro ao pré-visualizar: " + (e.message ?? e));
    } finally {
      setCarregando(false);
    }
  }

  function toggle(id: string) {
    setSelecionadas((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function salvar() {
    if (!titulo.trim()) {
      toast.error("Informe um título");
      return;
    }
    if (selecionadas.size === 0) {
      toast.error("Selecione ao menos uma amostra");
      return;
    }
    setSalvando(true);
    try {
      await criarLote({
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        data_programada: dataProgramada,
        criterio: {
          material_ids: materialIds.length ? materialIds : undefined,
          coleta_ate: coletaAte || undefined,
          validade_ate: validadeAte || undefined,
        },
        amostraIds: Array.from(selecionadas),
      });
      toast.success("Lote criado");
      onCreated();
    } catch {
      // erro já exibido pelo store
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Novo lote de expurgo</DialogTitle>
          <DialogDescription>
            Defina o critério, pré-visualize e selecione as amostras.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Título</Label>
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Expurgo trimestral Q2"
              />
            </div>
            <div>
              <Label>Data programada</Label>
              <Input
                type="date"
                value={dataProgramada}
                onChange={(e) => setDataProgramada(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Descrição (opcional)</Label>
            <Textarea
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="border border-border rounded-lg p-3 bg-muted/30">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Critério
            </Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label className="text-xs">Coleta até</Label>
                <Input
                  type="date"
                  value={coletaAte}
                  onChange={(e) => setColetaAte(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Validade até</Label>
                <Input
                  type="date"
                  value={validadeAte}
                  onChange={(e) => setValidadeAte(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3">
              <Label className="text-xs">Materiais (opcional)</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {materiais.map((m) => {
                  const on = materialIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() =>
                        setMaterialIds((prev) =>
                          on ? prev.filter((x) => x !== m.id) : [...prev, m.id]
                        )
                      }
                      className={cn(
                        "px-2 py-0.5 rounded border text-xs",
                        on
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border"
                      )}
                    >
                      {m.nome}
                    </button>
                  );
                })}
                {materiais.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    Nenhum material cadastrado.
                  </span>
                )}
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button variant="secondary" size="sm" onClick={preview} disabled={carregando}>
                <ListChecks className="h-4 w-4 mr-2" />
                {carregando ? "Buscando..." : "Pré-visualizar"}
              </Button>
            </div>
          </div>

          {candidatas.length > 0 && (
            <div className="border border-border rounded-lg max-h-72 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left w-8">
                      <input
                        type="checkbox"
                        checked={selecionadas.size === candidatas.length}
                        onChange={(e) =>
                          setSelecionadas(
                            e.target.checked
                              ? new Set(candidatas.map((c) => c.id))
                              : new Set()
                          )
                        }
                      />
                    </th>
                    <th className="px-2 py-1.5 text-left">Código</th>
                    <th className="px-2 py-1.5 text-left">Material</th>
                    <th className="px-2 py-1.5 text-left">Localização</th>
                    <th className="px-2 py-1.5 text-left">Coleta</th>
                    <th className="px-2 py-1.5 text-left">Validade</th>
                  </tr>
                </thead>
                <tbody>
                  {candidatas.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-2 py-1">
                        <input
                          type="checkbox"
                          checked={selecionadas.has(c.id)}
                          onChange={() => toggle(c.id)}
                        />
                      </td>
                      <td className="px-2 py-1 font-mono text-xs">{c.codigo_barra}</td>
                      <td className="px-2 py-1">{c.tipo_material}</td>
                      <td className="px-2 py-1">{c.localizacao || "—"}</td>
                      <td className="px-2 py-1">{formatDate(c.data_coleta)}</td>
                      <td className="px-2 py-1">{formatDate(c.data_validade)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando || selecionadas.size === 0}>
            <Plus className="h-4 w-4 mr-2" />
            Criar lote com {selecionadas.size} amostra(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Diálogo: detalhe / execução
// ---------------------------------------------------------------------------
function DetalheLoteDialog({
  lote,
  open,
  onOpenChange,
  onChanged,
}: {
  lote: ExpurgoLote;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChanged: () => void;
}) {
  const [loteLocal, setLoteLocal] = useState<ExpurgoLote>(lote);
  const [itens, setItens] = useState<ExpurgoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [motivoPulo, setMotivoPulo] = useState<{ id: string; motivo: string } | null>(null);
  const [motivoCancel, setMotivoCancel] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function recarregar() {
    setLoading(true);
    const [l, is] = await Promise.all([obterLote(lote.id), listarItens(lote.id)]);
    if (l) setLoteLocal(l);
    setItens(is);
    setLoading(false);
  }

  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lote.id]);

  const pendentes = useMemo(() => itens.filter((i) => i.status === "PENDENTE"), [itens]);
  const isAtivo = loteLocal.status === "PROGRAMADO" || loteLocal.status === "EM_EXECUCAO";

  async function handleIniciar() {
    await iniciarExecucao(loteLocal.id);
    toast.success("Execução iniciada");
    await recarregar();
    onChanged();
  }

  async function handleExecutar(id: string) {
    await executarItem(id);
    toast.success("Amostra descartada");
    await recarregar();
    onChanged();
  }

  async function handlePular() {
    if (!motivoPulo) return;
    if (!motivoPulo.motivo.trim()) {
      toast.error("Informe o motivo");
      return;
    }
    await pularItem(motivoPulo.id, motivoPulo.motivo.trim());
    toast.success("Item pulado");
    setMotivoPulo(null);
    await recarregar();
    onChanged();
  }

  async function handleConcluir() {
    if (pendentes.length > 0) {
      if (!confirm(`Ainda há ${pendentes.length} item(ns) pendentes. Concluir mesmo assim?`)) {
        return;
      }
    }
    await concluirLote(loteLocal.id);
    toast.success("Lote concluído");
    await recarregar();
    onChanged();
  }

  async function handleCancelar() {
    if (!motivoCancel.trim()) {
      toast.error("Informe o motivo do cancelamento");
      return;
    }
    await cancelarLote(loteLocal.id, motivoCancel.trim());
    toast.success("Lote cancelado");
    setConfirmCancel(false);
    setMotivoCancel("");
    await recarregar();
    onChanged();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-6">
            <div>
              <DialogTitle className="flex items-center gap-2">
                {loteLocal.titulo}
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded border",
                    statusBadge(loteLocal.status)
                  )}
                >
                  {statusLabel[loteLocal.status]}
                </span>
              </DialogTitle>
              <DialogDescription>
                Programado para {formatDate(loteLocal.data_programada)} ·{" "}
                {loteLocal.criado_por_nome ?? "—"}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              {loteLocal.status === "PROGRAMADO" && (
                <Button size="sm" onClick={handleIniciar}>
                  <Play className="h-4 w-4 mr-2" />
                  Iniciar
                </Button>
              )}
              {isAtivo && (
                <>
                  <Button size="sm" variant="secondary" onClick={handleConcluir}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Concluir
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setConfirmCancel(true)}>
                    <Ban className="h-4 w-4 mr-2" />
                    Cancelar lote
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        {loteLocal.status === "CANCELADO" && loteLocal.motivo_cancelamento && (
          <div className="bg-zinc-100 border border-zinc-300 text-zinc-700 rounded-lg p-2 text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div>
              <strong>Cancelado:</strong> {loteLocal.motivo_cancelamento}
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-2 text-center text-sm">
          <Stat label="Total" value={loteLocal.total_itens} />
          <Stat label="Pendentes" value={pendentes.length} />
          <Stat label="Descartadas" value={loteLocal.total_executados} tone="emerald" />
          <Stat label="Puladas" value={loteLocal.total_pulados} tone="amber" />
        </div>

        <TimelineLote lote={loteLocal} itens={itens} />



        <div className="border border-border rounded-lg max-h-[400px] overflow-auto">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : itens.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Sem itens.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left">Código</th>
                  <th className="px-2 py-1.5 text-left">Material</th>
                  <th className="px-2 py-1.5 text-left">Localização</th>
                  <th className="px-2 py-1.5 text-left">Coleta</th>
                  <th className="px-2 py-1.5 text-left">Status</th>
                  <th className="px-2 py-1.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((i) => (
                  <tr key={i.id} className="border-t border-border">
                    <td className="px-2 py-1 font-mono text-xs">{i.snapshot_codigo_barra}</td>
                    <td className="px-2 py-1">{i.snapshot_material}</td>
                    <td className="px-2 py-1">{i.snapshot_localizacao || "—"}</td>
                    <td className="px-2 py-1">{formatDate(i.snapshot_data_coleta)}</td>
                    <td className="px-2 py-1">
                      {i.status === "EXECUTADO" ? (
                        <span className="text-xs text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Descartada
                        </span>
                      ) : i.status === "PULADO" ? (
                        <span className="text-xs text-amber-700 flex items-center gap-1">
                          <XCircle className="h-3 w-3" />
                          Pulada
                          {i.motivo_pulo && (
                            <span className="text-muted-foreground">— {i.motivo_pulo}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pendente</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {i.status === "PENDENTE" && isAtivo && (
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setMotivoPulo({ id: i.id, motivo: "" })}
                          >
                            Pular
                          </Button>
                          <Button size="sm" onClick={() => handleExecutar(i.id)}>
                            <Trash2 className="h-3 w-3 mr-1" />
                            Descartar
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {motivoPulo && (
          <Dialog open onOpenChange={() => setMotivoPulo(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Pular item</DialogTitle>
                <DialogDescription>Informe o motivo para não executar o expurgo desta amostra.</DialogDescription>
              </DialogHeader>
              <Textarea
                value={motivoPulo.motivo}
                onChange={(e) => setMotivoPulo({ ...motivoPulo, motivo: e.target.value })}
                placeholder="Ex: amostra requisitada para reanálise"
                rows={3}
              />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setMotivoPulo(null)}>
                  Cancelar
                </Button>
                <Button onClick={handlePular}>Confirmar pulo</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {confirmCancel && (
          <Dialog open onOpenChange={() => setConfirmCancel(false)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancelar lote</DialogTitle>
                <DialogDescription>
                  Os itens já executados permanecerão descartados. Itens pendentes serão liberados.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={motivoCancel}
                onChange={(e) => setMotivoCancel(e.target.value)}
                placeholder="Motivo do cancelamento"
                rows={3}
              />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
                  Voltar
                </Button>
                <Button variant="destructive" onClick={handleCancelar}>
                  Confirmar cancelamento
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "amber";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
      ? "text-amber-700"
      : "text-foreground";
  return (
    <div className="border border-border rounded-lg py-2">
      <div className={cn("text-xl font-semibold tabular-nums", color)}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline (Fase 8) — eventos cronológicos derivados de campos auditáveis
// ---------------------------------------------------------------------------
type EventoTipo = "CRIACAO" | "INICIO" | "EXECUCAO" | "PULO" | "CONCLUSAO" | "CANCELAMENTO";

interface EventoTimeline {
  tipo: EventoTipo;
  ts: string;
  titulo: string;
  descricao?: string;
  autor?: string | null;
}

function TimelineLote({ lote, itens }: { lote: ExpurgoLote; itens: ExpurgoItem[] }) {
  const eventos = useMemo<EventoTimeline[]>(() => {
    const evs: EventoTimeline[] = [];

    evs.push({
      tipo: "CRIACAO",
      ts: lote.created_at,
      titulo: "Lote criado",
      descricao: `${lote.total_itens} amostra(s) selecionada(s) · programado para ${formatDate(
        lote.data_programada,
      )}`,
      autor: lote.criado_por_nome,
    });

    // "Início" só existe implicitamente; usamos o 1º item processado como aproximação,
    // já que não há campo started_at. Mantém-se enxuto sem novas colunas.
    const primeiroProcessado = itens
      .filter((i) => i.executado_em)
      .sort((a, b) => (a.executado_em! < b.executado_em! ? -1 : 1))[0];
    if (lote.status !== "PROGRAMADO" && primeiroProcessado) {
      evs.push({
        tipo: "INICIO",
        ts: primeiroProcessado.executado_em!,
        titulo: "Execução iniciada",
      });
    }

    for (const i of itens) {
      if (!i.executado_em) continue;
      if (i.status === "EXECUTADO") {
        evs.push({
          tipo: "EXECUCAO",
          ts: i.executado_em,
          titulo: "Amostra descartada",
          descricao: `${i.snapshot_codigo_barra ?? "—"} · ${i.snapshot_material ?? "—"}`,
          autor: i.executado_por_nome,
        });
      } else if (i.status === "PULADO") {
        evs.push({
          tipo: "PULO",
          ts: i.executado_em,
          titulo: "Item pulado",
          descricao: `${i.snapshot_codigo_barra ?? "—"}${i.motivo_pulo ? ` — ${i.motivo_pulo}` : ""}`,
          autor: i.executado_por_nome,
        });
      }
    }

    if (lote.concluido_em) {
      evs.push({
        tipo: "CONCLUSAO",
        ts: lote.concluido_em,
        titulo: "Lote concluído",
        descricao: `${lote.total_executados} descartadas · ${lote.total_pulados} puladas`,
      });
    }
    if (lote.cancelado_em) {
      evs.push({
        tipo: "CANCELAMENTO",
        ts: lote.cancelado_em,
        titulo: "Lote cancelado",
        descricao: lote.motivo_cancelamento ?? undefined,
      });
    }

    return evs.sort((a, b) => (a.ts < b.ts ? -1 : 1));
  }, [lote, itens]);

  const config: Record<EventoTipo, { Icon: typeof Clock; tone: string }> = {
    CRIACAO: { Icon: FileText, tone: "text-foreground bg-muted" },
    INICIO: { Icon: Play, tone: "text-blue-700 bg-blue-100" },
    EXECUCAO: { Icon: Trash2, tone: "text-emerald-700 bg-emerald-100" },
    PULO: { Icon: SkipForward, tone: "text-amber-700 bg-amber-100" },
    CONCLUSAO: { Icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-100" },
    CANCELAMENTO: { Icon: Ban, tone: "text-zinc-700 bg-zinc-200" },
  };

  return (
    <div className="border border-border rounded-lg p-3">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Linha do tempo</span>
        <span className="text-xs text-muted-foreground">({eventos.length} evento{eventos.length === 1 ? "" : "s"})</span>
      </div>

      <ol className="relative max-h-64 overflow-auto pr-2">
        {eventos.map((e, idx) => {
          const { Icon, tone } = config[e.tipo];
          const isLast = idx === eventos.length - 1;
          return (
            <li key={`${e.tipo}-${e.ts}-${idx}`} className="flex gap-3 pb-3 last:pb-0 relative">
              <div className="flex flex-col items-center">
                <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", tone)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{e.titulo}</span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {formatDateTime(e.ts)}
                  </span>
                </div>
                {e.descricao && (
                  <p className="text-xs text-muted-foreground mt-0.5 break-words">{e.descricao}</p>
                )}
                {e.autor && (
                  <p className="text-xs text-muted-foreground mt-0.5">por {e.autor}</p>
                )}
              </div>
            </li>
          );
        })}
        {eventos.length === 0 && (
          <li className="text-sm text-muted-foreground text-center py-4">
            Sem eventos registrados.
          </li>
        )}
      </ol>
    </div>
  );
}
