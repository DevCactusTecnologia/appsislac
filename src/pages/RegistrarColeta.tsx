import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { matchesSearch } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Edit2,
  RotateCcw,
  Droplets,
  Inbox,
  Sparkles,
  ListChecks,
  FlaskConical,
  ArrowLeft,
  Printer,
} from "lucide-react";
import AlterarResponsavelPopup from "@/components/AlterarResponsavelPopup";
import PacienteHeaderCard from "@/components/operacional/PacienteHeaderCard";
import { PacienteFlagsChips } from "@/components/operacional/PacienteFlagsChips";


// Dialogs lazy-loaded — só baixam chunks quando abertos.
const SolicitarRecoletaDialog = lazy(() => import("@/components/SolicitarRecoletaDialog"));
const ConfirmarIdentidadeDialog = lazy(() => import("@/components/rastreabilidade/ConfirmarIdentidadeDialog"));
const RegistrarOrientacoesDialog = lazy(() => import("@/components/rastreabilidade/RegistrarOrientacoesDialog"));
import { ShieldCheck, ClipboardCheck } from "lucide-react";
import { formatIdadeDetalhada } from "@/lib/idade";
import { fireSuccessConfetti } from "@/lib/confetti";
import {
  getExamesOperacionaisByStatus,
  updateAtendimentoExame,
  subscribe as subscribeAtendimentos,
  type ExameOperacionalRow,
} from "@/data/atendimentoStore";
import { criarAmostraParaExame } from "@/data/sorotecaStore";
import { imprimirEtiquetaPorAtendimentoExame } from "@/lib/imprimirEtiquetaPorAtendimentoExame";
import LabBadge from "@/components/LabBadge";
import ImpressaoLotePorLab from "@/components/ImpressaoLotePorLab";
import { getCachedTenantNome } from "@/lib/db/tenantResolver";
import { useDicionario } from "@/hooks/useDicionario";
import { toast } from "sonner";
import ExameListWithFade from "@/components/ExameListWithFade";
import { showError } from "@/lib/showError";
import { useAuth } from "@/contexts/AuthContext";
import PermissionDenied from "@/components/PermissionDenied";
import { PageHeader } from "@/components/shared/PageHeader";

// ─── UI status (preserva o vocabulário antigo da tela) ───
type ExameStatus = "coletado" | "pendente" | "cancelado";

interface Exame {
  id: number;
  nome: string;
  material: string;
  material_id?: string | null;
  status: ExameStatus;
  dataColeta: string | null;
  exameId?: string | null;
  amostraId?: string | null;
  tipoProcesso?: "INTERNO" | "TERCEIRIZADO";
  labApoioId?: string | null;
}


interface Paciente {
  id: number;
  protocolo: string;
  nome: string;
  cpf: string;
  sexo: string;
  nascimento: string;
  idade: string;
  coletado: boolean;
  coletador: string;
  exames: Exame[];
  pacienteId?: number | null;
  jejum: boolean;
  prioridadeClinica: "normal" | "urgencia" | "emergencia";
}

const isoToBR = (iso: string): string => {
  if (!iso) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};
const calcIdadeAnosMeses = (nascimento: string): string => formatIdadeDetalhada(isoToBR(nascimento));

const formatSexo = (s: string | null | undefined): string => {
  const v = (s ?? "").trim().toUpperCase();
  if (v === "M" || v.startsWith("MASC")) return "Masculino";
  if (v === "F" || v.startsWith("FEM")) return "Feminino";
  return s ?? "";
};

const dbToUi = (s: ExameOperacionalRow["exames"][0]["status"]): ExameStatus | null => {
  if (s === "pendente") return "pendente";
  if (s === "coletado") return "coletado";
  if (s === "cancelado") return "cancelado";
  return null;
};

const formatColetaDate = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

