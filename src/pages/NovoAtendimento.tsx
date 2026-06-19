import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  Search, X, CheckCircle2, Sparkles, Trash2, User, Stethoscope,
  FileText, CreditCard, Plus, UserPlus, Printer, Send,
  MessageCircle, AlertTriangle, Building2, ArrowLeft, Receipt, FlaskConical,
  TestTube2, Cake, Calendar, CalendarClock, ClipboardCheck, FileScan, Coffee, Clock, Zap, Flame, ChevronDown, Check, MapPin
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getUnidadeById, getUnidadesAtivas, subscribeUnidades } from "@/data/unidadeStore";
import ResultadoPopup from "@/components/ResultadoPopup";
import type { AddExameLeituraOptions } from "@/components/LeituraRequisicaoDialog";
import StandardDialog from "@/components/ui/standard-dialog";
import type { PagamentoRealizado, MockAtendimento } from "@/data/types";
import { getConvenios, getConveniosAtivosNomes, getTabelaByConvenioNome, subscribeConvenios } from "@/data/convenioStore";
import { getPacientes, type Paciente } from "@/data/pacienteStore";
import { getSolicitantesNomes, subscribeEspecialistas } from "@/data/especialistaStore";
import { subscribeTabelaPreco } from "@/data/tabelaPrecoStore";
import { addAtendimento, getAtendimentos, getNextProtocolo, updateAtendimento, fetchAtendimentosByPacienteCpf, fetchAtendimentoByProtocolo } from "@/data/atendimentoStore";
import { addOrcamento } from "@/data/orcamentoStore";
import { getPacienteByCPF } from "@/data/pacienteStore";
import { isValidCPF, looksLikeCPF, sanitizeCPF } from "@/lib/cpf";
import { gerarOrcamentoPDF, enviarOrcamentoPorWhatsapp, buildOrcamentoHtmlPublic, buildComprovanteHtml } from "@/lib/comprovantes";
import { printHtmlInHiddenFrame } from "@/lib/printHtml";
import PacienteTelefoneInline from "@/components/PacienteTelefoneInline";
import { isEdicaoClinicaBloqueada, mensagemBloqueioClinico } from "@/lib/atendimentoPolicy";
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
import { buscarAmostrasReutilizaveisPorNome, reutilizarAmostra, type Amostra } from "@/data/sorotecaStore";
import { getExamesCatalogo } from "@/data/exameCatalogoStore";
import { getLabsApoio } from "@/data/labApoioStore";
import { showError } from "@/lib/showError";
import LabBadge from "@/components/LabBadge";

// ── Code-splitting: dialogs/painéis pesados só baixam quando realmente abrem.
// Mantém a rota /novo-atendimento leve no carregamento inicial.
const PagamentoDialog = lazy(() => import("@/components/PagamentoDialog"));
const AvaliacaoIADialog = lazy(() => import("@/components/AvaliacaoIADialog"));
const LeituraRequisicaoDialog = lazy(() => import("@/components/LeituraRequisicaoDialog"));
const CadastroPacienteDialog = lazy(() => import("@/components/CadastroPacienteDialog"));
const PdfPreviewDialog = lazy(() => import("@/components/PdfPreviewDialog"));
const ReutilizarAmostraDialog = lazy(() => import("@/components/soroteca/ReutilizarAmostraDialog"));
const RoteamentoApoioPanel = lazy(() => import("@/components/RoteamentoApoioPanel"));
import FerramentasAvancadasMenu from "@/components/atendimento/FerramentasAvancadasMenu";

// Types, helpers puros, DropdownStatus e highlightMatch foram extraídos para
// ./NovoAtendimento/* (Sprint 1). Comportamento idêntico, apenas reorganização.
import type { CobrancaDestino, Exame, ExameTemplate } from "./NovoAtendimento/types";
import {
  computeAvailableConvenios,
  computeAvailableSolicitantes,
  buildAvailableExames,
  resolveCobrancaDefault,
} from "./NovoAtendimento/helpers";
import { calculateExamPrice } from "./NovoAtendimento/pricing";
import { buildExamesCobranca } from "./NovoAtendimento/buildExamesCobranca";
import { highlightMatch } from "./NovoAtendimento/highlightMatch";
import { DropdownStatus } from "./NovoAtendimento/DropdownStatus";
import { distribuirDescontoEntreExames } from "./NovoAtendimento/services/distribuirDesconto";
import { contarEtiquetas } from "./NovoAtendimento/services/contarEtiquetas";
import { resyncCobrancaConvenios } from "./NovoAtendimento/services/resyncCobrancaConvenios";

import { formatIdadeDetalhada, isAniversarioHoje } from "@/lib/idade";

import { fmtBRLNumber, fmtBRL, searchNormalize } from "@/lib/utils";
const steps = [
  { id: 1, label: "Paciente", icon: User },
  { id: 2, label: "Convênio", icon: Stethoscope },
  { id: 3, label: "Exames", icon: FlaskConical },
  { id: 4, label: "Resumo", icon: CreditCard },
];

