/**
 * Soroteca — Empréstimos (Fase 6)
 *
 * Tela de gestão do fluxo: Solicitação → Aprovação → Retirada → Devolução.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Handshake,
  Search,
  Plus,
  CheckCircle2,
  XCircle,
  PackageOpen,
  PackageCheck,
  Ban,
  Clock,
  AlertTriangle,
  Barcode,
  ArrowRight,
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
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  type AmostraEmprestimo,
  type EmprestimoStatus,
  listarEmprestimos,
  solicitarEmprestimo,
  aprovarEmprestimo,
  rejeitarEmprestimo,
  registrarRetirada,
  registrarDevolucao,
  cancelarEmprestimo,
  emprestimoStatusLabel,
  emprestimoStatusBadge,
  emprestimoVencido,
} from "@/data/sorotecaEmprestimosStore";
import { buscarAmostraPorCodigo, type AmostraTriagem } from "@/data/sorotecaEstruturaStore";

type StatusTab = "ATIVOS" | "TODOS" | EmprestimoStatus;

const TABS: { id: StatusTab; label: string }[] = [
  { id: "ATIVOS", label: "Ativos" },
  { id: "PENDENTE", label: "Pendentes" },
  { id: "APROVADO", label: "Aprovados" },
  { id: "RETIRADO", label: "Retirados" },
  { id: "DEVOLVIDO", label: "Devolvidos" },
  { id: "REJEITADO", label: "Rejeitados" },
  { id: "CANCELADO", label: "Cancelados" },
  { id: "TODOS", label: "Todos" },
];

function fmt(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

export default function SorotecaEmprestimos() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<StatusTab>("ATIVOS");
  const [search, setSearch] = useState("");
  const debSearch = useDebouncedValue(search, 300);
  const [itens, setItens] = useState<AmostraEmprestimo[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoOpen, setNovoOpen] = useState(false);
  const [acaoModal, setAcaoModal] = useState<{
    tipo: "rejeitar" | "devolver" | "cancelar";
    emprestimo: AmostraEmprestimo;
  } | null>(null);
  const [motivoAcao, setMotivoAcao] = useState("");

  const carregar = async () => {
    setLoading(true);
    const filtroStatus: EmprestimoStatus[] | undefined =
      tab === "TODOS"
        ? undefined
        : tab === "ATIVOS"
          ? ["PENDENTE", "APROVADO", "RETIRADO"]
          : [tab as EmprestimoStatus];
    const lista = await listarEmprestimos({
      status: filtroStatus,
      search: debSearch || undefined,
    });
    setItens(lista);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, debSearch]);

  const counts = useMemo(() => {
    return itens.reduce<Record<string, number>>(
      (acc, e) => {
        acc[e.status] = (acc[e.status] ?? 0) + 1;
        acc.ATIVOS =
          (acc.ATIVOS ?? 0) +
          (e.status === "PENDENTE" || e.status === "APROVADO" || e.status === "RETIRADO" ? 1 : 0);
        return acc;
      },
      { ATIVOS: 0, TODOS: itens.length },
    );
  }, [itens]);

  const handleAprovar = async (e: AmostraEmprestimo) => {
    const r = await aprovarEmprestimo(e.id);
    if (r.ok) {
      toast.success("Empréstimo aprovado.");
      carregar();
    } else toast.error(r.error || "Erro ao aprovar.");
  };

  const handleRetirar = async (e: AmostraEmprestimo) => {
    const r = await registrarRetirada(e.id);
    if (r.ok) {
      toast.success("Retirada registrada.");
      carregar();
    } else toast.error(r.error || "Erro ao registrar retirada.");
  };

  const confirmarAcao = async () => {
    if (!acaoModal) return;
    const { tipo, emprestimo } = acaoModal;
    let r: { ok: boolean; error?: string };
    if (tipo === "rejeitar") r = await rejeitarEmprestimo(emprestimo.id, motivoAcao);
    else if (tipo === "cancelar") r = await cancelarEmprestimo(emprestimo.id, motivoAcao);
    else r = await registrarDevolucao(emprestimo.id, motivoAcao);
    if (r.ok) {
      toast.success(
        tipo === "rejeitar"
          ? "Empréstimo rejeitado."
          : tipo === "cancelar"
            ? "Empréstimo cancelado."
            : "Devolução registrada.",
      );
      setAcaoModal(null);
      setMotivoAcao("");
      carregar();
    } else toast.error(r.error || "Erro.");
  };

  return (
    <SorotecaShell
      title="Empréstimos de amostras"
      description="Solicite, aprove, registre retiradas e devoluções de amostras emprestadas."
      actions={
        <Button size="sm" onClick={() => setNovoOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo empréstimo
        </Button>
      }
    >



      {/* Tabs + busca */}

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-muted/50 border border-border">
          {TABS.map((t) => {
            const c = counts[t.id];
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5",
                  tab === t.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                {typeof c === "number" && c > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {c}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por destinatário, solicitante ou motivo…"
            className="pl-9"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : itens.length === 0 ? (
          <div className="p-12 text-center">
            <Handshake className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Nenhum empréstimo nessa visão</p>
            <p className="text-xs text-muted-foreground mt-1">
              Use <span className="font-semibold">Novo empréstimo</span> para iniciar uma solicitação.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {itens.map((e) => {
              const vencido = emprestimoVencido(e);
              return (
                <li
                  key={e.id}
                  className="p-4 flex flex-col md:flex-row md:items-center gap-3 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border",
                          emprestimoStatusBadge(e.status),
                        )}
                      >
                        {emprestimoStatusLabel(e.status)}
                      </span>
                      {vencido && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-red-500/10 text-red-700 border border-red-500/30 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Prazo vencido
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => navigate(`/soroteca?amostra=${e.amostra_id}`)}
                        className="font-mono text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                        title="Ver amostra"
                      >
                        <Barcode className="w-3 h-3" />
                        {e.amostra_id.slice(0, 8)}
                      </button>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-sm">
                      <span className="font-semibold text-foreground">{e.solicitante_nome}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="font-medium text-foreground">{e.destinatario_nome}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{e.motivo}</p>
                  </div>

                  <div className="flex flex-col text-[11px] text-muted-foreground md:items-end md:min-w-[200px]">
                    <span>
                      Solicitado: <span className="text-foreground">{fmt(e.solicitado_em)}</span>
                    </span>
                    {e.prazo_devolucao && (
                      <span className="flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        Prazo: <span className="text-foreground">{fmtDate(e.prazo_devolucao)}</span>
                      </span>
                    )}
                    {e.retirado_em && (
                      <span className="mt-0.5">
                        Retirado: <span className="text-foreground">{fmt(e.retirado_em)}</span>
                      </span>
                    )}
                    {e.devolvido_em && (
                      <span className="mt-0.5">
                        Devolvido: <span className="text-foreground">{fmt(e.devolvido_em)}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap md:justify-end gap-1.5">
                    {e.status === "PENDENTE" && (
                      <>
                        <Button size="sm" variant="default" onClick={() => handleAprovar(e)}>
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setAcaoModal({ tipo: "rejeitar", emprestimo: e });
                            setMotivoAcao("");
                          }}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Rejeitar
                        </Button>
                      </>
                    )}
                    {e.status === "APROVADO" && (
                      <Button size="sm" variant="default" onClick={() => handleRetirar(e)}>
                        <PackageOpen className="w-4 h-4 mr-1" />
                        Registrar retirada
                      </Button>
                    )}
                    {e.status === "RETIRADO" && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          setAcaoModal({ tipo: "devolver", emprestimo: e });
                          setMotivoAcao("");
                        }}
                      >
                        <PackageCheck className="w-4 h-4 mr-1" />
                        Registrar devolução
                      </Button>
                    )}
                    {(e.status === "PENDENTE" || e.status === "APROVADO") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          setAcaoModal({ tipo: "cancelar", emprestimo: e });
                          setMotivoAcao("");
                        }}
                      >
                        <Ban className="w-4 h-4 mr-1" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <NovoEmprestimoDialog
        open={novoOpen}
        onOpenChange={setNovoOpen}
        onCriado={() => {
          setNovoOpen(false);
          setTab("ATIVOS");
          carregar();
        }}
      />

      {/* Modal genérico para motivo/observação */}
      <Dialog open={!!acaoModal} onOpenChange={(o) => !o && setAcaoModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {acaoModal?.tipo === "rejeitar"
                ? "Rejeitar empréstimo"
                : acaoModal?.tipo === "cancelar"
                  ? "Cancelar empréstimo"
                  : "Registrar devolução"}
            </DialogTitle>
            <DialogDescription>
              {acaoModal?.tipo === "devolver"
                ? "Você pode anotar observações sobre o estado da amostra devolvida."
                : "Informe o motivo — ficará registrado na auditoria."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={motivoAcao}
            onChange={(e) => setMotivoAcao(e.target.value)}
            placeholder={
              acaoModal?.tipo === "devolver"
                ? "Observações (opcional)…"
                : "Motivo obrigatório…"
            }
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcaoModal(null)}>
              Voltar
            </Button>
            <Button
              onClick={confirmarAcao}
              disabled={acaoModal?.tipo !== "devolver" && !motivoAcao.trim()}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SorotecaShell>
  );

}

// ---------------------------------------------------------------------------
// Novo empréstimo
// ---------------------------------------------------------------------------
function NovoEmprestimoDialog({
  open,
  onOpenChange,
  onCriado,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCriado: () => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [amostra, setAmostra] = useState<AmostraTriagem | null>(null);
  const [destinatario, setDestinatario] = useState("");
  const [motivo, setMotivo] = useState("");
  const [prazo, setPrazo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setCodigo("");
      setAmostra(null);
      setDestinatario("");
      setMotivo("");
      setPrazo("");
      setObservacao("");
    }
  }, [open]);

  const localizar = async () => {
    const c = codigo.trim();
    if (!c) return;
    const a = await buscarAmostraPorCodigo(c);
    if (!a) {
      toast.error("Amostra não encontrada.");
      setAmostra(null);
      return;
    }
    setAmostra(a);
  };

  const enviar = async () => {
    if (!amostra) {
      toast.error("Localize a amostra primeiro.");
      return;
    }
    setSaving(true);
    const r = await solicitarEmprestimo({
      amostraId: amostra.id,
      destinatarioNome: destinatario,
      motivo,
      prazoDevolucao: prazo || null,
      observacao: observacao || null,
    });
    setSaving(false);
    if (r.ok) {
      toast.success("Solicitação registrada.");
      onCriado();
    } else {
      toast.error(r.error || "Erro ao solicitar.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar empréstimo</DialogTitle>
          <DialogDescription>
            Bipe ou digite o código da amostra e preencha os dados do empréstimo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Código da amostra</Label>
            <div className="flex gap-2">
              <Input
                autoFocus
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    localizar();
                  }
                }}
                placeholder="A-AAAAMMDD-NNNNNN-D"
                className="font-mono"
              />
              <Button type="button" variant="outline" onClick={localizar}>
                Localizar
              </Button>
            </div>
            {amostra && (
              <div className="mt-2 rounded-lg border border-border bg-muted/30 p-2.5 text-xs">
                <div className="font-mono font-semibold text-foreground">{amostra.codigo_barra}</div>
                <div className="text-muted-foreground mt-0.5">
                  {amostra.tipo_material || "—"} ·{" "}
                  <span className="uppercase">{amostra.status}</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Destinatário</Label>
            <Input
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              placeholder="Nome de quem vai receber a amostra"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Motivo</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: Contraprova externa, reanálise em outro laboratório…"
              className="min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Prazo de devolução (opcional)</Label>
              <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Observação (opcional)</Label>
              <Input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Notas adicionais"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={enviar}
            disabled={!amostra || !destinatario.trim() || !motivo.trim() || saving}
          >
            Solicitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
