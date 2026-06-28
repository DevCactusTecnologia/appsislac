import { useState, useMemo, useCallback, useEffect, Fragment } from "react";
import { searchNormalize } from "@/lib/utils";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Search, Printer, Edit, Calendar, ClipboardList, CheckCircle2, AlertCircle, Download, User, ChevronRight, FlaskConical, ArrowLeft, AlertOctagon, AlertTriangle, ArrowDown, ArrowUp, Save, ShieldCheck } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import PacienteHeaderCard, { type PacienteHeaderAction } from "@/components/operacional/PacienteHeaderCard";
import MaisAcoesMenu from "@/components/resultado/MaisAcoesMenu";
import ExameAcoesMenu from "@/components/resultado/ExameAcoesMenu";
import { getValueRangeStatus } from "@/components/ResultadoValidationBar";
import ResultadoPopup from "@/components/ResultadoPopup";
import CelebracaoLiberacaoDialog from "@/components/CelebracaoLiberacaoDialog";
import AuditoriaPanel from "@/components/AuditoriaPanel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { resolverReferencia, getValoresReferencia, subscribeValoresReferencia, _initValoresReferenciaStore } from "@/data/valoresReferenciaStore";
import { getExamesCatalogo } from "@/data/exameCatalogoStore";
import { sanitizeHtmlForPrint } from "@/lib/sanitizeHtml";
import { printHtmlInHiddenFrame } from "@/lib/printHtml";
import { getLabConfig } from "@/data/labConfigStore";
import { getLabsApoio } from "@/data/labApoioStore";
import { getAtendimentoExamesDB, updateAtendimentoExame, getAtendimentos, fetchAtendimentoByProtocolo, type AtendimentoExameRow } from "@/data/atendimentoStore";
import { isFeatureEnabled } from "@/lib/featureFlags";
import type { MockAtendimento } from "@/data/types";
import { loadParametros, getParametros, type ExameParametro } from "@/data/exameParametrosStore";
import { avaliarCritico, type NivelCritico } from "@/domains/result/services/criticoChecker";
import { registrarLiberacaoCritica } from "@/lib/criticoAudit";
import {
  hidratarSegmentosParaDigitacao,
  buildResultadosByChave,
  type DigitacaoSegmento,
} from "@/lib/layoutScientificRuntime";
import { getLayouts } from "@/data/exameLayoutsStore";
import LayoutScientificFormRenderer from "./ResultadoDetalhe/LayoutScientificFormRenderer";
import ExamesTerceirizadosPanel from "@/components/ExamesTerceirizadosPanel";
import LabBadge from "@/components/LabBadge";
import IntegrationStatusBadge from "@/components/IntegrationStatusBadge";
import IntegrationWarningsList from "@/components/IntegrationWarningsList";
import { resolveIntegrationWarnings } from "@/lib/integration/integrationStatus";
import SolicitarRecoletaDialog from "@/components/SolicitarRecoletaDialog";
import RegistrarCriticoDialog from "@/components/rastreabilidade/RegistrarCriticoDialog";
import RegistrarEntregaDialog from "@/components/rastreabilidade/RegistrarEntregaDialog";
import { renderExameComLayout, preloadLayoutsParaExames } from "@/lib/laudoLayout";
import { resolveResultadoRegulatorio, renderRegulatorioFooterHtml } from "@/lib/regulatorioResolver";


import { renderCabecalhoPadrao, renderRodapePadrao } from "@/lib/documentoRenderer";
import { showError } from "@/lib/showError";
import { fireSuccessConfetti } from "@/lib/confetti";
import { notifyResultadoPronto } from "@/lib/whatsapp/notifyResultadoPronto";
import WhatsappActionButton from "@/components/whatsapp/WhatsappActionButton";
import { validarCredenciaisAnalista } from "@/lib/validarCredenciaisAnalista";
import { useDicionario } from "@/hooks/useDicionario";

// Tipos, helpers puros e ParamTypedInput foram extraídos para ./ResultadoDetalhe/*
// na Fase 3 do slicing estrutural. Comportamento idêntico, apenas reorganização.
import type { ExameStatus, Parametro, Exame, Paciente, DbIdMap } from "./ResultadoDetalhe/types";
import { statusExameMap } from "./ResultadoDetalhe/types";
import { ParamTypedInput } from "./ResultadoDetalhe/ParamTypedInput";
import { buildValuesByChave, evaluateFormula } from "./ResultadoDetalhe/formula";
import {
  templatesParametrosLegado,
  isoToBR,
  calcIdadeAnosMeses,
  STATUS_DB_TO_UI,
  statusDbToUi,
  getEmptyPaciente,
  buildExamesFromDB,
  deriveStatusGeral,
  buildPacienteFromAtendimento,
} from "./ResultadoDetalhe/helpers";
import { buildLaudoHtml as buildLaudoHtmlPure } from "./ResultadoDetalhe/services/laudoHtmlBuilder";
import {
  avaliarNivelCriticoPure,
  getParametrosCriticosDoExamePure,
} from "./ResultadoDetalhe/services/criticoPipeline";
import { buildAuditLogFromDb } from "./ResultadoDetalhe/services/auditLogBuilder";
import {
  statusAnaliseLabel,
  isExameLiberadoStatus,
  isExameBloqueadoStatus,
  statusGeralType,
} from "./ResultadoDetalhe/statusHelpers";

const getMnemonico = (nome: string): string => {
  const cat = getExamesCatalogo().find((c) => c.nome === nome);
  return (cat?.mnemonico || nome.slice(0, 6)).toUpperCase();
};

const ResultadoDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission, user: authUser } = useAuth();
  // Modo consulta: rotas canônica `/resultados/:id/consulta` e legada
  // `/consultar-resultado/:id` (redirecionada) renderizam tudo somente leitura
  // (sem salvar, liberar, recoletar ou cancelar análise). Usado pela página
  // /resultados/consulta — voltada para conferência e impressão de laudos.
  const modoConsulta =
    location.pathname.startsWith("/consultar-resultado/") ||
    /^\/resultados\/[^/]+\/consulta\/?$/.test(location.pathname);
  // RBAC visual — backend revalida via trigger BEFORE UPDATE em atendimento_exames.
  // Em modo consulta, todas as ações já são desabilitadas; aqui ajustamos as ações
  // mutativas conforme o perfil do usuário (analista pode liberar/retificar; recepção,
  // por exemplo, vê o detalhe mas não libera nada).
  const canLiberar = hasPermission("liberar_resultado") || hasPermission("editar_atendimento");
  const canAnalisar = hasPermission("analisar_amostra") || hasPermission("editar_atendimento");
  const canCancelarExame = hasPermission("cancelar_atendimento") || hasPermission("editar_atendimento");
  const [paciente, setPaciente] = useState<Paciente>(getEmptyPaciente);
  const [pacienteJejum, setPacienteJejum] = useState<boolean>(false);
  // `isHydrating` cobre o intervalo entre o mount e a primeira hidratação
  // do atendimento vindo do banco. Sem ele a tela exibia momentaneamente o
  // estado vazio ("Nenhum exame nesse filtro" / "Selecione um exame na lista").
  const [isHydrating, setIsHydrating] = useState(true);
  const [dbRows, setDbRows] = useState<AtendimentoExameRow[]>([]);
  const [dbIdMap, setDbIdMap] = useState<DbIdMap>({});
  const [layoutHtmlByExameId, setLayoutHtmlByExameId] = useState<Record<string, string>>({});
  const [selectedExameId, setSelectedExameId] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [retificando, setRetificando] = useState(false);
  const [showRetificarDialog, setShowRetificarDialog] = useState(false);
  const [retificarJustificativa, setRetificarJustificativa] = useState("");
  const [showSalvoPopup, setShowSalvoPopup] = useState(false);
  const [showLiberadoPopup, setShowLiberadoPopup] = useState(false);
  const [showCancelarDialog, setShowCancelarDialog] = useState(false);
  const [showImportarDialog, setShowImportarDialog] = useState(false);
  const [showConfirmarLiberar, setShowConfirmarLiberar] = useState(false);
  const [showRecoletaDialog, setShowRecoletaDialog] = useState(false);
  const [showCriticoDialog, setShowCriticoDialog] = useState(false);
  const [showEntregaDialog, setShowEntregaDialog] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [showAuditoria, setShowAuditoria] = useState(false);
  const [showAlterarAnalista, setShowAlterarAnalista] = useState(false);
  const [analistaEmail, setAnalistaEmail] = useState("");
  const [analistaSenha, setAnalistaSenha] = useState("");
  const [analistaErro, setAnalistaErro] = useState("");
  const [analistaValidando, setAnalistaValidando] = useState(false);
  const [analistaAtual, setAnalistaAtual] = useState({ nome: "Felipe Andrade Melo", iniciais: "FA" });
  const [assinaturaLaudo, setAssinaturaLaudo] = useState<{ tipo: "carimbo" | "imagem"; conselho: string | null; url: string | null }>({ tipo: "carimbo", conselho: null, url: null });
  useEffect(() => {
    const uid = authUser?.id;
    if (!uid || typeof uid !== "string") return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("profiles")
        .select("assinatura_tipo,assinatura_imagem_key,assinatura_conselho")
        .eq("user_id", uid).maybeSingle();
      if (cancelled || !data) return;
      const p = data as { assinatura_tipo?: string; assinatura_imagem_key?: string | null; assinatura_conselho?: string | null };
      const tipo: "carimbo" | "imagem" = p.assinatura_tipo === "imagem" ? "imagem" : "carimbo";
      let url: string | null = null;
      if (tipo === "imagem" && p.assinatura_imagem_key) {
        const r = await supabase.functions.invoke("assinatura-url", { body: { userId: uid } });
        url = (r.data as { url?: string | null } | null)?.url ?? null;
      }
      if (!cancelled) setAssinaturaLaudo({ tipo, conselho: p.assinatura_conselho ?? null, url });
    })();
    return () => { cancelled = true; };
  }, [authUser?.id]);
  const [retificados, setRetificados] = useState<Set<number>>(new Set());
  // Snapshot dos valores ANTES da retificação — usado para detectar se houve
  // alteração efetiva ao salvar. Se o usuário entrar em modo de retificação e
  // salvar sem alterar nenhum valor, o sistema NÃO grava como retificado.
  const [valoresAntesRetificacao, setValoresAntesRetificacao] = useState<
    Record<number, Array<{ chave: string; rotulo: string; valor: string }>>
  >({});
  // Re-render quando o store de valores de referência hidratar (assíncrono).
  // Sem isso, o primeiro render acontece com VR vazio e nunca recalcula a
  // resolução por sexo/idade — mesmo após o store popular.
  const [vrTick, setVrTick] = useState(0);
  useEffect(() => {
    if (getValoresReferencia().length === 0) {
      void _initValoresReferenciaStore();
    } else {
      setVrTick((t) => t + 1);
    }
    return subscribeValoresReferencia(() => setVrTick((t) => t + 1));
  }, []);
  const [statusAnterior, setStatusAnterior] = useState<Record<number, ExameStatus>>({});
  const [auditLog, setAuditLog] = useState<Record<number, { acao: string; dataHora: string; usuario: string; iniciais: string; dados?: string }[]>>({});
  const [statusFilter, setStatusFilter] = useState<"todos" | "pendentes" | "salvos" | "liberados" | "cancelados">("todos");
  const [showCelebracao, setShowCelebracao] = useState(false);
  const [liberandoTodos, setLiberandoTodos] = useState(false);

  // ── Impressão por solicitante ──
  // Quando o atendimento tem mais de um solicitante, perguntamos se o usuário
  // quer imprimir uma única cópia (todos os exames juntos) ou uma cópia por
  // solicitante (cada cópia contém apenas os exames pedidos por aquele médico).
  const [printDialog, setPrintDialog] = useState<{
    open: boolean;
    action: "imprimir" | "pdf";
    exames: Exame[];
    solicitantes: string[];
  }>({ open: false, action: "imprimir", exames: [], solicitantes: [] });

  // ── Resultados Críticos (Fase 2/3) ──
  // Cache de parâmetros configurados (com critico_min/max) por nome de exame.
  const [parametrosConfigPorExame, setParametrosConfigPorExame] = useState<Record<string, ExameParametro[]>>({});
  // Modal de confirmação obrigatória ao liberar resultado crítico
  const [showCriticoConfirm, setShowCriticoConfirm] = useState(false);
  const [criticoConfirmDados, setCriticoConfirmDados] = useState<{
    exameId: number;
    exameNome: string;
    parametrosCriticos: Array<{ nome: string; valor: string; nivel: NivelCritico }>;
  } | null>(null);
  const [criticoConduta, setCriticoConduta] = useState("");
  const [criticoNotificou, setCriticoNotificou] = useState(false);
  const [criticoRevisado, setCriticoRevisado] = useState(false);

  // Carrega exames do Supabase ao montar / quando o protocolo muda.
  const reloadExames = useCallback(async () => {
    if (!id) return;
    // Branch USE_LEGACY_STORE: cai no caminho antigo (cache global).
    // Caminho novo: hidrata o atendimento por protocolo direto do banco.
    const useLegacy = isFeatureEnabled("USE_LEGACY_STORE");
    const flagOn = isFeatureEnabled("paginated_atendimentos");
    // IMPORTANTE: fetchAtendimentoByProtocolo precisa rodar ANTES de
    // getAtendimentoExamesDB para popular `cache.idByProtocolo`.
    // Caso contrário, navegação direta (URL) retorna [] e a tela fica vazia.
    const atFromDb = !useLegacy
      ? await fetchAtendimentoByProtocolo(id)
      : (flagOn ? await fetchAtendimentoByProtocolo(id) : null);
    const rows = await getAtendimentoExamesDB(id);
    setDbRows(rows);
    // Inclui INTERNOS + TERCEIRIZADOS na lista lateral. Os terceirizados
    // são renderizados em modo somente-leitura (painel de apoio) ao serem
    // selecionados, mas aparecem como itens normais da lista.
    //
    // ── Pipeline LayoutScientificRuntime ─────────────────────────────────
    // Para cada row interna, hidratamos os parâmetros REAIS (do layout
    // padrão) com seus valores atuais. Auto-seed garante que todo exame
    // tenha um layout. Terceirizados não passam por essa pipeline (são
    // renderizados pelo painel de apoio).
    const segmentosPorRowId: Record<number, DigitacaoSegmento[]> = {};
    const layoutHtmlMap: Record<string, string> = {};
    await Promise.all(
      rows.map(async (row) => {
        if (row.tipo_processo === "TERCEIRIZADO") return;
        if (!row.exame_id) return;
        const cached = getParametros(row.exame_id);
        const parametros = cached.length > 0 ? cached : await loadParametros(row.exame_id);
        try {
          const segs = await hidratarSegmentosParaDigitacao(
            row.exame_id,
            row.nome_exame,
            parametros,
            (row.resultados as Record<string, unknown> | null) ?? null,
          );
          segmentosPorRowId[row.id] = segs;
          // Captura o HTML do layout padrão (já garantido pelo auto-seed
          // dentro de `hidratarSegmentosParaDigitacao`).
          const layouts = getLayouts(row.exame_id);
          const padrao = layouts.find((l) => l.padrao) ?? layouts[0];
          if (padrao?.conteudo) {
            layoutHtmlMap[row.exame_id] = padrao.conteudo;
          }
        } catch (err) {
          // Silencioso: cai no fallback degenerado de buildExamesFromDB.
          if (import.meta.env.DEV) console.warn("[ResultadoDetalhe] hidratacao falhou", err);
        }
      }),
    );
    setLayoutHtmlByExameId(layoutHtmlMap);
    const { exames, idMap } = buildExamesFromDB(rows, segmentosPorRowId);
    const pac = buildPacienteFromAtendimento(id, exames, atFromDb);
    pac.idade = calcIdadeAnosMeses(pac.nascimento);
    // Resolve sexo/nascimento direto da tabela `pacientes` (atendimento não
    // carrega sexo). Sem isso, o resolver de VR cai sempre no default
    // "Masculino" e ignora a faixa correta por sexo+idade.
    try {
      const cpfDigits = (pac.cpf || "").replace(/\D/g, "");
      let pacRow: { sexo?: string | null; data_nascimento?: string | null } | null = null;
      if (cpfDigits) {
        const { data } = await supabase
          .from("pacientes")
          .select("sexo, data_nascimento")
          .eq("cpf", cpfDigits)
          .maybeSingle();
        pacRow = data;
      }
      if (!pacRow) {
        const { data } = await supabase
          .from("atendimentos")
          .select("pacientes:paciente_id(sexo, data_nascimento)")
          .eq("protocolo", id)
          .maybeSingle();
          pacRow = (data as { pacientes?: { sexo?: string | null; data_nascimento?: string | null } } | null)?.pacientes ?? null;
      }
      if (pacRow?.sexo) {
        pac.sexo = pacRow.sexo === "M" ? "Masculino" : pacRow.sexo === "F" ? "Feminino" : pacRow.sexo;
      }
      if (!pac.nascimento && pacRow?.data_nascimento) {
        pac.nascimento = pacRow.data_nascimento;
        pac.idade = calcIdadeAnosMeses(pac.nascimento);
      }
    } catch {
      // silencioso — mantém defaults se a busca falhar
    }
    setPaciente(pac);
    setPacienteJejum(!!atFromDb?.jejum);
    setDbIdMap(idMap);
    setSelectedExameId(prev => prev || (exames[0]?.id ?? 0));

    // Hidrata estado de retificação a partir do banco (fonte de verdade).
    // - retificados: marca todos os exames com flag persistida.
    // - retificando: ativa modo edição quando há retificado em aberto
    //   (status != finalizado/cancelado) — sobrevive a reload da página.
    {
      const novosRetificados = new Set<number>();
      let temEmCurso = false;
      Object.entries(idMap).forEach(([uiIdStr, dbId]) => {
        const r = rows.find((rr) => rr.id === dbId);
        if (r?.retificado) {
          novosRetificados.add(Number(uiIdStr));
          if (r.status !== "finalizado" && r.status !== "cancelado") {
            temEmCurso = true;
          }
        }
      });
      setRetificados(novosRetificados);
      setRetificando(temEmCurso);
    }

    // Reconstrói o log a partir do estado vindo do banco, preservando hora/minuto/segundo.
    const log = buildAuditLogFromDb(rows, exames, idMap);
    setAuditLog(log);
    setIsHydrating(false);
  }, [id]);

  useEffect(() => {
    reloadExames();
  }, [reloadExames]);

  // Hidrata motivos de cancelamento via dicionário unificado (`select_options`).
  const { data: motivosCancelamentoOpts = [] } = useDicionario("motivo_cancelamento", { ativosOnly: true });

  /**
   * Carrega os parâmetros configurados (com critico_min/max) de cada exame
   * presente na lista. Necessário para o motor de detecção crítica.
   */
  useEffect(() => {
    if (paciente.exames.length === 0) return;
    const catalogo = getExamesCatalogo();
    const nomes = Array.from(new Set(paciente.exames.map(e => e.nome)));
    let cancel = false;
    (async () => {
      const map: Record<string, ExameParametro[]> = {};
      for (const nome of nomes) {
        const cat = catalogo.find(c => c.nome === nome);
        if (!cat) continue;
        const cached = getParametros(cat.id);
        const params = cached.length > 0 ? cached : await loadParametros(cat.id);
        map[nome] = params;
      }
      if (!cancel) setParametrosConfigPorExame(map);
    })();
    return () => { cancel = true; };
  }, [paciente.exames]);

  // Avaliação de críticos — pipeline puro extraído para services/criticoPipeline.ts.
  // Fase 1 — Críticos por sexo/idade: passa override que consulta valores_referencia
  // (critico_min/critico_max) usando sexo+idade do paciente. Fallback automático
  // para o crítico padrão de exame_parametros quando override vazio.
  const criticoOverride = useCallback(
    (exameNome: string, paramNome: string) => {
      const r = resolverReferencia(exameNome, paramNome, paciente.sexo, paciente.idade, false, pacienteJejum);
      if (!r) return undefined;
      return { criticoMin: r.criticoMin, criticoMax: r.criticoMax };
    },
    [paciente.sexo, paciente.idade, pacienteJejum],
  );

  const avaliarNivelCritico = useCallback(
    (exameNome: string, paramNome: string, valor: string): NivelCritico =>
      avaliarNivelCriticoPure(parametrosConfigPorExame, exameNome, paramNome, valor, criticoOverride),
    [parametrosConfigPorExame, criticoOverride],
  );
  const getParametrosCriticosDoExame = useCallback(
    (exame: { nome: string; parametros: Array<{ nome: string; valor: string }> } | undefined) =>
      getParametrosCriticosDoExamePure(parametrosConfigPorExame, exame, criticoOverride),
    [parametrosConfigPorExame, criticoOverride],
  );

  const addAuditEntry = (exameId: number, acao: string, dados?: string) => {
    const now = new Date();
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const dataHora = `${String(now.getDate()).padStart(2, "0")} de ${meses[now.getMonth()]} de ${now.getFullYear()} - ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    setAuditLog((prev) => ({
      ...prev,
      [exameId]: [...(prev[exameId] || []), { acao, dataHora, usuario: analistaAtual.nome, iniciais: analistaAtual.iniciais, dados }],
    }));
  };

  const selectedExame = paciente.exames.find((e) => e.id === selectedExameId);

  // Check if exam is terceirizada (sent to support lab).
  // A página de resultado deve respeitar o destino salvo no atendimento,
  // não o destino padrão do catálogo — o mesmo exame pode ser solicitado como INTERNO.
  const isExameTerceirizadaById = (uiId: number): boolean => {
    const dbId = dbIdMap[uiId];
    const row = dbRows.find(r => r.id === dbId);
    if (row?.tipo_processo === "TERCEIRIZADO") return true;
    return false;
  };

  const getLabNome = (uiId: number): string => {
    const dbId = dbIdMap[uiId];
    const row = dbRows.find(r => r.id === dbId);
    if (row?.tipo_processo !== "TERCEIRIZADO" || !row.lab_apoio_id) return "";
    const labs = getLabsApoio();
    const lab = labs.find(l => l.id === row.lab_apoio_id);
    return lab?.nome || "";
  };

  const selectedIsTerceirizada = selectedExame
    ? isExameTerceirizadaById(selectedExame.id)
    : false;

  // Resolve reference values from the shared store based on patient sex/age
  const getResolvedRef = (exameNome: string, param: Parametro) => {
    // VRs podem estar indexados por CHAVE (canônico, ex.: "HEMACI") ou por
    // RÓTULO legado (ex.: "Hemácias"). Tenta chave primeiro, depois rótulo/nome.
    const resolved =
      (param.chave
        ? resolverReferencia(exameNome, param.chave, paciente.sexo, paciente.idade, false, pacienteJejum)
        : null) ||
      resolverReferencia(exameNome, param.nome, paciente.sexo, paciente.idade, false, pacienteJejum) ||
      (param.rotulo
        ? resolverReferencia(exameNome, param.rotulo, paciente.sexo, paciente.idade, false, pacienteJejum)
        : null);
    if (resolved) return resolved;
    // Parâmetros do tipo Formula: a expressão fica em `param.formula`
    // (coluna dedicada). O `valor_referencia` agora é texto descritivo
    // como nos demais tipos. Para retro-compat, se ainda houver fórmula
    // legada armazenada em `valor_referencia` (contém `##CHAVE##`),
    // não exibimos como descrição clínica.
    if (param.tipo === "Formula") {
      const vr = param.valorReferencia ?? "";
      const looksLikeLegacyFormula = /##[^#]+##/.test(vr);
      return {
        refMin: "",
        refMax: "",
        refUnidade: "",
        descricao: looksLikeLegacyFormula ? "" : vr,
      };
    }
    return {
      refMin: param.refMin,
      refMax: param.refMax,
      refUnidade: param.refUnidade,
      descricao: param.valorReferencia ?? "",
    };
  };



  const matchesStatusFilter = (e: Exame): boolean => {
    if (statusFilter === "todos") return true;
    if (statusFilter === "pendentes") return e.status === "Pendente";
    if (statusFilter === "salvos") return e.status === "Resultado salvo" || e.status === "Em retificação";
    if (statusFilter === "liberados") return e.status === "Digitado" || e.status === "Impresso" || e.status === "Retificado";
    if (statusFilter === "cancelados") return e.status === "Cancelado";
    return true;
  };

  const filteredExames = paciente.exames.filter((e) => {
    const q = searchNormalize(searchQuery);
    const matchesQ = !q || searchNormalize(e.nome).includes(q) || searchNormalize(getMnemonico(e.nome)).includes(q);
    return matchesQ && matchesStatusFilter(e);
  });

  // Counters & next-pendente helper for smart navigation
  const counters = useMemo(() => {
    const c = { total: paciente.exames.length, pendentes: 0, salvos: 0, liberados: 0, cancelados: 0 };
    paciente.exames.forEach((e) => {
      if (e.status === "Pendente") c.pendentes++;
      else if (e.status === "Resultado salvo" || e.status === "Em retificação") c.salvos++;
      else if (e.status === "Digitado" || e.status === "Impresso" || e.status === "Retificado") c.liberados++;
      else if (e.status === "Cancelado") c.cancelados++;
    });
    return c;
  }, [paciente.exames]);

  const concluidos = counters.liberados + counters.cancelados;
  const progresso = counters.total > 0 ? Math.round((concluidos / counters.total) * 100) : 0;
  const podeImprimirTodos = paciente.exames.some(
    (e) => e.status === "Digitado" || e.status === "Impresso" || e.status === "Retificado",
  );

  const goToNextPendente = () => {
    const idx = paciente.exames.findIndex((e) => e.id === selectedExameId);
    const ordered = [
      ...paciente.exames.slice(idx + 1),
      ...paciente.exames.slice(0, idx + 1),
    ];
    const next = ordered.find((e) => e.status === "Pendente");
    if (next) setSelectedExameId(next.id);
    else toast.info("Não há mais exames pendentes.");
  };


  const calcStatusGeral = (exames: Exame[]): string => {
    if (exames.some((e) => e.status === "Em retificação")) return "Em Retificação";
    const allCanceled = exames.every((e) => e.status === "Cancelado");
    const allDone = exames.every((e) => e.status === "Digitado" || e.status === "Impresso" || e.status === "Retificado" || e.status === "Cancelado");
    const hasRetificado = exames.some((e) => e.status === "Retificado");
    const hasAtLeastOneLiberated = exames.some((e) => e.status === "Digitado" || e.status === "Impresso" || e.status === "Retificado");
    if (allCanceled) return "Cancelado";
    if (allDone && hasRetificado) return "Retificado";
    if (allDone && hasAtLeastOneLiberated) return "Finalizado";
    return "Pendente";
  };

  const updatePacienteExames = (updater: (exames: Exame[]) => Exame[]) => {
    setPaciente((prev) => {
      const newExames = updater(prev.exames);
      return { ...prev, exames: newExames, statusGeral: calcStatusGeral(newExames) };
    });
  };

  const updateParametro = (exameId: number, paramIndex: number, valor: string) => {
    setPaciente((prev) => ({
      ...prev,
      exames: prev.exames.map((e) =>
        e.id === exameId
          ? { ...e, parametros: e.parametros.map((p, i) => (i === paramIndex ? { ...p, valor } : p)) }
          : e
      ),
    }));
  };

  // Persiste valores dos parâmetros no jsonb e marca exame como "em_analise" (UI: "Resultado salvo").
  const handleSalvar = async () => {
    if (!selectedExame) return;
    const dbId = dbIdMap[selectedExameId];
    if (!dbId) {
      toast.error("Exame não encontrado no banco.");
      return;
    }
    // 🔒 Validação de obrigatórios — não salva enquanto algum campo
    // marcado como obrigatório estiver vazio. Parâmetros do tipo "Formula"
    // são derivados e ficam fora da exigência.
    const obrigFaltando = selectedExame.parametros
      .filter((p) => p.obrigatorio && p.tipo !== "Formula")
      .filter((p) => !(p.valor && String(p.valor).trim().length > 0))
      .map((p) => p.rotulo || p.nome);
    if (obrigFaltando.length > 0) {
      toast.error("Preencha os campos obrigatórios para salvar o resultado.", {
        description: obrigFaltando.slice(0, 6).join(", ") + (obrigFaltando.length > 6 ? "…" : ""),
      });
      return;
    }
    const dadosParams = selectedExame.parametros.map((p) => `${p.nome}: ${p.valor || "—"}`).join("\n");

    // LayoutScientificRuntime: jsonb canônico indexado por CHAVE do parâmetro.
    // Resultados antigos (indexados por nome) continuam legíveis via dual-read
    // em `readParametroValor`.
    const resultadosJson = buildResultadosByChave(
      selectedExame.parametros.map((p) => ({ chave: p.chave, rotulo: p.rotulo, nome: p.nome })),
      selectedExame.parametros.map((p) => p.valor || ""),
    );

    // 🔎 Em modo retificação: compara os valores atuais com o snapshot tirado
    // ao iniciar a retificação. Se nada mudou, aborta o save (não grava como
    // retificado). Caso contrário, monta texto de auditoria com o "antes → depois".
    let diffsRetificacao: Array<{ rotulo: string; antes: string; depois: string }> = [];
    if (retificando) {
      const snap = valoresAntesRetificacao[selectedExameId] ?? [];
      const snapByKey = new Map(snap.map((s) => [s.chave || s.rotulo, s]));
      diffsRetificacao = selectedExame.parametros
        .map((p) => {
          const key = p.chave || p.nome;
          const antes = (snapByKey.get(key)?.valor ?? "").trim();
          const depois = (p.valor ?? "").trim();
          return { rotulo: p.rotulo || p.nome, antes, depois };
        })
        .filter((d) => d.antes !== d.depois);
      if (diffsRetificacao.length === 0) {
        toast.warning("Nenhuma alteração detectada — o resultado não foi salvo como retificado.", {
          description: "Altere ao menos um valor para concluir a retificação.",
        });
        return;
      }
    }

    const res = await updateAtendimentoExame(dbId, {
      status: "em_analise",
      resultados: resultadosJson,
      data_analise: new Date().toISOString(),
      // Preserva (idempotente) a flag de retificação durante saves
      // intermediários — garante que status_atendimento permaneça
      // "Em Retificação" e que a hidratação após reload mantenha edição liberada.
      ...(retificando ? { retificado: true } : {}),
    });
    if (!res.ok) {
      toast.error("Falha ao salvar: " + (res.error ?? "erro desconhecido"));
      return;
    }
    updatePacienteExames((exames) =>
      exames.map((e) => e.id === selectedExameId ? { ...e, status: "Resultado salvo" } : e)
    );
    if (retificando) {
      setRetificados((prev) => new Set(prev).add(selectedExameId));
      const diffText = diffsRetificacao
        .map((d) => `• ${d.rotulo}: "${d.antes || "—"}" → "${d.depois || "—"}"`)
        .join("\n");
      addAuditEntry(
        selectedExameId,
        "Resultado salvo (após retificação)",
        `Alterações (${diffsRetificacao.length}):\n${diffText}\n\nValores finais:\n${dadosParams}`,
      );
      // Limpa snapshot — próxima retificação tira novo snapshot.
      setValoresAntesRetificacao((prev) => {
        const next = { ...prev };
        delete next[selectedExameId];
        return next;
      });
    } else {
      addAuditEntry(selectedExameId, "Resultado salvo", dadosParams);
    }
    setRetificando(false);

    // Após salvar, apenas mostra o popup informativo. A celebração com confettis
    // só dispara quando TODOS os exames forem liberados (assinados).
    setShowSalvoPopup(true);
  };

  // Libera (assina) → status "finalizado" no banco; trigger atualiza status_atendimento.
  const handleAnalisarLiberar = async () => {
    if (!selectedExame) return;
    const dbId = dbIdMap[selectedExameId];
    if (!dbId) {
      toast.error("Exame não encontrado no banco.");
      return;
    }
    // 🔒 Bloqueio: contagem diferencial da série branca DEVE totalizar 100%.
    const contParam = selectedExame.parametros.find(
      (p) => (p.chave ?? "").toUpperCase() === "CONT",
    );
    if (contParam) {
      const valuesByChave = buildValuesByChave(selectedExame.parametros);
      const contValor = contParam.tipo === "Formula"
        ? evaluateFormula(contParam.formula || contParam.valorReferencia, valuesByChave, contParam.casasDecimais ?? 0)
        : contParam.valor;
      const contN = parseFloat((contValor || "").replace(",", "."));
      if (!isFinite(contN) || contN !== 100) {
        toast.error("A soma da contagem diferencial da série branca deve totalizar 100%.", {
          description: isFinite(contN) ? `Total atual: ${contN}%` : "Contagem incompleta.",
        });
        return;
      }
    }
    // 🚨 Se houver parâmetros com valores críticos, abre modal de confirmação.
    const criticos = getParametrosCriticosDoExame(selectedExame);
    if (criticos.length > 0 && !criticoConfirmDados) {
      setCriticoConfirmDados({
        exameId: selectedExameId,
        exameNome: selectedExame.nome,
        parametrosCriticos: criticos,
      });
      setCriticoConduta("");
      setCriticoNotificou(false);
      setCriticoRevisado(false);
      setShowCriticoConfirm(true);
      return;
    }
    await executarLiberacao(dbId);
  };

  /** Persistência efetiva da liberação (chamada direta ou após confirmar crítico). */
  const executarLiberacao = async (dbId: number) => {
    if (!selectedExame) return;
    if (!dbId) {
      toast.error("Exame não encontrado no banco.");
      return;
    }
    const res = await updateAtendimentoExame(dbId, {
      status: "finalizado",
      data_liberacao: new Date().toISOString(),
      analista: analistaAtual.nome,
    });
    if (!res.ok) {
      toast.error("Falha ao liberar: " + (res.error ?? "erro desconhecido"));
      return;
    }
    updatePacienteExames((exames) =>
      exames.map((e) => e.id === selectedExameId ? { ...e, status: retificados.has(e.id) ? "Retificado" : "Digitado" } : e)
    );
    addAuditEntry(selectedExameId, "Resultado liberado");

    // Verifica se este era o ÚLTIMO exame não-liberado/cancelado.
    // Se sim, dispara celebração com confettis. Caso contrário, popup simples.
    const naoLiberadosRestantes = paciente.exames.filter(
      (e) =>
        e.id !== selectedExameId &&
          !isExameLiberado(e.status) &&
        e.status !== "Cancelado",
    ).length;
    if (naoLiberadosRestantes === 0) {
      fireSuccessConfetti();
      setShowCelebracao(true);
      // WhatsApp 2.0 — Fase 3E: avisa o paciente que o resultado está pronto.
      // Server-side aplica opt-out, rate limit, isolamento por tenant e auditoria.
      void notifyResultadoPronto({ protocolo: paciente.protocolo });
    } else {
      setShowLiberadoPopup(true);
    }
  };

  // Libera (assina) TODOS os exames salvos/em retificação de uma só vez.
  // P0 #1 — exames com parâmetros críticos NÃO podem ser liberados em lote:
  // exigem confirmação individual (conduta + notificação médica) via CriticoConfirm.
  const handleLiberarTodos = async () => {
    const liberaveis = paciente.exames.filter((e) => e.status === "Resultado salvo" || e.status === "Em retificação");
    if (liberaveis.length === 0) {
      toast.info("Não há resultados salvos para liberar.");
      return;
    }

    // 🔒 Bloqueio: contagem diferencial (CONT) ≠ 100 invalida liberação em lote.
    const contInvalidos: typeof liberaveis = [];
    // Separa críticos × seguros usando o MESMO avaliador do fluxo unitário.
    const criticosNoLote: typeof liberaveis = [];
    const seguros: typeof liberaveis = [];
    for (const ex of liberaveis) {
      const contParam = ex.parametros.find((p) => (p.chave ?? "").toUpperCase() === "CONT");
      if (contParam) {
        const vbc = buildValuesByChave(ex.parametros);
        const cv = contParam.tipo === "Formula"
          ? evaluateFormula(contParam.formula || contParam.valorReferencia, vbc, contParam.casasDecimais ?? 0)
          : contParam.valor;
        const cn = parseFloat((cv || "").replace(",", "."));
        if (!isFinite(cn) || cn !== 100) {
          contInvalidos.push(ex);
          continue;
        }
      }
      const criticos = getParametrosCriticosDoExame(ex);
      if (criticos.length > 0) criticosNoLote.push(ex);
      else seguros.push(ex);
    }

    if (contInvalidos.length > 0) {
      toast.error("A soma da contagem diferencial da série branca deve totalizar 100%.", {
        description: `${contInvalidos.length} exame(s) com diferencial incompleto/excedido.`,
      });
      setSelectedExameId(contInvalidos[0].id);
      return;
    }

    if (criticosNoLote.length > 0) {
      // Bloqueia o lote e direciona o analista para o primeiro crítico.
      const primeiro = criticosNoLote[0];
      toast.warning(
        `${criticosNoLote.length} exame(s) com valores críticos precisam ser liberados individualmente (conduta médica obrigatória).`,
      );
      setSelectedExameId(primeiro.id);
      return;
    }

    setLiberandoTodos(true);
    const dataLib = new Date().toISOString();
    let okCount = 0;
    let failCount = 0;
    for (const exame of seguros) {
      const dbId = dbIdMap[exame.id];
      if (!dbId) { failCount++; continue; }
      const res = await updateAtendimentoExame(dbId, {
        status: "finalizado",
        data_liberacao: dataLib,
        analista: analistaAtual.nome,
      });
      if (res.ok) {
        okCount++;
        // P0 #1 — auditoria individual por exame (não em bloco)
        addAuditEntry(exame.id, "Resultado liberado (lote validado sem críticos)");
      } else {
        failCount++;
      }
    }
    updatePacienteExames((exames) =>
      exames.map((e) =>
        (e.status === "Resultado salvo" || e.status === "Em retificação") &&
          seguros.some((s) => s.id === e.id)
          ? { ...e, status: retificados.has(e.id) ? "Retificado" : "Digitado" }
          : e,
      ),
    );
    setLiberandoTodos(false);
    if (failCount === 0) {
      const naoLiberados = paciente.exames.filter(
        (e) => e.status !== "Cancelado" && !seguros.some((l) => l.id === e.id),
      ).length;
      if (naoLiberados === 0) {
        fireSuccessConfetti();
        setShowCelebracao(true);
        // WhatsApp 2.0 — Fase 3E: notifica o paciente após liberação em lote.
        void notifyResultadoPronto({ protocolo: paciente.protocolo });
      } else {
        setShowCelebracao(false);
        toast.success(`${okCount} resultado${okCount > 1 ? "s" : ""} liberado${okCount > 1 ? "s" : ""} com sucesso.`);
      }
    } else {
      setShowCelebracao(false);
      toast.warning(`${okCount} liberado(s), ${failCount} com falha.`);
    }
  };

  const auditoriaAmostras = paciente.exames.map((exame) => ({
    nome: exame.nome,
    registros: auditLog[exame.id] || [],
  }));

  // Fase 3E.1 — envio manual do "Resultado pronto" pelo operador.
  // Disponível quando o atendimento já está finalizado. Server-side aplica
  // opt-out, rate limit, isolamento por tenant e idempotência.
  const todosLiberados = paciente.exames.length > 0 && paciente.exames.every(
    (e) => isExameLiberadoStatus(e.status) || e.status === "Cancelado",
  );
  const handleEnviarResultadoWhatsapp = async () => {
    const r = await notifyResultadoPronto({ protocolo: paciente.protocolo, force: true });
    if (r.ok) toast.success("Aviso de resultado enviado ao paciente.");
    else if (r.reason === "telefone_invalido") toast.error("Paciente sem telefone válido.");
    else if (r.reason === "paciente_sem_cadastro") toast.error("Paciente sem cadastro completo.");
    else toast.error("Não foi possível enviar.", { description: r.reason });
  };


  const handleCancelarAnalise = () => {
    setShowCancelarDialog(true);
  };

  /** Após registrar a recoleta, reverte o exame para "Pendente" (volta para coleta). */
  const handleRecoletaConfirmed = async () => {
    if (!selectedExame) return;
    const dbId = dbIdMap[selectedExameId];
    if (!dbId) {
      toast.error("Exame não encontrado no banco.");
      return;
    }
    const res = await updateAtendimentoExame(dbId, {
      status: "coletado",
      data_analise: null,
      data_liberacao: null,
      motivo_cancelamento: null,
    });
    if (!res.ok) {
      toast.error("Falha ao reverter exame para nova coleta.");
      return;
    }
    updatePacienteExames((exames) =>
      exames.map((e) => e.id === selectedExameId ? { ...e, status: "Pendente" as ExameStatus } : e)
    );
    addAuditEntry(selectedExameId, "Recoleta solicitada — exame revertido para nova coleta");
    toast.success("Recoleta registrada e exame revertido para coleta.");
  };

  const confirmCancelar = async () => {
    if (!selectedExame || !motivoCancelamento) return;
    const dbId = dbIdMap[selectedExameId];
    if (!dbId) {
      toast.error("Exame não encontrado no banco.");
      return;
    }
    const res = await updateAtendimentoExame(dbId, {
      status: "cancelado",
      motivo_cancelamento: motivoCancelamento,
    });
    if (!res.ok) {
      toast.error("Falha ao cancelar: " + (res.error ?? "erro desconhecido"));
      return;
    }
    updatePacienteExames((exames) =>
      exames.map((e) => e.id === selectedExameId ? { ...e, status: "Cancelado" as ExameStatus } : e)
    );
    addAuditEntry(selectedExameId, "Análise cancelada", `Motivo: ${motivoCancelamento}`);
    setShowCancelarDialog(false);
    setMotivoCancelamento("");
    toast.info("Análise cancelada.");
  };

  // statusAnaliseLabel / isExameLiberado / isExameBloqueado / statusGeralType
  // foram extraídos para ./ResultadoDetalhe/statusHelpers.ts (Fase 1).
  const isExameLiberado = isExameLiberadoStatus;
  const isExameBloqueado = isExameBloqueadoStatus;

  const isBlocked = selectedExame ? isExameBloqueado(selectedExame.status) : false;
  const isEditable = !isBlocked || selectedExame?.status === "Em retificação";
  const canPrint = (status: ExameStatus) => isExameLiberado(status);

  /**
   * Monta o HTML do laudo. Para cada exame, usa o HTML renderizado a partir
   * do Layout Científico (em `customByExame`). Se não houver, cai na tabela
   * padrão hardcoded — fallback de emergência mantido por retro-compat.
   *
   * NOTE: corpo movido para ./ResultadoDetalhe/services/laudoHtmlBuilder.ts
   * (extração mecânica — Fase 1 do Architectural Split Program).
   * O layout/CSS de impressão permanece CONGELADO (constraint travada).
   */
  const buildLaudoHtml = useCallback(
    (
      printable: Exame[],
      customByExame?: Record<number, string>,
      solicitanteLabel?: string,
      pageMargins?: { top: number; right: number; bottom: number; left: number },
    ) =>
      buildLaudoHtmlPure({
        paciente,
        analistaAtual,
        assinaturaLaudo,
        getResolvedRef,
        printable,
        customByExame,
        solicitanteLabel,
        pageMargins,
      }),
    [paciente, analistaAtual, assinaturaLaudo, getResolvedRef],
  );

  /**
   * Para cada exame "printable", tenta renderizar usando o layout padrão
   * cadastrado em exame_layouts. Devolve um mapa { exameId → htmlCustom }
   * contendo apenas os exames que de fato têm layout cadastrado.
   */
  const resolveCustomLayouts = useCallback(async (printable: Exame[]): Promise<{ map: Record<number, string>; margins: { top: number; right: number; bottom: number; left: number } }> => {
    await preloadLayoutsParaExames(printable.map((e) => e.nome));
    // Formata "Data Coleta: DD/MM/AAAA às HH:MM:SS" priorizando a data/hora real
    // de coleta da amostra (atendimento_exames.data_coleta). Fallback: data de
    // análise; em último caso, a data de cadastro do atendimento (sem hora).
    const fmtDataColeta = (exame: Exame): string => {
      const iso = exame.dataColetaISO || exame.dataAnaliseISO || null;
      if (iso) {
        const d = new Date(iso);
        if (!Number.isNaN(d.getTime())) {
          const data = d.toLocaleDateString("pt-BR");
          const hora = d.toLocaleTimeString("pt-BR", { hour12: false });
          return `Data Coleta: ${data} às ${hora}`;
        }
      }
      const cadastro = (paciente.dataCadastro || "").trim();
      return cadastro ? `Data Coleta: ${cadastro}` : "";
    };
    const entries = await Promise.all(
      printable.map(async (exame) => {
        const resultados: Record<string, string> = {};
        // Valores digitados (para resolver placeholders das fórmulas)
        const valuesByChave = buildValuesByChave(exame.parametros);
        exame.parametros.forEach((p) => {
          let v = p.valor || "";
          // Parâmetros do tipo Fórmula: substituir pelo resultado calculado
          if (p.tipo === "Formula") {
            const isCont = (p.chave ?? "").toUpperCase() === "CONT";
            v = evaluateFormula(
              p.formula || p.valorReferencia,
              valuesByChave,
              p.casasDecimais ?? 2,
              isCont,
            );
          } else if (p.tipo === "Select") {
            v = v.toUpperCase();
          }
          // Indexa por nome, rótulo, chave e abreviação (dual-read tolerante)
          if (p.nome) resultados[p.nome] = v;
          if (p.rotulo) resultados[p.rotulo] = v;
          if (p.chave) resultados[p.chave] = v;
          const abrev = (p as { abreviacao?: string }).abreviacao;
          if (abrev) resultados[abrev] = v;
        });
        const { html, margins } = await renderExameComLayout(
          exame.nome,
          resultados,
          paciente.sexo,
          paciente.idade,
          {
            nome: paciente.nome,
            nascimento: isoToBR(paciente.nascimento),
            cpf: paciente.cpf,
            protocolo: paciente.protocolo,
          },
          fmtDataColeta(exame),
        );
        return { id: exame.id, html, margins };
      })
    );
    const map: Record<number, string> = {};
    let pageMargins = { top: 4, right: 11, bottom: 4, left: 11 };
    for (const entry of entries) {
      if (entry.html) {
        map[entry.id] = entry.html;
        pageMargins = entry.margins;
      }
    }
    return { map, margins: pageMargins };
  }, [paciente.sexo, paciente.idade, paciente.nome, paciente.nascimento, paciente.cpf, paciente.protocolo, paciente.dataCadastro]);


  const markAsImpresso = (printable: Exame[]) => {
    updatePacienteExames((all) =>
      all.map((e) => printable.some((p) => p.id === e.id) && e.status === "Digitado" ? { ...e, status: "Impresso" as ExameStatus } : e)
    );
    printable.forEach((e) => {
      if (e.status === "Digitado") addAuditEntry(e.id, "Impresso");
    });
  };

  /** Lista de solicitantes distintos presentes nos exames informados (ignora vazios = "todos"). */
  const distintosSolicitantes = (lista: Exame[]): string[] => {
    const set = new Set<string>();
    lista.forEach((e) => {
      const s = (e.solicitante || "").trim();
      if (s) set.add(s);
    });
    return Array.from(set);
  };

  /**
   * Impressão vetorial nativa do laudo via iframe oculto.
   *
   * Fluxo único: monta o HTML, injeta auto-print, renderiza em iframe
   * escondido na própria aba e dispara `window.print()`. Sem nova aba,
   * sem Paged.js, sem travar a aba original. Esse é o caminho que sempre
   * funcionou — Paged.js / rota `/resultado/:id/print` foram REMOVIDOS.
   */
  const doImprimirLaudo = async (
    printable: Exame[],
    solicitanteLabel?: string,
  ) => {
    const safeNome = (paciente.nome || "Paciente").replace(/[\\/:*?"<>|]+/g, " ").trim();
    const title = `${safeNome} - ${paciente.protocolo}${solicitanteLabel ? ` - ${solicitanteLabel}` : ""}`;

    const t0 = performance.now();
    const { map: customByExame, margins } = await resolveCustomLayouts(printable);
    const html = buildLaudoHtml(printable, customByExame, solicitanteLabel, margins);

    const paginationHook = `
<script>
  (function(){
    window.__lovableBeforePrint = async function(){
      try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}
      await new Promise(function(resolve){ requestAnimationFrame(function(){ requestAnimationFrame(resolve); }); });

      var margins = ${JSON.stringify(margins)};
      var pageWidthMm = 210 - Number(margins.left || 0) - Number(margins.right || 0);
      document.documentElement.style.width = pageWidthMm + 'mm';
      document.body.style.width = pageWidthMm + 'mm';

      var probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;visibility:hidden;left:-1000mm;top:0;width:100mm;height:0;overflow:hidden;';
      document.body.appendChild(probe);
      var pxPerMm = probe.getBoundingClientRect().width / 100;
      probe.remove();
      if (!pxPerMm || !isFinite(pxPerMm)) return;

      var header = document.querySelector('table.laudo-a4-page > thead');
      var headerPx = header ? header.getBoundingClientRect().height : 0;
      var footerReservePx = 32 * pxPerMm;
      var safeGapPx = 3 * pxPerMm;
      var availablePx = (297 - Number(margins.top || 0) - Number(margins.bottom || 0)) * pxPerMm - headerPx - footerReservePx - safeGapPx;
      if (!availablePx || availablePx < 200) return;

      var sourceTable = document.querySelector('table.laudo-a4-page');
      var sourceContent = document.querySelector('#laudo-content');
      if (!sourceTable || !sourceContent) return;
      var blocks = Array.prototype.slice.call(sourceContent.children).filter(function(el){
        return el.classList && (el.classList.contains('exame-bloco') || el.classList.contains('assinatura-bloco'));
      });
      var outerHeight = function(el) {
        var rect = el.getBoundingClientRect();
        var cs = window.getComputedStyle(el);
        return rect.height + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
      };

      var pages = [];
      var current = [];
      var used = 0;
      blocks.forEach(function(block){
        var h = outerHeight(block);
        if (current.length > 0 && used + h > availablePx) {
          pages.push(current);
          current = [];
          used = 0;
        }
        current.push(block);
        used += h;
        if (h > availablePx && current.length === 1) {
          pages.push(current);
          current = [];
          used = 0;
        }
      });
      if (current.length) pages.push(current);
      if (pages.length <= 1) {
        document.documentElement.setAttribute('data-laudo-paginated', 'single');
        return;
      }

      var buildPage = function(){
        var table = sourceTable.cloneNode(false);
        table.classList.add('laudo-page-manual');
        table.style.breakInside = 'avoid';
        table.style.pageBreakInside = 'avoid';
        if (header) table.appendChild(header.cloneNode(true));
        var tbody = document.createElement('tbody');
        var tr = document.createElement('tr');
        var td = document.createElement('td');
        var corpo = document.createElement('div');
        corpo.className = 'laudo-a4-corpo';
        var content = document.createElement('div');
        content.id = 'laudo-content';
        content.setAttribute('style', sourceContent.getAttribute('style') || '');
        corpo.appendChild(content);
        td.appendChild(corpo);
        tr.appendChild(td);
        tbody.appendChild(tr);
        table.appendChild(tbody);
        return { table: table, content: content };
      };

      var wrapper = document.createElement('div');
      wrapper.className = 'laudo-pages-manual';
      pages.forEach(function(pageBlocks, pageIndex){
        var page = buildPage();
        page.table.style.breakAfter = pageIndex < pages.length - 1 ? 'page' : 'auto';
        page.table.style.pageBreakAfter = pageIndex < pages.length - 1 ? 'always' : 'auto';
        pageBlocks.forEach(function(block){
          block.style.breakBefore = '';
          block.style.pageBreakBefore = '';
          page.content.appendChild(block);
        });
        wrapper.appendChild(page.table);
      });
      sourceTable.replaceWith(wrapper);
      document.documentElement.setAttribute('data-laudo-pages', String(pages.length));
      document.documentElement.setAttribute('data-laudo-paginated', 'true');
    };
  })();
</script>`;

    const injected = `${sanitizeHtmlForPrint(html)}${paginationHook}`;
    printHtmlInHiddenFrame({ html: injected, documentTitle: title });
    const t1 = performance.now();
    // eslint-disable-next-line no-console
    console.info(
      `[PDF Vetorial] HTML renderizado em ${(t1 - t0).toFixed(0)}ms — exames=${printable.length}`,
    );
  };


  /**
   * Executa a impressão/exportação de fato. Quando `modo === 'porSolicitante'`,
   * gera uma cópia para cada solicitante distinto (apenas com seus exames).
   * Exames sem solicitante definido são incluídos em todas as cópias.
   */
  const executarImpressao = async (
    action: "imprimir" | "pdf",
    printable: Exame[],
    modo: "unica" | "porSolicitante",
  ) => {
    if (modo === "unica") {
      try {
        // Impressão via iframe oculto (sem abrir nova aba, sem travar o navegador).
        await doImprimirLaudo(printable, undefined);
        markAsImpresso(printable);
        toast.success(
          action === "imprimir"
            ? `Laudo enviado para impressão (${printable.length} exame(s)).`
            : `Laudo aberto — use "Salvar como PDF" no diálogo de impressão (${printable.length} exame(s)).`,
        );
      } catch {
        toast.error("Erro ao gerar laudo.");
      }
      return;
    }
    const solicitantes = distintosSolicitantes(printable);
    const comuns = printable.filter((e) => !(e.solicitante || "").trim());
    let geradas = 0;
    for (const sol of solicitantes) {
      const subset = printable.filter((e) => (e.solicitante || "").trim() === sol).concat(comuns);
      if (subset.length === 0) continue;
      try {
        await doImprimirLaudo(subset, sol);
        geradas += 1;
      } catch {
        toast.error(`Falha ao gerar laudo para ${sol}.`);
      }
    }
    if (geradas > 0) {
      markAsImpresso(printable);
      toast.success(
        action === "imprimir"
          ? `${geradas} laudo(s) abertos para impressão (um por solicitante).`
          : `${geradas} laudo(s) abertos — use "Salvar como PDF" no diálogo (um por solicitante).`,
      );
    }
  };

  const iniciarImpressao = async (action: "imprimir" | "pdf", exames: Exame[]) => {
    const printable = exames.filter((e) => canPrint(e.status));
    if (printable.length === 0) {
      toast.warning(
        action === "imprimir"
          ? "Nenhum exame disponível para impressão. Apenas exames com status 'Digitado' ou 'Impresso' podem ser impressos."
          : "Nenhum exame disponível para exportação. Apenas exames com status 'Digitado' ou 'Impresso' podem ser exportados.",
      );
      return;
    }
    const sols = distintosSolicitantes(printable);
    if (sols.length > 1) {
      // Mais de um solicitante: pergunta ao usuário como deseja imprimir.
      setPrintDialog({ open: true, action, exames: printable, solicitantes: sols });
      return;
    }
    await executarImpressao(action, printable, "unica");
  };

  const handleImprimir = (exames: Exame[]) => iniciarImpressao("imprimir", exames);
  const handleExportPDF = (exames: Exame[]) => iniciarImpressao("pdf", exames);

  // 🤖 Bridge para o Assistente SISLAC.
  // Expõe ações desta tela em window.__sislacResultado enquanto a página estiver montada.
  useEffect(() => {
    const findIdx = (termo: string) => {
      if (!selectedExame) return -1;
      const n = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const t = n(termo);
      return selectedExame.parametros.findIndex(
        (p) => n(p.chave || "") === t || n(p.rotulo || "") === t || n(p.nome || "") === t ||
               n(p.rotulo || "").includes(t) || n(p.nome || "").includes(t),
      );
    };
    (window as any).__sislacResultado = {
      setValor: (parametro: string, valor: string) => {
        if (!selectedExame) return { ok: false, msg: "Nenhum exame selecionado" };
        const idx = findIdx(parametro);
        if (idx < 0) return { ok: false, msg: `Parâmetro "${parametro}" não encontrado` };
        updateParametro(selectedExame.id, idx, String(valor));
        return { ok: true, msg: `${parametro} = ${valor}` };
      },
      setVarios: (pares: string) => {
        if (!selectedExame) return { ok: false, msg: "Nenhum exame selecionado" };
        const items = pares.split(/[;\n]+/).map((s) => s.trim()).filter(Boolean);
        let ok = 0, fail = 0;
        for (const it of items) {
          const [k, ...rest] = it.split("=");
          const v = rest.join("=").trim();
          const idx = findIdx((k || "").trim());
          if (idx < 0) { fail++; continue; }
          updateParametro(selectedExame.id, idx, v);
          ok++;
        }
        return { ok: true, msg: `${ok} aplicados, ${fail} ignorados` };
      },
      salvar: () => { void handleSalvar(); return { ok: true, msg: "Salvando..." }; },
      liberar: () => { void handleAnalisarLiberar(); return { ok: true, msg: "Liberando..." }; },
      imprimir: () => {
        if (!paciente?.exames?.length) return { ok: false, msg: "Sem exames" };
        handleImprimir(paciente.exames);
        return { ok: true, msg: "Impressão iniciada" };
      },
    };
    return () => { try { delete (window as any).__sislacResultado; } catch {} };
  }, [selectedExame, paciente]);

  return (

    <div className="min-h-screen bg-background">

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 animate-fade-in">
        {/* Back link — strategic contextual breadcrumb */}
        <div className="mb-4">
          <button
            onClick={() => navigate(modoConsulta ? "/resultados/consulta" : "/resultados")}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Voltar para resultados
          </button>
        </div>
        {/* ===== STACKED VIEW (below xl: mobile + tablet + small laptops) ===== */}
        <div className="lg:hidden">
          {/* Patient header — compartilhado, à prova de overflow */}
          <div className="mb-4">
            <PacienteHeaderCard
              nome={paciente.nome}
              sexo={paciente.sexo}
              nascimentoBR={isoToBR(paciente.nascimento)}
              idade={paciente.idade}
              protocolo={paciente.protocolo}
              statusLabel={paciente.statusGeral}
              statusType={statusGeralType(paciente.statusGeral)}
              actionsInline={modoConsulta}
              actions={([
                {
                  key: "imprimir",
                  label: "Imprimir todos",
                  icon: <Printer className="h-4 w-4" />,
                  onClick: () => handleImprimir(paciente.exames),
                  variant: "primary",
                  title: modoConsulta ? "Imprime apenas exames Assinados e Liberados" : undefined,
                  disabled: !podeImprimirTodos,
                },
              ]) as PacienteHeaderAction[]}
              actionsExtraLeft={
                <>
                  <span
                    title={pacienteJejum ? "Paciente em jejum" : "Jejum não informado"}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold ${pacienteJejum ? "bg-status-success/15 text-status-success" : "bg-status-warning/15 text-status-warning"}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${pacienteJejum ? "bg-status-success" : "bg-status-warning"}`} />
                    Jejum: {pacienteJejum ? "Sim" : "Não"}
                  </span>
                  {!modoConsulta && todosLiberados && (
                    <WhatsappActionButton
                      onClick={handleEnviarResultadoWhatsapp}
                      title="Enviar mensagem pelo WhatsApp"
                    />
                  )}
                  <MaisAcoesMenu
                    modoConsulta={modoConsulta}
                    semExameSelecionado={!selectedExame}
                    onAuditoria={() => setShowAuditoria(true)}
                    onCritico={() => setShowCriticoDialog(true)}
                    onEntrega={() => setShowEntregaDialog(true)}
                  />
                </>
              }

            />
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar exame"
              className="pl-10 pr-4 py-2 w-full bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>

          {/* Exam cards */}
          <div className="space-y-2">
            {filteredExames.map((exame) => (
              <div key={exame.id} className="border rounded-xl bg-card overflow-hidden">
                {/* Exam header button */}
                <button
                  onClick={() => setSelectedExameId(selectedExameId === exame.id ? 0 : exame.id)}
                  className={`w-full text-left px-3 py-3 transition-colors ${
                    selectedExameId === exame.id ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold tracking-wider text-primary uppercase font-mono truncate">
                      {getMnemonico(exame.nome)}
                    </span>
                    <StatusBadge label={exame.status} type={statusExameMap[exame.status].type} />
                  </div>
                  {retificados.has(exame.id) && exame.status !== "Em retificação" && exame.status !== "Retificado" && (() => {
                    const dbRow = dbRows.find((r) => r.id === dbIdMap[exame.id]);
                    const emCurso = dbRow ? dbRow.status !== "finalizado" && dbRow.status !== "cancelado" : false;
                    return (
                      <div className={`flex items-center gap-1 mt-1.5 ${emCurso ? "text-status-warning" : "text-status-info"}`}>
                        <AlertCircle className="h-3 w-3" />
                        <span className="text-[10px] font-medium">{emCurso ? "Em retificação" : "Retificado"}</span>
                      </div>
                    );
                  })()}
                </button>
                {selectedExameId === exame.id && isExameLiberado(exame.status) && (
                  <div className="px-3 pb-3 pt-1 border-t bg-accent/40">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleImprimir([exame]); }}
                      className="w-full flex items-center justify-center gap-1.5 h-9 px-3 mt-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                      title="Imprimir este exame"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Imprimir exame
                    </button>
                  </div>
                )}

                {/* Expanded: parameter inputs */}
                {selectedExameId === exame.id && (
                  <div className="border-t px-3 py-3 space-y-3">
                    {isExameTerceirizadaById(exame.id) ? (
                      <ExamesTerceirizadosPanel
                        rows={dbRows.filter(r => r.id === dbIdMap[exame.id])}
                        onChanged={reloadExames}
                      />
                    ) : (
                    <>
                    {/* Exam action buttons */}
                    {!modoConsulta && (() => {
                      const isBlockedExameLocal = isExameBloqueado(exame.status);
                      return (
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <button
                        onClick={() => setShowImportarDialog(true)}
                        className="flex items-center gap-1 px-2.5 py-1.5 border rounded-lg text-xs font-medium text-status-info hover:bg-status-info-bg transition-colors"
                      >
                        Importar
                      </button>
                      <ExameAcoesMenu
                        size="sm"
                        canRetificar={canLiberar && isBlockedExameLocal && !retificando}
                        canCancelar={canCancelarExame}
                        onRetificar={() => setShowRetificarDialog(true)}
                        onRecoleta={() => setShowRecoletaDialog(true)}
                        onCancelarAnalise={handleCancelarAnalise}
                      />
                    </div>
                      );
                    })()}


                    {/* Parameters */}
                    
                    {exame.parametros.map((param, idx) => {
                      const isBlockedExame = isExameBloqueado(exame.status);
                      const isEditableParam = !isBlockedExame || exame.status === "Em retificação";
                      const ref = getResolvedRef(exame.nome, param);
                      const valuesByChave = buildValuesByChave(exame.parametros);
                      const computedFormula = param.tipo === "Formula"
                        ? evaluateFormula(param.formula || param.valorReferencia, valuesByChave, param.casasDecimais ?? 2, (param.chave ?? "").toUpperCase() === "CONT")
                        : "";
                      const displayValor = param.tipo === "Formula" ? computedFormula : param.valor;
                      const rangeStatus = displayValor ? getValueRangeStatus(displayValor, ref.refMin, ref.refMax, ref.refUnidade || param.unidade) : null;
                      const inRange = rangeStatus === null ? null : rangeStatus === "normal";
                      const isOutOfRange = rangeStatus === "below" || rangeStatus === "above";
                      const below = rangeStatus === "below";
                      const above = rangeStatus === "above";


                      // Texto livre (observação, etc.) — não tem referência e
                      // precisa de largura ampla para digitação confortável.
                      const isTextoLivre = !["Select", "Formula", "Número"].includes(param.tipo ?? "");
                      const temReferencia = !!(ref.refMin || ref.refMax || ref.descricao);

                      return (
                        <Fragment key={idx}>
                        {param.headerAntes && !/valor(es)?\s+de\s+refer[êe]ncia/i.test(param.headerAntes) && (
                          <p className="pt-3 pb-1 text-sm font-bold uppercase tracking-wide text-foreground">
                            {param.headerAntes}
                          </p>
                        )}
                        <div className="border-2 rounded-lg p-3 space-y-2 bg-background transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/30 focus-within:bg-primary/5 focus-within:shadow-md">
                          <p className="text-sm font-medium text-foreground">
                            {param.nome}
                            {param.obrigatorio && <span className="text-status-danger ml-0.5">*</span>}
                          </p>
                          <div className="space-y-1.5">
                            {isTextoLivre ? (
                              // Layout em coluna: label em cima, input ocupando 100% da largura.
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-muted-foreground">Resultado</span>
                                {isBlockedExame && !retificando ? (
                                  <div className="rounded-lg px-2.5 py-1.5 bg-accent/50 min-h-[36px]">
                                    {displayValor ? (
                                      <span className="text-sm text-foreground whitespace-pre-line">{displayValor}</span>
                                    ) : (
                                      <span className="text-sm text-muted-foreground italic">—</span>
                                    )}
                                  </div>
                                ) : (
                                  <ParamTypedInput
                                    param={param}
                                    computedValue={computedFormula}
                                    onChange={(v) => updateParametro(exame.id, idx, v)}
                                    disabled={modoConsulta || exame.status === "Cancelado" || !isEditableParam}
                                    className="w-full"
                                  />
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-muted-foreground">Resultado</span>
                                {isBlockedExame && !retificando ? (
                                  <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${isOutOfRange ? "bg-status-danger/10" : "bg-accent/50"}`}>
                                    {inRange === true && <CheckCircle2 className="h-4 w-4 text-status-success" />}
                                    {below && <ArrowDown className="h-4 w-4 text-orange-500" />}
                                    {above && <ArrowUp className="h-4 w-4 text-status-danger" />}
                                     {displayValor ? (
                                      <span className={`text-sm font-bold ${isOutOfRange ? (above ? "text-status-danger" : "text-orange-500") : "text-foreground"}`}>
                                        {param.tipo === "Select" ? displayValor.toUpperCase() : displayValor} <span className="text-muted-foreground font-normal">{param.unidade}</span>
                                      </span>
                                    ) : (
                                      <span className="text-sm text-muted-foreground italic">—</span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 w-full">
                                    {inRange === true && <CheckCircle2 className="h-4 w-4 text-status-success shrink-0" />}
                                    {below && <ArrowDown className="h-4 w-4 text-orange-500 shrink-0" />}
                                    {above && <ArrowUp className="h-4 w-4 text-status-danger shrink-0" />}
                                    <div className="flex-1 min-w-0">
                                      <ParamTypedInput
                                        param={param}
                                        computedValue={computedFormula}
                                        onChange={(v) => updateParametro(exame.id, idx, v)}
                                        disabled={modoConsulta || exame.status === "Cancelado" || !isEditableParam}
                                        className="w-full"
                                      />
                                    </div>
                                    {param.unidade && (
                                      <span className="text-xs text-muted-foreground shrink-0">{param.unidade}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            {/* Linha de referência só aparece se existir VR para este parâmetro. */}
                            {temReferencia && !isTextoLivre && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Referência</span>
                                <div className="text-right">
                                  {(ref.refMin || ref.refMax) ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-accent/50 rounded-lg text-xs text-foreground">
                                      {ref.refMin && ref.refMax
                                        ? `${ref.refMin} - ${ref.refMax}`
                                        : ref.refMin
                                          ? `≥ ${ref.refMin}`
                                          : `≤ ${ref.refMax}`}
                                      <span className="text-muted-foreground ml-0.5">{ref.refUnidade}</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-1 bg-accent/50 rounded-lg text-xs text-foreground whitespace-pre-line">
                                      {ref.descricao}
                                    </span>
                                  )}
                                  {(ref.refMin || ref.refMax) && ref.descricao && (
                                    <p className="text-[10px] text-muted-foreground italic">{ref.descricao}</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        </Fragment>
                      );
                    })}



                    {/* Mobile footer actions — secundárias estão em "Mais ações" no topo */}
                    <div className="flex flex-col gap-3 pt-3 border-t border-border/60">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 border border-status-info/40">
                          <AvatarFallback className="bg-status-info-bg text-status-info text-[10px] font-semibold">
                            {analistaAtual.iniciais}
                          </AvatarFallback>
                        </Avatar>
                        {modoConsulta ? (
                          <span className="text-xs text-foreground">
                            <span className="text-muted-foreground">Analisado e Liberado por:</span>{" "}
                            <span className="font-medium">{analistaAtual.nome}</span>
                          </span>
                        ) : (
                          <>
                            <div className="flex flex-col leading-tight flex-1 min-w-0">
                              <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Analista</span>
                              <span className="text-xs font-medium text-foreground truncate">{analistaAtual.nome}</span>
                            </div>
                            <button
                              onClick={() => { setAnalistaEmail(""); setAnalistaSenha(""); setAnalistaErro(""); setShowAlterarAnalista(true); }}
                              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-2 py-1"
                            >
                              <Edit className="h-3 w-3" />
                              Trocar
                            </button>
                          </>
                        )}
                      </div>
                      {!modoConsulta && (canAnalisar || canLiberar) && (
                      <div className="flex gap-2">
                        {canAnalisar && (
                          <button
                            data-result-nav="true"
                            onClick={handleSalvar}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-lg text-xs font-medium text-foreground border border-border bg-card hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                          >
                            <Save className="h-3.5 w-3.5" />
                            Salvar
                          </button>
                        )}
                        {canLiberar && (exame.status === "Resultado salvo" || exame.status === "Em retificação") && (
                          <button
                            onClick={() => setShowConfirmarLiberar(true)}
                            className="flex-[1.6] inline-flex items-center justify-center gap-1.5 h-10 rounded-lg text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors shadow-sm"
                            title="Disponível somente após salvar o resultado"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Assinar e Liberar
                          </button>
                        )}

                      </div>
                      )}
                    </div>

                    </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>

        {/* ===== DESKTOP SPLIT VIEW (xl and above) ===== */}
        <div className="hidden lg:flex flex-row gap-0 min-h-[calc(100vh-140px)] bg-card rounded-2xl overflow-hidden border border-border/60 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {/* Sidebar — compact, SA-style */}
          <div className="w-60 shrink-0 border-r border-border/60 flex flex-col max-h-[calc(100vh-140px)] bg-muted/10">
              {/* Sidebar header: progress + counters (compact) */}
              <div className="px-3 py-3 border-b border-border/60">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Progresso</span>
                  <span className="text-[11px] font-semibold tabular-nums text-foreground">{concluidos}/{counters.total} · {progresso}%</span>
                </div>
                <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progresso}%` }}
                  />
                </div>
                {counters.pendentes > 0 && (
                  <button
                    onClick={goToNextPendente}
                    className="mt-2.5 w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
                  >
                    Próximo pendente
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="px-3 pt-3 pb-1">
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar exame"
                    className="pl-8 pr-2.5 h-9 w-full bg-card border border-border/60 rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                  />
                </div>

                {/* Status filter chips — uma linha; oculta zerados */}
                <div className="flex gap-1 mb-1 w-full">
                  {([
                    { key: "todos", label: "Todos", count: counters.total },
                    { key: "pendentes", label: "Pend.", count: counters.pendentes },
                    { key: "salvos", label: "Salv.", count: counters.salvos },
                    { key: "liberados", label: "Liber.", count: counters.liberados },
                    { key: "cancelados", label: "Canc.", count: counters.cancelados },
                  ] as const)
                    .filter((f) => f.key === "todos" || f.count > 0 || statusFilter === f.key)
                    .map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setStatusFilter(f.key)}
                      className={`flex-1 min-w-0 px-1 py-1 rounded-md text-[9px] font-semibold uppercase tracking-tight transition-colors whitespace-nowrap ${
                        statusFilter === f.key
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/60 text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {f.label} <span className="opacity-70">{f.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">

                {filteredExames.length === 0 && (
                  isHydrating ? (
                    <div className="space-y-1.5 py-2">
                      {[0,1,2,3,4].map((i) => (
                        <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-xs text-muted-foreground py-8">Nenhum exame nesse filtro.</p>
                  )
                )}
                {filteredExames.map((exame) => {
                  const liberado = isExameLiberado(exame.status);
                  const isSelected = selectedExameId === exame.id;
                  const dbId = dbIdMap[exame.id];
                  const dbRow = dbRows.find((r) => r.id === dbId);
                  const isTerc = isExameTerceirizadaById(exame.id);
                  return (
                  <div
                    key={exame.id}
                    className={`rounded-lg border transition-colors ${
                      isSelected ? "bg-card border-primary/40 shadow-[0_1px_2px_rgba(77,65,243,0.08)]" : "border-transparent hover:bg-accent/50"
                    }`}
                  >
                    <button
                      onClick={() => setSelectedExameId(exame.id)}
                      className="w-full text-left px-2.5 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-extrabold tracking-[0.08em] text-primary uppercase font-mono truncate">
                          {getMnemonico(exame.nome)}
                        </span>
                        <StatusBadge label={exame.status} type={statusExameMap[exame.status].type} />
                      </div>
                      {isTerc && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <LabBadge
                            tipoProcesso="TERCEIRIZADO"
                            labApoioId={dbRow?.lab_apoio_id ?? null}
                            labApoioNome={getLabNome(exame.id) || undefined}
                            compact
                          />
                          <span className="text-[10px] font-medium text-muted-foreground truncate">
                            {getLabNome(exame.id) || "Lab. de apoio"}
                          </span>
                        </div>
                      )}
                      {isTerc && dbRow && dbRow.status_externo !== "NAO_APLICAVEL" && (
                        <div className="mt-1.5">
                          <IntegrationStatusBadge row={dbRow} compact />
                          <IntegrationWarningsList
                            className="mt-1.5"
                            maxVisible={2}
                            warnings={resolveIntegrationWarnings(dbRow, {
                              catalogo: (() => {
                                const c = getExamesCatalogo().find((x) => x.nome === dbRow.nome_exame);
                                return c ? {
                                  tipoProcesso: c.tipoProcesso,
                                  permiteEnvioApoio: c.permiteEnvioApoio,
                                  providerIntegracao: c.providerIntegracao,
                                  codigoExameApoio: c.codigoExameApoio,
                                } : null;
                              })(),
                              awaitingMs: dbRow.data_envio && !dbRow.data_retorno
                                ? Date.now() - new Date(dbRow.data_envio).getTime()
                                : null,
                            })}
                          />
                        </div>
                      )}
                      {retificados.has(exame.id) && exame.status !== "Em retificação" && exame.status !== "Retificado" && (() => {
                        const dbRow = dbRows.find((r) => r.id === dbIdMap[exame.id]);
                        const emCurso = dbRow ? dbRow.status !== "finalizado" && dbRow.status !== "cancelado" : false;
                        return (
                          <div className={`flex items-center gap-1 mt-1.5 ${emCurso ? "text-status-warning" : "text-status-info"}`}>
                            <AlertCircle className="h-3 w-3" />
                            <span className="text-[10px] font-medium">{emCurso ? "Em retificação" : "Retificado"}</span>
                          </div>
                        );
                      })()}
                    </button>
                    {isSelected && liberado && (
                      <div className="px-3 pb-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleImprimir([exame]); }}
                          className="w-full flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                          title="Imprimir este exame"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Imprimir exame
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-muted/30">
            {/* Patient header — componente compartilhado, sem sobreposição */}
            <div className="px-4 sm:px-5 py-3 border-b border-border/60 bg-card">
              <PacienteHeaderCard
                nome={paciente.nome}
                sexo={paciente.sexo}
                nascimentoBR={isoToBR(paciente.nascimento)}
                idade={paciente.idade}
                protocolo={paciente.protocolo}
                statusLabel={paciente.statusGeral}
                statusType={statusGeralType(paciente.statusGeral)}
                actionsInline={modoConsulta}
                actions={([
                  { key: "imprimir", label: "Imprimir todos", icon: <Printer className="h-4 w-4" />, onClick: () => handleImprimir(paciente.exames), variant: "primary", title: modoConsulta ? "Imprime apenas exames Assinados e Liberados" : undefined, disabled: !podeImprimirTodos },
                  
                ]) as PacienteHeaderAction[]}
                actionsExtraLeft={
                  <>
                    <span
                      title={pacienteJejum ? "Paciente em jejum" : "Jejum não informado"}
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold ${pacienteJejum ? "bg-status-success/15 text-status-success" : "bg-status-warning/15 text-status-warning"}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${pacienteJejum ? "bg-status-success" : "bg-status-warning"}`} />
                      Jejum: {pacienteJejum ? "Sim" : "Não"}
                    </span>
                    {!modoConsulta && todosLiberados && (
                      <WhatsappActionButton
                        onClick={handleEnviarResultadoWhatsapp}
                        title="Enviar mensagem pelo WhatsApp"
                      />
                    )}
                    <MaisAcoesMenu
                      modoConsulta={modoConsulta}
                      semExameSelecionado={!selectedExame}
                      onAuditoria={() => setShowAuditoria(true)}
                      onCritico={() => setShowCriticoDialog(true)}
                      onEntrega={() => setShowEntregaDialog(true)}
                    />
                  </>
                }

              />
            </div>


            {/* Exam detail */}
            {selectedExame ? (
              <div className="flex-1 flex flex-col p-4 sm:p-5 overflow-y-auto space-y-4">
                <div className="bg-card rounded-2xl p-5 border border-border/60 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                {/* Exam header */}
                <div className="mb-4">
                  <div className="mb-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <h2 className="text-xl font-bold tracking-tight text-foreground leading-tight uppercase min-w-0 flex-1">
                        {selectedExame.nome}
                      </h2>
                      {!selectedIsTerceirizada && !modoConsulta && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setShowImportarDialog(true)}
                            className="flex items-center justify-center h-9 w-9 border rounded-lg text-status-info hover:bg-status-info-bg transition-colors"
                            title="Importar resultado"
                            aria-label="Importar resultado"
                          >
                            <Download className="h-4 w-4 rotate-180" />
                          </button>
                          <ExameAcoesMenu
                            canRetificar={canLiberar && isBlocked && !retificando}
                            canCancelar={canCancelarExame}
                            onRetificar={() => setShowRetificarDialog(true)}
                            onRecoleta={() => setShowRecoletaDialog(true)}
                            onCancelarAnalise={handleCancelarAnalise}
                          />
                        </div>
                      )}

                    </div>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <StatusBadge
                        label={statusAnaliseLabel(selectedExame.status)}
                        type={statusExameMap[selectedExame.status].type}
                      />
                      {selectedIsTerceirizada && (
                        <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-lg bg-accent text-accent-foreground">
                          Apoio: {getLabNome(selectedExame.id)}
                        </span>
                      )}
                      {retificados.has(selectedExame.id) && selectedExame.status !== "Em retificação" && selectedExame.status !== "Retificado" && (() => {
                        const dbRow = dbRows.find((r) => r.id === dbIdMap[selectedExame.id]);
                        const emCurso = dbRow ? dbRow.status !== "finalizado" && dbRow.status !== "cancelado" : false;
                        return (
                          <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md border ${emCurso ? "text-status-warning bg-status-warning-bg border-status-warning/20" : "text-status-info bg-status-info-bg border-status-info/20"}`}>
                            <AlertCircle className="h-3.5 w-3.5" />
                            {emCurso ? "Em retificação" : "Retificado"}
                          </span>
                        );
                      })()}
                      {(() => {
                        const log = auditLog[selectedExame.id] || [];
                        const relevantes = ["Resultado liberado", "Análise cancelada", "Resultado salvo", "Resultado salvo (após retificação)"];
                        const ultima = [...log].reverse().find((l) => relevantes.some((r) => l.acao.startsWith(r)));
                        if (!ultima) {
                          return selectedExame.dataAnalise ? (
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              {selectedExame.dataAnalise}
                            </span>
                          ) : null;
                        }
                        return (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground" title={ultima.acao}>
                            <Calendar className="h-3.5 w-3.5" />
                            <span className="font-medium text-foreground">{ultima.acao.replace(" (após retificação)", "")}</span>
                            <span>·</span>
                            <span>{ultima.dataHora}</span>
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {selectedIsTerceirizada ? (
                    <ExamesTerceirizadosPanel
                      rows={dbRows.filter(r => r.id === dbIdMap[selectedExame.id])}
                      onChanged={reloadExames}
                    />
                  ) : (
                  <>
                  {/* 🚨 Banner de alerta crítico (Fase 2) */}
                  {(() => {
                    const criticos = getParametrosCriticosDoExame(selectedExame);
                    if (criticos.length === 0) return null;
                    return (
                      <div
                        role="alert"
                        className="mb-4 rounded-xl border-2 border-status-danger/40 bg-status-danger/10 p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-1"
                      >
                        <AlertOctagon className="h-5 w-5 text-status-danger shrink-0 mt-0.5 animate-pulse" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-status-danger">
                            Resultado crítico identificado — confirme antes de liberar
                          </p>
                          <p className="text-xs text-foreground/80 mt-1">
                            {criticos.length} parâmetro(s) com valores fora da faixa de pânico:
                          </p>
                          <ul className="mt-1.5 text-xs text-foreground space-y-0.5">
                            {criticos.map((c) => (
                              <li key={c.nome} className="flex items-center gap-1.5">
                                <span className="font-semibold">{c.nome}:</span>
                                <span className="font-mono font-bold text-status-danger">{c.valor}</span>
                                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-status-danger/20 text-status-danger font-semibold">
                                  {c.nivel === "critico_baixo" ? "PÂNICO BAIXO" : "PÂNICO ALTO"}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <p className="text-[11px] text-muted-foreground mt-2 italic">
                            Verifique a amostra e o equipamento. Será exigida justificativa ao liberar.
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Parameters: layout científico (HTML) em edição/retificação,
                      tabela padrão em consulta/read-only ou quando não houver layout. */}
                  {(() => {
                    const editing = !isBlocked || retificando;
                    const dbRowSel = dbRows.find((r) => r.id === dbIdMap[selectedExame.id]);
                    const exameCatId = dbRowSel?.exame_id ?? null;
                    const layoutHtml = exameCatId ? layoutHtmlByExameId[exameCatId] : "";
                    // Design unificado: todos os exames (incluindo HEMOGRAMA) usam a
                    // mesma tabela em cards (resultado + valor de referência) tanto em
                    // digitação quanto em consulta. O layout científico (CKEditor) é
                    // mantido apenas para impressão/laudo, não para a tela de digitação.
                    void editing; void layoutHtml;
                    // Pareamento %/(absoluto) — pré-processa parâmetros em linhas
                    // onde cada linha pode conter um par "principal" (%) e seu
                    // contraponto "(absoluto)" renderizado em coluna à direita.
                    const isAbsName = (n: string) => /\(\s*abs(oluto)?\s*\)/i.test(n || "");
                    const baseOf = (n: string) =>
                      (n || "")
                        .replace(/\(\s*abs(oluto)?\s*\)/i, "")
                        .replace(/\s+/g, " ")
                        .trim()
                        .toLowerCase();
                    type Param = typeof selectedExame.parametros[number];
                    type Row = { main: Param; mainIdx: number; abs?: Param; absIdx?: number };
                    const rows: Row[] = [];
                    const used = new Set<number>();
                    selectedExame.parametros.forEach((p, i) => {
                      if (used.has(i)) return;
                      if (isAbsName(p.nome)) {
                        rows.push({ main: p, mainIdx: i });
                        used.add(i);
                        return;
                      }
                      const base = baseOf(p.nome);
                      const sibIdx = selectedExame.parametros.findIndex(
                        (q, j) => j > i && !used.has(j) && isAbsName(q.nome) && baseOf(q.nome) === base,
                      );
                      if (sibIdx >= 0) {
                        rows.push({ main: p, mainIdx: i, abs: selectedExame.parametros[sibIdx], absIdx: sibIdx });
                        used.add(i);
                        used.add(sibIdx);
                      } else {
                        rows.push({ main: p, mainIdx: i });
                        used.add(i);
                      }
                    });
                    const hasAnyAbs = rows.some((r) => !!r.abs);

                    const valuesByChave = buildValuesByChave(selectedExame.parametros);

                    const renderResultCard = (param: Param, idx: number) => {
                      const ref = getResolvedRef(selectedExame.nome, param);
                      const computedFormula = param.tipo === "Formula"
                        ? evaluateFormula(param.formula || param.valorReferencia, valuesByChave, param.casasDecimais ?? 2, (param.chave ?? "").toUpperCase() === "CONT")
                        : "";
                      const displayValor = param.tipo === "Formula" ? computedFormula : param.valor;
                      const rangeStatus = displayValor ? getValueRangeStatus(displayValor, ref.refMin, ref.refMax, ref.refUnidade || param.unidade) : null;
                      const inRange = rangeStatus === null ? null : rangeStatus === "normal";
                      const isOutOfRange = rangeStatus === "below" || rangeStatus === "above";
                      const below = rangeStatus === "below";
                      const above = rangeStatus === "above";
                      const nivelCritico = avaliarNivelCritico(selectedExame.nome, param.nome, displayValor);
                      const isCriticoParam = nivelCritico !== "normal";
                      // Status semântico do contador da série branca (CONT):
                      //   = 100 → verde · 99/101 → amarelo · demais → vermelho.
                      const isCont = (param.chave ?? "").toUpperCase() === "CONT";
                      const contN = isCont ? parseFloat((displayValor || "").replace(",", ".")) : NaN;
                      const contStatus: "success" | "warning" | "danger" | undefined = isCont
                        ? (isFinite(contN) && contN === 100
                            ? "success"
                            : isFinite(contN) && (contN === 99 || contN === 101)
                            ? "warning"
                            : "danger")
                        : undefined;
                      const barColorClass = contStatus
                        ? (contStatus === "success" ? "bg-status-success" : contStatus === "warning" ? "bg-status-warning" : "bg-status-danger")
                        : inRange === true
                        ? "bg-status-success"
                        : isOutOfRange
                          ? (above ? "bg-status-danger" : "bg-orange-500")
                          : "bg-transparent";
                      const ringClass = contStatus
                        ? (contStatus === "success" ? "ring-1 ring-status-success/40" : contStatus === "warning" ? "ring-1 ring-status-warning/50" : "ring-1 ring-status-danger/40")
                        : isCriticoParam ? "ring-1 ring-status-danger/30" : "";
                      return (
                        <div className={`relative flex items-center gap-2 pl-3 pr-4 h-9 rounded-lg bg-muted/50 dark:bg-muted/30 transition-all focus-within:bg-primary/10 focus-within:ring-2 focus-within:ring-primary focus-within:shadow-md ${ringClass}`}>

                          <span className="shrink-0 inline-flex items-center justify-center h-4 w-4">
                            {inRange === true && <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />}
                            {below && <ArrowDown className="h-3.5 w-3.5 text-orange-500" />}
                            {above && <ArrowUp className="h-3.5 w-3.5 text-status-danger" />}
                            {inRange === null && <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />}
                          </span>
                          <div className="flex-1 min-w-0 flex items-baseline gap-1.5">
                            {isBlocked && !retificando ? (
                              displayValor ? (
                                <>
                                  <span className={`text-[13px] font-bold tabular-nums ${isOutOfRange ? (above ? "text-status-danger" : "text-orange-500") : "text-foreground"}`}>
                                    {param.tipo === "Select" ? displayValor.toUpperCase() : displayValor}
                                  </span>
                                  <span className="text-xs text-muted-foreground">{param.unidade}</span>
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">—</span>
                              )
                            ) : (
                              <>
                                <ParamTypedInput
                                  param={param}
                                  isCritico={isCriticoParam && !contStatus}
                                  statusColor={contStatus}
                                  computedValue={computedFormula}
                                  onChange={(v) => updateParametro(selectedExame.id, idx, v)}
                                  disabled={modoConsulta || selectedExame.status === "Cancelado" || !isEditable}
                                  className={`!border-0 !bg-transparent !ring-0 !shadow-none !px-0 !py-0 h-7 w-full text-[13px] font-bold tabular-nums focus:!ring-0 ${
                                    contStatus === "success" ? "!text-status-success" : contStatus === "warning" ? "!text-status-warning" : contStatus === "danger" ? "!text-status-danger" : ""
                                  }`}
                                />

                                <span className="text-xs text-muted-foreground shrink-0">{param.unidade}</span>
                              </>
                            )}
                          </div>
                          <span className={`absolute right-1 top-1 bottom-1 w-1 rounded-full ${barColorClass}`} />
                        </div>
                      );
                    };

                    const renderRefCard = (param: Param, fallbackParam?: Param) => {
                      let ref = getResolvedRef(selectedExame.nome, param);
                      let hasRef = Boolean(ref.refMin || ref.refMax || ref.descricao);
                      if (!hasRef && fallbackParam) {
                        ref = getResolvedRef(selectedExame.nome, fallbackParam);
                        hasRef = Boolean(ref.refMin || ref.refMax || ref.descricao);
                      }
                      if (!hasRef) {
                        return (
                          <div className="flex items-center h-9 px-3 rounded-lg bg-muted/30 text-xs text-muted-foreground italic">
                            Sem referência
                          </div>
                        );
                      }
                      const hasRange = Boolean(ref.refMin || ref.refMax);
                      const descMultiline = !!ref.descricao && /\n/.test(ref.descricao);
                      const isDescOnly = !hasRange && !!ref.descricao;
                      return (
                        <>
                          <div className={`relative flex gap-2 pl-3 pr-4 py-1.5 rounded-lg bg-muted/50 dark:bg-muted/30 ${descMultiline || isDescOnly ? "items-start min-h-9" : "items-center h-9"}`}>
                            <div className="flex-1 min-w-0 flex items-baseline gap-1.5">
                              {hasRange ? (
                                <>
                                  <span className="text-[13px] font-medium text-foreground tabular-nums truncate">
                                    {ref.refMin}{ref.refMin && ref.refMax ? " - " : ""}{ref.refMax}
                                  </span>
                                  <span className="text-xs text-muted-foreground shrink-0">{ref.refUnidade}</span>
                                </>
                              ) : (
                                <span className="text-[11px] leading-snug text-foreground whitespace-pre-line break-words">{ref.descricao}</span>
                              )}
                            </div>
                            <span className="absolute right-1 top-1 bottom-1 w-1 rounded-full bg-foreground/85" />
                          </div>
                          {hasRange && ref.descricao && (
                            <p className="text-[10px] text-muted-foreground italic mt-0.5 pl-3 whitespace-pre-line break-words">{ref.descricao}</p>
                          )}
                        </>
                      );
                    };

                    return (
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed border-separate border-spacing-y-1">
                      <colgroup>
                        <col className="w-[22%]" />
                        <col className={hasAnyAbs ? "w-[20%]" : "w-[40%]"} />
                        {hasAnyAbs && <col className="w-[20%]" />}
                        <col className="w-3" />
                        <col />
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="text-left pb-2 pr-4 text-xs font-semibold tracking-[0.18em] text-muted-foreground/70"></th>
                          <th className="text-left pb-2 px-2 text-xs font-bold tracking-[0.18em] text-muted-foreground">
                            {hasAnyAbs ? "RESULTADO (%)" : "RESULTADO"}
                          </th>
                          {hasAnyAbs && (
                            <th className="text-left pb-2 px-2 text-xs font-bold tracking-[0.18em] text-muted-foreground">
                            </th>
                          )}
                          <th />
                          <th className="text-left pb-2 pl-2 text-xs font-bold tracking-[0.18em] text-muted-foreground">VALOR DE REFERÊNCIA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, rIdx) => {
                          const param = row.main;
                          const idx = row.mainIdx;
                          const displayValorMain = param.tipo === "Formula"
                            ? evaluateFormula(param.formula || param.valorReferencia, valuesByChave, param.casasDecimais ?? 2, (param.chave ?? "").toUpperCase() === "CONT")
                            : param.valor;
                          const nivelCritico = avaliarNivelCritico(selectedExame.nome, param.nome, displayValorMain);
                          const isCriticoParam = nivelCritico !== "normal";
                          // Nome base sem o sufixo "(absoluto)" se este parâmetro for o absoluto isolado
                          const displayName = isAbsName(param.nome)
                            ? param.nome.replace(/\(\s*abs(oluto)?\s*\)/i, "").trim() || param.nome
                            : param.nome;
                          const refMain = getResolvedRef(selectedExame.nome, param);
                          const hasRefMain = Boolean(refMain.refMin || refMain.refMax || refMain.descricao);
                          const isObservation = /^\s*observa[cç][aã]o/i.test(param.nome) || (param.tipo === "Texto" && !hasRefMain);
                          return (
                            <Fragment key={rIdx}>
                              {param.headerAntes && (() => {
                                // Cabeçalhos válidos são títulos curtos de seção
                                // (ex.: "ÍNDICES HEMATIMÉTRICOS"). Filtramos texto
                                // que, na verdade, é vazamento de uma linha do
                                // bloco de Valor de Referência do layout
                                // (ex.: "6...........: 1.080 a 56.500 mUI/mL",
                                // "Idade gestacional (semanas)", "Valores de Referência").
                                const h = param.headerAntes.trim();
                                // Normaliza para detectar "label leak" — a célula
                                // de rótulo do layout (ex.: "*eGFR:..", "Resultado:....")
                                // vazando como cabeçalho da próxima linha.
                                const norm = (s: string) => s.toLowerCase().replace(/[\s.:*]+/g, "").trim();
                                const headerNorm = norm(h);
                                const labelNorm = norm(param.nome || "");
                                const chaveNorm = norm((param as any).chave || "");
                                const isLabelLeak =
                                  (!!labelNorm && (headerNorm === labelNorm || headerNorm.startsWith(labelNorm))) ||
                                  (!!chaveNorm && headerNorm === chaveNorm) ||
                                  /^\*?\s*[\wÀ-ÿ*]+\s*:?\.{2,}$/i.test(h);
                                const isVRLeak =
                                  /valor(es)?\s+de\s+refer[êe]ncia/i.test(h) ||
                                  /idade\s+gestacional/i.test(h) ||
                                  /\.{3,}/.test(h) ||                      // pontilhado de tabulação
                                  /[\d.,]+\s*a\s*[\d.,]+/i.test(h) ||      // "X a Y" (faixa)
                                  /(mui|mg\/dl|g\/dl|ng\/ml|ui\/ml|fl|pg|%)\b/i.test(h) ||
                                  h.length > 60;                            // títulos longos ≈ parágrafo
                                if (isVRLeak || isLabelLeak) return null;
                                return (
                                  <tr>
                                    <td colSpan={hasAnyAbs ? 5 : 4} className="pt-3 pb-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/70">
                                      {h}
                                    </td>
                                  </tr>
                                );
                              })()}
                              {isObservation ? (
                                <tr className="group">
                                  <td className="py-0.5 pr-3 text-[13px] font-medium text-foreground align-middle">
                                    {displayName}
                                    {param.obrigatorio && <span className="text-status-danger ml-0.5">*</span>}
                                  </td>
                                  <td colSpan={hasAnyAbs ? 4 : 3} className="py-0.5 px-1.5 align-middle">
                                    {renderResultCard(param, idx)}
                                  </td>
                                </tr>
                              ) : (
                                <tr className="group">
                                  <td className="py-0.5 pr-3 text-[13px] font-medium text-foreground align-middle">
                                    {displayName}
                                    {param.obrigatorio && <span className="text-status-danger ml-0.5">*</span>}
                                    {isCriticoParam && (
                                      <span title={nivelCritico === "critico_baixo" ? "Crítico baixo (pânico)" : "Crítico alto (pânico)"}>
                                        <AlertOctagon className="inline h-3 w-3 ml-1 text-status-danger animate-pulse" />
                                      </span>
                                    )}
                                  </td>
                                  {hasAnyAbs && !row.abs && !isAbsName(param.nome) ? (
                                    <td colSpan={2} className="py-0.5 px-1.5 align-middle">
                                      {renderResultCard(param, idx)}
                                    </td>
                                  ) : (
                                    <>
                                      <td className="py-0.5 px-1.5 align-middle">
                                        {isAbsName(param.nome) && hasAnyAbs ? (
                                          <div className="h-9 rounded-lg bg-muted/20 border border-dashed border-muted-foreground/20" />
                                        ) : (
                                          renderResultCard(param, idx)
                                        )}
                                      </td>
                                      {hasAnyAbs && (
                                        <td className="py-0.5 px-1.5 align-middle">
                                          {row.abs ? (
                                            renderResultCard(row.abs, row.absIdx!)
                                          ) : isAbsName(param.nome) ? (
                                            renderResultCard(param, idx)
                                          ) : (
                                            <div className="h-9 rounded-lg bg-muted/20 border border-dashed border-muted-foreground/20" />
                                          )}
                                        </td>
                                      )}
                                    </>
                                  )}
                                  <td />
                                  <td className="py-0.5 pl-1.5 align-middle">
                                    {row.abs ? (
                                      <div className="grid grid-cols-2 gap-1.5">
                                        {renderRefCard(param)}
                                        {renderRefCard(row.abs, param)}
                                      </div>
                                    ) : (
                                      renderRefCard(param)
                                    )}
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                    );
                  })()}


                  </>
                  )}
                </div>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col p-5 sm:p-6 overflow-y-auto">
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm bg-card rounded-xl shadow-sm min-h-[200px]">
                  {isHydrating ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-6 w-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                      <span className="text-xs">Carregando exames…</span>
                    </div>
                  ) : (
                    "Selecione um exame na lista lateral."
                  )}
                </div>
              </div>
            )}

            {/* Footer bar — analista + ações primárias.
                Ações secundárias (Cancelar análise, Solicitar recoleta, Retificar)
                vivem no menu "Mais ações" no topo, evitando duplicação cognitiva. */}
            <div className="border-t border-border/60 bg-card/40 px-5 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8 border border-status-info/40">
                  <AvatarFallback className="bg-status-info-bg text-status-info text-xs font-semibold">
                    {analistaAtual.iniciais}
                  </AvatarFallback>
                </Avatar>
                {modoConsulta ? (
                  <div className="flex flex-col leading-tight">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Analisado e Liberado por</span>
                    <span className="text-sm font-medium text-foreground">{analistaAtual.nome}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col leading-tight">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Analista responsável</span>
                      <span className="text-sm font-medium text-foreground">{analistaAtual.nome}</span>
                    </div>
                    <button
                      onClick={() => {
                        setAnalistaEmail("");
                        setAnalistaSenha("");
                        setAnalistaErro("");
                        setShowAlterarAnalista(true);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-2 py-1 transition-colors"
                      title="Trocar analista responsável"
                    >
                      <Edit className="h-3 w-3" />
                      Trocar
                    </button>
                  </>
                )}
              </div>

              {!selectedIsTerceirizada && !modoConsulta && (canAnalisar || canLiberar) && (
                <div className="flex items-center gap-2">
                  {canAnalisar && (
                    <button
                      data-result-nav="true"
                      onClick={handleSalvar}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium text-foreground border border-border bg-card hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                      title="Salvar parcialmente sem liberar"
                    >
                      <Save className="h-4 w-4" />
                      Salvar
                    </button>
                  )}
                  {canLiberar && (selectedExame?.status === "Resultado salvo" || selectedExame?.status === "Em retificação") && (
                    <button
                      onClick={() => setShowConfirmarLiberar(true)}
                      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors shadow-sm"
                      title="Disponível somente após salvar o resultado"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Assinar e Liberar
                    </button>
                  )}

                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Popup: Resultado salvo */}
      <ResultadoPopup
        open={showSalvoPopup}
        onOpenChange={setShowSalvoPopup}
        variant="info"
        title="Resultado inserido com sucesso!"
        description="Aguardando conferência e liberação de laudo."
      />

      {/* Popup: Retificar */}
      <ResultadoPopup
        open={showRetificarDialog}
        onOpenChange={(open) => {
          setShowRetificarDialog(open);
          if (!open) setRetificarJustificativa("");
        }}
        variant="warning"
        title="Retificar resultado"
        description={
          selectedExame?.status === "Cancelado" ? (
            <>Amostra cancelada: <strong>Amostra coagulada</strong>. Confirmada a alteração o resultado será liberado para edição.</>
          ) : (
            <>Este resultado já <strong>estava Liberado</strong>. Confirmada a alteração o resultado será liberado para edição.</>
          )
        }
        footer={
          <>
            <button
              onClick={() => { setShowRetificarDialog(false); setRetificarJustificativa(""); }}
              className="px-5 py-2.5 border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
            <button
              disabled={retificarJustificativa.trim().length < 5}
              onClick={async () => {
                const justificativa = retificarJustificativa.trim();
                if (justificativa.length < 5) {
                  toast.error("Informe uma justificativa com pelo menos 5 caracteres.");
                  return;
                }
                if (selectedExame) {
                  // Snapshot dos valores ANTES da retificação — base para o
                  // diff exibido na auditoria e para bloquear save sem alteração.
                  const snap = selectedExame.parametros.map((p) => ({
                    chave: p.chave || p.nome,
                    rotulo: p.rotulo || p.nome,
                    valor: (p.valor ?? "").trim(),
                  }));
                  setValoresAntesRetificacao((prev) => ({ ...prev, [selectedExameId]: snap }));

                  const dbId = dbIdMap[selectedExameId];
                  if (dbId) {
                    // Volta exame para "em_analise" no banco (libera para edição).
                    // Mantemos os resultados anteriores carregados para que o
                    // analista veja os valores atuais e possa editá-los; o
                    // diff é calculado no save contra o snapshot acima.
                    const res = await updateAtendimentoExame(dbId, {
                      status: "em_analise",
                      data_liberacao: null,
                      retificado: true,
                    }, justificativa);
                    if (!res.ok) {
                      toast.error("Falha ao retificar: " + (res.error ?? "erro desconhecido"));
                      return;
                    }
                  }
                  setStatusAnterior((prev) => ({ ...prev, [selectedExameId]: selectedExame.status }));
                  updatePacienteExames((exames) =>
                    exames.map((e) =>
                      e.id === selectedExameId
                        ? { ...e, status: "Em retificação" as ExameStatus }
                        : e
                    )
                  );
                }
                addAuditEntry(selectedExameId, "Retificação", `Status anterior: ${selectedExame?.status} · Justificativa: ${justificativa}`);
                setRetificando(true);
                setShowRetificarDialog(false);
                setRetificarJustificativa("");
                toast.info("Em retificação — exame liberado para nova edição. Após salvar e liberar novamente, o status passará a 'Retificado'.");
              }}
              className="px-5 py-2.5 rounded-lg text-sm font-medium bg-status-warning text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirmar
            </button>
          </>
        }
      >
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Justificativa <span className="text-status-danger">*</span>
          </label>
          <textarea
            value={retificarJustificativa}
            onChange={(e) => setRetificarJustificativa(e.target.value)}
            rows={3}
            placeholder="Descreva o motivo da retificação (mín. 5 caracteres)…"
            className="w-full px-3 py-2 border rounded-lg text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 resize-none"
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground">
            Será registrada na auditoria com seu usuário, data e hora.
          </p>
        </div>
      </ResultadoPopup>

      {/* Popup: Confirmar liberação */}
      <ResultadoPopup
        open={showConfirmarLiberar}
        onOpenChange={setShowConfirmarLiberar}
        variant="warning"
        title="Confirmar liberação do resultado"
        description={`Deseja realmente assinar e liberar o exame "${selectedExame?.nome}"? Esta ação não poderá ser desfeita sem retificação.`}
        footer={
          <>
            <button
              onClick={() => setShowConfirmarLiberar(false)}
              className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                setShowConfirmarLiberar(false);
                handleAnalisarLiberar();
              }}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "hsl(var(--status-success))" }}
            >
              Confirmar e Liberar
            </button>
          </>
        }
      />

      {/* Popup: Assinado e liberado */}
      <ResultadoPopup
        open={showLiberadoPopup}
        onOpenChange={setShowLiberadoPopup}
        variant="success"
        title="Resultado assinado e liberado com sucesso!"
        description="Resultado disponível para impressão"
      />

      {/* 🚨 Popup: Confirmação obrigatória de Resultado Crítico (Fase 3) */}
      <ResultadoPopup
        open={showCriticoConfirm}
        onOpenChange={(o) => { setShowCriticoConfirm(o); if (!o) setCriticoConfirmDados(null); }}
        variant="danger"
        title="🚨 Resultado crítico — confirme antes de liberar"
        description={`O exame "${criticoConfirmDados?.exameNome ?? ""}" contém valores fora da faixa de pânico. Esta liberação ficará registrada em auditoria.`}
        footer={
          <>
            <button
              onClick={() => { setShowCriticoConfirm(false); setCriticoConfirmDados(null); }}
              className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
            <button
              disabled={!criticoRevisado || !criticoConduta.trim()}
              onClick={async () => {
                if (!criticoConfirmDados) return;
                const dbId = dbIdMap[criticoConfirmDados.exameId];
                if (!dbId) { toast.error("Exame não encontrado."); return; }
                try {
                  // O criticoAudit resolve internamente o atendimentoId via protocolo
                  // se não for fornecido, e lança caso não encontre.
                  await registrarLiberacaoCritica({
                    registroId: dbId,
                    protocolo: paciente.protocolo,
                    pacienteNome: paciente.nome,
                    exameNome: criticoConfirmDados.exameNome,
                    parametrosCriticos: criticoConfirmDados.parametrosCriticos.map(p => ({
                      nome: p.nome, valor: p.valor,
                      nivel: p.nivel === "critico_baixo" ? "critico_baixo" : "critico_alto",
                    })),
                    justificativa: "",
                    conduta: criticoConduta.trim(),
                    notificouMedico: criticoNotificou,
                  });
                } catch (e) {
                  showError(e, { scope: "ResultadoDetalhe.criticoAudit", userMessage: "Não foi possível registrar a auditoria do resultado crítico." });
                  return;
                }
                addAuditEntry(criticoConfirmDados.exameId, "🚨 Resultado crítico liberado", `Conduta: ${criticoConduta.trim()}${criticoNotificou ? " | Médico notificado" : ""}`);
                setShowCriticoConfirm(false);
                setCriticoConfirmDados(null);
                await executarLiberacao(dbId);
              }}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: "hsl(var(--status-danger))" }}
            >
              Confirmar e Liberar
            </button>
          </>
        }
      >
        {criticoConfirmDados && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-status-danger/30 bg-status-danger/5 p-3">
              <p className="text-xs font-semibold text-status-danger mb-2 uppercase tracking-wider">Parâmetros críticos</p>
              <ul className="space-y-1">
                {criticoConfirmDados.parametrosCriticos.map((p) => (
                  <li key={p.nome} className="text-sm flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{p.nome}</span>
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-status-danger">{p.valor}</span>
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-status-danger/20 text-status-danger font-semibold">
                        {p.nivel === "critico_baixo" ? "Pânico baixo" : "Pânico alto"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={criticoRevisado} onChange={(e) => setCriticoRevisado(e.target.checked)} className="mt-0.5" />
              <span className="text-sm text-foreground">Confirmo que o resultado foi revisado e a amostra/equipamento verificados</span>
            </label>

            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={criticoNotificou} onChange={(e) => setCriticoNotificou(e.target.checked)} className="mt-0.5" />
              <span className="text-sm text-foreground">Médico solicitante notificado</span>
            </label>

            <div>
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Conduta / Justificativa *</label>
              <textarea
                value={criticoConduta}
                onChange={(e) => setCriticoConduta(e.target.value)}
                rows={3}
                placeholder="Ex: Resultado validado após repetição em duplicata. Médico notificado por telefone às 14h32."
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-status-danger/30 resize-none"
                maxLength={500}
              />
              <p className="text-[10px] text-muted-foreground mt-1">{criticoConduta.length}/500</p>
            </div>
          </div>
        )}
      </ResultadoPopup>

      {/* Dialog de celebração — todos os exames liberados */}
      <CelebracaoLiberacaoDialog
        open={showCelebracao}
        onClose={() => setShowCelebracao(false)}
        totalLiberados={
          paciente.exames.filter((e) => isExameLiberado(e.status)).length
        }
        protocolo={paciente.protocolo}
        onImprimir={() => {
          setShowCelebracao(false);
          handleImprimir(paciente.exames.filter((e) => isExameLiberado(e.status)));
        }}
      />

      {/* Popup: Cancelar análise */}
      <ResultadoPopup
        open={showCancelarDialog}
        onOpenChange={setShowCancelarDialog}
        variant="danger"
        title="Cancelar análise da amostra"
        description="Deseja realmente cancelar a análise da(s) amostra(a) selecionada(s)?"
      >
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">
              Informe o motivo <span className="text-status-danger">*</span>
            </Label>
            <Select value={motivoCancelamento} onValueChange={setMotivoCancelamento}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                {motivosCancelamentoOpts.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Nenhum motivo cadastrado. Acesse Configurações → Motivos de Cancelamento.
                  </div>
                ) : (
                  motivosCancelamentoOpts.map((m) => (
                    <SelectItem key={m.id} value={m.label}>{m.label}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3 mt-4">
            <button
              onClick={() => { setShowCancelarDialog(false); setMotivoCancelamento(""); }}
              className="px-5 py-2.5 border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmCancelar}
              disabled={!motivoCancelamento}
              className="px-5 py-2.5 rounded-lg text-sm font-medium bg-status-danger text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Sim, Cancelar
            </button>
          </div>
        </div>
      </ResultadoPopup>

      {/* Popup: Importar resultado */}
      <ResultadoPopup
        open={showImportarDialog}
        onOpenChange={setShowImportarDialog}
        variant="purple"
        title="Importar resultado"
      >
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Equipamento</Label>
            <Input className="mt-1" defaultValue="Automático" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Porta Serial / IP</Label>
              <Input className="mt-1" defaultValue="COM3 / 192.168.0.10" />
            </div>
            <div>
              <Label className="text-sm font-medium">Baud Rate</Label>
              <Input className="mt-1" defaultValue="9600" />
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Protocolo</Label>
            <Input className="mt-1" defaultValue="Automático" />
          </div>
          <div className="flex items-center justify-between gap-3 mt-4">
            <button
              onClick={() => setShowImportarDialog(false)}
              className="px-5 py-2.5 border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => { setShowImportarDialog(false); toast.success("Conectando e importando..."); }}
              className="px-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Conectar e Importar
            </button>
          </div>
        </div>
      </ResultadoPopup>

      {/* Popup: Alterar Analista */}
      <ResultadoPopup
        open={showAlterarAnalista}
        onOpenChange={setShowAlterarAnalista}
        variant="info"
        title="Alterar Analista"
        description="Informe as credenciais do novo analista responsável."
      >
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">E-mail</Label>
            <Input
              className="mt-1"
              type="email"
              placeholder="analista@lab.com"
              value={analistaEmail}
              onChange={(e) => { setAnalistaEmail(e.target.value); setAnalistaErro(""); }}
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Senha</Label>
            <Input
              className="mt-1"
              type="password"
              placeholder="••••••"
              value={analistaSenha}
              onChange={(e) => { setAnalistaSenha(e.target.value); setAnalistaErro(""); }}
            />
          </div>
          {analistaErro && (
            <p className="text-sm text-status-danger font-medium">{analistaErro}</p>
          )}
          <div className="flex items-center justify-between gap-3 mt-4">
            <button
              onClick={() => setShowAlterarAnalista(false)}
              className="px-5 py-2.5 border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                setAnalistaValidando(true);
                const res = await validarCredenciaisAnalista(analistaEmail, analistaSenha);
                setAnalistaValidando(false);
                if (res.ok) {
                  setAnalistaAtual({ nome: res.nome, iniciais: res.iniciais });
                  setShowAlterarAnalista(false);
                  toast.success(`Analista alterado para ${res.nome}`);
                } else {
                  setAnalistaErro(res.error);
                }
              }}
              disabled={!analistaEmail || !analistaSenha || analistaValidando}
              className="px-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {analistaValidando ? "Validando..." : "Confirmar"}
            </button>
          </div>
        </div>
      </ResultadoPopup>

      {/* Auditoria Panel */}
      <AuditoriaPanel
        open={showAuditoria}
        onOpenChange={setShowAuditoria}
        pacienteNome={paciente.nome}
        sexo={paciente.sexo}
        nascimento={paciente.nascimento}
        idade={paciente.idade}
        protocolo={paciente.protocolo}
        amostras={auditoriaAmostras}
      />

      {selectedExame && dbIdMap[selectedExameId] && (() => {
        const dbRow = dbRows.find((r) => r.id === dbIdMap[selectedExameId]);
        if (!dbRow) return null;
        return (
          <SolicitarRecoletaDialog
            open={showRecoletaDialog}
            onOpenChange={setShowRecoletaDialog}
            etapa="liberacao"
            atendimentoId={dbRow.atendimento_id}
            atendimentoExameId={dbIdMap[selectedExameId]}
            exameNome={selectedExame.nome}
            pacienteNome={paciente.nome}
            protocolo={paciente.protocolo}
            onConfirmed={handleRecoletaConfirmed}
          />
        );
      })()}

      {paciente && (
        <>
          <RegistrarCriticoDialog
            open={showCriticoDialog}
            onOpenChange={setShowCriticoDialog}
            atendimentoId={paciente.id}
            atendimentoExameId={selectedExame && dbIdMap[selectedExameId] ? dbIdMap[selectedExameId] : 0}
            protocolo={paciente.protocolo}
            pacienteNome={paciente.nome}
            exameNome={selectedExame?.nome ?? ""}
          />
          <RegistrarEntregaDialog
            open={showEntregaDialog}
            onOpenChange={setShowEntregaDialog}
            atendimentoId={paciente.id}
            atendimentoExameId={selectedExame && dbIdMap[selectedExameId] ? dbIdMap[selectedExameId] : undefined}
            protocolo={paciente.protocolo}
            pacienteNome={paciente.nome}
          />
        </>
      )}

      {printDialog.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-foreground/30 backdrop-blur-[3px]"
            onClick={() => setPrintDialog((s) => ({ ...s, open: false }))}
          />
          <div className="relative w-full max-w-md bg-card rounded-2xl border border-border shadow-[0_24px_80px_-12px_hsl(var(--foreground)/0.18)] overflow-hidden">
            <div className="px-6 pt-6 pb-2">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Printer className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-foreground tracking-tight">
                    {printDialog.action === "imprimir" ? "Imprimir laudo" : "Exportar PDF"}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    Este atendimento tem <span className="font-semibold text-foreground">{printDialog.solicitantes.length} solicitantes</span>.
                    Como deseja {printDialog.action === "imprimir" ? "imprimir" : "exportar"}?
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 space-y-2">
              <button
                onClick={async () => {
                  const d = printDialog;
                  setPrintDialog((s) => ({ ...s, open: false }));
                  await executarImpressao(d.action, d.exames, "unica");
                }}
                className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all"
              >
                <div className="text-sm font-semibold text-foreground">Uma única cópia</div>
                <div className="text-xs text-muted-foreground mt-0.5">Todos os exames juntos, sem distinção de solicitante.</div>
              </button>
              <button
                onClick={async () => {
                  const d = printDialog;
                  setPrintDialog((s) => ({ ...s, open: false }));
                  await executarImpressao(d.action, d.exames, "porSolicitante");
                }}
                className="w-full text-left px-4 py-3 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all"
              >
                <div className="text-sm font-semibold text-foreground">Uma cópia por solicitante</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Gera {printDialog.solicitantes.length} laudo(s), cada um com os exames pedidos por aquele médico.
                </div>
              </button>
            </div>
            <div className="px-6 pb-5 flex justify-end">
              <button
                onClick={() => setPrintDialog((s) => ({ ...s, open: false }))}
                className="h-9 px-4 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultadoDetalhe;