/* ─── Helpers ─── */
/* ─── Component ─── */
const NovoAtendimento = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { protocolo: editProtocolo } = useParams<{ protocolo?: string }>();
  const { user } = useAuth();
  const unidadeAtiva = user?.unidadeAtiva ? getUnidadeById(user.unidadeAtiva) : undefined;
  const isEditing = Boolean(editProtocolo);

  const [activeStep, setActiveStep] = useState(1);
  const [exames, setExames] = useState<Exame[]>([]);
  // Catálogo de exames disponíveis derivado das tabelas de preço.
  // Reativo: re-renderiza quando o store carrega/atualiza (evita lista vazia
  // quando o boot da tabela de preços termina depois do mount).
  const [availableExames, setAvailableExames] = useState<ExameTemplate[]>(() => buildAvailableExames());
  useEffect(() => {
    setAvailableExames(buildAvailableExames());
    const unsub = subscribeTabelaPreco(() => setAvailableExames(buildAvailableExames()));
    return unsub;
  }, []);
  const [pagamentoOpen, setPagamentoOpen] = useState(false);
  const [avaliacaoIAOpen, setAvaliacaoIAOpen] = useState(false);
  const [leituraReqOpen, setLeituraReqOpen] = useState(false);
  const [cadastroPacienteOpen, setCadastroPacienteOpen] = useState(false);
  const [novaAmostraDialog, setNovaAmostraDialog] = useState<{
    open: boolean;
    template: ExameTemplate | null;
    fromIA: boolean;
  }>({ open: false, template: null, fromIA: false });

  // Soroteca: diálogo de reutilização de amostra existente
  const [reuseDialog, setReuseDialog] = useState<{
    open: boolean;
    amostras: Amostra[];
    template: ExameTemplate | null;
  }>({ open: false, amostras: [], template: null });

  // Patient
  const [pacienteQuery, setPacienteQuery] = useState("");
  const [pacienteDropdownOpen, setPacienteDropdownOpen] = useState(false);
  const [selectedPaciente, setSelectedPaciente] = useState<Paciente | null>(null);
  const pacienteRef = useRef<HTMLDivElement>(null);
  const pacienteAnchorRef = useRef<HTMLDivElement>(null);
  const [pacienteAnchorRect, setPacienteAnchorRect] = useState<DOMRect | null>(null);

  // Track anchor position for portal-rendered dropdown so it sits above any
  // overflow-hidden card and follows scroll/resize.
  useEffect(() => {
    if (!pacienteDropdownOpen) return;
    const update = () => {
      if (pacienteAnchorRef.current) {
        setPacienteAnchorRect(pacienteAnchorRef.current.getBoundingClientRect());
      }
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [pacienteDropdownOpen, pacienteQuery]);

  // Debt check — busca server-side por CPF (sem depender do cache global).
  const [pacienteHistorico, setPacienteHistorico] = useState<ReturnType<typeof getAtendimentos>>([]);
  useEffect(() => {
    let alive = true;
    if (!selectedPaciente?.cpf) { setPacienteHistorico([]); return; }
    void fetchAtendimentosByPacienteCpf(selectedPaciente.cpf, { limit: 50 }).then((list) => {
      if (alive) setPacienteHistorico(list);
    });
    return () => { alive = false; };
  }, [selectedPaciente?.cpf]);
  const pacienteDebitos = useMemo(() => {
    if (!selectedPaciente) return [];
    return pacienteHistorico
      .filter(a => a.statusPagamento.label.toLowerCase().includes("parcial"))
      .map(a => {
        const totalExames = a.exames.reduce((sum, nomeExame) => {
          const meta = a.examesCobranca?.find(c => c.nome === nomeExame);
          if (meta?.cobrancaDestino === "convenio") return sum; // exame faturado p/ convênio não entra no saldo do paciente
          // Fonte de verdade: valor persistido em examesCobranca. Nunca inventar preço.
          return sum + calculateExamPrice({
            nomeExame,
            convenioNome: a.convenio,
            metaValor: meta?.valor,
          });
        }, 0);
        const totalPago = (a.pagamentosRealizados ?? []).reduce((s, p) => s + p.valor, 0);
        return { protocolo: a.protocolo, saldo: Math.max(0, totalExames - totalPago) };
      })
      .filter(d => d.saldo > 0);
  }, [selectedPaciente, pacienteHistorico]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (pacienteRef.current && pacienteRef.current.contains(target)) return;
      // Allow clicks inside the portal-rendered dropdown
      if (target instanceof HTMLElement && target.closest("[data-paciente-portal]")) return;
      setPacienteDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Prefill vindo de uma solicitação pública convertida (location.state).
  // Pré-pré-atendimento web → atendimento operacional sem retrabalho:
  //  - paciente: identificado por CPF ou pré-preenchido para cadastro;
  //  - convênio default: Particular;
  //  - solicitante default: SEM SOLICITANTE (web não tem médico solicitante);
  //  - exames: best-effort (mantém os nomes da solicitação);
  //  - origem: WEB_APROVADO (badge visível em /atendimentos e detalhe).
  const prefillAppliedRef = useRef(false);
  const origemRef = useRef<MockAtendimento["origem"] | undefined>(undefined);
  useEffect(() => {
    if (prefillAppliedRef.current || isEditing) return;
    const st = location.state as
      | {
          from?: string;
          nome?: string;
          cpf?: string | null;
          telefone?: string;
          exames?: Array<{ nome?: string; exame_id?: string; valor?: number }>;
          origem?: MockAtendimento["origem"];
          payment_status?: string | null;
        }
      | null;
    if (!st || st.from !== "solicitacao") return;
    prefillAppliedRef.current = true;
    origemRef.current = st.origem ?? "WEB_APROVADO";

    // Defaults operacionais para pedidos da web.
    setConvenios((prev) => (prev.length === 0 ? ["Particular"] : prev));
    setSolicitantes((prev) => (prev.length === 0 ? ["SEM SOLICITANTE"] : prev));

    // Best-effort: pré-popula exames usando o catálogo (sem disparar dialogs).
    const examesIn = Array.isArray(st.exames) ? st.exames : [];
    if (examesIn.length > 0) {
      const catalogo = getExamesCatalogo();
      const templates: ExameTemplate[] = [];
      examesIn.forEach((ex, idx) => {
        const nome = (ex?.nome ?? "").trim();
        if (!nome) return;
        const cat = catalogo.find((c) => c.nome.toLowerCase() === nome.toLowerCase());
        templates.push({
          id: idx + 1,
          nome: cat?.nome ?? nome,
          convenio: "Particular",
          material: cat?.material ?? "Sangue",
          valor: typeof ex?.valor === "number" ? ex.valor : (cat ? resolvePreco(cat.nome, "Particular") : 0),
        });
      });
      if (templates.length > 0) {
        const cobr = resolveCobrancaDefault(["Particular"], "Particular");
        setExames(
          templates.map((t) => ({
            ...t,
            cobrancaDestino: cobr.cobrancaDestino,
            convenioCobrancaId: cobr.convenioCobrancaId,
            amostraSeq: 1,
            grupoExameId: typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `g-${Date.now()}-${t.id}`,
            tipoProcesso: "INTERNO",
            labApoioIdPadrao: null,
            labApoioIdOverride: null,
          })),
        );
      }
    }

    if (st.cpf && isValidCPF(st.cpf)) {
      const p = getPacienteByCPF(st.cpf);
      if (p) {
        setSelectedPaciente(p);
        setPacienteQuery(p.nome);
        toast({ title: "Paciente identificado", description: `Vinculado a ${p.nome}.` });
      } else if (st.nome) {
        setPacienteQuery(st.nome);
        setPacienteDropdownOpen(true);
      }
    } else if (st.nome) {
      setPacienteQuery(st.nome);
      setPacienteDropdownOpen(true);
    }
  }, [location.state, isEditing]);

  // Convênios
  const [convenios, setConvenios] = useState<string[]>(() => isEditing ? [] : ["Particular"]);
  const [convenioQuery, setConvenioQuery] = useState("");
  const [convenioDropdownOpen, setConvenioDropdownOpen] = useState(false);
  const [convenioHighlight, setConvenioHighlight] = useState(0);
  const [convenioLoading, setConvenioLoading] = useState(false);
  const [convenioError, setConvenioError] = useState<string | null>(null);
  const [lastSelectedConvenio, setLastSelectedConvenio] = useState<string | null>(null);

  // Solicitantes
  const [solicitantes, setSolicitantes] = useState<string[]>([]);
  const [solicitanteQuery, setSolicitanteQuery] = useState("");
  const [solicitanteDropdownOpen, setSolicitanteDropdownOpen] = useState(false);
  const [solicitanteHighlight, setSolicitanteHighlight] = useState(0);
  const [solicitanteLoading, setSolicitanteLoading] = useState(false);
  const [solicitanteError, setSolicitanteError] = useState<string | null>(null);
  const [lastSelectedSolicitante, setLastSelectedSolicitante] = useState<string | null>(null);

  // Snapshots reativos dos cadastros (re-renderiza quando os stores hidratam).
  const [availableConvenios, setAvailableConvenios] = useState<string[]>(() => computeAvailableConvenios());
  const [availableSolicitantes, setAvailableSolicitantes] = useState<string[]>(() => computeAvailableSolicitantes());
  useEffect(() => {
    const refreshConv = () => setAvailableConvenios(computeAvailableConvenios());
    const refreshSol = () => setAvailableSolicitantes(computeAvailableSolicitantes());
    refreshConv();
    refreshSol();
    const unsubConv = subscribeConvenios(refreshConv);
    const unsubSol = subscribeEspecialistas(refreshSol);
    return () => { unsubConv(); unsubSol(); };
  }, []);

  // Exames search
  const [exameQuery, setExameQuery] = useState("");
  const [exameDropdownOpen, setExameDropdownOpen] = useState(false);
  const [selectedConvenioFilter, setSelectedConvenioFilter] = useState<string | null>(null);
  const [exameLoading, setExameLoading] = useState(false);
  const [exameError, setExameError] = useState<string | null>(null);
  const [lastSelectedExameKey, setLastSelectedExameKey] = useState<string | null>(null);

  // Refs para fechar dropdowns ao clicar fora
  const convenioWrapperRef = useRef<HTMLDivElement>(null);
  const solicitanteWrapperRef = useRef<HTMLDivElement>(null);
  const convenioInputRef = useRef<HTMLInputElement>(null);
  const solicitanteInputRef = useRef<HTMLInputElement>(null);
  const unidadeWrapperRef = useRef<HTMLDivElement>(null);
  const [unidadeDropdownOpen, setUnidadeDropdownOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (convenioDropdownOpen && convenioWrapperRef.current && !convenioWrapperRef.current.contains(target)) {
        setConvenioDropdownOpen(false);
      }
      if (solicitanteDropdownOpen && solicitanteWrapperRef.current && !solicitanteWrapperRef.current.contains(target)) {
        setSolicitanteDropdownOpen(false);
      }
      if (unidadeDropdownOpen && unidadeWrapperRef.current && !unidadeWrapperRef.current.contains(target)) {
        setUnidadeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [convenioDropdownOpen, solicitanteDropdownOpen, unidadeDropdownOpen]);

  useEffect(() => {
    if (!convenioDropdownOpen) return;
    const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const q = searchNormalize(convenioQuery);
    const jaSelecionados = new Set(convenios.map(norm));
    const filtered = availableConvenios.filter(
      c => !jaSelecionados.has(norm(c)) && (!q || norm(c).includes(q)),
    );
    if (lastSelectedConvenio) {
      const idx = filtered.findIndex(c => norm(c) === norm(lastSelectedConvenio));
      setConvenioHighlight(idx >= 0 ? idx : 0);
    } else {
      setConvenioHighlight(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convenioQuery, convenioDropdownOpen]);

  useEffect(() => {
    if (!solicitanteDropdownOpen) return;
    const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const q = searchNormalize(solicitanteQuery);
    const jaSelecionados = new Set(solicitantes.map(norm));
    const filtered = availableSolicitantes.filter(
      s => !jaSelecionados.has(norm(s)) && (!q || norm(s).includes(q)),
    );
    if (lastSelectedSolicitante) {
      const idx = filtered.findIndex(s => norm(s) === norm(lastSelectedSolicitante));
      setSolicitanteHighlight(idx >= 0 ? idx : 0);
    } else {
      setSolicitanteHighlight(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitanteQuery, solicitanteDropdownOpen]);

  // Financial
  const [valorPago, setValorPago] = useState(0);
  const [desconto, setDesconto] = useState(0);

  // UX: ajustes avançados por exame (Solicitante por exame + Cobrança híbrida).
  // Colapsados por padrão para reduzir carga cognitiva da lista de exames.
  // Não altera estado dos campos — apenas a visibilidade dos controles.
  const [mostrarAjustesPorExame, setMostrarAjustesPorExame] = useState(false);

  // Clinical info
  const [observacoes, setObservacoes] = useState("");
  const [jejum, setJejum] = useState<"sim" | "nao">("nao");
  const [entregaWhatsapp, setEntregaWhatsapp] = useState<"sim" | "nao">("nao");
  const [prioridade, setPrioridade] = useState<"normal" | "urgencia" | "emergencia">("normal");

  // Unidade + data do atendimento (Horário de Brasília)
  const [unidadesList, setUnidadesList] = useState(() => getUnidadesAtivas());
  useEffect(() => {
    setUnidadesList(getUnidadesAtivas());
    return subscribeUnidades(() => setUnidadesList(getUnidadesAtivas()));
  }, []);
  const nowBrasiliaInputValue = () => {
    // YYYY-MM-DDTHH:mm no fuso America/Sao_Paulo (para <input type="datetime-local">)
    const parts = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Sao_Paulo",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date());
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? "00";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
  };
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string>(
    () => {
      const unidades = getUnidadesAtivas();
      const sede = unidades.find(u => u.tipo === "SEDE");
      return sede?.id ?? user?.unidadeAtiva ?? unidades.find(u => u.padrao)?.id ?? unidades[0]?.id ?? "";
    }
  );
  const [dataAtendimento, setDataAtendimento] = useState<string>(() => nowBrasiliaInputValue());
  const [lastGuiaNumero, setLastGuiaNumero] = useState<string | null>(null);

  // Data/hora prevista de entrega = +2 dias úteis (Brasília), editável.
  // Data da coleta = hoje (Brasília), editável; só aparece quando há exames.
  const addBusinessDays = (input: string, days: number): string => {
    const [d] = input.split("T");
    if (!d) return input;
    const [y, m, dd] = d.split("-").map(Number);
    const dt = new Date(Date.UTC(y, (m ?? 1) - 1, dd ?? 1));
    let added = 0;
    while (added < days) {
      dt.setUTCDate(dt.getUTCDate() + 1);
      const dow = dt.getUTCDay();
      if (dow !== 0 && dow !== 6) added++;
    }
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const day = String(dt.getUTCDate()).padStart(2, "0");
    // Hora padrão de entrega = 17:00 (Brasília), independente do horário do atendimento.
    return `${yyyy}-${mm}-${day}T17:00`;
  };
  const todayBrasiliaDate = () => nowBrasiliaInputValue().split("T")[0];
  const [dataEntrega, setDataEntrega] = useState<string>(() => addBusinessDays(nowBrasiliaInputValue(), 2));
  const [dataEntregaTouched, setDataEntregaTouched] = useState(false);
  const [dataColeta, setDataColeta] = useState<string>(() => todayBrasiliaDate());
  const [dataColetaTouched, setDataColetaTouched] = useState(false);

  // Quando a data do atendimento muda e o usuário não tocou na entrega, recalcula +2 úteis.
  useEffect(() => {
    if (!dataEntregaTouched) setDataEntrega(addBusinessDays(dataAtendimento, 2));
    if (!dataColetaTouched) setDataColeta(dataAtendimento.split("T")[0] || todayBrasiliaDate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataAtendimento]);




  const [successOpen, setSuccessOpen] = useState(false);
  const [lastProtocolo, setLastProtocolo] = useState<string | null>(null);
  const [lastHadTerceirizados, setLastHadTerceirizados] = useState(false);
  const [lastEtiquetasTotal, setLastEtiquetasTotal] = useState(0);
  const [lastEtiquetasTerc, setLastEtiquetasTerc] = useState(0);
  const [orcamentoSuccessOpen, setOrcamentoSuccessOpen] = useState(false);
  const [orcamentoPreviewOpen, setOrcamentoPreviewOpen] = useState(false);
  const [orcamentoConfirmOpen, setOrcamentoConfirmOpen] = useState(false);
  const [orcamentoId, setOrcamentoId] = useState("");
  const [pagamentosRealizados, setPagamentosRealizados] = useState<PagamentoRealizado[]>([]);
  const [comprovanteTipo, setComprovanteTipo] = useState<"pagamento" | "atendimento" | "comparecimento" | null>(null);

  // Edit mode
  const [showPacienteSearch, setShowPacienteSearch] = useState(!isEditing);
  const [originalPaciente, setOriginalPaciente] = useState("");
  const [originalConvenios, setOriginalConvenios] = useState<string[]>([]);
  const [originalSolicitantes, setOriginalSolicitantes] = useState<string[]>([]);
  const [originalExameNames, setOriginalExameNames] = useState<string[]>([]);
  const [editAtendimentoData, setEditAtendimentoData] = useState<{ cpf: string; nascimento: string; idade: string } | null>(null);

  useEffect(() => {
    if (!editProtocolo) return;
    const decoded = decodeURIComponent(editProtocolo);
    let atendimento = getAtendimentos().find(a => a.protocolo === decoded);
    if (!atendimento) {
      // Fallback server-side quando o atendimento não está no cache (modo paginado).
      // `editAtendimentoData` NÃO é gatilho de render: é o dado real (cpf/nascimento/idade)
      // consumido em `updateAtendimento(...)` mais abaixo quando o paciente não está
      // resolvido via `getPacientes()`. Hidratação do restante (convenios/exames/etc)
      // exigiria refetch + re-execução; este fallback é intencionalmente mínimo.
      void fetchAtendimentoByProtocolo(decoded).then((a) => {
        if (a) {
          setEditAtendimentoData({ cpf: a.cpf, nascimento: a.nascimento, idade: a.idade });
        }
      });
      return;
    }
    // Política de edição: bloqueia carregamento se atendimento finalizado/cancelado
    if (isEdicaoClinicaBloqueada(atendimento.statusAtendimento)) {
      toast({
        title: "Edição bloqueada",
        description: mensagemBloqueioClinico(atendimento.statusAtendimento),
        variant: "destructive",
      });
      navigate("/atendimentos", { replace: true });
      return;
    }
    setPacienteQuery(atendimento.nome);
    setOriginalPaciente(atendimento.nome);
    const convs = atendimento.convenio ? [atendimento.convenio] : [];
    const sols = atendimento.solicitante ? [atendimento.solicitante] : [];
    setConvenios(convs);
    setOriginalConvenios(convs);
    setSolicitantes(sols);
    setOriginalSolicitantes(sols);
    setEditAtendimentoData({ cpf: atendimento.cpf, nascimento: atendimento.nascimento, idade: atendimento.idade });
    setShowPacienteSearch(false);
    setPagamentosRealizados(atendimento.pagamentosRealizados ?? []);
    // Considera apenas exames cobrados do paciente (Fase 2: faturamento híbrido).
    const totalFromExames = atendimento.exames.reduce((sum, nomeExame) => {
      const meta = atendimento.examesCobranca?.find(c => c.nome === nomeExame);
      if (meta?.cobrancaDestino === "convenio") return sum;
      // Fonte de verdade: valor persistido em examesCobranca. Nunca inventar preço.
      return sum + calculateExamPrice({
        nomeExame,
        convenioNome: atendimento.convenio,
        metaValor: meta?.valor,
      });
    }, 0);
    const totalPagamentosRealizados = (atendimento.pagamentosRealizados ?? []).reduce((sum, p) => sum + p.valor, 0);
    if (totalPagamentosRealizados > 0) setValorPago(Math.round(totalPagamentosRealizados * 100) / 100);
    else if (atendimento.statusPagamento.label === "Pagamento efetuado") setValorPago(totalFromExames);
    else if (atendimento.statusPagamento.label === "Pagamento parcial") setValorPago(Math.round(totalFromExames * 0.5 * 100) / 100);
    else setValorPago(0);
    const mappedExames: Exame[] = atendimento.exames.map((nomeExame, i) => {
      const meta = atendimento.examesCobranca?.find(c => c.nome === nomeExame);
      const cobr = meta
        ? { cobrancaDestino: meta.cobrancaDestino, convenioCobrancaId: meta.convenioCobrancaId ?? null }
        : resolveCobrancaDefault(atendimento.convenio ? [atendimento.convenio] : []);
      const cat = getExamesCatalogo().find(c => c.nome.toLowerCase() === nomeExame.toLowerCase());
      const tipoProcesso = ((meta?.tipoProcesso as string) || cat?.tipoProcesso || "INTERNO") as "INTERNO" | "TERCEIRIZADO";
      const labApoioIdPadrao = cat?.labApoioId ?? null;
      // Se o meta gravado difere do padrão do catálogo, é um override.
      const labGravado = meta?.labApoioId ?? null;
      const labApoioIdOverride = (tipoProcesso === "TERCEIRIZADO" && labGravado && labGravado !== labApoioIdPadrao)
        ? labGravado
        : null;
      return {
        id: i + 1,
        nome: nomeExame,
        convenio: atendimento.convenio,
        material: meta?.material ?? cat?.material ?? "Sangue",
        // Preço exibido = valor persistido (fonte de verdade). Fallback: catálogo. Nunca chute.
        valor: calculateExamPrice({
          nomeExame,
          convenioNome: atendimento.convenio,
          metaValor: meta?.valor,
        }),
        // valorOriginal = preço cheio antes do desconto distribuído.
        // Fallback explícito para meta.valor (sem desconto histórico).
        valorOriginal: meta?.valorOriginal ?? meta?.valor,
        cobrancaDestino: cobr.cobrancaDestino,
        convenioCobrancaId: cobr.convenioCobrancaId,
        tipoProcesso,
        labApoioIdPadrao,
        labApoioIdOverride,
        // Hidratação: se não houver solicitante salvo e o atendimento tem >1 solicitante,
        // marca como "__ambos" (consistente com o comportamento anterior em que vazio = ambos).
        solicitanteExame: meta?.solicitante && meta.solicitante.trim() ? meta.solicitante : "__ambos",
      };
    });
    setExames(mappedExames);
    setOriginalExameNames(atendimento.exames);
  }, [editProtocolo]);

  const pacienteChanged = isEditing && pacienteQuery !== originalPaciente;
  const conveniosChanged = isEditing && JSON.stringify(convenios) !== JSON.stringify(originalConvenios);
  const solicitantesChanged = isEditing && JSON.stringify(solicitantes) !== JSON.stringify(originalSolicitantes);
  const examesChanged = isEditing && JSON.stringify(exames.map(e => e.nome).sort()) !== JSON.stringify([...originalExameNames].sort());
  const hasChangesStep1 = pacienteChanged;
  const hasChangesStep2 = conveniosChanged || solicitantesChanged;
  const hasChangesStep3 = examesChanged;

  const finalizarAtendimento = async (pagamentoEfetuado: boolean) => {
    // Converte o input datetime-local (interpretado como horário de Brasília)
    // para o formato BR usado pelo store ("dd/MM/yyyy HH:mm:ss").
    const buildDataStr = (): string => {
      const raw = dataAtendimento || nowBrasiliaInputValue();
      const [d, t] = raw.split("T");
      if (!d || !t) {
        const today = new Date();
        return `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()} ${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}:${String(today.getSeconds()).padStart(2, "0")}`;
      }
      const [yyyy, mm, dd] = d.split("-");
      const [hh, mi] = t.split(":");
      return `${dd}/${mm}/${yyyy} ${hh}:${mi}:00`;
    };
    const dataStr = buildDataStr();
    let novoProtocolo: string | null = null;
    // Desconto proporcional entre exames do paciente — pipeline puro extraído
    // para ./NovoAtendimento/services/distribuirDesconto.ts (Fase 2).
    const examesParaSalvar = distribuirDescontoEntreExames(exames, desconto);
    try {
      if (isEditing && editProtocolo) {
      const decoded = decodeURIComponent(editProtocolo);
      const paciente = getPacientes().find(p => p.nome === pacienteQuery);
      const statusPag = pagamentoEfetuado
        ? { label: "Pagamento efetuado", type: "success" as const }
        : valorPago > 0
          ? { label: "Pagamento parcial", type: "info" as const }
          : { label: "Pagamento pendente", type: "warning" as const };
      await updateAtendimento(decoded, {
        nome: pacienteQuery || "Paciente",
        cpf: paciente?.cpf || editAtendimentoData?.cpf || "",
        nascimento: paciente?.dataNascimento || editAtendimentoData?.nascimento || "",
        idade: paciente?.idade || editAtendimentoData?.idade || "",
        solicitante: solicitantes[0] || "",
        convenio: convenios[0] || "Particular",
        exames: examesParaSalvar.map(e => e.nome),
        examesCobranca: buildExamesCobranca(examesParaSalvar, solicitantes),
        statusPagamento: statusPag,
        pagamentosRealizados,
        unidadeId: selectedUnidadeId || user?.unidadeAtiva,
      });
      } else {
      const protocolo = getNextProtocolo();
      novoProtocolo = protocolo;
      const paciente = getPacientes().find(p => p.nome === pacienteQuery);
      const statusPag = pagamentoEfetuado
        ? { label: "Pagamento efetuado", type: "success" as const }
        : valorPago > 0
          ? { label: "Pagamento parcial", type: "info" as const }
          : { label: "Pagamento pendente", type: "warning" as const };
      const novoAt: MockAtendimento = {
        protocolo, data: dataStr,
        nome: pacienteQuery || "Paciente",
        cpf: paciente?.cpf || "",
        nascimento: paciente?.dataNascimento || "",
        idade: paciente?.idade || "",
        statusAtendimento: { label: "Pedido Realizado", type: "neutral" },
        statusPagamento: statusPag,
        solicitante: solicitantes[0] || "",
        convenio: convenios[0] || "Particular",
        exames: examesParaSalvar.map(e => e.nome),
        examesCobranca: buildExamesCobranca(examesParaSalvar, solicitantes),
        unidadeId: selectedUnidadeId || user?.unidadeAtiva,
        pagamentosRealizados: pagamentosRealizados.length > 0 ? pagamentosRealizados : undefined,
        origem: origemRef.current ?? "INTERNO",
      };
      await addAtendimento(novoAt);
      setLastGuiaNumero(novoAt.guiaNumero ?? null);
      }
      const { total: etiquetasTotal, terceirizados: etiquetasTerc, temTerceirizados } =
        contarEtiquetas(exames, getExamesCatalogo());
      const protocoloFinal = isEditing && editProtocolo
        ? decodeURIComponent(editProtocolo)
        : novoProtocolo;
      setLastProtocolo(protocoloFinal);
      setLastHadTerceirizados(temTerceirizados);
      setLastEtiquetasTotal(etiquetasTotal);
      setLastEtiquetasTerc(etiquetasTerc);
      setSuccessOpen(true);
    } catch (e) {
      showError(e, { scope: "NovoAtendimento.finalizar", userMessage: "Não foi possível salvar o atendimento. Tente novamente." });
    }
  };

  // Totais financeiros do paciente — exames com cobrancaDestino='convenio' são cobrados via fatura
  // do convênio (módulo Financeiro › A Receber › Convênios), portanto NÃO entram no que o paciente paga.
  const subtotal = exames.reduce((sum, e) => e.cobrancaDestino === "convenio" ? sum : sum + e.valor, 0);
  const subtotalConvenio = exames.reduce((sum, e) => e.cobrancaDestino === "convenio" ? sum + e.valor : sum, 0);
  // Subtotal calculado pelo valor cheio (valorOriginal) — usado apenas para exibição.
  const subtotalOriginal = exames.reduce((sum, e) => {
    if (e.cobrancaDestino === "convenio") return sum;
    return sum + (e.valorOriginal ?? e.valor);
  }, 0);
  // Desconto embutido nos exames (distribuído ao salvar). Não altera lógica de save.
  const descontoHistorico = Math.max(0, Math.round((subtotalOriginal - subtotal) * 100) / 100);
  // Desconto exibido no resumo = histórico (já embutido no valor) + manual (state).
  const descontoExibido = Math.round((descontoHistorico + desconto) * 100) / 100;
  const total = subtotal - desconto;
  const saldoDevedor = Math.max(0, total - valorPago);

  // Fase 2 — re-sincroniza cobrança ao mudar a lista de convênios.
  // Se um exame estava cobrado de um convênio que foi removido, volta para Paciente.
  // Se nenhum exame havia sido editado manualmente e o usuário acaba de adicionar
  // o primeiro convênio não-Particular, aplica o default em todos.
  useEffect(() => {
    setExames(prev => {
      const naoParticularesIds = new Set(
        convenios.filter(n => n !== "Particular")
          .map(n => getConvenios().find(c => c.nome === n)?.id)
          .filter((id): id is number => typeof id === "number"),
      );
      return resyncCobrancaConvenios(prev, naoParticularesIds);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convenios.join("|")]);

  const resolvePreco = (nomeExame: string, convenioNome: string): number =>
    // Nunca inventar preço. Sem cadastro → 0 (UI mostra "sem preço") em vez de chute silencioso.
    calculateExamPrice({ nomeExame, convenioNome });

  const handleAddExameIA = (
    nome: string,
    opts?: { justificativa?: string; confianca?: "alta" | "media" | "baixa"; observacao?: string },
  ) => {
    const convenio = selectedConvenioFilter || (convenios.length > 0 ? convenios[0] : "Particular");
    const valor = resolvePreco(nome, convenio);
    const template: ExameTemplate = {
      id: 0,
      nome,
      convenio,
      material: "Sangue",
      valor,
      addedByIA: true,
      justificativaIA: opts?.justificativa,
      confiancaIA: opts?.confianca,
      observacaoIA: opts?.observacao,
    };
    const jaExiste = exames.some(e => e.nome.toLowerCase() === nome.toLowerCase());
    if (jaExiste) {
      setNovaAmostraDialog({ open: true, template, fromIA: true });
      return;
    }
    inserirExameComoAmostra(template, true);
  };

  const removeExame = (id: number) => setExames(prev => prev.filter(e => e.id !== id));

  /**
   * Insere o exame no estado. Se já existir um exame com o mesmo nome, calcula
   * a próxima sequência de amostra e reusa o grupoExameId.
   * `cobrar`: quando false, força valor 0 (recoleta gratuita).
   */
  const inserirExameComoAmostra = (template: ExameTemplate, cobrar: boolean) => {
    const newId = Math.max(0, ...exames.map(e => e.id)) + 1;
    // Prefere o convênio explícito do template (vindo da seleção na busca);
    // se for um nome de tabela ou não estiver definido, cai no filtro/lista de convênios selecionados.
    const isConvenioValido = convenios.includes(template.convenio);
    const convenio = isConvenioValido
      ? template.convenio
      : (selectedConvenioFilter || (convenios.length > 0 ? convenios[0] : template.convenio));
    const valor = cobrar ? resolvePreco(template.nome, convenio) : 0;
    const cobr = resolveCobrancaDefault(convenios, convenio);
    const existentes = exames.filter(e => e.nome.toLowerCase() === template.nome.toLowerCase());
    const amostraSeq = existentes.length > 0
      ? Math.max(...existentes.map(e => e.amostraSeq ?? 1)) + 1
      : 1;
    const grupoExameId = existentes[0]?.grupoExameId ?? (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `g-${Date.now()}-${newId}`);
    // Fase 3 — enriquecimento com tipo de processo / lab apoio do catálogo (snapshot)
    const cat = getExamesCatalogo().find(c => c.nome.toLowerCase() === template.nome.toLowerCase());
    const tipoProcesso = (cat?.tipoProcesso as "INTERNO" | "TERCEIRIZADO" | undefined) ?? "INTERNO";
    const labApoioIdPadrao = cat?.labApoioId ?? null;
    // Quando há repetição do exame, herda override do irmão para coerência.
    const labApoioIdOverride = existentes[0]?.labApoioIdOverride ?? null;
    setExames(prev => [...prev, {
      ...template, id: newId, convenio, valor,
      cobrancaDestino: cobr.cobrancaDestino, convenioCobrancaId: cobr.convenioCobrancaId,
      amostraSeq, grupoExameId,
      tipoProcesso, labApoioIdPadrao, labApoioIdOverride,
    }]);
    setExameQuery("");
    setExameDropdownOpen(false);
  };

  const addExame = (exame: ExameTemplate, convenioNomeOverride?: string) => {
    const exameComConvenio: ExameTemplate = convenioNomeOverride
      ? { ...exame, convenio: convenioNomeOverride }
      : exame;
    const jaExiste = exames.some(e => e.nome.toLowerCase() === exameComConvenio.nome.toLowerCase());
    if (jaExiste) {
      setNovaAmostraDialog({ open: true, template: exameComConvenio, fromIA: false });
      return;
    }
    // Soroteca: tenta reutilizar amostra existente (não bloqueia o fluxo)
    const pacienteId = (selectedPaciente as { id?: number } | null)?.id;
    if (pacienteId) {
      buscarAmostrasReutilizaveisPorNome({ pacienteId, nomeExame: exameComConvenio.nome })
        .then(amostras => {
          if (amostras.length > 0) {
            setReuseDialog({ open: true, amostras, template: exameComConvenio });
          } else {
            inserirExameComoAmostra(exameComConvenio, true);
          }
        })
        .catch(() => inserirExameComoAmostra(exameComConvenio, true));
      return;
    }
    inserirExameComoAmostra(exameComConvenio, true);
  };

  const filteredExames = exames.filter(e => !selectedConvenioFilter || e.convenio === selectedConvenioFilter);




  // Status derivado de cada seção (preenchimento), para o stepper sticky.
  const stepDone: Record<1 | 2 | 3 | 4, boolean> = {
    1: Boolean(selectedPaciente || (!showPacienteSearch && pacienteQuery)),
    2: convenios.length > 0 && solicitantes.length > 0,
    3: exames.length > 0,
    4: false,
  };
  stepDone[4] = stepDone[1] && stepDone[2] && stepDone[3];

  const scrollToStep = (id: number) => {
    const map: Record<number, string> = {
      1: "step-paciente", 2: "step-convenio", 3: "step-exames", 4: "step-resumo",
    };
    const el = document.getElementById(map[id]);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveStep(id);
  };

  // Validação completa antes de finalizar (mesmas regras de negócio do antigo wizard).
  const finalizarComValidacao = () => {
    if (!selectedPaciente && !(!showPacienteSearch && pacienteQuery)) {
      toast({ title: "Paciente obrigatório", description: "Selecione um paciente antes de finalizar.", variant: "destructive" });
      scrollToStep(1); return;
    }
    if (convenios.length === 0) {
      toast({ title: "Convênio obrigatório", description: "Selecione ao menos um convênio.", variant: "destructive" });
      scrollToStep(2); return;
    }
    if (solicitantes.length === 0) {
      toast({ title: "Solicitante obrigatório", description: "Selecione ao menos um solicitante.", variant: "destructive" });
      scrollToStep(2); return;
    }
    if (exames.length === 0) {
      toast({ title: "Exames obrigatórios", description: "Adicione ao menos um exame.", variant: "destructive" });
      scrollToStep(3); return;
    }
    if (solicitantes.length > 1) {
      const semSolicitante = exames.filter(e => !e.solicitanteExame || !e.solicitanteExame.trim());
      if (semSolicitante.length > 0) {
        toast({
          title: "Defina o solicitante de cada exame",
          description: `${semSolicitante.length} exame(s) sem solicitante. Como há mais de um solicitante, informe quem pediu cada exame (ou marque "Ambos").`,
          variant: "destructive",
        });
        scrollToStep(3); return;
      }
    }
    finalizarAtendimento(false);
  };

  const buildOrcPayload = () => {
    const today = new Date();
    const dataStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()} ${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}:${String(today.getSeconds()).padStart(2, "0")}`;
    const telefoneFromPaciente = selectedPaciente
      ? (getPacienteByCPF((selectedPaciente.cpf || "").replace(/\D/g, ""))?.celular
          || getPacienteByCPF((selectedPaciente.cpf || "").replace(/\D/g, ""))?.telefone
          || "")
      : "";
    return {
      data: dataStr,
      nome: selectedPaciente?.nome || pacienteQuery || "Paciente",
      cpf: selectedPaciente?.cpf || "",
      telefone: telefoneFromPaciente,
      convenio: convenios[0] || "Particular",
      solicitante: solicitantes[0] || "",
      exames: exames.map(e => e.nome),
      subtotal, desconto, total,
    };
  };

  const criarOrcamento = () => {
    const payload = buildOrcPayload();
    addOrcamento(payload).then((id) => {
      setOrcamentoId(id);
      setOrcamentoSuccessOpen(true);
      const orcData = {
        id,
        data: new Date().toLocaleDateString("pt-BR"),
        paciente: payload.nome,
        convenio: payload.convenio,
        solicitante: payload.solicitante || undefined,
        exames: payload.exames,
        subtotal, desconto, total,
      };
      setTimeout(() => {
        printHtmlInHiddenFrame({
          html: buildOrcamentoHtmlPublic(orcData),
          documentTitle: `orcamento-${id}`,
        });
      }, 200);
    }).catch((err) => {
      showError(err, { scope: "NovoAtendimento.criarOrcamento" });
    });
  };

  /* ─── Render ─── */
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 lg:py-10">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/atendimentos")}
              className="h-10 w-10 rounded-2xl border border-border/60 bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                {isEditing ? "Editar Atendimento" : "Novo Atendimento"}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-sm text-muted-foreground">
                  {isEditing ? "Altere as informações do atendimento" : "Preencha os dados para registrar"}
                </p>
                {unidadeAtiva && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/8 text-primary text-[11px] font-semibold">
                    <Building2 className="h-3 w-3" />
                    {unidadeAtiva.nome}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <FerramentasAvancadasMenu
              onAbrirOCR={() => setLeituraReqOpen(true)}
              onAbrirIA={() => setAvaliacaoIAOpen(true)}
            />
          </div>
        </div>

        {/* ── Single-form: todas as seções em um único card ── */}
        <div className="bg-card border border-border/60 rounded-2xl p-4 sm:p-6 lg:p-8 space-y-8 pb-28 overflow-hidden">

            {/* ════ Cabeçalho operacional: Unidade + Data ════ */}
            <section className="-mx-6 sm:-mx-8 -mt-6 sm:-mt-8 px-6 sm:px-8 py-4 bg-muted/30 border-b border-border/60 rounded-t-2xl">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-6">
                {/* Unidade */}
                <div className="flex-1 min-w-0" ref={unidadeWrapperRef}>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setUnidadeDropdownOpen(o => !o)}
                      aria-haspopup="listbox"
                      aria-expanded={unidadeDropdownOpen}
                      className={`group w-full flex items-center gap-3 rounded-xl border bg-background/80 px-3 py-2.5 text-left transition-all hover:border-primary/40 hover:bg-background ${
                        unidadeDropdownOpen
                          ? "border-primary/40 ring-2 ring-primary/20"
                          : "border-border/60"
                      }`}
                    >
                      <Building2 className="h-4 w-4 text-primary/70 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none">
                          Unidade
                        </span>
                        <span className="block w-full text-sm font-semibold text-foreground truncate mt-1">
                          {unidadesList.find(u => u.id === selectedUnidadeId)?.nome || "Nenhuma unidade cadastrada"}
                        </span>
                      </div>
                      <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${unidadeDropdownOpen ? "rotate-180 text-primary" : ""}`} />
                    </button>

                    {unidadeDropdownOpen && unidadesList.length > 0 && (
                      <ul
                        role="listbox"
                        aria-label="Selecionar unidade"
                        className="absolute top-full left-0 right-0 mt-2 bg-card border border-border/60 rounded-2xl shadow-[0_16px_48px_-12px_hsl(var(--foreground)/0.18)] z-50 max-h-64 overflow-y-auto py-1.5 origin-top animate-scale-in"
                      >
                        {unidadesList.map((u) => {
                          const isSelected = u.id === selectedUnidadeId;
                          return (
                            <li key={u.id}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => {
                                  setSelectedUnidadeId(u.id);
                                  setUnidadeDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center gap-2.5 transition-colors outline-none ${
                                  isSelected
                                    ? "bg-primary/8 text-foreground"
                                    : "text-foreground hover:bg-accent/60"
                                }`}
                              >
                                <Building2 className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                                <span className="flex-1 truncate font-medium">{u.nome}</span>
                                {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Data */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40">
                    <CalendarClock className="h-4 w-4 text-primary/70 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none">
                        Data do atendimento <span className="normal-case font-normal tracking-normal">(Brasília)</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={dataAtendimento}
                        onChange={(e) => setDataAtendimento(e.target.value)}
                        className="w-full bg-transparent text-sm font-semibold text-foreground focus:outline-none py-0.5"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>


            {/* ════ STEP 1: Paciente ════ */}
            <section id="step-paciente" className="scroll-mt-28 space-y-4">

                <div>
                  <h2 className="text-lg font-bold text-foreground tracking-tight">
                    {isEditing ? "Paciente vinculado" : "Selecionar paciente"}
                  </h2>
                </div>

                {/* Edit mode patient card */}
                {isEditing && !showPacienteSearch && pacienteQuery && (() => {
                  const nascimento = editAtendimentoData?.nascimento || "";
                  const idadeDetalhada = nascimento ? (formatIdadeDetalhada(nascimento) || editAtendimentoData?.idade || "") : (editAtendimentoData?.idade || "");
                  const aniversario = nascimento ? isAniversarioHoje(nascimento) : false;
                  const initials = pacienteQuery.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <div className="max-w-3xl space-y-4">
                      <div className="bg-gradient-to-br from-primary/5 to-transparent border border-primary/15 rounded-2xl p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 min-w-0 flex-1">
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-base font-bold text-foreground truncate">{pacienteQuery}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                CPF:{" "}
                                {editAtendimentoData?.cpf
                                  ? editAtendimentoData.cpf
                                  : <span className="italic">não cadastrado</span>}
                              </p>
                              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                                {nascimento && (
                                  <div className="flex items-center gap-2 text-xs whitespace-nowrap">
                                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="text-muted-foreground">Nascimento:</span>
                                    <span className="font-semibold text-foreground">{nascimento}</span>
                                  </div>
                                )}
                                {idadeDetalhada && (
                                  <div className="flex items-center gap-2 text-xs whitespace-nowrap">
                                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="text-muted-foreground">Idade:</span>
                                    <span className="font-semibold text-foreground">{idadeDetalhada}</span>
                                  </div>
                                )}
                                {editAtendimentoData?.cpf && (
                                  <div className="text-xs">
                                    <PacienteTelefoneInline cpf={editAtendimentoData.cpf} />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => { setShowPacienteSearch(true); setPacienteQuery(""); }}
                            className="h-9 w-9 rounded-xl border border-border/60 flex items-center justify-center hover:bg-destructive/10 hover:border-destructive/30 transition-colors shrink-0"
                          >
                            <X className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </div>
                      </div>

                      {aniversario && (
                        <div className="border border-[hsl(var(--status-purple))]/30 rounded-2xl p-4 bg-[hsl(var(--status-purple-bg))]">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-[hsl(var(--status-purple))]/15 shrink-0">
                              <Cake className="h-4 w-4 text-[hsl(var(--status-purple))]" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[hsl(var(--status-purple))]">Feliz aniversário! 🎉</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {pacienteQuery.split(" ")[0]} está aniversariando hoje.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Search */}
                {(!isEditing || showPacienteSearch) && !selectedPaciente && (
                  <div ref={pacienteRef} className="relative w-full">
                    <div className="relative" ref={pacienteAnchorRef}>
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={pacienteQuery}
                        onChange={e => { setPacienteQuery(e.target.value); setPacienteDropdownOpen(true); }}
                        onFocus={() => pacienteQuery.trim() && setPacienteDropdownOpen(true)}
                        placeholder="Digite o nome ou CPF do paciente..."
                        className="w-full pl-11 pr-4 py-3.5 bg-background border border-border/60 rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                      />
                    </div>
                    {pacienteDropdownOpen && pacienteQuery.trim().length > 0 && pacienteAnchorRect && createPortal((() => {
                      const q = searchNormalize(pacienteQuery);
                      const digits = pacienteQuery.replace(/\D/g, "");
                      const isCpfSearch = looksLikeCPF(pacienteQuery);
                      const cpfValido = isCpfSearch ? isValidCPF(pacienteQuery) : true;
                      const filtered = getPacientes().filter(p => {
                        const nameMatch = searchNormalize(p.nome).includes(q);
                        const cpfMatch = digits.length > 0 && p.cpf.replace(/\D/g, "").includes(digits);
                        return nameMatch || cpfMatch;
                      });
                      const cpfEncontrado = isCpfSearch && cpfValido
                        ? !!getPacienteByCPF(sanitizeCPF(pacienteQuery))
                        : false;
                      const style: React.CSSProperties = {
                        position: "fixed",
                        top: pacienteAnchorRect.bottom + 8,
                        left: pacienteAnchorRect.left,
                        width: pacienteAnchorRect.width,
                        zIndex: 70,
                      };
                      return (
                        <div
                          data-paciente-portal
                          style={style}
                          className="bg-card border border-border/60 rounded-2xl shadow-[0_16px_48px_-12px_hsl(var(--foreground)/0.18)] overflow-hidden flex flex-col max-h-96"
                        >
                          {isCpfSearch && (
                            <div
                              className={`px-4 py-2.5 text-xs font-semibold border-b border-border/60 ${
                                !cpfValido
                                  ? "bg-destructive/10 text-destructive"
                                  : cpfEncontrado
                                    ? "bg-emerald-500/10 text-emerald-700"
                                    : "bg-amber-500/10 text-amber-700"
                              }`}
                            >
                              {!cpfValido
                                ? "CPF inválido (não atende às regras da Receita Federal)"
                                : cpfEncontrado
                                  ? "CPF encontrado"
                                  : "CPF não encontrado"}
                            </div>
                          )}
                          {filtered.length > 0 ? (
                            <ul className="overflow-y-auto py-2 flex-1">
                              {filtered.map(p => (
                                <li key={p.id}>
                                  <button
                                    type="button"
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => { setSelectedPaciente(p); setPacienteQuery(p.nome); setPacienteDropdownOpen(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/60 transition-colors"
                                  >
                                    <div className="h-9 w-9 rounded-xl bg-primary/8 flex items-center justify-center text-primary font-bold text-[10px] shrink-0">
                                      {p.initials}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-semibold text-foreground truncate">{p.nome}</p>
                                      <p className="text-[11px] text-muted-foreground truncate">
                                        CPF:{" "}
                                        {p.cpf
                                          ? p.cpf
                                          : <span className="italic">não cadastrado</span>}
                                      </p>
                                      <p className="text-[11px] text-muted-foreground truncate">
                                        Nasc.: {p.dataNascimento} · {formatIdadeDetalhada(p.dataNascimento) || p.idade}
                                      </p>
                                    </div>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="px-4 py-5 text-center">
                              <p className="text-sm text-muted-foreground">
                                Nenhum paciente encontrado para "<span className="font-semibold text-foreground">{pacienteQuery}</span>"
                              </p>
                            </div>
                          )}
                          <div className="border-t border-border/60 bg-muted/30 px-3 py-2.5">
                            <button
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => { setCadastroPacienteOpen(true); setPacienteDropdownOpen(false); }}
                              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              Cadastrar novo paciente
                            </button>
                          </div>
                        </div>
                      );
                    })(), document.body)}
                  </div>
                )}

                {/* Selected patient (new mode) */}
                {!isEditing && selectedPaciente && (() => {
                  const idadeDetalhada = formatIdadeDetalhada(selectedPaciente.dataNascimento) || selectedPaciente.idade;
                  const aniversario = isAniversarioHoje(selectedPaciente.dataNascimento);
                  const totalDebitos = pacienteDebitos.reduce((s, d) => s + d.saldo, 0);
                  return (
                    <div className="max-w-3xl space-y-4">
                      <div className="bg-gradient-to-br from-primary/5 to-transparent border border-primary/15 rounded-2xl p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 min-w-0 flex-1">
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                              {selectedPaciente.initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-base font-bold text-foreground truncate">{selectedPaciente.nome}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                CPF:{" "}
                                {selectedPaciente.cpf
                                  ? selectedPaciente.cpf
                                  : <span className="italic">não cadastrado</span>}
                              </p>
                              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                                <div className="flex items-center gap-2 text-xs whitespace-nowrap">
                                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="text-muted-foreground">Nascimento:</span>
                                  <span className="font-semibold text-foreground">{selectedPaciente.dataNascimento}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs whitespace-nowrap">
                                  <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="text-muted-foreground">Idade:</span>
                                  <span className="font-semibold text-foreground">{idadeDetalhada}</span>
                                </div>
                                <div className="text-xs">
                                  <PacienteTelefoneInline cpf={selectedPaciente.cpf} />
                                </div>
                                {(selectedPaciente.endereco || selectedPaciente.cidade || selectedPaciente.estado) && (
                                  <div className="flex items-center gap-2 text-xs min-w-0">
                                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="text-muted-foreground">Endereço:</span>
                                    <span className="font-semibold text-foreground truncate">
                                      {[
                                        selectedPaciente.endereco,
                                        selectedPaciente.numero,
                                        selectedPaciente.bairro,
                                        selectedPaciente.complemento,
                                      ].filter(Boolean).join(", ")}
                                      {selectedPaciente.cidade || selectedPaciente.estado
                                        ? ` — ${selectedPaciente.cidade || ""}${selectedPaciente.cidade && selectedPaciente.estado ? "/" : ""}${selectedPaciente.estado || ""}`
                                        : ""}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => { setSelectedPaciente(null); setPacienteQuery(""); }}
                            className="h-9 w-9 rounded-xl border border-border/60 flex items-center justify-center hover:bg-destructive/10 hover:border-destructive/30 transition-colors shrink-0"
                          >
                            <X className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </div>
                      </div>

                      {aniversario && (
                        <div className="border border-[hsl(var(--status-purple))]/30 rounded-2xl p-4 bg-[hsl(var(--status-purple-bg))]">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-[hsl(var(--status-purple))]/15 shrink-0">
                              <Cake className="h-4 w-4 text-[hsl(var(--status-purple))]" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[hsl(var(--status-purple))]">Feliz aniversário! 🎉</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {selectedPaciente.nome.split(" ")[0]} está aniversariando hoje.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {pacienteDebitos.length > 0 && (
                        <div className="border border-[hsl(var(--status-danger))]/30 rounded-2xl p-5 bg-[hsl(var(--status-danger-bg))]">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-xl bg-[hsl(var(--status-danger))]/15 shrink-0">
                              <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-danger))]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-3 flex-wrap">
                                <p className="text-sm font-bold text-[hsl(var(--status-danger))]">
                                  Débitos em aberto
                                </p>
                                <span className="text-sm font-bold text-[hsl(var(--status-danger))] tabular-nums">
                                  {fmtBRL(totalDebitos)}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Este paciente possui pagamentos pendentes:
                              </p>
                              <div className="mt-3 space-y-2">
                                {pacienteDebitos.map(d => (
                                  <div key={d.protocolo} className="flex items-center justify-between text-xs bg-card/60 rounded-xl px-4 py-2.5 border border-border/60">
                                    <span className="font-semibold text-foreground">{d.protocolo}</span>
                                    <span className="font-bold text-[hsl(var(--status-danger))] tabular-nums">{fmtBRL(d.saldo)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

            </section>

            {/* ════ STEP 2: Convênio & Solicitante ════ */}
            <section id="step-convenio" className="scroll-mt-28 space-y-4 pt-6 border-t border-border/60">
                <div>
                  <h2 className="text-lg font-bold text-foreground tracking-tight">Convênio & Solicitante</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Convênio */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-foreground">Convênio</label>
                    <div className="relative" ref={convenioWrapperRef}>
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        ref={convenioInputRef}
                        type="text"
                        value={convenioQuery}
                        onChange={e => { setConvenioQuery(e.target.value); setConvenioDropdownOpen(true); }}
                        onFocus={() => setConvenioDropdownOpen(true)}
                        onKeyDown={e => {
                          const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                          const q = searchNormalize(convenioQuery);
                          const jaSelecionados = new Set(convenios.map(norm));
                          const filtered = availableConvenios.filter(c => !jaSelecionados.has(norm(c)) && (!q || norm(c).includes(q)));
                          if (e.key === "Escape") {
                            e.preventDefault();
                            setConvenioDropdownOpen(false);
                            return;
                          }
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            if (!convenioDropdownOpen) { setConvenioDropdownOpen(true); return; }
                            setConvenioHighlight(h => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
                            return;
                          }
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setConvenioHighlight(h => Math.max(h - 1, 0));
                            return;
                          }
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (!convenioDropdownOpen) { setConvenioDropdownOpen(true); return; }
                            const c = filtered[convenioHighlight];
                            if (!c) return;
                            const jaExiste = convenios.some(x => norm(x) === norm(c));
                            if (jaExiste) {
                              toast({ title: "Convênio já adicionado", description: `${c} já está na lista.`, variant: "destructive" });
                            } else {
                              setConvenios([...convenios, c]);
                            }
                            setConvenioQuery("");
                            setConvenioDropdownOpen(false);
                            setConvenioHighlight(0);
                          }
                        }}
                        placeholder="Buscar convênio..."
                        className="w-full pl-11 pr-4 py-3 bg-background border border-border/60 rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                      />
                      {convenioDropdownOpen && (() => {
                        const q = searchNormalize(convenioQuery);
                        const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                        const jaSelecionados = new Set(convenios.map(norm));
                        const filtered = availableConvenios.filter(c => !jaSelecionados.has(norm(c)) && (!q || norm(c).includes(q)));
                        if (convenioLoading || convenioError || filtered.length === 0) {
                          return (
                            <DropdownStatus
                              loading={convenioLoading}
                              error={convenioError}
                              query={convenioQuery}
                              emptyTitle="Nenhum convênio disponível"
                              emptyHint="Todos os convênios já foram adicionados ou não há cadastros."
                              noResultsTitle="Nenhum convênio encontrado"
                              noResultsHint={<>Não há resultados para "<strong>{convenioQuery}</strong>".</>}
                              onRetry={() => setConvenioError(null)}
                            />
                          );
                        }
                        return (
                          <ul
                            role="listbox"
                            aria-label="Convênios disponíveis"
                            className="absolute top-full left-0 right-0 mt-2 bg-card border border-border/60 rounded-2xl shadow-[0_16px_48px_-12px_hsl(var(--foreground)/0.12)] z-50 max-h-56 overflow-y-auto py-1.5 origin-top animate-scale-in"
                          >
                            {filtered.map((c, idx) => {
                              const isLastSelected = lastSelectedConvenio
                                ? norm(lastSelectedConvenio) === norm(c)
                                : false;
                              return (
                              <li key={c}>
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={convenioHighlight === idx}
                                  onMouseEnter={() => setConvenioHighlight(idx)}
                                  onMouseDown={e => e.preventDefault()}
                                  onClick={() => {
                                    const jaExiste = convenios.some(x => norm(x) === norm(c));
                                    if (jaExiste) {
                                      toast({ title: "Convênio já adicionado", description: `${c} já está na lista.`, variant: "destructive" });
                                      setConvenioQuery("");
                                      setConvenioDropdownOpen(false);
                                      convenioInputRef.current?.focus();
                                      return;
                                    }
                                    setConvenios([...convenios, c]);
                                    setLastSelectedConvenio(c);
                                    setConvenioQuery("");
                                    setConvenioDropdownOpen(false);
                                    setConvenioHighlight(0);
                                    convenioInputRef.current?.focus();
                                  }}
                                  className={`w-full text-left px-4 py-3 text-sm text-foreground transition-colors flex items-center gap-2 outline-none ${
                                    convenioHighlight === idx
                                      ? "bg-primary/10 text-foreground ring-1 ring-inset ring-primary/30"
                                      : isLastSelected
                                        ? "bg-primary/5"
                                        : "hover:bg-accent/60"
                                  }`}
                                >
                                  <Plus className="h-3.5 w-3.5 text-primary shrink-0" />
                                  <span className="truncate">{highlightMatch(c, convenioQuery)}</span>
                                  {isLastSelected && (
                                    <span className="ml-auto text-[9.5px] font-semibold uppercase tracking-wider text-primary/70">
                                      último
                                    </span>
                                  )}
                                </button>
                              </li>
                              );
                            })}
                          </ul>
                        );
                      })()}
                    </div>
                    {convenios.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {convenios.map(c => (
                          <span key={c} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary/8 text-primary text-sm font-medium border border-primary/15">
                            {c}
                            <X className="h-3 w-3 cursor-pointer hover:opacity-70" onClick={() => setConvenios(convenios.filter(x => x !== c))} />
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Solicitante */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-foreground">Solicitante</label>
                    <div className="relative" ref={solicitanteWrapperRef}>
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        ref={solicitanteInputRef}
                        type="text"
                        value={solicitanteQuery}
                        onChange={e => { setSolicitanteQuery(e.target.value); setSolicitanteDropdownOpen(true); }}
                        onFocus={() => setSolicitanteDropdownOpen(true)}
                        onKeyDown={e => {
                          const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                          const q = searchNormalize(solicitanteQuery);
                          const jaSelecionados = new Set(solicitantes.map(norm));
                          const filtered = availableSolicitantes.filter(s => !jaSelecionados.has(norm(s)) && (!q || norm(s).includes(q)));
                          if (e.key === "Escape") {
                            e.preventDefault();
                            setSolicitanteDropdownOpen(false);
                            return;
                          }
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            if (!solicitanteDropdownOpen) { setSolicitanteDropdownOpen(true); return; }
                            setSolicitanteHighlight(h => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
                            return;
                          }
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setSolicitanteHighlight(h => Math.max(h - 1, 0));
                            return;
                          }
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (!solicitanteDropdownOpen) { setSolicitanteDropdownOpen(true); return; }
                            const s = filtered[solicitanteHighlight];
                            if (!s) return;
                            const jaExiste = solicitantes.some(x => norm(x) === norm(s));
                            if (jaExiste) {
                              toast({ title: "Solicitante já adicionado", description: `${s} já está na lista.`, variant: "destructive" });
                            } else {
                              setSolicitantes([...solicitantes, s]);
                            }
                            setSolicitanteQuery("");
                            setSolicitanteDropdownOpen(false);
                            setSolicitanteHighlight(0);
                          }
                        }}
                        placeholder="Buscar solicitante..."
                        className="w-full pl-11 pr-4 py-3 bg-background border border-border/60 rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                      />
                      {solicitanteDropdownOpen && (() => {
                        const q = searchNormalize(solicitanteQuery);
                        const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                        const jaSelecionados = new Set(solicitantes.map(norm));
                        const filtered = availableSolicitantes.filter(s => !jaSelecionados.has(norm(s)) && (!q || norm(s).includes(q)));
                        if (solicitanteLoading || solicitanteError || filtered.length === 0) {
                          return (
                            <DropdownStatus
                              loading={solicitanteLoading}
                              error={solicitanteError}
                              query={solicitanteQuery}
                              emptyTitle="Nenhum solicitante disponível"
                              emptyHint="Todos os solicitantes já foram adicionados ou não há cadastros."
                              noResultsTitle="Nenhum solicitante encontrado"
                              noResultsHint={<>Não há resultados para "<strong>{solicitanteQuery}</strong>".</>}
                              onRetry={() => setSolicitanteError(null)}
                            />
                          );
                        }
                        return (
                          <ul
                            role="listbox"
                            aria-label="Solicitantes disponíveis"
                            className="absolute top-full left-0 right-0 mt-2 bg-card border border-border/60 rounded-2xl shadow-[0_16px_48px_-12px_hsl(var(--foreground)/0.12)] z-50 max-h-56 overflow-y-auto py-1.5 origin-top animate-scale-in"
                          >
                            {filtered.map((s, idx) => {
                              const isLastSelected = lastSelectedSolicitante
                                ? norm(lastSelectedSolicitante) === norm(s)
                                : false;
                              return (
                               <li key={`${norm(s)}-${idx}`}>
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={solicitanteHighlight === idx}
                                  onMouseEnter={() => setSolicitanteHighlight(idx)}
                                  onMouseDown={e => e.preventDefault()}
                                  onClick={() => {
                                    const jaExiste = solicitantes.some(x => norm(x) === norm(s));
                                    if (jaExiste) {
                                      toast({ title: "Solicitante já adicionado", description: `${s} já está na lista.`, variant: "destructive" });
                                      setSolicitanteQuery("");
                                      setSolicitanteDropdownOpen(false);
                                      solicitanteInputRef.current?.focus();
                                      return;
                                    }
                                    setSolicitantes([...solicitantes, s]);
                                    setLastSelectedSolicitante(s);
                                    setSolicitanteQuery("");
                                    setSolicitanteDropdownOpen(false);
                                    setSolicitanteHighlight(0);
                                    solicitanteInputRef.current?.focus();
                                  }}
                                  className={`w-full text-left px-4 py-3 text-sm text-foreground transition-colors flex items-center gap-2 outline-none ${
                                    solicitanteHighlight === idx
                                      ? "bg-primary/10 text-foreground ring-1 ring-inset ring-primary/30"
                                      : isLastSelected
                                        ? "bg-primary/5"
                                        : "hover:bg-accent/60"
                                  }`}
                                >
                                  <Plus className="h-3.5 w-3.5 text-primary shrink-0" />
                                  <span className="truncate">{highlightMatch(s, solicitanteQuery)}</span>
                                  {isLastSelected && (
                                    <span className="ml-auto text-[9.5px] font-semibold uppercase tracking-wider text-primary/70">
                                      último
                                    </span>
                                  )}
                                </button>
                              </li>
                              );
                            })}
                          </ul>
                        );
                      })()}
                    </div>
                    {solicitantes.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {solicitantes.map(s => (
                          <span key={s} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-accent text-foreground text-sm font-medium border border-border/60">
                            {s}
                            <X className="h-3 w-3 cursor-pointer hover:opacity-70" onClick={() => setSolicitantes(solicitantes.filter(x => x !== s))} />
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

            </section>

            {/* ════ STEP 3: Exames ════ */}
            <section id="step-exames" className="scroll-mt-28 space-y-4 pt-6 border-t border-border/60">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                  <h2 className="text-lg font-bold text-foreground tracking-tight">Solicitar exames</h2>
                  <div className="flex items-end gap-3 flex-wrap">
                    {exames.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setMostrarAjustesPorExame(v => !v)}
                        className="h-10 px-3 inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background text-xs font-semibold text-foreground hover:bg-accent transition-all"
                        title="Mostrar/ocultar Solicitante por exame e Cobrança híbrida"
                      >
                        {mostrarAjustesPorExame ? "Ocultar ajustes por exame" : "Ajustes por exame"}
                      </button>
                    )}
                    {exames.length > 0 && (
                      <div className="space-y-1.5 sm:w-64">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Data da coleta <span className="text-muted-foreground/70 normal-case font-normal">(Brasília)</span>
                        </label>
                        <input
                          type="date"
                          value={dataColeta}
                          onChange={(e) => { setDataColeta(e.target.value); setDataColetaTouched(true); }}
                          className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Convênio filter */}
                {convenios.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filtrar:</span>
                    <button
                      onClick={() => setSelectedConvenioFilter(null)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        !selectedConvenioFilter
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-accent text-foreground hover:bg-accent/80 border border-border/60"
                      }`}
                    >
                      Todos
                    </button>
                    {convenios.map(c => (
                      <button
                        key={c}
                        onClick={() => setSelectedConvenioFilter(selectedConvenioFilter === c ? null : c)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                          selectedConvenioFilter === c
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-accent text-foreground hover:bg-accent/80 border border-border/60"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={exameQuery}
                    onChange={e => { setExameQuery(e.target.value); setExameDropdownOpen(true); }}
                    onFocus={() => setExameDropdownOpen(true)}
                    placeholder="Pesquisar exame por nome ou mnemônico..."
                    className="w-full pl-11 pr-4 py-3.5 bg-background border border-border/60 rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                  />
                  {exameDropdownOpen && (exameQuery.trim() || exameLoading || exameError) && (() => {
                    const q = searchNormalize(exameQuery);
                    const catalogo = getExamesCatalogo();
                    const catByNorm = new Map<string, typeof catalogo[number]>();
                    catalogo.forEach(c => { catByNorm.set(searchNormalize(c.nome), c); });
                    const filtered = availableExames.filter(e => {
                      const matchesName = !q || searchNormalize(e.nome).includes(q);
                      const cat = catByNorm.get(searchNormalize(e.nome));
                      const matchesMnemonico = !q || (cat?.mnemonico ? searchNormalize(cat.mnemonico).includes(q) : false);
                      const matches = matchesName || matchesMnemonico;
                      const convenioTabelas = convenios.map(c => getTabelaByConvenioNome(c));
                      const inSelectedConvenios = convenios.length === 0 || convenioTabelas.includes(e.convenio);
                      const filterTabela = selectedConvenioFilter ? getTabelaByConvenioNome(selectedConvenioFilter) : null;
                      const matchesConvenio = !filterTabela || e.convenio === filterTabela;
                      return matches && inSelectedConvenios && matchesConvenio;
                    });
                    const seen = new Set<string>();
                    const deduped = filtered.filter(e => {
                      const key = `${e.nome}|${e.convenio}`;
                      if (seen.has(key)) return false;
                      seen.add(key);
                      return true;
                    });
                    // Expandir cada exame em uma linha por convênio selecionado que usa aquela tabela.
                    // Isso evita ambiguidade quando dois convênios compartilham a mesma tabela de preços.
                    type LinhaBusca = { exame: ExameTemplate; convenioNome: string };
                    const linhas: LinhaBusca[] = [];
                    deduped.forEach(e => {
                      const conveniosDaTabela = convenios.filter(c => getTabelaByConvenioNome(c) === e.convenio);
                      const aplicaveis = selectedConvenioFilter
                        ? conveniosDaTabela.filter(c => c === selectedConvenioFilter)
                        : conveniosDaTabela;
                      if (aplicaveis.length === 0) {
                        linhas.push({ exame: e, convenioNome: e.convenio });
                      } else {
                        aplicaveis.forEach(c => linhas.push({ exame: e, convenioNome: c }));
                      }
                    });
                    if (exameLoading || exameError || linhas.length === 0) {
                      return (
                        <DropdownStatus
                          loading={exameLoading}
                          error={exameError}
                          query={exameQuery}
                          emptyTitle="Digite para buscar exames"
                          emptyHint="Pesquise por nome ou código do exame para ver as opções."
                          noResultsTitle="Nenhum exame encontrado"
                          noResultsHint={
                            <>
                              Não há resultados para "<strong>{exameQuery}</strong>"
                              {selectedConvenioFilter ? <> no convênio <strong>{selectedConvenioFilter}</strong></> : null}.
                            </>
                          }
                          onRetry={() => setExameError(null)}
                        />
                      );
                    }
                    return (
                      <ul
                        role="listbox"
                        aria-label="Exames encontrados"
                        className="absolute top-full left-0 right-0 mt-2 bg-card border border-border/60 rounded-2xl shadow-[0_16px_48px_-12px_hsl(var(--foreground)/0.12)] z-50 max-h-56 overflow-y-auto py-2"
                      >
                        {linhas.map(({ exame: e, convenioNome }) => {
                          const key = `${e.id}-${convenioNome}`;
                          const isLastSelected = lastSelectedExameKey === key;
                          const cat = catByNorm.get(searchNormalize(e.nome));
                          const labApoioNome =
                            cat?.labApoioId
                              ? getLabsApoio().find((l) => l.id === cat.labApoioId)?.nome ?? undefined
                              : undefined;
                          const mnem = cat?.mnemonico?.trim() || "";
                          return (
                          <li key={`${e.id}-${convenioNome}`}>
                            <button
                              type="button"
                              onClick={() => {
                                addExame(e, convenioNome);
                                setLastSelectedExameKey(key);
                              }}
                              className={`w-full text-left px-5 py-3 transition-colors outline-none ${
                                isLastSelected
                                  ? "bg-primary/5 ring-1 ring-inset ring-primary/20"
                                  : "hover:bg-primary/10 hover:ring-1 hover:ring-inset hover:ring-primary/30 focus-visible:bg-primary/10 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/30"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {highlightMatch(e.nome, exameQuery)}
                                  {mnem && (
                                    <span className="text-muted-foreground font-normal"> — {highlightMatch(mnem, exameQuery)}</span>
                                  )}
                                </p>
                                <div className="flex items-center gap-2 shrink-0 ml-3">
                                  {isLastSelected && (
                                    <span className="text-[9.5px] font-semibold uppercase tracking-wider text-primary/70">
                                      último
                                    </span>
                                  )}
                                  <span
                                    title={`Convênio: ${convenioNome}`}
                                    className="text-[10px] font-semibold px-2.5 py-0.5 rounded-lg bg-primary/8 text-primary max-w-[180px] truncate"
                                  >
                                    {convenioNome}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <LabBadge
                                  compact
                                  tipoProcesso={cat?.tipoProcesso ?? "INTERNO"}
                                  labApoioId={cat?.labApoioId ?? null}
                                  labApoioNome={labApoioNome ?? null}
                                />
                                <span className="text-xs text-muted-foreground">
                                  {e.material} — {fmtBRL(e.valor)}
                                </span>
                              </div>
                            </button>
                          </li>
                          );
                        })}
                      </ul>
                    );
                  })()}
                </div>

                {/* Exames list */}
                {filteredExames.length > 0 ? (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {filteredExames.map(exame => {
                      // Opções de cobrança para este exame: Paciente + cada convênio não-Particular selecionado
                      const conveniosNaoParticulares = convenios
                        .filter(n => n !== "Particular")
                        .map(n => getConvenios().find(c => c.nome === n))
                        .filter((c): c is NonNullable<typeof c> => Boolean(c));
                      const cobrancaValue = exame.cobrancaDestino === "convenio" && exame.convenioCobrancaId != null
                        ? `c:${exame.convenioCobrancaId}`
                        : "p";
                      const onCobrancaChange = (v: string) => {
                        if (v === "p") {
                          setExames(prev => prev.map(e => e.id === exame.id
                            ? { ...e, cobrancaDestino: "paciente", convenioCobrancaId: null }
                            : e));
                        } else {
                          const convId = Number(v.slice(2));
                          setExames(prev => prev.map(e => e.id === exame.id
                            ? { ...e, cobrancaDestino: "convenio", convenioCobrancaId: convId }
                            : e));
                        }
                      };
                      return (
                        <div key={exame.id} className="group p-3 sm:p-4 border border-border/60 rounded-2xl hover:border-primary/20 hover:shadow-sm transition-all">
                          {/* Linha única (com wrap em telas estreitas) */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 md:flex-nowrap">
                            {/* Identidade do exame */}
                            <div className="flex items-center gap-3 min-w-0 flex-1 basis-full md:basis-0">
                              <div className="h-9 w-9 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                                <TestTube2 className="h-4 w-4 text-primary" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-semibold text-foreground truncate">
                                    {highlightMatch(exame.nome, exameQuery)}
                                    {(() => {
                                      const cat = getExamesCatalogo().find(c => searchNormalize(c.nome) === searchNormalize(exame.nome));
                                      const mnem = cat?.mnemonico?.trim();
                                      return mnem ? (
                                        <span className="text-muted-foreground font-normal"> — {highlightMatch(mnem, exameQuery)}</span>
                                      ) : null;
                                    })()}
                                  </p>
                                  <span
                                    title={`Convênio: ${exame.convenio}`}
                                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary shrink-0 max-w-[180px] truncate"
                                  >
                                    {exame.convenio}
                                  </span>
                                  {exame.addedByIA && (
                                    <span
                                      title={
                                        exame.justificativaIA
                                          ? `IA (${exame.confiancaIA || "media"}) — ${exame.justificativaIA}`
                                          : "Adicionado pela IA"
                                      }
                                    >
                                      <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                                    </span>
                                  )}
                                  {(() => {
                                    const totalDoNome = exames.filter(x => x.nome.toLowerCase() === exame.nome.toLowerCase()).length;
                                    if (totalDoNome <= 1) return null;
                                    return (
                                      <span
                                        title="Esta é uma amostra adicional do mesmo exame"
                                        className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary shrink-0"
                                      >
                                        Amostra {exame.amostraSeq ?? 1}
                                      </span>
                                    );
                                  })()}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">{exame.material}</p>
                                {exame.observacaoIA && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5 italic line-clamp-2" title={exame.observacaoIA}>
                                    {exame.observacaoIA}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Controles inline */}
                            <div className="flex items-center gap-2 md:gap-2.5 lg:gap-3 basis-full md:basis-auto md:flex-none md:flex-nowrap justify-end shrink-0 w-full md:w-auto">
                              {mostrarAjustesPorExame && (
                                <select
                                  value={cobrancaValue}
                                  onChange={e => onCobrancaChange(e.target.value)}
                                  disabled={conveniosNaoParticulares.length === 0}
                                  aria-label="Cobrar de"
                                  className="h-9 flex-1 md:flex-none md:w-[140px] lg:w-[170px] min-w-0 px-2.5 pr-7 rounded-xl text-xs font-semibold bg-background border border-border/60 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:opacity-60 disabled:cursor-not-allowed transition-all truncate"
                                  title={conveniosNaoParticulares.length === 0 ? "Sem convênio selecionado — só é possível cobrar do paciente" : "Cobrar de quem"}
                                >
                                  <option value="p">Paciente</option>
                                  {conveniosNaoParticulares.map(c => (
                                    <option key={c.id} value={`c:${c.id}`}>{c.nome}</option>
                                  ))}
                                </select>
                              )}

                              {mostrarAjustesPorExame && solicitantes.length > 1 && (
                                <select
                                  value={exame.solicitanteExame === "__ambos" ? "__ambos" : (exame.solicitanteExame ?? "")}
                                  onChange={ev => {
                                    const v = ev.target.value;
                                    setExames(prev => prev.map(e => e.id === exame.id ? { ...e, solicitanteExame: v } : e));
                                  }}
                                  onClick={(ev) => ev.stopPropagation()}
                                  aria-label="Solicitante"
                                  className={`h-9 flex-1 md:flex-none md:w-[150px] lg:w-[180px] min-w-0 px-2.5 pr-7 rounded-xl text-xs font-semibold bg-background border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all truncate ${
                                    !exame.solicitanteExame || !exame.solicitanteExame.trim()
                                      ? "border-destructive/50 text-destructive"
                                      : "border-border/60 text-foreground"
                                  }`}
                                  title="Solicitante deste exame"
                                >
                                  <option value="">Solicitante…</option>
                                  <option value="__ambos">Ambos</option>
                                  {solicitantes.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                  ))}
                                </select>
                              )}

                              <div className="h-9 inline-flex flex-col items-end justify-center whitespace-nowrap min-w-[72px] md:min-w-[88px] tabular-nums shrink-0 leading-tight">
                                {exame.valorOriginal != null && exame.valorOriginal > exame.valor && (
                                  <span className="text-[10px] text-muted-foreground line-through">
                                    {fmtBRL(exame.valorOriginal)}
                                  </span>
                                )}
                                <span className="text-sm font-bold text-foreground">
                                  {fmtBRL(exame.valor)}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => removeExame(exame.id)}
                                aria-label="Remover exame"
                                className="h-9 w-9 shrink-0 rounded-xl border border-border/60 flex items-center justify-center hover:bg-destructive/10 hover:border-destructive/30 transition-all"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : exames.length > 0 && selectedConvenioFilter ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border/60 rounded-2xl">
                    <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                      <FileText className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      Nenhum exame do convênio <span className="font-bold">{selectedConvenioFilter}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Existem {exames.length} exame{exames.length !== 1 ? "s" : ""} de outros convênios.
                    </p>
                    <button
                      onClick={() => setSelectedConvenioFilter(null)}
                      className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                    >
                      Limpar filtro
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="h-16 w-16 rounded-3xl bg-muted/50 flex items-center justify-center mb-4">
                      <FileText className="h-7 w-7 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Nenhum exame adicionado</p>
                    <p className="text-xs text-muted-foreground mt-1">Use a busca acima para adicionar exames</p>
                  </div>
                )}

                {/* Summary bar */}
                {exames.length > 0 && (
                  <div className="flex items-center justify-between gap-3 px-5 py-3 bg-primary/5 border border-primary/15 rounded-2xl flex-wrap">
                    <span className="text-sm text-muted-foreground shrink-0">
                      <span className="font-bold text-foreground">{filteredExames.length}</span> exame{filteredExames.length !== 1 ? "s" : ""}
                    </span>
                    <div className="flex items-baseline gap-2 tabular-nums whitespace-nowrap">
                      {descontoHistorico > 0 && (
                        <span className="text-[11px] text-muted-foreground line-through">
                          {fmtBRL(subtotalOriginal)}
                        </span>
                      )}
                      <span className="text-sm font-bold text-foreground">{fmtBRL(subtotal)}</span>
                    </div>
                  </div>
                )}

            </section>

            {/* ════ STEP 4: Observações & Financeiro ════ */}
            <section id="step-resumo" className="scroll-mt-28 space-y-4 pt-6 border-t border-border/60">
                <div>
                  <h2 className="text-lg font-bold text-foreground tracking-tight">Observações & finalização</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
                  {/* Left: Clinical info */}
                  <div className="lg:col-span-3 space-y-5 min-w-0">
                    {/* Linha 1: Prioridade (segmented) + Previsão de entrega (compacto) */}
                    <div className="flex flex-col lg:flex-row lg:items-end gap-4">
                      <div className="min-w-0 flex-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
                          Prioridade clínica
                        </label>
                        <div className="flex flex-wrap lg:flex-nowrap p-1 rounded-lg bg-muted/50 border border-border/60 gap-1">
                          {([
                            { v: "normal", label: "Normal", icon: Clock, active: "bg-background text-foreground shadow-sm" },
                            { v: "urgencia", label: "Urgência", icon: Zap, active: "bg-background text-[hsl(var(--status-warning))] shadow-sm" },
                            { v: "emergencia", label: "Emergência", icon: Flame, active: "bg-background text-[hsl(var(--status-danger))] shadow-sm" },
                          ] as const).map(opt => {
                            const Icon = opt.icon;
                            const isActive = prioridade === opt.v;
                            return (
                              <button
                                key={opt.v}
                              type="button"
                                onClick={() => setPrioridade(opt.v)}
                                className={`inline-flex flex-1 items-center justify-center gap-1 h-8 px-2 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${isActive ? opt.active : "text-muted-foreground hover:text-foreground"}`}
                              >
                                <Icon className="h-3.5 w-3.5 shrink-0" />
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="w-full lg:w-auto lg:min-w-[140px] lg:max-w-[160px] shrink-0">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
                          Previsão de entrega
                        </label>
                        <input
                          type="datetime-local"
                          value={dataEntrega}
                          onChange={(e) => { setDataEntrega(e.target.value); setDataEntregaTouched(true); }}
                          className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </div>

                    {/* Linha 2: Opções clínicas (toggles inline) */}
                    <div className="rounded-lg border border-border/60 bg-muted/20 divide-y divide-border/40">
                      <label htmlFor="opt-jejum" className="flex items-center justify-between gap-4 px-4 py-3 cursor-pointer">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-lg bg-background border border-border/60 flex items-center justify-center shrink-0">
                            <Coffee className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground">Paciente em jejum</div>
                            <div className="text-[11px] text-muted-foreground">Necessário para exames bioquímicos</div>
                          </div>
                        </div>
                        <Switch
                          id="opt-jejum"
                          checked={jejum === "sim"}
                          onCheckedChange={(v) => setJejum(v ? "sim" : "nao")}
                        />
                      </label>
                      <label htmlFor="opt-whats" className="flex items-center justify-between gap-4 px-4 py-3 cursor-pointer">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-lg bg-background border border-border/60 flex items-center justify-center shrink-0">
                            <MessageCircle className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground">Entrega do resultado por WhatsApp</div>
                            <div className="text-[11px] text-muted-foreground">
                              {entregaWhatsapp === "sim"
                                ? "Enviado ao telefone do paciente assim que liberado"
                                : "O paciente receberá apenas pelo portal"}
                            </div>
                          </div>
                        </div>
                        <Switch
                          id="opt-whats"
                          checked={entregaWhatsapp === "sim"}
                          onCheckedChange={(v) => setEntregaWhatsapp(v ? "sim" : "nao")}
                        />
                      </label>
                    </div>



                    {/* Observações */}
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
                        Observações, doenças e medicamentos
                      </label>
                      <textarea
                        value={observacoes}
                        onChange={e => setObservacoes(e.target.value)}
                        rows={5}
                        placeholder="Informe doenças preexistentes, medicamentos em uso, alergias e demais observações clínicas relevantes."
                        className="w-full rounded-xl border border-border/60 bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 resize-none"
                      />
                    </div>

                    {/* Roteamento de apoio (Fase 3) — só renderiza se houver TERCEIRIZADO */}
                    <Suspense fallback={null}>
                    <RoteamentoApoioPanel
                      exames={exames.map(e => ({
                        id: e.id,
                        nome: e.nome,
                        tipoProcesso: e.tipoProcesso,
                        labApoioIdPadrao: e.labApoioIdPadrao,
                        labApoioIdOverride: e.labApoioIdOverride,
                        grupoExameId: e.grupoExameId,
                      }))}
                      onChange={(id, labApoioId) => {
                        setExames(prev => prev.map(e => {
                          if (e.id !== id) return e;
                          const mesmoPadrao = labApoioId && labApoioId === e.labApoioIdPadrao;
                          return { ...e, labApoioIdOverride: mesmoPadrao ? null : labApoioId };
                        }));
                      }}
                    />
                    </Suspense>
                  </div>

                  {/* Right: Financial */}
                  <div className="lg:col-span-2 min-w-0">
                    <div className="lg:sticky lg:top-6 bg-gradient-to-br from-primary/5 to-transparent border border-primary/15 rounded-2xl p-5 sm:p-6 space-y-4">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Resumo financeiro</p>

                      <div className="space-y-2.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Itens</span>
                          <span className="font-semibold text-foreground">{exames.length}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="font-semibold text-foreground">{fmtBRL(subtotal)}</span>
                        </div>
                        {desconto > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Desconto</span>
                            <span className="font-semibold text-[hsl(var(--status-success))]">- {fmtBRL(desconto)}</span>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-border/60 pt-4 flex justify-between">
                        <span className="text-base font-bold text-foreground">Total</span>
                        <span className="text-xl font-extrabold text-foreground">{fmtBRL(total)}</span>
                      </div>

                      <div className="border-t border-border/60 pt-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Valor pago</span>
                          <span className="font-semibold text-foreground">{fmtBRL(valorPago)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Saldo devedor</span>
                          <span className={`font-bold ${saldoDevedor > 0 ? "text-[hsl(var(--status-danger))]" : "text-[hsl(var(--status-success))]"}`}>
                            {fmtBRL(saldoDevedor)}
                          </span>
                        </div>
                      </div>

                      {total > 0 || isEditing ? (
                        <button
                          onClick={() => setPagamentoOpen(true)}
                          className="w-full py-3 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground shadow-[0_2px_12px_-2px_hsl(var(--primary)/0.4)] hover:shadow-[0_4px_20px_-2px_hsl(var(--primary)/0.5)] transition-all"
                        >
                          {isEditing ? "Editar pagamento" : "Pagar agora"}
                        </button>
                      ) : (
                        <div className="w-full py-3 px-4 rounded-2xl text-xs font-medium text-center bg-[hsl(var(--status-success-bg))] border border-[hsl(var(--status-success))]/30 text-[hsl(var(--status-success))]">
                          Sem cobrança ao paciente — todos os exames serão faturados via convênio.
                        </div>
                      )}

                      {isEditing && (
                        <div className="border-t border-border/60 pt-3 space-y-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Comprovantes</p>
                          {valorPago > 0 && (
                            <button
                              onClick={() => setComprovanteTipo("pagamento")}
                              className="w-full h-10 px-3 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:border-primary/40 hover:bg-muted/40 transition-all flex items-center justify-center gap-2"
                            >
                              <Receipt className="h-3.5 w-3.5 text-primary" />
                              Comp. Pagamento
                            </button>
                          )}
                          <button
                            onClick={() => setComprovanteTipo("atendimento")}
                            className="w-full h-10 px-3 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:border-primary/40 hover:bg-muted/40 transition-all flex items-center justify-center gap-2"
                          >
                            <FileText className="h-3.5 w-3.5 text-primary" />
                            Comp. Atendimento
                          </button>
                          <button
                            onClick={() => setComprovanteTipo("comparecimento")}
                            className="w-full h-10 px-3 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:border-primary/40 hover:bg-muted/40 transition-all flex items-center justify-center gap-2"
                          >
                            <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
                            Comparecimento
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

            </section>


        </div>
      </div>

      {/* ── Sticky Action Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total</p>
            <p className="text-base sm:text-lg font-bold text-foreground truncate">
              {fmtBRL(total)}
              <span className="ml-2 text-xs font-medium text-muted-foreground">· {exames.length} exame(s)</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/atendimentos")}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60 border border-border/60 transition-all"
            >
              Cancelar
            </button>
            {!isEditing && (
              <button
                onClick={() => setOrcamentoConfirmOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-primary/30 text-primary hover:bg-primary/5 transition-all"
              >
                <Receipt className="h-4 w-4" />
                <span className="hidden sm:inline">Orçamento</span>
              </button>
            )}
            <button
              onClick={finalizarComValidacao}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all"
            >
              {isEditing ? "Atualizar atendimento" : "Finalizar atendimento"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Dialogs ── */}
      {pagamentoOpen && (
      <Suspense fallback={null}>
      <PagamentoDialog
        open={pagamentoOpen}
        onClose={() => setPagamentoOpen(false)}
        itens={exames.length} subtotal={subtotal} desconto={desconto} total={total}
        valorPago={valorPago} saldoDevedor={saldoDevedor}
        exames={exames.filter(e => e.cobrancaDestino !== "convenio").map(e => ({ nome: e.nome, valor: e.valor }))}
        pagamentosRealizados={pagamentosRealizados} isEditing={isEditing}
        onConfirm={res => {
          setValorPago(res.valorPago);
          setDesconto(res.desconto);
          if (res.novosPagamentos && res.novosPagamentos.length > 0) {
            setPagamentosRealizados(prev => [...prev, ...res.novosPagamentos]);
          }
        }}
        onRemovePagamentoRealizado={index => {
          const removed = pagamentosRealizados[index];
          if (!removed) return;
          setPagamentosRealizados(prev => prev.filter((_, i) => i !== index));
          setValorPago(prev => Math.max(0, prev - removed.valor));
        }}
      />
      </Suspense>
      )}
      {comprovanteTipo && (() => {
        const paciente = getPacientes().find(p => p.nome === pacienteQuery);
        const cpf = paciente?.cpf || editAtendimentoData?.cpf || "";
        const nascimento = paciente?.dataNascimento || editAtendimentoData?.nascimento || "";
        const idade = paciente?.idade || editAtendimentoData?.idade || "";
        const telefone = paciente?.telefone || paciente?.celular;
        const protocoloAtual = editProtocolo ? decodeURIComponent(editProtocolo) : "";
        const dataAtual = (() => {
          const d = new Date();
          return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
        })();
        const examesData = exames.map(e => ({ nome: e.nome, material: e.material, valor: e.valor }));
        const tipoLabels = {
          pagamento: "COMPROVANTE DE PAGAMENTO",
          atendimento: "COMPROVANTE DE ATENDIMENTO",
          comparecimento: "COMPROVANTE DE COMPARECIMENTO",
        } as const;
        const comprovanteData = {
          tipo: comprovanteTipo,
          protocolo: protocoloAtual,
          data: dataAtual,
          paciente: { nome: pacienteQuery || "Paciente", cpf, nascimento, idade },
          convenio: convenios[0] || "Particular",
          solicitante: solicitantes[0] || "",
          unidade: unidadeAtiva ? { nome: unidadeAtiva.nome, endereco: unidadeAtiva.endereco, cidade: unidadeAtiva.cidade, estado: unidadeAtiva.estado } : undefined,
          exames: examesData,
          pagamentos: pagamentosRealizados,
          totais: { subtotal, desconto, pago: valorPago, total, saldo: saldoDevedor },
        };
        const html = buildComprovanteHtml(comprovanteData);
        return (
          <Suspense fallback={null}>
          <PdfPreviewDialog
            open={!!comprovanteTipo}
            onClose={() => setComprovanteTipo(null)}
            html={html}
            filename={`comprovante-${comprovanteTipo}-${protocoloAtual}`}
            title={tipoLabels[comprovanteTipo]}
            subtitle={`${protocoloAtual} · ${dataAtual}`}
            whatsappPhone={telefone}
            buildWhatsappMessage={(url) => {
              const linkLine = url ? `📎 *PDF:* ${url}` : "📎 O PDF foi baixado — anexe o arquivo a esta conversa.";
              return [
                `📋 *${tipoLabels[comprovanteTipo]}*`,
                `Protocolo: *${protocoloAtual}*`,
                `Data: ${dataAtual}`,
                "",
                `Olá *${pacienteQuery || "Paciente"}*, segue seu comprovante.`,
                "",
                linkLine,
              ].join("\n");
            }}
          />
          </Suspense>
        );
      })()}
      {avaliacaoIAOpen && (
      <Suspense fallback={null}>
      <AvaliacaoIADialog
        open={avaliacaoIAOpen}
        onOpenChange={setAvaliacaoIAOpen}
        onAddExame={handleAddExameIA}
        examesAtuais={exames.map(e => e.nome)}
        sexo={selectedPaciente?.sexo}
        idade={
          selectedPaciente?.dataNascimento
            ? formatIdadeDetalhada(selectedPaciente.dataNascimento)
            : selectedPaciente?.idade
        }
        historicoExames={(() => {
          if (!selectedPaciente?.nome) return [];
          const ats = getAtendimentos()
            .filter(a => a.nome === selectedPaciente.nome)
            .slice(0, 10);
          const set = new Set<string>();
          ats.forEach(a => (a.exames || []).forEach(ex => set.add(ex)));
          return Array.from(set).slice(0, 30);
        })()}
        catalogoDisponivel={(() => {
          try {
            return getExamesCatalogo()
              .filter(e => e.ativo !== false)
              .map(e => e.nome)
              .slice(0, 400);
          } catch {
            return availableExames.map(e => e.nome).slice(0, 400);
          }
        })()}
      />
      </Suspense>
      )}

      {leituraReqOpen && (
      <Suspense fallback={null}>
      <LeituraRequisicaoDialog
        open={leituraReqOpen}
        onOpenChange={setLeituraReqOpen}
        examesAtuais={exames.map(e => e.nome)}
        solicitantes={solicitantes}
        catalogoDisponivel={(() => {
          try {
            return getExamesCatalogo()
              .filter(e => e.ativo !== false)
              .map(e => e.nome)
              .slice(0, 600);
          } catch {
            return availableExames.map(e => e.nome).slice(0, 600);
          }
        })()}
        onAddExame={(nome: string, opts?: AddExameLeituraOptions) => {
          const tpl = availableExames.find(e => e.nome.toLowerCase() === nome.toLowerCase());
          if (!tpl) {
            toast({ title: "Exame indisponível", description: `"${nome}" não está nas tabelas de preço configuradas.`, variant: "destructive" });
            return;
          }
          const before = exames.length;
          addExame(tpl);
          // Atribui o solicitante após inserção (timeout para garantir que o estado foi atualizado)
          if (opts?.solicitante) {
            setTimeout(() => {
              setExames(prev => {
                if (prev.length <= before) return prev;
                const last = prev[prev.length - 1];
                if (last.nome.toLowerCase() !== nome.toLowerCase()) return prev;
                return prev.map(e => e.id === last.id ? { ...e, solicitanteExame: opts.solicitante } : e);
              });
            }, 0);
          }
        }}
      />
      </Suspense>
      )}

      {/* Diálogo: confirmar adição de nova amostra do mesmo exame */}
      <AlertDialog
        open={novaAmostraDialog.open}
        onOpenChange={(open) => setNovaAmostraDialog(prev => ({ ...prev, open }))}
      >
        <AlertDialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          <AlertDialogHeader className="px-6 pt-6 pb-4 space-y-2 text-left">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FlaskConical className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <AlertDialogTitle className="text-base font-semibold leading-tight">
                  Adicionar nova amostra?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground mt-1 break-words">
                  O exame <span className="font-medium text-foreground">{novaAmostraDialog.template?.nome}</span> já foi adicionado.
                  Escolha como registrar a nova amostra:
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="px-6 pb-4 space-y-2">
            <button
              type="button"
              onClick={() => {
                if (novaAmostraDialog.template) inserirExameComoAmostra(novaAmostraDialog.template, true);
                setNovaAmostraDialog({ open: false, template: null, fromIA: false });
              }}
              className="w-full text-left rounded-lg border border-border bg-background hover:border-primary hover:bg-primary/5 transition-colors p-3"
            >
              <div className="text-sm font-medium text-foreground">Adicionar e cobrar</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Nova amostra com cobrança normal do exame.
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                if (novaAmostraDialog.template) inserirExameComoAmostra(novaAmostraDialog.template, false);
                setNovaAmostraDialog({ open: false, template: null, fromIA: false });
              }}
              className="w-full text-left rounded-lg border border-border bg-background hover:border-primary hover:bg-primary/5 transition-colors p-3"
            >
              <div className="text-sm font-medium text-foreground">Adicionar sem cobrar</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Recoleta gratuita — não soma ao total.
              </div>
            </button>
          </div>

          <AlertDialogFooter className="px-6 py-3 border-t border-border bg-muted/30 sm:justify-end">
            <AlertDialogCancel className="mt-0">Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Soroteca: diálogo de reutilização de amostra existente */}
      {reuseDialog.open && (
      <Suspense fallback={null}>
      <ReutilizarAmostraDialog
        open={reuseDialog.open}
        amostras={reuseDialog.amostras}
        exameNome={reuseDialog.template?.nome ?? ""}
        onReutilizar={(amostraId) => {
          // Reutiliza: marca soroteca e adiciona o exame SEM cobrar coleta extra (valor 0)
          if (reuseDialog.template) {
            inserirExameComoAmostra(reuseDialog.template, false);
            // Vincula a amostra de forma assíncrona — o atendimento_exame ainda não
            // existe no banco neste ponto; o vínculo final é feito após persistência.
            // Aqui apenas marcamos a intenção em sessionStorage para uso posterior.
            try {
              const key = "soroteca:pending-reuse";
              const list = JSON.parse(sessionStorage.getItem(key) || "[]");
              list.push({ amostraId, exameNome: reuseDialog.template.nome, ts: Date.now() });
              sessionStorage.setItem(key, JSON.stringify(list));
            } catch { /* noop */ }
            void reutilizarAmostra;
            toast({ title: "Amostra reutilizada", description: "Coleta dispensada — material já disponível." });
          }
          setReuseDialog({ open: false, amostras: [], template: null });
        }}
        onNovaColeta={() => {
          if (reuseDialog.template) inserirExameComoAmostra(reuseDialog.template, true);
          setReuseDialog({ open: false, amostras: [], template: null });
        }}
        onCancel={() => setReuseDialog({ open: false, amostras: [], template: null })}
      />
      </Suspense>
      )}

      {cadastroPacienteOpen && (
        <Suspense fallback={null}>
          <CadastroPacienteDialog open={cadastroPacienteOpen} onClose={() => setCadastroPacienteOpen(false)} initialName={pacienteQuery} />
        </Suspense>
      )}
      <ResultadoPopup
        open={successOpen}
        onOpenChange={open => { setSuccessOpen(open); if (!open) navigate("/atendimentos"); }}
        variant="success"
        title={isEditing ? "Atendimento atualizado!" : "Pedido realizado!"}
        description={isEditing ? "As alterações foram salvas." : `O atendimento foi registrado com sucesso.${lastProtocolo ? ` Protocolo: ${lastProtocolo}` : ""}${lastGuiaNumero ? ` • Guia: ${lastGuiaNumero}` : ""}`}
        children={
          !isEditing && lastEtiquetasTotal > 0 ? (
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-left">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Printer className="h-3.5 w-3.5 text-primary" />
                <span>
                  {lastEtiquetasTotal} {lastEtiquetasTotal === 1 ? "etiqueta será gerada" : "etiquetas serão geradas"} na coleta
                </span>
              </div>
              {lastEtiquetasTerc > 0 && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Inclui <span className="font-semibold text-foreground">{lastEtiquetasTerc}</span> de laboratório de apoio.
                </div>
              )}
              <div className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                A impressão das etiquetas ocorre apenas após registrar a coleta — o código de barras só é gerado nesse momento.
              </div>
            </div>
          ) : undefined
        }
        footer={
          <div className="flex gap-3 w-full">
            {lastHadTerceirizados && lastProtocolo && (
              <button
                onClick={() => {
                  setSuccessOpen(false);
                  navigate(`/registrar-coleta?protocolo=${encodeURIComponent(lastProtocolo)}`);
                }}
                className="flex-1 py-2.5 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center justify-center gap-2"
                title="Imprimir etiquetas com destino do laboratório de apoio"
              >
                <Printer className="h-4 w-4" />
                Ir para coleta
              </button>
            )}
            {!isEditing && (
              <button
                onClick={() => { setSuccessOpen(false); navigate("/atendimentos/novo", { replace: true }); window.location.reload(); }}
                className={`flex-1 py-2.5 rounded-2xl text-sm font-semibold transition-colors ${lastHadTerceirizados && lastProtocolo ? "border border-border/60 text-foreground hover:bg-accent" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
              >
                Novo atendimento
              </button>
            )}
            <button
              onClick={() => { setSuccessOpen(false); navigate("/atendimentos"); }}
              className="flex-1 py-2.5 rounded-2xl text-sm font-medium border border-border/60 text-foreground hover:bg-accent transition-colors"
            >
              Ver atendimentos
            </button>
          </div>
        }
      />

      {/* Orcamento Confirmation */}
      <AlertDialog open={orcamentoConfirmOpen} onOpenChange={setOrcamentoConfirmOpen}>
        <AlertDialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          <AlertDialogHeader className="px-6 pt-6 pb-4 space-y-2 text-left">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <AlertDialogTitle className="text-base font-semibold leading-tight">
                  Enviar para orçamento?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground mt-1">
                  O orçamento será salvo e o PDF será gerado automaticamente em uma nova aba.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="px-6 py-3 border-t border-border bg-muted/30 sm:justify-end gap-2">
            <AlertDialogCancel className="mt-0">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setOrcamentoConfirmOpen(false); criarOrcamento(); }}
              className="mt-0"
            >
              Confirmar envio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Orcamento Success */}
      <StandardDialog
        open={orcamentoSuccessOpen}
        onClose={() => { setOrcamentoSuccessOpen(false); navigate("/orcamentos"); }}
        icon={<CheckCircle2 className="h-5 w-5 text-primary" />}
        title="Orçamento enviado!"
        subtitle={`Código: ${orcamentoId} — ${new Date().toLocaleDateString("pt-BR")}`}
        maxWidth="lg"
      >
          <div className="space-y-4 px-6 py-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Paciente</p>
                <p className="text-sm text-foreground mt-0.5">{pacienteQuery || "Paciente"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Convênio</p>
                <p className="text-sm text-foreground mt-0.5">{convenios[0] || "Particular"}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Exames ({exames.length})</p>
              <div className="border border-border/60 rounded-2xl divide-y divide-border/60 max-h-32 overflow-y-auto">
                {exames.map((e, i) => (
                  <div key={i} className="px-4 py-2.5 text-sm text-foreground">{e.nome}</div>
                ))}
              </div>
            </div>
            <div className="border border-border/60 rounded-2xl p-4 bg-primary/5 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold text-foreground">{fmtBRL(subtotal)}</span>
              </div>
              {desconto > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Desconto</span>
                  <span className="font-semibold text-[hsl(var(--status-success))]">- {fmtBRL(desconto)}</span>
                </div>
              )}
              <div className="border-t border-border/60 pt-2 flex justify-between text-base font-bold">
                <span className="text-foreground">Total</span>
                <span className="text-foreground">{fmtBRL(total)}</span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => setOrcamentoPreviewOpen(true)}
                className="w-full py-3 rounded-2xl text-sm font-semibold text-primary-foreground bg-primary hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <Printer className="h-4 w-4" />
                Pré-visualizar PDF
              </button>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setOrcamentoSuccessOpen(false); navigate("/orcamentos"); }}
                  className="flex-1 py-2.5 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Ver orçamentos
                </button>
                <button
                  onClick={() => { setOrcamentoSuccessOpen(false); navigate("/atendimentos/novo", { replace: true }); window.location.reload(); }}
                  className="flex-1 py-2.5 rounded-2xl text-sm font-medium border border-border/60 text-foreground hover:bg-accent transition-colors"
                >
                  Novo atendimento
                </button>
              </div>
            </div>
          </div>
      </StandardDialog>

      {orcamentoPreviewOpen && (() => {
        const orcData = {
          id: orcamentoId,
          data: new Date().toLocaleDateString("pt-BR"),
          paciente: pacienteQuery || "Paciente",
          convenio: convenios[0] || "Particular",
          solicitante: solicitantes[0] || undefined,
          exames: exames.map(e => e.nome),
          subtotal,
          desconto,
          total,
        };
        return (
          <Suspense fallback={null}>
          <PdfPreviewDialog
            open={orcamentoPreviewOpen}
            onClose={() => setOrcamentoPreviewOpen(false)}
            html={buildOrcamentoHtmlPublic(orcData)}
            filename={`orcamento-${orcData.id}`}
            title={`Orçamento ${orcData.id}`}
            subtitle={`${orcData.paciente} · ${orcData.data}`}
            buildWhatsappMessage={(url) => {
              const examesList = orcData.exames.map((e, i) => `  ${i + 1}. ${e}`).join("\n");
              const linkLine = url ? `📎 *PDF:* ${url}` : "📎 O PDF foi baixado — anexe o arquivo a esta conversa.";
              return [
                `📋 *ORÇAMENTO ${orcData.id}*`,
                "",
                `Olá *${orcData.paciente}*, segue o orçamento solicitado:`,
                "",
                `🏥 Convênio: ${orcData.convenio}`,
                orcData.solicitante ? `👨‍⚕️ Solicitante: ${orcData.solicitante}` : "",
                "",
                `🔬 *Exames (${orcData.exames.length}):*`,
                examesList,
                "",
                `💰 *Total: R$ ${fmtBRLNumber(orcData.total)}*`,
                "",
                linkLine,
              ].filter(Boolean).join("\n");
            }}
          />
          </Suspense>
        );
      })()}
    </div>
  );
};

export default NovoAtendimento;
