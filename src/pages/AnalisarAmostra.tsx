import { useEffect, useMemo, useRef, useState } from "react";
import { matchesSearch } from "@/lib/utils";
import {
  Search,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Microscope,
  RotateCcw,
  Clock,
  FlaskConical,
  Sparkles,
  Inbox,
  ListChecks,
  ArrowLeft,
  Printer,
} from "lucide-react";
import AlterarResponsavelPopup from "@/components/AlterarResponsavelPopup";
import PacienteHeaderCard from "@/components/operacional/PacienteHeaderCard";

import SuccessOverlay from "@/components/SuccessOverlay";
import SolicitarRecoletaDialog from "@/components/SolicitarRecoletaDialog";
import { formatIdadeDetalhada } from "@/lib/idade";
import { fireSuccessConfetti } from "@/lib/confetti";
import {
  getExamesOperacionaisByStatus,
  updateAtendimentoExame,
  type ExameOperacionalRow,
} from "@/data/atendimentoStore";
import { useDicionario } from "@/hooks/useDicionario";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import PermissionDenied from "@/components/PermissionDenied";
import ExameListWithFade from "@/components/ExameListWithFade";
import { imprimirEtiquetaPorAtendimentoExame } from "@/lib/imprimirEtiquetaPorAtendimentoExame";
import LabBadge from "@/components/LabBadge";
import { getCachedTenantNome } from "@/data/_tenant";
import { PageHeader } from "@/components/shared/PageHeader";

// UI status (vocabulário existente da tela)
type ExameStatus = "analisado" | "pendente" | "cancelado" | "finalizada";

interface Exame { id: number; nome: string; material: string; status: ExameStatus; dataAnalise: string | null; amostraId?: string | null; tipoProcesso?: "INTERNO" | "TERCEIRIZADO"; labApoioId?: string | null; }
interface Paciente { id: number; protocolo: string; nome: string; cpf: string; sexo: string; nascimento: string; idade: string; analisado: boolean; analista: string; exames: Exame[]; }

const isoToBR = (iso: string): string => {
  if (!iso) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};
const calcIdadeAnosMeses = (nascimento: string): string => formatIdadeDetalhada(isoToBR(nascimento));

// Mapeia DB → UI de análise
const dbToUi = (s: ExameOperacionalRow["exames"][0]["status"]): ExameStatus | null => {
  if (s === "coletado") return "pendente";
  if (s === "em_bancada") return "analisado";
  if (s === "analisado") return "finalizada";
  if (s === "cancelado") return "cancelado";
  // em_analise / finalizado já passaram para a etapa de Resultados — não exibir aqui.
  return null;
};

const formatAnaliseDate = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

async function fetchPacientesAnalise(): Promise<Paciente[]> {
  const rows = await getExamesOperacionaisByStatus(["coletado", "em_bancada", "analisado", "cancelado"]);
  return rows
    .map(r => {
      const exames: Exame[] = r.exames
        .map(e => {
          const ui = dbToUi(e.status);
          if (!ui) return null;
          // Exames TERCEIRIZADO são analisados pelo laboratório de apoio —
          // não devem aparecer na bancada interna de análise.
          if (e.tipo_processo === "TERCEIRIZADO") return null;
          return {
            id: e.id,
            nome: e.nome,
            material: e.material,
            status: ui,
            dataAnalise: formatAnaliseDate(e.data_analise),
            amostraId: e.amostra_id ?? null,
            tipoProcesso: e.tipo_processo,
            labApoioId: e.lab_apoio_id,
          } as Exame;
        })
        .filter((e): e is Exame => e !== null);
      if (exames.length === 0) return null;
      return {
        id: r.atendimento_id,
        protocolo: r.protocolo,
        nome: r.paciente_nome,
        cpf: r.paciente_cpf,
        sexo: r.paciente_sexo,
        nascimento: isoToBR(r.paciente_nascimento),
        idade: calcIdadeAnosMeses(r.paciente_nascimento),
        analisado: false,
        analista: r.responsavel || "—",
        exames,
      } as Paciente;
    })
    .filter((p): p is Paciente => p !== null);
}

const statusConfig: Record<ExameStatus, { label: string; dot: string; text: string; bg: string; ring: string }> = {
  analisado:  { label: "Analisada",  dot: "bg-[hsl(var(--status-info))]",    text: "text-[hsl(var(--status-info))]",    bg: "bg-[hsl(var(--status-info-bg))]",    ring: "ring-[hsl(var(--status-info))]/20" },
  pendente:   { label: "Pendente",   dot: "bg-[hsl(var(--status-warning))]", text: "text-[hsl(var(--status-warning))]", bg: "bg-[hsl(var(--status-warning-bg))]", ring: "ring-[hsl(var(--status-warning))]/20" },
  cancelado:  { label: "Cancelada",  dot: "bg-[hsl(var(--status-danger))]",  text: "text-[hsl(var(--status-danger))]",  bg: "bg-[hsl(var(--status-danger-bg))]",  ring: "ring-[hsl(var(--status-danger))]/20" },
  finalizada: { label: "Finalizada", dot: "bg-[hsl(var(--status-success))]", text: "text-[hsl(var(--status-success))]", bg: "bg-[hsl(var(--status-success-bg))]", ring: "ring-[hsl(var(--status-success))]/20" },
};