async function fetchPacientesColeta(): Promise<Paciente[]> {
  const rows = await getExamesOperacionaisByStatus(["pendente", "coletado", "cancelado"]);
  return rows
    .map(r => {
      const exames: Exame[] = r.exames
        .map(e => {
          const ui = dbToUi(e.status);
          if (!ui) return null;
          return {
            id: e.id,
            nome: e.nome,
            material: e.material,
            material_id: e.material_id ?? null,

            status: ui,
            dataColeta: formatColetaDate(e.data_coleta),
            exameId: e.exame_id ?? null,
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
        sexo: formatSexo(r.paciente_sexo),
        nascimento: isoToBR(r.paciente_nascimento),
        idade: calcIdadeAnosMeses(r.paciente_nascimento),
        coletado: false,
        coletador: r.responsavel || "—",
        exames,
        pacienteId: r.paciente_id ?? null,
        jejum: !!r.jejum,
        prioridadeClinica: r.prioridade_clinica ?? "normal",
      } as Paciente;
    })
    .filter((p): p is Paciente => p !== null);
}

const statusConfig: Record<ExameStatus, { label: string; dot: string; text: string; bg: string }> = {
  coletado:  { label: "Coletado",  dot: "bg-[hsl(var(--status-success))]", text: "text-[hsl(var(--status-success))]", bg: "bg-[hsl(var(--status-success-bg))]" },
  pendente:  { label: "Pendente",  dot: "bg-[hsl(var(--status-warning))]", text: "text-[hsl(var(--status-warning))]", bg: "bg-[hsl(var(--status-warning-bg))]" },
  cancelado: { label: "Cancelada", dot: "bg-[hsl(var(--status-danger))]",  text: "text-[hsl(var(--status-danger))]",  bg: "bg-[hsl(var(--status-danger-bg))]" },
};

const initials = (name: string) => name.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();

const RegistrarColeta = () => {
  const { hasPermission } = useAuth();
  // RBAC visual — backend revalida via trigger BEFORE UPDATE em atendimento_exames.
  if (!hasPermission("registrar_coleta")) {
    return <PermissionDenied permissao="registrar_coleta" />;
  }
  const [searchParams, setSearchParams] = useSearchParams();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("protocolo") ?? "");
  const [selectedExames, setSelectedExames] = useState<number[]>([]);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelExameId, setCancelExameId] = useState<number | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [cancelMotivoCustom, setCancelMotivoCustom] = useState("");
  const [successDialog, setSuccessDialog] = useState(false);
  // Snapshot do atendimento que acabou de concluir — preserva a lista de
  // exames coletados para permitir (re)impressão das etiquetas dentro do modal
  // "Coleta concluída!". Necessário porque após a celebração limpamos o
  // selectedPaciente e o item some da fila.
  const [successPaciente, setSuccessPaciente] = useState<Paciente | null>(null);
  const [printingAll, setPrintingAll] = useState(false);
  const [allCancelledDialog, setAllCancelledDialog] = useState(false);
  const [showAlterarResponsavel, setShowAlterarResponsavel] = useState(false);
  const celebratedIdsRef = useRef<Set<number>>(new Set());
  const initializedRef = useRef(false);

  // Recoleta dialog state
  const [recoletaDialog, setRecoletaDialog] = useState<{ open: boolean; exameId: number | null }>({
    open: false,
    exameId: null,
  });
  const [showIdentidadeDialog, setShowIdentidadeDialog] = useState(false);
  const [showOrientacoesDialog, setShowOrientacoesDialog] = useState(false);

  const { data: motivosCancelamentoOpts = [] } = useDicionario("motivo_cancelamento", { ativosOnly: true });
  // Banner contextual quando o usuário chega via ?protocolo= (vindo do Novo Atendimento)
  const [protoBanner, setProtoBanner] = useState<{
    protocolo: string;
    paciente: string;
    tercCount: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchPacientesColeta();
        if (!cancelled) setPacientes(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const reload = async () => {
    const list = await fetchPacientesColeta();
    setPacientes(list);
  };

  // Real-time: quando o atendimento é editado (jejum / prioridade / etc.),
  // o atendimentoStore notifica via realtime channel. Recarregamos a fila.
  useEffect(() => {
    const unsub = subscribeAtendimentos(() => { void reload(); });
    return unsub;
  }, []);

  // Pré-seleção via ?protocolo=ATD-... (vindo do SuccessOverlay de Novo Atendimento)
  useEffect(() => {
    const proto = searchParams.get("protocolo");
    if (!proto || pacientes.length === 0) return;
    const match = pacientes.find(
      (p) => p.protocolo.toLowerCase() === proto.toLowerCase(),
    );
    if (match) {
      setSelectedId(match.id);
      setSearchQuery(proto);
      const tercCount = match.exames.filter(
        (e) => e.tipoProcesso === "TERCEIRIZADO" && e.status !== "cancelado",
      ).length;
      setProtoBanner({ protocolo: match.protocolo, paciente: match.nome, tercCount });
      if (tercCount === 0) {
        toast.info("Este atendimento não possui exames de laboratório de apoio.");
      }
    } else {
      toast.error(`Protocolo ${proto} não encontrado na fila de coleta.`);
    }
    // limpa o param para não re-disparar em próximas navegações internas
    const next = new URLSearchParams(searchParams);
    next.delete("protocolo");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacientes]);

  const selectedPaciente = pacientes.find((p) => p.id === selectedId);

  const isPacienteCompleto = (p: Paciente) => {
    const allTerminal = p.exames.every((e) => e.status === "coletado" || e.status === "cancelado");
    const temColetado = p.exames.some((e) => e.status === "coletado");
    return allTerminal && temColetado;
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
    const c = { pendente: 0, coletado: 0 };
    filteredPacientes.forEach(p => p.exames.forEach(e => {
      if (e.status === "pendente") c.pendente++;
      else if (e.status === "coletado") c.coletado++;
    }));
    return c;
  }, [filteredPacientes]);

  type ColetaTransition = {
    exameId: number;
    novoStatusUi: ExameStatus;
    dbStatus: "pendente" | "coletado" | "cancelado";
    data_coleta: string | null;
    motivo_cancelamento: string | null;
  };
  const applyTransitions = async (updates: Array<ColetaTransition>) => {
    if (!selectedPaciente || updates.length === 0) return;
    const dataStr = getNowStr();
    const pacienteId = selectedPaciente.id;
    const idMap = new Map(updates.map(u => [u.exameId, u]));

    // Persiste PRIMEIRO no banco. Só depois atualiza o estado local.
    // Evita celebração otimista (modal "Coleta concluída!") antes da
    // confirmação real, e impede inconsistência quando RLS/triggers falham.
    const results = await Promise.all(updates.map(u =>
      updateAtendimentoExame(u.exameId, {
        status: u.dbStatus,
        data_coleta: u.dbStatus === "coletado" ? new Date().toISOString() : null,
        motivo_cancelamento: u.motivo_cancelamento,
      })
    ));

    const failed = results.filter(r => !r.ok);
    if (failed.length > 0) {
      const firstErr = failed.find(r => r.error)?.error ?? "erro desconhecido";
      toast.error(`Falha ao salvar ${failed.length} alteração(ões): ${firstErr}`);
      await reload();
      return;
    }

    // Sucesso confirmado pelo banco — sincroniza estado local com o resultado.
    setPacientes(curr => curr.map(p => p.id !== pacienteId ? p : {
      ...p,
      exames: p.exames.map(e => {
        const u = idMap.get(e.id);
        if (!u) return e;
        return {
          ...e,
          status: u.novoStatusUi,
          dataColeta: u.novoStatusUi === "coletado" ? dataStr : null,
        };
      }),
    }));

    // Soroteca: cria amostra para cada exame coletado (aditivo, tolerante a falhas).
    try {
      const coletados = updates.filter(u => u.dbStatus === "coletado");
      if (coletados.length > 0) {
        const pacienteAtual = pacientes.find(p => p.id === pacienteId);
        await Promise.all(
          coletados.map(u => {
            const ex = pacienteAtual?.exames.find(e => e.id === u.exameId);
            return criarAmostraParaExame({
              atendimentoExameId: u.exameId,
              atendimentoId: pacienteId,
              exameId: ex?.exameId ?? null,
              pacienteId: pacienteAtual?.pacienteId ?? null,
              materialId: ex?.material_id ?? null,
            });
          }),
        );
      }
    } catch (e) {
      showError(e, { scope: "RegistrarColeta.criarAmostras", silent: true });
    }

    // Recarrega a lista do banco
    await reload();
  };

  // Detecta quando UM atendimento específico fica completo (todas amostras
  // coletadas — com pelo menos 1 efetivamente coletada). Dispara confete +
  // overlay imediatamente, mesmo que ainda existam outros pacientes na fila.
  useEffect(() => {
    if (loading) return;

    // Primeira passagem após o load inicial: marcar como já celebrados todos
    // os atendimentos que já estão completos no banco (não celebrar histórico).
    if (!initializedRef.current) {
      pacientes.forEach((p) => {
        if (isPacienteCompleto(p) || isPacienteTodoCancelado(p)) {
          celebratedIdsRef.current.add(p.id);
        }
      });
      initializedRef.current = true;
      return;
    }

    // Procura atendimentos que acabaram de completar (com pelo menos 1 coletada).
    const justCompleted = pacientes.find(
      (p) => isPacienteCompleto(p) && !celebratedIdsRef.current.has(p.id),
    );

    if (justCompleted) {
      celebratedIdsRef.current.add(justCompleted.id);
      // Marca também os "todo cancelado" presentes para não celebrar depois
      pacientes.forEach((p) => {
        if (isPacienteTodoCancelado(p)) celebratedIdsRef.current.add(p.id);
      });
      setSuccessPaciente(justCompleted);
      setSuccessDialog(true);
      setSelectedId(null);
      setSelectedExames([]);
      fireSuccessConfetti();
    } else {
      // Garante que "todo cancelado" também não dispare celebração futura
      pacientes.forEach((p) => {
        if (isPacienteTodoCancelado(p)) celebratedIdsRef.current.add(p.id);
      });
    }
  }, [pacientes, loading]);

  const handleColetar = (exameId: number): void => {
    void applyTransitions([{
      exameId, novoStatusUi: "coletado", dbStatus: "coletado", data_coleta: new Date().toISOString(), motivo_cancelamento: null,
    }]);
  };

  const handleColetaIntegral = () => {
    if (!selectedPaciente) return;
    const targets = selectedPaciente.exames.filter(e => e.status === "pendente");
    void applyTransitions(targets.map((e): ColetaTransition => ({
      exameId: e.id, novoStatusUi: "coletado", dbStatus: "coletado",
      data_coleta: new Date().toISOString(), motivo_cancelamento: null,
    })));
  };

  const handleColetarSelecionados = () => {
    if (!selectedPaciente) return;
    const targets = selectedPaciente.exames.filter(e => selectedExames.includes(e.id) && e.status === "pendente");
    void applyTransitions(targets.map((e): ColetaTransition => ({
      exameId: e.id, novoStatusUi: "coletado", dbStatus: "coletado",
      data_coleta: new Date().toISOString(), motivo_cancelamento: null,
    })));
    setSelectedExames([]);
  };

  const handleReverter = (exameId: number): void => {
    void applyTransitions([{
      exameId, novoStatusUi: "pendente", dbStatus: "pendente", data_coleta: null, motivo_cancelamento: null,
    }]);
  };

  const openRecoletaDialog = (exameId: number) => setRecoletaDialog({ open: true, exameId });
  const onRecoletaConfirmed = async () => {
    if (recoletaDialog.exameId == null) return;
    // Marca o exame como pendente novamente para nova coleta (sem cobrança extra).
    await applyTransitions([{
      exameId: recoletaDialog.exameId, novoStatusUi: "pendente",
      dbStatus: "pendente", data_coleta: null, motivo_cancelamento: null,
    }]);
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
    await applyTransitions(targetIds.map((id): ColetaTransition => ({
      exameId: id, novoStatusUi: "cancelado", dbStatus: "cancelado",
      data_coleta: null, motivo_cancelamento: motivo,
    })));
    setSelectedExames([]);
    toast.success(
      targetIds.length === 1
        ? "Amostra cancelada com sucesso"
        : `${targetIds.length} amostras canceladas com sucesso`,
      { description: `Motivo: ${motivo}` }
    );
  };

  const pendentesCount  = selectedPaciente?.exames.filter((e) => e.status === "pendente").length ?? 0;
  const coletadosCount  = selectedPaciente?.exames.filter((e) => e.status === "coletado").length ?? 0;
  const canceladosCount = selectedPaciente?.exames.filter((e) => e.status === "cancelado").length ?? 0;
  const totalExames = selectedPaciente?.exames.length ?? 0;
  const concluidosCount = coletadosCount + canceladosCount;
  const progressPercent = totalExames > 0 ? Math.round((concluidosCount / totalExames) * 100) : 0;

  // Ordena exames: pendentes primeiro, depois coletados, depois cancelados.
  // Assim as amostras pendentes ficam sempre acessíveis no topo, e as concluídas vão para o final.
  const statusOrder = { pendente: 0, coletado: 1, cancelado: 2 } as const;
  const sortExames = <T extends { status: ExameStatus }>(exames: T[]): T[] =>
    [...exames].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  const sortedExames = useMemo(
    () => selectedPaciente ? sortExames(selectedPaciente.exames) : [],
    [selectedPaciente]
  );

  // Status-type mapping para o badge do PacienteHeaderCard.
  type HeaderStatusType = "success" | "warning" | "danger" | "info" | "neutral" | "purple" | "teal";
  const pacienteStatusBadge = useMemo<{ label: string; type: HeaderStatusType } | null>(() => {
    if (!selectedPaciente) return null;
    if (pendentesCount > 0) return { label: `${pendentesCount} pendente${pendentesCount > 1 ? "s" : ""}`, type: "warning" };
    if (coletadosCount > 0) return { label: `${coletadosCount} coletada${coletadosCount > 1 ? "s" : ""}`, type: "success" };
    return null;
  }, [selectedPaciente, pendentesCount, coletadosCount]);

  // ─── Componentes locais ──────────────────────────────────────────
  const SummaryChip = ({ icon: Icon, label, value, tone }: { icon: typeof Clock; label: string; value: number; tone: "warning" | "success" }) => {
    const map = {
      warning: "text-[hsl(var(--status-warning))] bg-[hsl(var(--status-warning-bg))] ring-[hsl(var(--status-warning))]/15",
      success: "text-[hsl(var(--status-success))] bg-[hsl(var(--status-success-bg))] ring-[hsl(var(--status-success))]/15",
    } as const;
    return (
      <div className={`flex items-center gap-2 px-3.5 h-9 rounded-full ring-1 ${map[tone]}`}>
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
        <span className="text-sm font-bold tabular-nums">{value}</span>
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
    <div className="min-h-screen bg-gradient-to-b from-muted/30 via-background to-background">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-12 animate-fade-in">

        <PageHeader
          eyebrow="Operacional"
          title="Registrar coleta"
          description={`${filteredPacientes.length} ${filteredPacientes.length === 1 ? "paciente na fila" : "pacientes na fila"}`}
          actions={
            hasPendentes ? (
              <div className="flex flex-wrap items-center gap-2">
                <SummaryChip icon={Clock}        label="Pendentes" value={globalCounts.pendente} tone="warning" />
                <SummaryChip icon={CheckCircle2} label="Coletadas" value={globalCounts.coletado} tone="success" />
              </div>
            ) : undefined
          }
        />


        {/* ─────────── MASTER-DETAIL (responsivo) ───────────
            Em mobile/tablet (<1280px): mostra a fila OU o detalhe (nunca os dois).
            Em desktop (≥1280px): mostra os dois lado a lado. */}
        <section className="grid grid-cols-1 xl:grid-cols-[340px_1fr] 2xl:grid-cols-[380px_1fr] gap-5 items-start">
          {/* Sidebar de pacientes — altura natural exibindo todos os pacientes.
              Sem scroll interno; o scroll é o da página. */}
          <aside className={`bg-card rounded-2xl border border-border/60 shadow-elevation-xs flex-col self-start overflow-hidden ${selectedId ? "hidden xl:flex" : "flex"}`}>
            <div className="p-4 border-b border-border/60 bg-gradient-to-br from-primary/5 via-card to-transparent">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar paciente…"
                  className="pl-10 pr-4 h-10 w-full bg-card border border-border/60 rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
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
                const pC = p.exames.filter(e => e.status === "coletado").length;
                const active = selectedId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedId(p.id); setSelectedExames([]); }}
                    className={`w-full text-left p-3 rounded-xl transition-all duration-150 group ${
                      active ? "bg-primary/8 ring-1 ring-primary/25 shadow-elevation-xs" : "hover:bg-accent/60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-[11px] font-semibold transition-colors ${
                        active ? "bg-primary text-primary-foreground ring-1 ring-primary/30" : "bg-muted text-foreground"
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
                          {pC > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--status-success))]" title={`${pC} coletada`} />}
                          {pP > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--status-warning))]" title={`${pP} pendente`} />}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Painel principal — altura totalmente natural para exibir todas as amostras. */}
          <main className={`bg-card rounded-2xl border border-border/60 shadow-elevation-xs overflow-hidden flex-col self-start w-full ${selectedId ? "flex" : "hidden xl:flex"}`}>
            {!hasPendentes ? (
              <div className="min-h-[400px] flex items-center justify-center"><EmptyState /></div>
            ) : !selectedPaciente || !filteredPacientes.find(p => p.id === selectedId) ? (
              <div className="min-h-[400px] flex flex-col items-center justify-center text-center px-8 py-12 bg-gradient-to-br from-primary/5 via-card to-transparent">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center mb-4">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-base font-semibold text-foreground mb-1">Selecione um paciente</h2>
                <p className="text-sm text-muted-foreground max-w-sm">Escolha um paciente na fila ao lado para iniciar o registro de coleta.</p>
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

                {/* Banner contextual quando vier de ?protocolo= */}
                {protoBanner && selectedPaciente.protocolo === protoBanner.protocolo && (
                  <div className="px-6 py-3 border-b border-border bg-primary/5 flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <Printer className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-foreground">
                        Protocolo <span className="font-mono">{protoBanner.protocolo}</span> pré-selecionado
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {protoBanner.tercCount > 0 ? (
                          <>
                            <span className="font-semibold text-foreground">{protoBanner.tercCount}</span>{" "}
                            {protoBanner.tercCount === 1 ? "exame de laboratório de apoio" : "exames de laboratório de apoio"} destacado{protoBanner.tercCount === 1 ? "" : "s"} abaixo. Registre a coleta para liberar a impressão das etiquetas.
                          </>
                        ) : (
                          <>Este atendimento não possui exames de laboratório de apoio — etiquetas seguem o fluxo padrão.</>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setProtoBanner(null)}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      title="Dispensar"
                    >
                      Dispensar
                    </button>
                  </div>
                )}

                {/* Header do paciente — usa PacienteHeaderCard responsivo */}
                <div className="px-4 sm:px-6 pt-4 sm:pt-5 bg-gradient-to-br from-primary/5 via-card to-transparent border-b border-border/60 pb-4">
                  <PacienteHeaderCard
                    nome={selectedPaciente.nome}
                    sexo={selectedPaciente.sexo}
                    nascimentoBR={selectedPaciente.nascimento}
                    idade={selectedPaciente.idade}
                    protocolo={selectedPaciente.protocolo}
                    statusLabel={pacienteStatusBadge?.label}
                    statusType={pacienteStatusBadge?.type}
                    belowAvatar={<PacienteFlagsChips jejum={selectedPaciente.jejum} prioridade={selectedPaciente.prioridadeClinica} />}
                    actions={[
                      {
                        key: "identidade",
                        label: "Identidade",
                        icon: <ShieldCheck className="h-3.5 w-3.5" />,
                        onClick: () => setShowIdentidadeDialog(true),
                        variant: "ghost",
                        title: "Confirmar identidade do paciente (RDC 978/2025)",
                      },
                      {
                        key: "orientacoes",
                        label: "Orientações",
                        icon: <ClipboardCheck className="h-3.5 w-3.5" />,
                        onClick: () => setShowOrientacoesDialog(true),
                        variant: "ghost",
                        title: "Registrar orientações pré-analíticas entregues",
                      },
                      {
                        key: "alterar",
                        label: "Alterar coletor",
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
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Progresso da coleta</span>
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
                      <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[hsl(var(--status-success))]" /><span className="text-muted-foreground">Coletadas</span><span className="font-semibold text-foreground tabular-nums">{coletadosCount}</span></div>
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

                {/* Fase 4 — impressão em lote por laboratório (paciente atual) */}
                {(() => {
                  const lote = selectedPaciente.exames
                    .filter(e => e.status === "coletado" && e.amostraId)
                    .map(e => ({
                      atendimentoExameId: e.id,
                      tipoProcesso: e.tipoProcesso,
                      labApoioId: e.labApoioId,
                      amostraId: e.amostraId,
                    }));
                  if (lote.length === 0) return null;
                  return (
                    <div className="px-6 py-3 border-b border-border">
                      <ImpressaoLotePorLab
                        exames={lote}
                        laboratorioPropriaNome={getCachedTenantNome()}
                        compact
                      />
                    </div>
                  );
                })()}

                {/* Lista de exames — exibe todas as amostras; o scroll passa a ser da página. */}
                <div className="flex flex-col">
                  <ExameListWithFade>
                    {sortedExames.map((exame) => (
                      <ExameCard
                        key={exame.id}
                        exame={exame}
                        selected={selectedExames.includes(exame.id)}
                        onToggle={() => toggleExame(exame.id)}
                        onColetar={() => handleColetar(exame.id)}
                        onCancelar={() => openCancelDialog(exame.id)}
                        onReverter={() => handleReverter(exame.id)}
                        onRecoleta={() => openRecoletaDialog(exame.id)}
                        onImprimir={() => void imprimirEtiquetaPorAtendimentoExame(exame.id)}
                        highlight={
                          !!protoBanner &&
                          protoBanner.protocolo === selectedPaciente.protocolo &&
                          exame.tipoProcesso === "TERCEIRIZADO"
                        }
                        etiquetaJaPrinted={
                          !!exame.amostraId &&
                          sortedExames.findIndex(
                            (x) => x.amostraId === exame.amostraId && x.status === "coletado",
                          ) !== sortedExames.findIndex((x) => x.id === exame.id)
                        }
                      />
                    ))}
                  </ExameListWithFade>

                  {/* Action bar — fica logo abaixo do último exame */}
                  <div className="shrink-0 px-4 lg:px-6 py-3.5 border-t border-border/60 bg-muted/10 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openCancelDialog(null)}
                        disabled={selectedExames.length === 0}
                        className="flex items-center gap-2 h-9 px-3.5 rounded-xl text-xs font-medium text-[hsl(var(--status-danger))] hover:bg-[hsl(var(--status-danger-bg))] disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Cancelar
                        {selectedExames.length > 0 && <span className="h-4 min-w-4 px-1 rounded-full bg-[hsl(var(--status-danger))] text-[hsl(var(--status-danger-foreground))] text-[10px] font-bold flex items-center justify-center tabular-nums">{selectedExames.length}</span>}
                      </button>
                      <button
                        onClick={handleColetarSelecionados}
                        disabled={selectedExames.length === 0}
                        className="flex items-center gap-2 h-9 px-3.5 rounded-xl text-xs font-medium border border-border/60 bg-card text-foreground hover:bg-accent disabled:opacity-40 disabled:hover:bg-card transition-colors"
                      >
                        Coletar selecionados
                        {selectedExames.length > 0 && <span className="h-4 min-w-4 px-1 rounded-full bg-foreground/10 text-foreground text-[10px] font-bold flex items-center justify-center tabular-nums">{selectedExames.length}</span>}
                      </button>
                    </div>
                    <button
                      onClick={handleColetaIntegral}
                      disabled={pendentesCount === 0}
                      className="h-9 px-5 rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:hover:bg-primary transition-colors shadow-elevation-xs"
                    >
                      Coleta integral
                    </button>
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
              <h2 className="text-base font-semibold text-foreground">Cancelar amostra</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {cancelExameId !== null ? "Esta ação cancelará a coleta do exame." : `Esta ação cancelará ${selectedExames.length} ${selectedExames.length === 1 ? "amostra" : "amostras"}.`}
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
                <label htmlFor="motivo-custom-coleta" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
                id="motivo-custom-coleta"
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
            <button onClick={() => setCancelDialogOpen(false)} className="h-10 px-4 rounded-xl border border-border/60 bg-card text-xs font-medium text-foreground hover:bg-accent transition-colors">Voltar</button>
            <button
              onClick={confirmCancel}
              disabled={!cancelMotivo || (cancelMotivo === "Outro" && cancelMotivoCustom.trim().length < 5)}
              className="h-10 px-5 bg-[hsl(var(--status-danger))] text-[hsl(var(--status-danger-foreground))] rounded-full text-xs font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-elevation-xs"
            >
              Confirmar cancelamento
            </button>
          </div>
        </div>
      </Overlay>

      <Overlay
        open={successDialog}
        onClose={() => { setSuccessDialog(false); setSuccessPaciente(null); }}
      >
        <div className="py-2">
          <div className="text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-[hsl(var(--status-success-bg))] flex items-center justify-center mb-4">
              <CheckCircle2 className="h-7 w-7 text-[hsl(var(--status-success))]" />
            </div>
            <h2 className="text-base font-semibold text-foreground mb-1">Coleta concluída!</h2>
            <p className="text-xs text-muted-foreground mb-5">
              {successPaciente?.nome
                ? <>Todas as amostras de <span className="font-medium text-foreground">{successPaciente.nome}</span> foram registradas.</>
                : "Todas as amostras deste atendimento foram registradas."}
            </p>
          </div>

          {successPaciente && (() => {
            const coletados = successPaciente.exames.filter(e => e.status === "coletado");
            if (coletados.length === 0) return null;
            return (
              <div className="border border-border/60 rounded-lg overflow-hidden mb-5">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border/60">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Etiquetas ({coletados.length})
                  </span>
                  <button
                    type="button"
                    disabled={printingAll}
                    onClick={async () => {
                      setPrintingAll(true);
                      try {
                        for (const ex of coletados) {
                          await imprimirEtiquetaPorAtendimentoExame(ex.id);
                        }
                      } finally {
                        setPrintingAll(false);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    <Printer className="h-3 w-3" />
                    {printingAll ? "Imprimindo..." : "Imprimir todas"}
                  </button>
                </div>
                <ul className="divide-y divide-border/60 max-h-56 overflow-auto no-scrollbar">
                  {coletados.map((ex) => (
                    <li key={ex.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="text-xs text-foreground truncate">{ex.nome}</span>
                      <button
                        type="button"
                        onClick={() => void imprimirEtiquetaPorAtendimentoExame(ex.id)}
                        className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[11px] font-medium border border-border text-foreground hover:bg-accent transition-colors shrink-0"
                      >
                        <Printer className="h-3 w-3" />
                        Imprimir
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}

          <div className="flex justify-center">
            <button
              onClick={() => { setSuccessDialog(false); setSuccessPaciente(null); }}
              className="h-10 px-6 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-elevation-xs"
            >
              Continuar
            </button>
          </div>
        </div>
      </Overlay>


      <Overlay open={allCancelledDialog} onClose={() => { setAllCancelledDialog(false); setSelectedId(null); }}>
        <div className="text-center py-2">
          <div className="mx-auto h-12 w-12 rounded-full bg-[hsl(var(--status-danger-bg))] flex items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6 text-[hsl(var(--status-danger))]" />
          </div>
          <h2 className="text-base font-semibold text-foreground mb-1">Todas canceladas</h2>
          <p className="text-sm text-muted-foreground mb-6">Todas as amostras foram canceladas.</p>
          <button onClick={() => { setAllCancelledDialog(false); setSelectedId(null); }} className="h-10 px-6 rounded-xl border border-border/60 bg-card text-sm font-medium text-foreground hover:bg-accent transition-colors">Fechar</button>
        </div>
      </Overlay>

      <AlterarResponsavelPopup
        open={showAlterarResponsavel}
        onOpenChange={setShowAlterarResponsavel}
        title="Alterar Coletor"
        description="Informe as credenciais do novo coletor responsável."
        onConfirm={(nome) => {
          if (!selectedPaciente) return;
          setPacientes(pacientes.map((p) => p.id === selectedPaciente.id ? { ...p, coletador: nome } : p));
        }}
      />

      {(() => {
        const exameAlvo = selectedPaciente?.exames.find(e => e.id === recoletaDialog.exameId);
        return (
          recoletaDialog.open && (
          <Suspense fallback={null}>
          <SolicitarRecoletaDialog
            open={recoletaDialog.open}
            onOpenChange={(v) => setRecoletaDialog({ open: v, exameId: v ? recoletaDialog.exameId : null })}
            etapa="coleta"
            atendimentoId={selectedPaciente?.id ?? 0}
            atendimentoExameId={recoletaDialog.exameId ?? 0}
            exameNome={exameAlvo?.nome ?? ""}
            pacienteNome={selectedPaciente?.nome ?? ""}
            protocolo={selectedPaciente?.protocolo ?? ""}
            onConfirmed={onRecoletaConfirmed}
          />
          </Suspense>
          )
        );
      })()}

      {selectedPaciente && (
        <>
          {showIdentidadeDialog && (
          <Suspense fallback={null}>
          <ConfirmarIdentidadeDialog
            open={showIdentidadeDialog}
            onOpenChange={setShowIdentidadeDialog}
            atendimentoId={selectedPaciente.id}
            protocolo={selectedPaciente.protocolo}
            pacienteNome={selectedPaciente.nome}
            pacienteNascimento={selectedPaciente.nascimento}
            pacienteCpf={selectedPaciente.cpf}
          />
          </Suspense>
          )}
          {showOrientacoesDialog && (
          <Suspense fallback={null}>
          <RegistrarOrientacoesDialog
            open={showOrientacoesDialog}
            onOpenChange={setShowOrientacoesDialog}
            atendimentoId={selectedPaciente.id}
            protocolo={selectedPaciente.protocolo}
            pacienteNome={selectedPaciente.nome}
            exames={selectedPaciente.exames.map(e => e.nome)}
          />
          </Suspense>
          )}
        </>
      )}
    </div>
  );

  function EmptyState() {
    return (
      <div className="flex flex-col items-center py-16 text-center px-8">
        <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <FlaskConical className="h-8 w-8 text-muted-foreground/40" />
        </div>
        <h2 className="text-base font-semibold text-foreground mb-1">Nenhuma coleta pendente</h2>
        <p className="text-sm text-muted-foreground">Todas as coletas já foram processadas.</p>
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
  exame, selected, onToggle, onColetar, onCancelar, onReverter, onRecoleta, onImprimir, etiquetaJaPrinted, highlight = false,
}: {
  exame: Exame;
  selected: boolean;
  onToggle: () => void;
  onColetar: () => void;
  onCancelar: () => void;
  onReverter: () => void;
  onRecoleta: () => void;
  onImprimir: () => void;
  /** True quando outro exame deste mesmo tubo já oferece o botão de etiqueta. */
  etiquetaJaPrinted: boolean;
  /** Destaca visualmente quando contextual (ex.: vindo de protocolo com terceirizados). */
  highlight?: boolean;
}) {
  const accentBar: Record<ExameStatus, string> = {
    pendente:  "bg-[hsl(var(--status-warning))]",
    coletado:  "bg-[hsl(var(--status-success))]",
    cancelado: "bg-[hsl(var(--status-danger))]",
  };
  return (
    <div className={`relative flex items-stretch rounded-xl border bg-card overflow-hidden transition-all duration-150 ${
      selected
        ? "border-primary/40 ring-1 ring-primary/20 shadow-elevation-xs"
        : highlight
        ? "border-primary/50 ring-1 ring-primary/25 bg-primary/5"
        : "border-border/60 hover:border-border hover:shadow-elevation-xs"
    }`}>
      <span className={`w-1 shrink-0 ${accentBar[exame.status]}`} />
      <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="rounded border-input accent-primary shrink-0"
          disabled={exame.status === "coletado" || exame.status === "cancelado"}
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
            {exame.dataColeta && (
              <span className="flex items-center gap-1 shrink-0"><Clock className="h-3 w-3" />{exame.dataColeta}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {exame.status === "cancelado" ? (
            <button onClick={onReverter} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-border/60 bg-card text-foreground hover:bg-accent transition-colors">
              <RotateCcw className="h-3.5 w-3.5" /> Reverter
            </button>
          ) : exame.status === "coletado" ? (
            <>
              <span className="hidden sm:flex items-center gap-1 px-2 h-8 text-xs font-medium text-[hsl(var(--status-success))]">
                <CheckCircle2 className="h-3.5 w-3.5" /> Coletada
              </span>
              {!etiquetaJaPrinted && (
                <button
                  onClick={onImprimir}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-border/60 bg-card text-foreground hover:bg-accent transition-colors"
                  title="Imprimir etiqueta da amostra"
                >
                  <Printer className="h-3.5 w-3.5" /> Etiqueta
                </button>
              )}
              <button
                onClick={onRecoleta}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-warning/30 text-warning hover:bg-warning/10 transition-colors"
                title="Solicitar recoleta desta amostra"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Recoleta
              </button>
            </>
          ) : (
            <>
              <button onClick={onCancelar} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-[hsl(var(--status-danger))] hover:bg-[hsl(var(--status-danger-bg))] transition-colors" title="Cancelar">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button onClick={onColetar} className="h-8 px-4 rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-elevation-xs">
                Coletar
              </button>
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
      <div className="relative bg-card rounded-2xl border border-border/60 shadow-elevation-lg w-full max-w-md max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-y-auto p-6 animate-fade-in-up">
        {children}
      </div>
    </div>
  );
}

export default RegistrarColeta;