const initials = (name: string) => name.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();

const AnalisarAmostra = () => {
  const { hasPermission } = useAuth();
  // RBAC visual — backend revalida via trigger BEFORE UPDATE em atendimento_exames.
  if (!hasPermission("analisar_amostra")) {
    return <PermissionDenied permissao="analisar_amostra" />;
  }
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExames, setSelectedExames] = useState<number[]>([]);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelExameId, setCancelExameId] = useState<number | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [cancelMotivoCustom, setCancelMotivoCustom] = useState("");
  const [successDialog, setSuccessDialog] = useState(false);
  const [allCancelledDialog, setAllCancelledDialog] = useState(false);
  const [showAlterarResponsavel, setShowAlterarResponsavel] = useState(false);
  const [finalizarWarningDialog, setFinalizarWarningDialog] = useState(false);
  const celebratedIdsRef = useRef<Set<number>>(new Set());
  const initializedRef = useRef(false);

  // Diálogo de recoleta (etapa = analise)
  const [recoletaDialog, setRecoletaDialog] = useState<{
    open: boolean;
    exameId: number | null;
    exameNome: string;
  }>({ open: false, exameId: null, exameNome: "" });

  const { data: motivosCancelamentoOpts = [] } = useDicionario("motivo_cancelamento", { ativosOnly: true });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchPacientesAnalise();
        if (!cancelled) setPacientes(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const reload = async () => {
    const list = await fetchPacientesAnalise();
    setPacientes(list);
  };

  const selectedPaciente = pacientes.find((p) => p.id === selectedId);

  const isPacienteCompleto = (p: Paciente) => {
    const allTerminal = p.exames.every((e) => e.status === "finalizada" || e.status === "cancelado");
    const temFinalizada = p.exames.some((e) => e.status === "finalizada");
    return allTerminal && temFinalizada;
  };
  const isPacienteTodoCancelado = (p: Paciente) => p.exames.every((e) => e.status === "cancelado");

  const filteredPacientes = pacientes.filter((p) => {
    if (isPacienteCompleto(p) || isPacienteTodoCancelado(p)) return false;
    return matchesSearch(p.nome, searchQuery) || matchesSearch(p.protocolo, searchQuery);
  });

  const hasPendentes = filteredPacientes.length > 0;
  const toggleExame = (id: number) => setSelectedExames((prev) => prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]);

  const getNowStr = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} · ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  };

  // Métricas globais (chips do header)
  const globalCounts = useMemo(() => {
    const c = { pendente: 0, analisado: 0, finalizada: 0 };
    filteredPacientes.forEach(p => p.exames.forEach(e => {
      if (e.status === "pendente") c.pendente++;
      else if (e.status === "analisado") c.analisado++;
      else if (e.status === "finalizada") c.finalizada++;
    }));
    return c;
  }, [filteredPacientes]);

  // ── Aplica transições otimistas + persistência ──
  type AnaliseTransition = {
    exameId: number;
    novoStatusUi: ExameStatus;
    dbStatus: "coletado" | "em_bancada" | "analisado" | "cancelado";
    motivo_cancelamento: string | null;
  };
  const applyTransitions = async (updates: Array<AnaliseTransition>) => {
    if (!selectedPaciente || updates.length === 0) return;
    const dataStr = getNowStr();
    const pacienteId = selectedPaciente.id;
    const idMap = new Map(updates.map(u => [u.exameId, u]));
    const prev = pacientes;

    setPacientes(prev.map(p => p.id !== pacienteId ? p : {
      ...p,
      exames: p.exames.map(e => {
        const u = idMap.get(e.id);
        if (!u) return e;
        return {
          ...e,
          status: u.novoStatusUi,
          dataAnalise: u.novoStatusUi === "analisado" || u.novoStatusUi === "finalizada" ? dataStr : null,
        };
      }),
    }));

    const nowIso = new Date().toISOString();
    const results = await Promise.all(updates.map(u =>
      updateAtendimentoExame(u.exameId, {
        status: u.dbStatus,
        data_analise: (u.dbStatus === "em_bancada" || u.dbStatus === "analisado") ? nowIso : null,
        data_liberacao: null,
        motivo_cancelamento: u.motivo_cancelamento,
      })
    ));
    const failed = results.filter(r => !r.ok);
    if (failed.length > 0) {
      toast.error(`Falha ao salvar ${failed.length} alteração(ões). Recarregando…`);
      setPacientes(prev);
      await reload();
      return;
    }
    await reload();
  };

  // Detecta quando a fila esvazia após ter tido pacientes (mostra alerta central)
  // Per-atendimento: dispara confete + overlay quando um atendimento fica
  // completo (todas amostras finalizadas, com ao menos 1 efetivamente analisada).
  useEffect(() => {
    if (loading) return;

    if (!initializedRef.current) {
      pacientes.forEach((p) => {
        if (isPacienteCompleto(p) || isPacienteTodoCancelado(p)) {
          celebratedIdsRef.current.add(p.id);
        }
      });
      initializedRef.current = true;
      return;
    }

    const justCompleted = pacientes.find(
      (p) => isPacienteCompleto(p) && !celebratedIdsRef.current.has(p.id),
    );

    if (justCompleted) {
      celebratedIdsRef.current.add(justCompleted.id);
      pacientes.forEach((p) => {
        if (isPacienteTodoCancelado(p)) celebratedIdsRef.current.add(p.id);
      });
      setSuccessDialog(true);
      setSelectedId(null);
      setSelectedExames([]);
      fireSuccessConfetti();
    } else {
      pacientes.forEach((p) => {
        if (isPacienteTodoCancelado(p)) celebratedIdsRef.current.add(p.id);
      });
    }
  }, [pacientes, loading]);

  const handleAnalisar  = (exameId: number): void => { void applyTransitions([{ exameId, novoStatusUi: "analisado",  dbStatus: "em_bancada", motivo_cancelamento: null }]); };
  const handleFinalizar = (exameId: number): void => { void applyTransitions([{ exameId, novoStatusUi: "finalizada", dbStatus: "analisado",  motivo_cancelamento: null }]); };
  const handleAnaliseIntegral = () => {
    if (!selectedPaciente) return;
    const targets = selectedPaciente.exames.filter(e => e.status === "pendente");
    void applyTransitions(targets.map((e): AnaliseTransition => ({ exameId: e.id, novoStatusUi: "analisado", dbStatus: "em_bancada", motivo_cancelamento: null })));
  };
  const handleAnalisarSelecionados = () => {
    if (!selectedPaciente) return;
    const targets = selectedPaciente.exames.filter(e => selectedExames.includes(e.id) && e.status === "pendente");
    void applyTransitions(targets.map((e): AnaliseTransition => ({ exameId: e.id, novoStatusUi: "analisado", dbStatus: "em_bancada", motivo_cancelamento: null })));
    setSelectedExames([]);
  };
  const handleFinalizarSelecionados = () => {
    if (!selectedPaciente) return;
    const examesSel = selectedPaciente.exames.filter((e) => selectedExames.includes(e.id));
    const analisados = examesSel.filter((e) => e.status === "analisado");
    if (analisados.length === 0) { setFinalizarWarningDialog(true); return; }
    void applyTransitions(analisados.map((e): AnaliseTransition => ({ exameId: e.id, novoStatusUi: "finalizada", dbStatus: "analisado", motivo_cancelamento: null })));
    setSelectedExames([]);
  };
  const handleReverter = (exameId: number): void => { void applyTransitions([{ exameId, novoStatusUi: "pendente", dbStatus: "coletado", motivo_cancelamento: null }]); };

  const openRecoletaDialog = (exameId: number) => {
    if (!selectedPaciente) return;
    const ex = selectedPaciente.exames.find((e) => e.id === exameId);
    if (!ex) return;
    setRecoletaDialog({ open: true, exameId, exameNome: ex.nome });
  };

  const onRecoletaConfirmed = async () => {
    if (recoletaDialog.exameId == null) return;
    // Reverte o exame para "pendente" (volta para coleta)
    await applyTransitions([{
      exameId: recoletaDialog.exameId,
      novoStatusUi: "pendente",
      dbStatus: "coletado",
      motivo_cancelamento: null,
    }]);
    setRecoletaDialog({ open: false, exameId: null, exameNome: "" });
  };

  const openCancelDialog = (exameId: number | null) => {
    setCancelExameId(exameId);
    setCancelMotivo("");
    setCancelMotivoCustom("");
    setCancelDialogOpen(true);
  };
  const confirmCancel = async () => {
    if (!selectedPaciente) return;
    const targetIds = cancelExameId !== null ? [cancelExameId] : selectedExames;
    const motivo = cancelMotivo === "Outro" ? cancelMotivoCustom.trim() : cancelMotivo;
    if (!motivo) return;
    setCancelDialogOpen(false);
    await applyTransitions(targetIds.map(id => ({ exameId: id, novoStatusUi: "cancelado" as ExameStatus, dbStatus: "cancelado" as const, motivo_cancelamento: motivo })));
    setSelectedExames([]);
    toast.success(
      targetIds.length === 1
        ? "Análise cancelada com sucesso"
        : `${targetIds.length} análises canceladas com sucesso`,
      { description: `Motivo: ${motivo}` }
    );
  };

  const pendentesCount   = selectedPaciente?.exames.filter((e) => e.status === "pendente").length ?? 0;
  const analisadosCount  = selectedPaciente?.exames.filter((e) => e.status === "analisado").length ?? 0;
  const finalizadosCount = selectedPaciente?.exames.filter((e) => e.status === "finalizada").length ?? 0;
  const canceladosCount  = selectedPaciente?.exames.filter((e) => e.status === "cancelado").length ?? 0;
  const totalExames = selectedPaciente?.exames.length ?? 0;
  const concluidosCount = finalizadosCount + canceladosCount;
  const progressPercent = totalExames > 0 ? Math.round((concluidosCount / totalExames) * 100) : 0;

  // Ordena exames: pendentes primeiro, depois analisados, finalizados e cancelados.
  // Garante que as amostras pendentes fiquem sempre acessíveis no topo.
  const statusOrder = { pendente: 0, analisado: 1, finalizada: 2, cancelado: 3 } as const;
  const sortExames = <T extends { status: ExameStatus }>(exames: T[]): T[] =>
    [...exames].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  const sortedExames = useMemo(
    () => selectedPaciente ? sortExames(selectedPaciente.exames) : [],
    [selectedPaciente]
  );

  // Status badge para o PacienteHeaderCard.
  type HeaderStatusType = "success" | "warning" | "danger" | "info" | "neutral" | "purple" | "teal";
  const pacienteStatusBadge = useMemo<{ label: string; type: HeaderStatusType } | null>(() => {
    if (!selectedPaciente) return null;
    if (pendentesCount > 0) return { label: `${pendentesCount} pendente${pendentesCount > 1 ? "s" : ""}`, type: "warning" };
    if (analisadosCount > 0) return { label: `${analisadosCount} em análise`, type: "info" };
    if (finalizadosCount > 0) return { label: `${finalizadosCount} finalizada${finalizadosCount > 1 ? "s" : ""}`, type: "success" };
    return null;
  }, [selectedPaciente, pendentesCount, analisadosCount, finalizadosCount]);

  // ─── Componentes locais ──────────────────────────────────────────
  const StatusPill = ({ status }: { status: ExameStatus }) => {
    const c = statusConfig[status];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium ${c.bg} ${c.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
        {c.label}
      </span>
    );
  };

  const SummaryChip = ({ icon: Icon, label, value, tone }: { icon: typeof Clock; label: string; value: number; tone: "warning" | "info" | "success" }) => {
    const map = {
      warning: "text-[hsl(var(--status-warning))] bg-[hsl(var(--status-warning-bg))]",
      info:    "text-[hsl(var(--status-info))] bg-[hsl(var(--status-info-bg))]",
      success: "text-[hsl(var(--status-success))] bg-[hsl(var(--status-success-bg))]",
    } as const;
    return (
      <div className={`flex items-center gap-2 px-3 h-9 rounded-lg ${map[tone]}`}>
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{label}</span>
        <span className="text-sm font-semibold tabular-nums">{value}</span>
      </div>
    );
  };

  // Overlay foi movido para fora do componente (ver final do arquivo)
  // — manter dentro causava re-mount em cada setState (flicker no clique).

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-10 w-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-fade-in">

        <PageHeader
          eyebrow="Operacional"
          title="Analisar amostras"
          description={`${filteredPacientes.length} ${filteredPacientes.length === 1 ? "paciente na fila" : "pacientes na fila"}`}
          actions={
            hasPendentes ? (
              <div className="flex flex-wrap items-center gap-2">
                <SummaryChip icon={Clock}         label="Pendentes"  value={globalCounts.pendente}   tone="warning" />
                <SummaryChip icon={FlaskConical}  label="Analisadas" value={globalCounts.analisado}  tone="info" />
                <SummaryChip icon={CheckCircle2}  label="Finalizadas" value={globalCounts.finalizada} tone="success" />
              </div>
            ) : undefined
          }
        />


        {/* ─────────── MASTER-DETAIL (responsivo) ───────────
            Em mobile/tablet (<1280px): mostra a fila OU o detalhe (nunca os dois).
            Em desktop (≥1280px): mostra os dois lado a lado. */}
        <section className="grid grid-cols-1 xl:grid-cols-[340px_1fr] 2xl:grid-cols-[380px_1fr] gap-5 items-start">
          {/* Sidebar de pacientes */}
          <aside className={`bg-card rounded-xl border border-border flex-col self-start ${selectedId ? "hidden xl:flex" : "flex"}`}>
            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar paciente…"
                  className="pl-10 pr-4 h-10 w-full bg-muted/50 border border-transparent rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background focus:border-border transition-all"
                />
              </div>
              <div className="flex items-center justify-between mt-3 px-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Fila</span>
                <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{filteredPacientes.length}</span>
              </div>
            </div>
            <div className="p-2 space-y-1">
              {filteredPacientes.length === 0 ? (
                hasPendentes ? (
                  <div className="flex flex-col items-center py-12 text-center px-4">
                    <Inbox className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum paciente encontrado</p>
                  </div>
                ) : (
                  <EmptyState />
                )
              ) : filteredPacientes.map((p) => {
                const pP = p.exames.filter(e => e.status === "pendente").length;
                const pA = p.exames.filter(e => e.status === "analisado").length;
                const pF = p.exames.filter(e => e.status === "finalizada").length;
                const active = selectedId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedId(p.id); setSelectedExames([]); }}
                    className={`w-full text-left p-3 rounded-lg transition-all duration-150 group ${
                      active ? "bg-primary/8 ring-1 ring-primary/20" : "hover:bg-accent/60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors ${
                        active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}>
                        {initials(p.nome)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground font-mono truncate">{p.protocolo}</span>
                          {pP > 0 && (
                            <span className="h-4 min-w-4 px-1 rounded-full bg-[hsl(var(--status-warning))] text-[hsl(var(--status-warning-foreground))] text-[10px] font-bold flex items-center justify-center tabular-nums">{pP}</span>
                          )}
                        </div>
                        <p className="text-[13px] font-semibold text-foreground leading-snug truncate">{p.nome}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{p.sexo} · {p.idade}</p>
                        <div className="flex items-center gap-1 mt-1.5">
                          {pA > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--status-info))]" title={`${pA} analisada`} />}
                          {pF > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--status-success))]" title={`${pF} finalizada`} />}
                          {pP > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--status-warning))]" title={`${pP} pendente`} />}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Painel principal */}
          <main className={`bg-card rounded-xl border border-border overflow-hidden flex-col self-start w-full ${selectedId ? "flex" : "hidden xl:flex"}`}>
            {!hasPendentes ? (
              <div className="min-h-[400px] flex items-center justify-center"><EmptyState /></div>
            ) : !selectedPaciente || !filteredPacientes.find(p => p.id === selectedId) ? (
              <div className="min-h-[400px] flex flex-col items-center justify-center text-center px-8 py-12">
                <div className="h-16 w-16 rounded-2xl bg-primary/8 flex items-center justify-center mb-4">
                  <Sparkles className="h-7 w-7 text-primary/60" />
                </div>
                <h2 className="text-base font-semibold text-foreground mb-1">Selecione um paciente</h2>
                <p className="text-sm text-muted-foreground max-w-sm">Escolha um paciente na fila ao lado para iniciar a análise dos exames.</p>
              </div>
            ) : (
              <div className="flex flex-col animate-fade-in-up">

                {/* Botão Voltar — visível apenas em mobile/tablet (<1280px) */}
                <div className="xl:hidden px-4 py-2.5 border-b border-border bg-muted/20">
                  <button
                    onClick={() => { setSelectedId(null); setSelectedExames([]); }}
                    className="inline-flex items-center gap-1.5 h-8 px-2 -ml-2 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar à fila
                  </button>
                </div>

                {/* Header do paciente — PacienteHeaderCard responsivo */}
                <div className="px-4 sm:px-6 pt-4 sm:pt-5">
                  <PacienteHeaderCard
                    nome={selectedPaciente.nome}
                    sexo={selectedPaciente.sexo}
                    nascimentoBR={selectedPaciente.nascimento}
                    idade={selectedPaciente.idade}
                    protocolo={selectedPaciente.protocolo}
                    statusLabel={pacienteStatusBadge?.label}
                    statusType={pacienteStatusBadge?.type}
                    actions={[
                      {
                        key: "alterar",
                        label: "Alterar analista",
                        icon: <Edit2 className="h-3.5 w-3.5" />,
                        onClick: () => setShowAlterarResponsavel(true),
                        variant: "ghost",
                      },
                    ]}
                  />
                </div>

                {/* Progresso */}
                <div className="px-4 sm:px-6 py-4 border-b border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Progresso</span>
                      <span className="text-xs font-semibold text-foreground tabular-nums">{progressPercent}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-[11px]">
                      <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[hsl(var(--status-warning))]" /><span className="text-muted-foreground">Pendentes</span><span className="font-semibold text-foreground tabular-nums">{pendentesCount}</span></div>
                      <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[hsl(var(--status-info))]" /><span className="text-muted-foreground">Analisadas</span><span className="font-semibold text-foreground tabular-nums">{analisadosCount}</span></div>
                      <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[hsl(var(--status-success))]" /><span className="text-muted-foreground">Finalizadas</span><span className="font-semibold text-foreground tabular-nums">{finalizadosCount}</span></div>
                      {canceladosCount > 0 && (
                        <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[hsl(var(--status-danger))]" /><span className="text-muted-foreground">Canceladas</span><span className="font-semibold text-foreground tabular-nums">{canceladosCount}</span></div>
                      )}
                    </div>
                </div>

                {/* Toolbar */}
                <div className="px-6 py-3 border-b border-border bg-muted/20 flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selectedPaciente.exames.length > 0 && selectedExames.length === selectedPaciente.exames.length}
                      onChange={() => selectedExames.length === selectedPaciente.exames.length ? setSelectedExames([]) : setSelectedExames(selectedPaciente.exames.map(e => e.id))}
                      className="rounded border-input accent-primary"
                    />
                    {selectedExames.length > 0 ? `${selectedExames.length} selecionado${selectedExames.length > 1 ? "s" : ""}` : "Selecionar todos"}
                  </label>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <ListChecks className="h-3.5 w-3.5" />
                    <span>{totalExames} {totalExames === 1 ? "exame" : "exames"}</span>
                  </div>
                </div>

                {/* Lista de exames + action bar — altura natural; exibe todas as
                    amostras sem scroll interno. O scroll é o da página. */}
                <div className="flex flex-col">
                  <ExameListWithFade>
                    {(() => {
                      const groupLabels: Record<ExameStatus, string> = {
                        pendente: "Pendentes",
                        analisado: "Analisadas",
                        finalizada: "Finalizadas",
                        cancelado: "Canceladas",
                      };
                      const groupCounts: Record<ExameStatus, number> = {
                        pendente: pendentesCount,
                        analisado: analisadosCount,
                        finalizada: finalizadosCount,
                        cancelado: canceladosCount,
                      };
                      let lastStatus: ExameStatus | null = null;
                      return sortedExames.map((exame) => {
                        const showHeader = exame.status !== lastStatus;
                        lastStatus = exame.status;
                        return (
                          <div key={exame.id}>
                            {showHeader && (
                              <div className="flex items-center gap-2 px-1 pt-3 pb-1.5 first:pt-0">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  {groupLabels[exame.status]}
                                </span>
                                <span className="text-[10px] font-medium text-muted-foreground/60 tabular-nums">
                                  {groupCounts[exame.status]}
                                </span>
                                <div className="flex-1 h-px bg-border/60" />
                              </div>
                            )}
                            <ExameCard
                              exame={exame}
                              selected={selectedExames.includes(exame.id)}
                              onToggle={() => toggleExame(exame.id)}
                              onAnalisar={() => handleAnalisar(exame.id)}
                              onFinalizar={() => handleFinalizar(exame.id)}
                              onCancelar={() => openCancelDialog(exame.id)}
                              onReverter={() => handleReverter(exame.id)}
                              onImprimir={() => void imprimirEtiquetaPorAtendimentoExame(exame.id)}
                              onRecoleta={() => openRecoletaDialog(exame.id)}
                            />
                          </div>
                        );
                      });
                    })()}
                  </ExameListWithFade>

                  {/* Action bar — fica logo abaixo do último exame */}
                  <div className="shrink-0 px-4 lg:px-6 py-3.5 border-t border-border bg-card flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openCancelDialog(null)}
                        disabled={selectedExames.length === 0}
                        className="flex items-center gap-2 h-9 px-3.5 rounded-lg text-xs font-medium text-[hsl(var(--status-danger))] hover:bg-[hsl(var(--status-danger-bg))] disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Cancelar
                        {selectedExames.length > 0 && <span className="h-4 min-w-4 px-1 rounded-full bg-[hsl(var(--status-danger))] text-[hsl(var(--status-danger-foreground))] text-[10px] font-bold flex items-center justify-center tabular-nums">{selectedExames.length}</span>}
                      </button>
                      <button
                        onClick={handleAnalisarSelecionados}
                        disabled={selectedExames.length === 0}
                        className="flex items-center gap-2 h-9 px-3.5 rounded-lg text-xs font-medium border border-border text-foreground hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                      >
                        Analisar selecionados
                        {selectedExames.length > 0 && <span className="h-4 min-w-4 px-1 rounded-full bg-foreground/10 text-foreground text-[10px] font-bold flex items-center justify-center tabular-nums">{selectedExames.length}</span>}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAnaliseIntegral}
                        disabled={pendentesCount === 0}
                        className="h-9 px-4 rounded-lg text-xs font-semibold border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 disabled:opacity-40 disabled:hover:bg-primary/5 transition-colors"
                      >
                        Analisar todas
                      </button>
                      <button
                        onClick={handleFinalizarSelecionados}
                        disabled={selectedExames.length === 0}
                        className="h-9 px-4 rounded-lg text-xs font-semibold bg-[hsl(var(--status-success))] text-[hsl(var(--status-success-foreground))] hover:opacity-90 disabled:opacity-40 disabled:hover:opacity-40 transition-opacity"
                      >
                        Finalizar análise
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </section>
      </div>

      {/* ─── Modais ─── */}
      <Overlay open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
        <div>
          <div className="flex items-start gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-[hsl(var(--status-danger-bg))] flex items-center justify-center shrink-0">
              <AlertCircle className="h-5 w-5 text-[hsl(var(--status-danger))]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">Cancelar análise</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {cancelExameId !== null ? "Esta ação cancelará a análise do exame." : `Esta ação cancelará ${selectedExames.length} ${selectedExames.length === 1 ? "análise" : "análises"}.`}
              </p>
            </div>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Motivo do cancelamento</p>
          <div className="space-y-1.5 mb-5">
            {(() => {
              const motivosStore = motivosCancelamentoOpts.map((m) => m.label);
              const lista = motivosStore.includes("Outro") ? motivosStore : [...motivosStore, "Outro"];
              return lista;
            })().map((motivo) => {
              const active = cancelMotivo === motivo;
              return (
                <button
                  key={motivo}
                  type="button"
                  onClick={() => setCancelMotivo(motivo)}
                  className={`w-full flex items-center gap-3 px-3.5 h-11 rounded-xl border text-sm font-medium text-left transition-all duration-150 ${
                    active
                      ? "border-[hsl(var(--status-danger))]/40 bg-[hsl(var(--status-danger-bg))] text-[hsl(var(--status-danger))]"
                      : "border-border bg-card text-foreground hover:border-border/80 hover:bg-accent/50"
                  }`}
                >
                  <span className={`h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                    active ? "border-[hsl(var(--status-danger))]" : "border-border"
                  }`}>
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--status-danger))]" />}
                  </span>
                  <span className="flex-1 truncate">{motivo}</span>
                </button>
              );
            })}
          </div>

          {cancelMotivo === "Outro" && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="motivo-custom-analise" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Descreva o motivo
                </label>
                <span className={`text-[11px] font-medium tabular-nums ${
                  cancelMotivoCustom.trim().length > 0 && cancelMotivoCustom.trim().length < 5
                    ? "text-[hsl(var(--status-danger))]"
                    : "text-muted-foreground"
                }`}>
                  {cancelMotivoCustom.length}/200
                </span>
              </div>
              <textarea
                id="motivo-custom-analise"
                autoFocus
                value={cancelMotivoCustom}
                onChange={(e) => setCancelMotivoCustom(e.target.value.slice(0, 200))}
                placeholder="Informe o motivo do cancelamento (mínimo 5 caracteres)..."
                rows={3}
                maxLength={200}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--status-danger))]/30 focus:border-[hsl(var(--status-danger))]/40 resize-none transition-colors"
              />
              {cancelMotivoCustom.trim().length > 0 && cancelMotivoCustom.trim().length < 5 && (
                <p className="text-[11px] text-[hsl(var(--status-danger))] mt-1.5">
                  Mínimo de 5 caracteres para um motivo descritivo.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button onClick={() => setCancelDialogOpen(false)} className="h-10 px-4 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-accent transition-colors">Voltar</button>
            <button
              onClick={confirmCancel}
              disabled={!cancelMotivo || (cancelMotivo === "Outro" && cancelMotivoCustom.trim().length < 5)}
              className="h-10 px-5 bg-[hsl(var(--status-danger))] text-[hsl(var(--status-danger-foreground))] rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Confirmar cancelamento
            </button>
          </div>
        </div>
      </Overlay>

      <SuccessOverlay
        open={successDialog}
        onClose={() => setSuccessDialog(false)}
        title="Análise concluída!"
        description="Todas as amostras deste atendimento foram analisadas. Bom trabalho!"
      />

      <Overlay open={allCancelledDialog} onClose={() => { setAllCancelledDialog(false); setSelectedId(null); }}>
        <div className="text-center py-2">
          <div className="mx-auto h-12 w-12 rounded-full bg-[hsl(var(--status-danger-bg))] flex items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6 text-[hsl(var(--status-danger))]" />
          </div>
          <h2 className="text-base font-semibold text-foreground mb-1">Todas canceladas</h2>
          <p className="text-sm text-muted-foreground mb-6">Todas as amostras foram canceladas.</p>
          <button onClick={() => { setAllCancelledDialog(false); setSelectedId(null); }} className="h-10 px-6 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors">Fechar</button>
        </div>
      </Overlay>

      <Overlay open={finalizarWarningDialog} onClose={() => setFinalizarWarningDialog(false)}>
        <div className="text-center py-2">
          <div className="mx-auto h-12 w-12 rounded-full bg-[hsl(var(--status-warning-bg))] flex items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6 text-[hsl(var(--status-warning))]" />
          </div>
          <h2 className="text-base font-semibold text-foreground mb-1">Não é possível finalizar</h2>
          <p className="text-sm text-muted-foreground mb-6">As amostras precisam estar com status <strong className="text-foreground">Analisada</strong> antes de finalizar.</p>
          <button onClick={() => setFinalizarWarningDialog(false)} className="h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Entendi</button>
        </div>
      </Overlay>

      <AlterarResponsavelPopup
        open={showAlterarResponsavel}
        onOpenChange={setShowAlterarResponsavel}
        title="Alterar Analista"
        description="Informe as credenciais do novo analista responsável."
        onConfirm={(nome) => {
          if (!selectedPaciente) return;
          setPacientes(pacientes.map((p) => p.id === selectedPaciente.id ? { ...p, analista: nome } : p));
        }}
      />

      {selectedPaciente && recoletaDialog.exameId !== null && (
        <SolicitarRecoletaDialog
          open={recoletaDialog.open}
          onOpenChange={(v) => setRecoletaDialog((s) => ({ ...s, open: v }))}
          etapa="analise"
          atendimentoId={selectedPaciente.id}
          atendimentoExameId={recoletaDialog.exameId}
          exameNome={recoletaDialog.exameNome}
          pacienteNome={selectedPaciente.nome}
          protocolo={selectedPaciente.protocolo}
          onConfirmed={onRecoletaConfirmed}
        />
      )}
    </div>
  );

  // ─── helpers locais ──────────────────────────────────────────────
  function EmptyState() {
    return (
      <div className="flex flex-col items-center py-16 text-center px-8">
        <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <Microscope className="h-8 w-8 text-muted-foreground/40" />
        </div>
        <h2 className="text-base font-semibold text-foreground mb-1">Nenhuma amostra pendente</h2>
        <p className="text-sm text-muted-foreground">Todas as amostras já foram processadas.</p>
      </div>
    );
  }
};

// ─── Status pill (top-level para uso em ExameCard) ──────────────────
function StatusPill({ status }: { status: ExameStatus }) {
  const c = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

// ─── Card de exame (compartilhado entre desktop e mobile) ──────────
function ExameCard({
  exame, selected, onToggle, onAnalisar, onFinalizar, onCancelar, onReverter, onImprimir, onRecoleta,
}: {
  exame: Exame;
  selected: boolean;
  onToggle: () => void;
  onAnalisar: () => void;
  onFinalizar: () => void;
  onCancelar: () => void;
  onReverter: () => void;
  onImprimir: () => void;
  onRecoleta: () => void;
}) {
  const c = statusConfig[exame.status];
  const accentBar: Record<ExameStatus, string> = {
    pendente:   "bg-[hsl(var(--status-warning))]",
    analisado:  "bg-[hsl(var(--status-info))]",
    finalizada: "bg-[hsl(var(--status-success))]",
    cancelado:  "bg-[hsl(var(--status-danger))]",
  };
  return (
    <div className={`relative flex items-stretch rounded-lg border bg-card overflow-hidden transition-all duration-150 ${
      selected ? "border-primary/40 ring-1 ring-primary/15" : "border-border hover:border-border/80"
    }`}>
      <span className={`w-1 shrink-0 ${accentBar[exame.status]}`} />
      <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="rounded border-input accent-primary shrink-0"
          disabled={exame.status === "finalizada" || exame.status === "cancelado"}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground truncate">{exame.nome}</p>
            <StatusPill status={exame.status} />
            <LabBadge
              tipoProcesso={exame.tipoProcesso}
              labApoioId={exame.labApoioId}
              laboratorioPropriaNome={getCachedTenantNome()}
              compact
            />
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
            <span className="truncate">{exame.material}</span>
            {exame.dataAnalise && (
              <span className="flex items-center gap-1 shrink-0"><Clock className="h-3 w-3" />{exame.dataAnalise}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Reimpressão de etiqueta — disponível sempre que houver amostra associada,
              independentemente do status da análise. Útil para etiqueta danificada
              ou alíquotas geradas durante a análise. */}
          {exame.amostraId && (
            <button
              onClick={onImprimir}
              className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Reimprimir etiqueta da amostra"
            >
              <Printer className="h-3.5 w-3.5" />
            </button>
          )}
          {exame.status === "cancelado" ? (
            <button onClick={onReverter} className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border border-border text-foreground hover:bg-accent transition-colors">
              <RotateCcw className="h-3.5 w-3.5" /> Reverter
            </button>
          ) : exame.status === "finalizada" ? (
            <>
              <button
                onClick={onRecoleta}
                className="h-8 px-3 rounded-md text-xs font-medium border border-border text-muted-foreground hover:text-warning hover:border-warning/40 hover:bg-warning/5 transition-colors flex items-center gap-1.5"
                title="Solicitar recoleta"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Recoleta
              </button>
              <span className="flex items-center gap-1 px-2 h-8 text-xs font-medium text-[hsl(var(--status-success))]">
                <CheckCircle2 className="h-3.5 w-3.5" /> Finalizada
              </span>
            </>
          ) : (
            <>
              <button onClick={onCancelar} className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-[hsl(var(--status-danger))] hover:bg-[hsl(var(--status-danger-bg))] transition-colors" title="Cancelar">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              {exame.status === "analisado" && (
                <button
                  onClick={onRecoleta}
                  className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-warning hover:bg-warning/10 transition-colors"
                  title="Solicitar recoleta"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              {exame.status === "analisado" ? (
                <button onClick={onFinalizar} className="h-8 px-3.5 rounded-md text-xs font-semibold bg-[hsl(var(--status-success))] text-[hsl(var(--status-success-foreground))] hover:opacity-90 transition-opacity">
                  Finalizar
                </button>
              ) : (
                <button onClick={onAnalisar} className="h-8 px-3.5 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  Analisar
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Overlay (top-level: evita re-mount/flicker em setState) ───────
function Overlay({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-[6px]" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border border-border shadow-elevation-lg w-full max-w-md max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-y-auto p-6 animate-fade-in-up">
        {children}
      </div>
    </div>
  );
}

export default AnalisarAmostra;
