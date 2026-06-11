import { useState, useMemo, useCallback, useEffect, Fragment } from "react";
import { searchNormalize } from "@/lib/utils";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Search, Printer, Edit, Calendar, ClipboardList, CheckCircle2, AlertCircle, Download, User, ChevronRight, FlaskConical, ArrowLeft, AlertOctagon, AlertTriangle, Send } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import PacienteHeaderCard, { type PacienteHeaderAction } from "@/components/operacional/PacienteHeaderCard";
import { isValueInRange } from "@/components/ResultadoValidationBar";
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
import { resolverReferencia } from "@/data/valoresReferenciaStore";
import { getExamesCatalogo } from "@/data/exameCatalogoStore";
import { getLabsApoio } from "@/data/labApoioStore";
import { getAtendimentoExamesDB, updateAtendimentoExame, getAtendimentos, fetchAtendimentoByProtocolo, type AtendimentoExameRow } from "@/data/atendimentoStore";
import { isFeatureEnabled } from "@/lib/featureFlags";
import type { MockAtendimento } from "@/data/types";
import { loadParametros, getParametros, type ExameParametro } from "@/data/exameParametrosStore";
import { avaliarCritico, type NivelCritico } from "@/lib/criticoChecker";
import { registrarLiberacaoCritica } from "@/lib/criticoAudit";
import {
  hidratarSegmentosParaDigitacao,
  buildResultadosByChave,
  type DigitacaoSegmento,
} from "@/lib/layoutScientificRuntime";
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

import { printHtmlInHiddenFrame } from "@/lib/printHtml";
import { renderCabecalhoPadrao, renderRodapePadrao } from "@/lib/documentoRenderer";
import { showError } from "@/lib/showError";
import { fireSuccessConfetti } from "@/lib/confetti";
import { validarCredenciaisAnalista } from "@/lib/validarCredenciaisAnalista";
import { useDicionario } from "@/hooks/useDicionario";

// Tipos, helpers puros e ParamTypedInput foram extraídos para ./ResultadoDetalhe/*
// na Fase 3 do slicing estrutural. Comportamento idêntico, apenas reorganização.
import type { ExameStatus, Parametro, Exame, Paciente, DbIdMap } from "./ResultadoDetalhe/types";
import { statusExameMap } from "./ResultadoDetalhe/types";
import { ParamTypedInput } from "./ResultadoDetalhe/ParamTypedInput";
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

const getMnemonico = (nome: string): string => {
  const cat = getExamesCatalogo().find((c) => c.nome === nome);
  return (cat?.mnemonico || nome.slice(0, 6)).toUpperCase();
};

const ResultadoDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission, user: authUser } = useAuth();
  // Modo consulta: rota /consultar-resultado/:id renderiza tudo somente leitura
  // (sem salvar, liberar, recoletar ou cancelar análise). Usado pela página
  // /consultar-resultados — voltada para conferência e impressão de laudos.
  const modoConsulta = location.pathname.startsWith("/consultar-resultado/");
  // RBAC visual — backend revalida via trigger BEFORE UPDATE em atendimento_exames.
  // Em modo consulta, todas as ações já são desabilitadas; aqui ajustamos as ações
  // mutativas conforme o perfil do usuário (analista pode liberar/retificar; recepção,
  // por exemplo, vê o detalhe mas não libera nada).
  const canLiberar = hasPermission("liberar_resultado") || hasPermission("editar_atendimento");
  const canAnalisar = hasPermission("analisar_amostra") || hasPermission("editar_atendimento");
  const canCancelarExame = hasPermission("cancelar_atendimento") || hasPermission("editar_atendimento");
  const [paciente, setPaciente] = useState<Paciente>(getEmptyPaciente);
  const [dbRows, setDbRows] = useState<AtendimentoExameRow[]>([]);
  const [dbIdMap, setDbIdMap] = useState<DbIdMap>({});
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
    const [rows, atFromDb] = await Promise.all([
      getAtendimentoExamesDB(id),
      !useLegacy && flagOn ? fetchAtendimentoByProtocolo(id) : Promise.resolve(null),
    ]);
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
        } catch (err) {
          // Silencioso: cai no fallback degenerado de buildExamesFromDB.
          if (import.meta.env.DEV) console.warn("[ResultadoDetalhe] hidratacao falhou", err);
        }
      }),
    );
    const { exames, idMap } = buildExamesFromDB(rows, segmentosPorRowId);
    const pac = buildPacienteFromAtendimento(id, exames, atFromDb);
    pac.idade = calcIdadeAnosMeses(pac.nascimento);
    setPaciente(pac);
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
    const fmtDateTime = (d: Date) => {
      const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      return `${String(d.getDate()).padStart(2, "0")} de ${meses[d.getMonth()]} de ${d.getFullYear()} - ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
    };
    const fmtIso = (iso: string | null | undefined, fallback: Date) =>
      fmtDateTime(iso ? new Date(iso) : fallback);
    const now = new Date();
    const log: Record<number, { acao: string; dataHora: string; usuario: string; iniciais: string; dados?: string }[]> = {};
    // Index DB rows by uiId via idMap reverse lookup
    const rowByUiId = new Map<number, AtendimentoExameRow>();
    Object.entries(idMap).forEach(([uiIdStr, dbId]) => {
      const row = rows.find((r) => r.id === dbId);
      if (row) rowByUiId.set(Number(uiIdStr), row);
    });
    exames.forEach((exame) => {
      const row = rowByUiId.get(exame.id);
      const dbStatus = row?.status;
      const dataPedido = fmtIso(exame.dataColetaISO ?? exame.dataAnaliseISO ?? exame.dataLiberacaoISO, now);
      const dataColeta = fmtIso(exame.dataColetaISO ?? exame.dataAnaliseISO, now);
      const dataAnal = fmtIso(exame.dataAnaliseISO, now);
      const dataLib = fmtIso(exame.dataLiberacaoISO, now);
      const entries = [
        { acao: "Pedido realizado", dataHora: dataPedido, usuario: "Felipe Andrade Melo", iniciais: "FA" },
        { acao: "Amostra coletada", dataHora: dataColeta, usuario: "Felipe Andrade Melo", iniciais: "FA" },
      ];
      // Transições de bancada (apenas exames internos: em_bancada → analisado)
      if (dbStatus === "em_bancada" || dbStatus === "analisado" ||
          dbStatus === "em_analise" || dbStatus === "finalizado") {
        entries.push({ acao: "Bancada iniciada", dataHora: dataAnal, usuario: "Felipe Andrade Melo", iniciais: "FA" });
      }
      if (dbStatus === "analisado" || dbStatus === "em_analise" || dbStatus === "finalizado") {
        entries.push({ acao: "Análise concluída", dataHora: dataAnal, usuario: "Felipe Andrade Melo", iniciais: "FA" });
      }
      if (exame.status === "Resultado salvo" || exame.status === "Em retificação" || isExameLiberado(exame.status)) {
        const dadosAtuais = exame.parametros.map((p) => `${p.nome}: ${p.valor || "—"}`).join("\n");
        const foiRetificado = row?.retificado === true;
        const dataRetificacao = fmtIso(row?.retificado_at ?? null, new Date(dataAnal));
        if (foiRetificado) {
          // Antes da retificação: preserva o registro original do "Resultado salvo".
          // Os valores anteriores não são versionados em banco — exibimos um marcador
          // explicativo no campo `dados` para deixar a linha do tempo legível.
          entries.push({
            acao: "Resultado salvo",
            dataHora: dataAnal,
            usuario: "Felipe Andrade Melo",
            iniciais: "FA",
            dados: "Valores anteriores à retificação (não versionados).",
          } as any);
          // Marcador de retificação.
          entries.push({
            acao: "Resultado retificado",
            dataHora: dataRetificacao,
            usuario: "Felipe Andrade Melo",
            iniciais: "FA",
          });
          // Após a retificação: valores correntes.
          entries.push({
            acao: "Resultado salvo (após retificação)",
            dataHora: dataRetificacao,
            usuario: "Felipe Andrade Melo",
            iniciais: "FA",
            dados: dadosAtuais,
          } as any);
        } else {
          entries.push({
            acao: "Resultado salvo",
            dataHora: dataAnal,
            usuario: "Felipe Andrade Melo",
            iniciais: "FA",
            dados: dadosAtuais,
          } as any);
        }
      }
      if (isExameLiberado(exame.status)) {
        entries.push({ acao: "Resultado liberado", dataHora: dataLib, usuario: "Felipe Andrade Melo", iniciais: "FA" });
      }
      if (exame.status === "Cancelado") {
        entries.push({ acao: "Análise cancelada", dataHora: fmtIso(exame.dataAnaliseISO ?? exame.dataLiberacaoISO, now), usuario: "Felipe Andrade Melo", iniciais: "FA" });
      }
      log[exame.id] = entries;
    });
    setAuditLog(log);
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

  /**
   * Avalia o nível crítico de um parâmetro de exame consultando a configuração
   * (critico_min/critico_max) cadastrada em ParametrosDialog. Faz match por
   * rótulo OU chave (case-insensitive).
   */
  const avaliarNivelCritico = useCallback((exameNome: string, paramNome: string, valor: string): NivelCritico => {
    if (!valor) return "normal";
    const lista = parametrosConfigPorExame[exameNome];
    if (!lista || lista.length === 0) return "normal";
    const k = paramNome.trim().toLowerCase();
    const cfg = lista.find(p => p.rotulo.trim().toLowerCase() === k || p.chave.trim().toLowerCase() === k);
    if (!cfg) return "normal";
    return avaliarCritico(valor, cfg.criticoMin, cfg.criticoMax);
  }, [parametrosConfigPorExame]);

  /** Lista todos os parâmetros críticos do exame selecionado. */
  const getParametrosCriticosDoExame = useCallback((exame: { nome: string; parametros: Array<{ nome: string; valor: string }> } | undefined) => {
    if (!exame) return [] as Array<{ nome: string; valor: string; nivel: NivelCritico }>;
    const out: Array<{ nome: string; valor: string; nivel: NivelCritico }> = [];
    for (const p of exame.parametros) {
      const nivel = avaliarNivelCritico(exame.nome, p.nome, p.valor);
      if (nivel !== "normal") out.push({ nome: p.nome, valor: p.valor, nivel });
    }
    return out;
  }, [avaliarNivelCritico]);

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
  // Considera tanto o tipo_processo da row no banco quanto o catálogo,
  // já que agora os terceirizados também aparecem na lista lateral.
  const isExameTerceirizadaById = (uiId: number): boolean => {
    const dbId = dbIdMap[uiId];
    const row = dbRows.find(r => r.id === dbId);
    if (row?.tipo_processo === "TERCEIRIZADO") return true;
    return false;
  };
  const isExameTerceirizada = (exameNome: string): boolean => {
    const catalogo = getExamesCatalogo();
    const labs = getLabsApoio();
    const entry = catalogo.find(c => c.nome === exameNome);
    if (!entry) return false;
    return entry.analise !== "INTERNA" && entry.analise !== "TERCEIRIZADA" && labs.some(l => l.id === entry.analise);
  };

  const getLabNome = (exameNome: string): string => {
    const catalogo = getExamesCatalogo();
    const labs = getLabsApoio();
    const entry = catalogo.find(c => c.nome === exameNome);
    if (!entry) return "";
    const lab = labs.find(l => l.id === entry.analise);
    return lab?.nome || "";
  };

  const selectedIsTerceirizada = selectedExame
    ? (isExameTerceirizadaById(selectedExame.id) || isExameTerceirizada(selectedExame.nome))
    : false;

  // Resolve reference values from the shared store based on patient sex/age
  const getResolvedRef = (exameNome: string, param: Parametro) => {
    const resolved = resolverReferencia(exameNome, param.nome, paciente.sexo, paciente.idade);
    if (resolved) return resolved;
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
    const dadosParams = selectedExame.parametros.map((p) => `${p.nome}: ${p.valor || "—"}`).join("\n");
    // LayoutScientificRuntime: jsonb canônico indexado por CHAVE do parâmetro.
    // Resultados antigos (indexados por nome) continuam legíveis via dual-read
    // em `readParametroValor`.
    const resultadosJson = buildResultadosByChave(
      selectedExame.parametros.map((p) => ({ chave: p.chave, rotulo: p.rotulo, nome: p.nome })),
      selectedExame.parametros.map((p) => p.valor || ""),
    );

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
      addAuditEntry(selectedExameId, "Resultado salvo (após retificação)", dadosParams);
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

    // Separa críticos × seguros usando o MESMO avaliador do fluxo unitário.
    const criticosNoLote: typeof liberaveis = [];
    const seguros: typeof liberaveis = [];
    for (const ex of liberaveis) {
      const criticos = getParametrosCriticosDoExame(ex);
      if (criticos.length > 0) criticosNoLote.push(ex);
      else seguros.push(ex);
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

  const statusAnaliseLabel = (status: ExameStatus) => {
    switch (status) {
      case "Pendente": return "Análise Pendente";
      case "Digitado": return "Digitado";
      case "Cancelado": return "Cancelado";
      case "Impresso": return "Impresso";
      case "Resultado salvo": return "Resultado salvo";
      case "Em retificação": return "Em retificação";
      case "Retificado": return "Retificado";
    }
  };

  const isExameLiberado = (status: ExameStatus) => status === "Digitado" || status === "Impresso" || status === "Retificado";
  const isExameBloqueado = (status: ExameStatus) => status === "Resultado salvo" || isExameLiberado(status);
  const statusGeralType = (status: string): "success" | "warning" | "danger" | "info" => {
    if (status === "Cancelado") return "danger";
    if (status === "Retificado") return "info";
    if (status === "Finalizado") return "success";
    return "warning";
  };

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
    const entries = await Promise.all(
      printable.map(async (exame) => {
        const resultados: Record<string, string> = {};
        exame.parametros.forEach((p) => {
          const v = p.valor || "";
          resultados[p.nome] = p.tipo === "Select" ? v.toUpperCase() : v;
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
  }, [paciente.sexo, paciente.idade]);

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

  const doImprimirHtml = async (printable: Exame[], solicitanteLabel?: string) => {
    const { map: customByExame, margins } = await resolveCustomLayouts(printable);
    const docName = `${(paciente.nome || "Paciente").replace(/[\\/:*?"<>|]+/g, " ").trim()} - ${paciente.protocolo}`;
    printHtmlInHiddenFrame({
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${docName}</title></head><body>${buildLaudoHtml(printable, customByExame, solicitanteLabel, margins)}</body></html>`,
      frameId: "laudo-print-frame",
      documentTitle: docName,
    });
  };

  const doExportPdf = async (printable: Exame[], solicitanteLabel?: string, suffix?: string) => {
    const { map: customByExame, margins } = await resolveCustomLayouts(printable);
    const container = document.createElement("div");
    container.innerHTML = buildLaudoHtml(printable, customByExame, solicitanteLabel, margins);
    // html2pdf aplica as margens no jsPDF; o DOM precisa estar na largura útil
    // exata da página, sem margem/padding próprios, para não somar/desbalancear.
    container.style.position = "fixed";
    container.style.left = "0";
    container.style.top = "0";
    container.style.width = `${210 - margins.left - margins.right}mm`;
    container.style.maxWidth = `${210 - margins.left - margins.right}mm`;
    container.style.margin = "0";
    container.style.padding = "0";
    container.style.boxSizing = "border-box";
    container.style.background = "#ffffff";
    container.style.overflow = "hidden";
    document.body.appendChild(container);
    const safeNome = (paciente.nome || "Paciente").replace(/[\\/:*?"<>|]+/g, " ").trim();
    // Carrega html2pdf sob demanda — evita ~370 KB no chunk inicial.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html2pdf = (await import("html2pdf.js")).default as any;
    return new Promise<void>((resolve, reject) => {
      html2pdf()
        .set({
          margin: [margins.top, margins.right, 4, margins.left],
          filename: `${safeNome} - ${paciente.protocolo}${suffix ? ` - ${suffix}` : ""}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0, windowWidth: container.offsetWidth },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"], avoid: [".exame-bloco", ".assinatura-bloco"] },
        })
        .from(container)
        .save()
        .then(() => { document.body.removeChild(container); resolve(); })
        .catch((err: unknown) => { document.body.removeChild(container); reject(err); });
    });
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
        if (action === "imprimir") await doImprimirHtml(printable);
        else await doExportPdf(printable);
        markAsImpresso(printable);
        if (action === "imprimir") toast.success(`Laudo com ${printable.length} exame(s) enviado para impressão.`);
        else toast.success(`PDF exportado com ${printable.length} exame(s).`);
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
        if (action === "imprimir") await doImprimirHtml(subset, sol);
        else await doExportPdf(subset, sol, sol.replace(/[^a-zA-Z0-9]+/g, "_"));
        geradas += 1;
      } catch {
        toast.error(`Falha ao gerar laudo para ${sol}.`);
      }
    }
    if (geradas > 0) {
      markAsImpresso(printable);
      toast.success(
        action === "imprimir"
          ? `${geradas} laudo(s) enviado(s) para impressão (uma cópia por solicitante).`
          : `${geradas} PDF(s) exportado(s) (um por solicitante).`,
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

  return (
    <div className="min-h-screen bg-background">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 mt-6 rounded-xl">
        {/* Back link — strategic contextual breadcrumb */}
        <div className="mb-4">
          <button
            onClick={() => navigate(modoConsulta ? "/consultar-resultados" : "/resultados")}
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
              actions={(modoConsulta
                ? [
                    {
                      key: "auditoria",
                      label: "Auditoria",
                      icon: <ClipboardList className="h-4 w-4" />,
                      onClick: () => setShowAuditoria(true),
                      variant: "ghost",
                    },
                    {
                      key: "imprimir",
                      label: "Imprimir todos",
                      icon: <Printer className="h-4 w-4" />,
                      onClick: () => handleImprimir(paciente.exames),
                      variant: "primary",
                      title: "Imprime apenas exames Assinados e Liberados",
                      disabled: !podeImprimirTodos,
                    },
                  ]
                : [
                    {
                      key: "auditoria",
                      label: "Auditoria",
                      icon: <ClipboardList className="h-4 w-4" />,
                      onClick: () => setShowAuditoria(true),
                      variant: "ghost",
                    },
                    {
                      key: "critico",
                      label: "Comunicar valor crítico",
                      icon: <AlertTriangle className="h-4 w-4" />,
                      onClick: () => setShowCriticoDialog(true),
                      variant: "danger",
                    },
                    {
                      key: "entrega",
                      label: "Registrar entrega",
                      icon: <Send className="h-4 w-4" />,
                      onClick: () => setShowEntregaDialog(true),
                      variant: "ghost",
                    },
                    {
                      key: "imprimir",
                      label: "Imprimir todos",
                      icon: <Printer className="h-4 w-4" />,
                      onClick: () => handleImprimir(paciente.exames),
                      variant: "primary",
                      disabled: !podeImprimirTodos,
                    },
                  ]) as PacienteHeaderAction[]}
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
                    {(isExameTerceirizadaById(exame.id) || isExameTerceirizada(exame.nome)) ? (
                      <ExamesTerceirizadosPanel
                        rows={dbRows.filter(r => r.id === dbIdMap[exame.id])}
                        onChanged={reloadExames}
                      />
                    ) : (
                    <>
                    {/* Exam action buttons */}
                    {!modoConsulta && (
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <button
                        onClick={() => setShowImportarDialog(true)}
                        className="flex items-center gap-1 px-2.5 py-1.5 border rounded-lg text-xs font-medium text-status-info hover:bg-status-info-bg transition-colors"
                      >
                        Importar
                      </button>
                       {isExameBloqueado(exame.status) && canLiberar && (
                        <button
                          onClick={() => setShowRetificarDialog(true)}
                          className="flex items-center gap-1 px-2.5 py-1.5 border rounded-lg text-xs font-medium text-foreground hover:bg-accent transition-colors"
                        >
                          <Edit className="h-3 w-3" />
                          Retificar
                        </button>
                      )}
                    </div>
                    )}

                    {/* Parameters */}
                    {exame.parametros.map((param, idx) => {
                      const isBlockedExame = isExameBloqueado(exame.status);
                      const isEditableParam = !isBlockedExame || exame.status === "Em retificação";
                      const ref = getResolvedRef(exame.nome, param);
                      const inRange = isBlockedExame && param.valor ? isValueInRange(param.valor, ref.refMin, ref.refMax) : null;
                      const isOutOfRange = inRange === false;

                      return (
                        <Fragment key={idx}>
                        {param.headerAntes && (
                          <p className="pt-3 pb-1 text-sm font-bold uppercase tracking-wide text-foreground">
                            {param.headerAntes}
                          </p>
                        )}
                        <div className="border rounded-lg p-3 space-y-2 bg-background">
                          <p className="text-sm font-medium text-foreground">
                            {param.nome}
                            {param.obrigatorio && <span className="text-status-danger ml-0.5">*</span>}
                          </p>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Resultado</span>
                              {isBlockedExame && !retificando ? (
                                <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${isOutOfRange ? "bg-status-danger/10" : "bg-accent/50"}`}>
                                  {inRange !== null && (
                                    inRange ? (
                                      <CheckCircle2 className="h-4 w-4 text-status-success" />
                                    ) : (
                                      <AlertCircle className="h-4 w-4 text-status-danger" />
                                    )
                                  )}
                                   {param.valor ? (
                                    <span className={`text-sm font-bold ${isOutOfRange ? "text-status-danger" : "text-foreground"}`}>
                                      {param.tipo === "Select" ? param.valor.toUpperCase() : param.valor} <span className="text-muted-foreground font-normal">{param.unidade}</span>
                                    </span>
                                  ) : (
                                    <span className="text-sm text-muted-foreground italic">—</span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <ParamTypedInput
                                    param={param}
                                    onChange={(v) => updateParametro(exame.id, idx, v)}
                                    disabled={modoConsulta || exame.status === "Cancelado" || !isEditableParam}
                                    className="w-24 text-right"
                                  />
                                  <span className="text-xs text-muted-foreground">{param.unidade}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Referência</span>
                              <div className="text-right">
                                {(ref.refMin || ref.refMax) ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-accent/50 rounded-lg text-xs text-foreground">
                                    {ref.refMin} - {ref.refMax}
                                    <span className="text-muted-foreground ml-0.5">{ref.refUnidade}</span>
                                  </span>
                                ) : ref.descricao ? (
                                  <span className="inline-flex items-center px-2 py-1 bg-accent/50 rounded-lg text-xs text-foreground whitespace-pre-line">
                                    {ref.descricao}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">Sem referência</span>
                                )}
                                {(ref.refMin || ref.refMax) && ref.descricao && (
                                  <p className="text-[10px] text-muted-foreground italic">{ref.descricao}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        </Fragment>
                      );
                    })}

                    {/* Observação mobile */}
                    <div>
                      <label className="text-xs font-medium text-foreground">Observação</label>
                      <textarea
                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 resize-none disabled:cursor-not-allowed disabled:opacity-60"
                        rows={2}
                        disabled={modoConsulta || isExameBloqueado(exame.status) || exame.status === "Cancelado"}
                      />
                    </div>

                    {/* Mobile footer actions */}
                    <div className="flex flex-col gap-2 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 border-2 border-status-info">
                          <AvatarFallback className="bg-status-info-bg text-status-info text-[10px] font-semibold">
                            {analistaAtual.iniciais}
                          </AvatarFallback>
                        </Avatar>
                        {modoConsulta ? (
                          <span className="text-xs text-foreground">
                            <span className="text-muted-foreground">Analisado por:</span>{" "}
                            <span className="font-medium">{analistaAtual.nome}</span>
                          </span>
                        ) : (
                          <>
                            <span className="text-xs text-foreground font-medium">{analistaAtual.nome}</span>
                            <button
                              onClick={() => { setAnalistaEmail(""); setAnalistaSenha(""); setAnalistaErro(""); setShowAlterarAnalista(true); }}
                              className="text-xs text-muted-foreground hover:text-foreground border rounded px-2 py-0.5"
                            >
                              Alterar
                            </button>
                          </>
                        )}
                      </div>
                      {!modoConsulta && (
                      <>
                      <div className="flex gap-2">
                        {canCancelarExame && (
                          <button
                            onClick={handleCancelarAnalise}
                            className="flex-1 px-3 py-2 border rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          >
                            Cancelar análise
                          </button>
                        )}
                        <button
                          onClick={() => setShowRecoletaDialog(true)}
                          className="flex-1 px-3 py-2 border rounded-lg text-xs font-medium text-warning hover:bg-warning/5 transition-colors"
                          title="Solicitar nova coleta da amostra"
                        >
                          Solicitar recoleta
                        </button>
                        {canAnalisar && (
                          <button
                            onClick={handleSalvar}
                            className="flex-1 px-3 py-2 border rounded-lg text-xs font-medium text-foreground hover:bg-accent transition-colors"
                          >
                            Salvar resultado
                          </button>
                        )}
                      </div>
                      {canLiberar && (
                        <button
                          onClick={() => setShowConfirmarLiberar(true)}
                          className="px-4 py-2 border-2 border-foreground rounded-lg text-sm font-bold text-foreground hover:bg-accent transition-colors"
                        >
                          {exame.status === "Resultado salvo" || exame.status === "Em retificação" ? "Assinar e Liberar" : "Analisar e Liberar"}
                        </button>
                      )}
                      </>
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
        <div className="hidden lg:flex flex-row gap-0 min-h-[calc(100vh-140px)] bg-card rounded-xl overflow-hidden border shadow-sm">
          {/* Sidebar */}
          <div className="w-80 shrink-0 border-r border-border flex flex-col max-h-[calc(100vh-140px)]">
              {/* Sidebar header: progress + counters */}
              <div className="p-4 border-b bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Progresso</span>
                  <span className="text-xs font-bold text-foreground">{concluidos}/{counters.total} · {progresso}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-status-success transition-all"
                    style={{ width: `${progresso}%` }}
                  />
                </div>
                {counters.pendentes > 0 && (
                  <button
                    onClick={goToNextPendente}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
                  >
                    Próximo pendente
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="p-4 pb-2">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar mnemônico ou nome"
                    className="pl-10 pr-3 py-2 w-full bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                </div>

                {/* Status filter chips — sempre em uma linha; oculta os zerados (exceto Todos e o filtro ativo) */}
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
                      className={`flex-1 min-w-0 px-1.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-tight transition-colors whitespace-nowrap ${
                        statusFilter === f.key
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {f.label} <span className="opacity-70">{f.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">

                {filteredExames.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-8">Nenhum exame nesse filtro.</p>
                )}
                {filteredExames.map((exame) => {
                  const liberado = isExameLiberado(exame.status);
                  const isSelected = selectedExameId === exame.id;
                  const dbId = dbIdMap[exame.id];
                  const dbRow = dbRows.find((r) => r.id === dbId);
                  const isTerc = isExameTerceirizadaById(exame.id) || isExameTerceirizada(exame.nome);
                  return (
                  <div
                    key={exame.id}
                    className={`rounded-lg border transition-colors ${
                      isSelected ? "bg-accent border-primary/30" : "border-transparent hover:bg-accent/50"
                    }`}
                  >
                    <button
                      onClick={() => setSelectedExameId(exame.id)}
                      className="w-full text-left p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-extrabold tracking-wider text-primary uppercase font-mono truncate">
                          {getMnemonico(exame.nome)}
                        </span>
                        <StatusBadge label={exame.status} type={statusExameMap[exame.status].type} />
                      </div>
                      {isTerc && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <LabBadge
                            tipoProcesso="TERCEIRIZADO"
                            labApoioId={dbRow?.lab_apoio_id ?? null}
                            labApoioNome={getLabNome(exame.nome) || undefined}
                            compact
                          />
                          <span className="text-[10px] font-medium text-muted-foreground truncate">
                            {getLabNome(exame.nome) || "Lab. de apoio"}
                          </span>
                        </div>
                      )}
                      {isTerc && dbRow && (
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
            <div className="px-4 sm:px-6 py-3 border-b bg-card">
              <PacienteHeaderCard
                nome={paciente.nome}
                sexo={paciente.sexo}
                nascimentoBR={isoToBR(paciente.nascimento)}
                idade={paciente.idade}
                protocolo={paciente.protocolo}
                statusLabel={paciente.statusGeral}
                statusType={statusGeralType(paciente.statusGeral)}
                actionsInline={modoConsulta}
                actions={(modoConsulta
                  ? [
                      { key: "auditoria", label: "Auditoria", icon: <ClipboardList className="h-4 w-4" />, onClick: () => setShowAuditoria(true), variant: "ghost" },
                      { key: "imprimir", label: "Imprimir todos", icon: <Printer className="h-4 w-4" />, onClick: () => handleImprimir(paciente.exames), variant: "primary", title: "Imprime apenas exames Assinados e Liberados", disabled: !podeImprimirTodos },
                    ]
                  : [
                      { key: "auditoria", label: "Auditoria", icon: <ClipboardList className="h-4 w-4" />, onClick: () => setShowAuditoria(true), variant: "ghost" },
                      { key: "critico", label: "Comunicar valor crítico", icon: <AlertTriangle className="h-4 w-4" />, onClick: () => setShowCriticoDialog(true), variant: "danger" },
                      { key: "entrega", label: "Registrar entrega", icon: <Send className="h-4 w-4" />, onClick: () => setShowEntregaDialog(true), variant: "ghost" },
                      { key: "imprimir", label: "Imprimir todos", icon: <Printer className="h-4 w-4" />, onClick: () => handleImprimir(paciente.exames), variant: "primary", disabled: !podeImprimirTodos },
                    ]) as PacienteHeaderAction[]}
              />
            </div>

            {/* Exam detail */}
            {selectedExame ? (
              <div className="flex-1 flex flex-col p-5 sm:p-6 overflow-y-auto space-y-5">
                <div className="bg-card rounded-xl p-6 shadow-sm">
                {/* Exam header */}
                <div className="mb-5">
                  <div className="mb-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <h2 className="text-2xl font-extrabold tracking-tight text-foreground leading-tight uppercase min-w-0 flex-1">
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
                          {canLiberar && (
                            <button
                              onClick={() => {
                                if (isBlocked && !retificando) {
                                  setShowRetificarDialog(true);
                                }
                              }}
                              className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              Retificar
                            </button>
                          )}
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
                          Apoio: {getLabNome(selectedExame.nome)}
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

                  {/* Parameters table */}
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 pr-4 text-sm font-semibold text-foreground w-[22%]"></th>
                          <th className="text-left py-3 px-4 text-sm font-bold text-foreground w-[34%]">RESULTADO</th>
                          <th className="text-left py-3 px-2 text-sm font-semibold text-foreground w-[12px]"></th>
                          <th className="text-left py-3 pl-4 text-sm font-bold text-foreground">VALOR DE REFERÊNCIA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedExame.parametros.map((param, idx) => {
                          const ref = getResolvedRef(selectedExame.nome, param);
                          const inRange = isBlocked && param.valor ? isValueInRange(param.valor, ref.refMin, ref.refMax) : null;
                          const isOutOfRange = inRange === false;
                          const nivelCritico = avaliarNivelCritico(selectedExame.nome, param.nome, param.valor);
                          const isCriticoParam = nivelCritico !== "normal";
                          const hasRef = Boolean(ref.refMin || ref.refMax || ref.descricao);
                          return (
                            <Fragment key={idx}>
                            {param.headerAntes && (
                              <tr>
                                <td className="pt-4 pb-1 pr-4 text-sm font-bold uppercase tracking-wide text-foreground whitespace-nowrap">
                                  {param.headerAntes}
                                </td>
                                <td className="pt-4 pb-1" />
                                <td className="pt-4 pb-1" />
                                <td className="pt-4 pb-1" />
                              </tr>
                            )}
                            <tr>
                              <td className="py-1.5 pr-4 text-sm font-medium text-foreground">
                                {param.nome}
                                {param.obrigatorio && <span className="text-status-danger ml-0.5">*</span>}
                                {isCriticoParam && (
                                  <span title={nivelCritico === "critico_baixo" ? "Crítico baixo (pânico)" : "Crítico alto (pânico)"}>
                                    <AlertOctagon className="inline h-3.5 w-3.5 ml-1.5 text-status-danger animate-pulse" />
                                  </span>
                                )}
                              </td>
                              <td className="py-1.5 px-4">
                                {isBlocked && !retificando ? (
                                  <div className="flex items-center gap-2">
                                    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 w-full ${isCriticoParam ? "bg-status-danger/10 border border-status-danger/40" : "bg-accent/50"}`}>
                                      {inRange !== null && (
                                        inRange ? (
                                          <CheckCircle2 className="h-5 w-5 text-status-success shrink-0" />
                                        ) : (
                                          <AlertCircle className="h-5 w-5 text-status-danger shrink-0" />
                                        )
                                      )}
                                      {param.valor ? (
                                        <>
                                          <span className={`text-sm font-bold ${(isOutOfRange || isCriticoParam) ? "text-status-danger" : "text-foreground"}`}>
                                            {param.tipo === "Select" ? param.valor.toUpperCase() : param.valor}
                                          </span>
                                          <span className="text-sm text-muted-foreground">{param.unidade}</span>
                                        </>
                                      ) : (
                                        <span className="text-sm text-muted-foreground italic">—</span>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <ParamTypedInput
                                      param={param}
                                      isCritico={isCriticoParam}
                                      onChange={(v) => updateParametro(selectedExame.id, idx, v)}
                                      disabled={modoConsulta || selectedExame.status === "Cancelado" || !isEditable}
                                      className="w-28 sm:w-36"
                                    />
                                    <span className="text-sm text-muted-foreground">{param.unidade}</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-1.5 px-1">
                                {isBlocked && param.valor && inRange !== null && (
                                  <div className={`w-1.5 h-8 rounded-full ${isOutOfRange ? "bg-status-danger" : "bg-status-success"}`} />
                                )}
                              </td>
                              <td className="py-1.5 pl-4">
                                <div className="flex items-center gap-1">
                                  <div className="flex-1 min-w-0">
                                    {(ref.refMin || ref.refMax) ? (
                                      <>
                                        <span className="inline-flex items-center gap-2 px-3 py-2 bg-accent/50 rounded-lg text-sm text-foreground w-full">
                                          <span className="truncate">{ref.refMin} - {ref.refMax}</span>
                                          <span className="text-muted-foreground ml-1">{ref.refUnidade}</span>
                                        </span>
                                        {ref.descricao && (
                                          <p className="text-[10px] text-muted-foreground italic mt-0.5 pl-3 whitespace-pre-line">{ref.descricao}</p>
                                        )}
                                      </>
                                    ) : ref.descricao ? (
                                      <span className="inline-flex items-center gap-2 px-3 py-2 bg-accent/50 rounded-lg text-sm text-foreground whitespace-pre-line w-full">
                                        {ref.descricao}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-2 px-3 py-2 bg-accent/30 rounded-lg text-sm text-muted-foreground italic w-full">
                                        Sem referência
                                      </span>
                                    )}
                                  </div>
                                  {hasRef && <div className="w-1.5 h-8 rounded-full bg-foreground/80 ml-1 shrink-0" />}
                                </div>
                              </td>
                            </tr>
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Observação */}
                  <div className="mt-4">
                    <label className="text-sm font-medium text-foreground">Observação</label>
                    <textarea
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 resize-none disabled:cursor-not-allowed disabled:opacity-60"
                      rows={2}
                      placeholder=""
                      disabled={modoConsulta || isExameBloqueado(selectedExame.status) || selectedExame.status === "Cancelado"}
                    />
                  </div>
                  </>
                  )}
                </div>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col p-5 sm:p-6 overflow-y-auto">
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm bg-card rounded-xl shadow-sm min-h-[200px]">
                  Selecione um exame na lista lateral.
                </div>
              </div>
            )}

            {/* Footer bar */}
            <div className="border-t px-5 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8 border-2 border-status-info">
                  <AvatarFallback className="bg-status-info-bg text-status-info text-xs font-semibold">
                    {analistaAtual.iniciais}
                  </AvatarFallback>
                </Avatar>
                {modoConsulta ? (
                  <span className="text-sm text-foreground">
                    <span className="text-muted-foreground">Analisado por:</span>{" "}
                    <span className="font-medium">{analistaAtual.nome}</span>
                  </span>
                ) : (
                  <>
                    <span className="text-sm text-foreground font-medium">{analistaAtual.nome}</span>
                    <button
                      onClick={() => {
                        setAnalistaEmail("");
                        setAnalistaSenha("");
                        setAnalistaErro("");
                        setShowAlterarAnalista(true);
                      }}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground border rounded-lg px-2.5 py-1 transition-colors"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Alterar
                    </button>
                  </>
                )}
              </div>

              {!selectedIsTerceirizada && !modoConsulta && (
              <div className="flex items-center gap-3">
                {canCancelarExame && (
                  <button
                    onClick={handleCancelarAnalise}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancelar análise
                  </button>
                )}
                <button
                  onClick={() => setShowRecoletaDialog(true)}
                  className="text-sm text-warning hover:text-warning/80 transition-colors"
                  title="Solicitar nova coleta da amostra"
                >
                  Solicitar recoleta
                </button>
                {canAnalisar && (
                  <button
                    onClick={handleSalvar}
                    className="px-4 py-2 border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
                  >
                    Salvar resultado
                  </button>
                )}
                {canLiberar && (
                  <button
                    onClick={() => setShowConfirmarLiberar(true)}
                    className="text-sm text-foreground font-medium hover:text-foreground/80 transition-colors"
                  >
                    {isBlocked ? "Assinar e Liberar" : "Analisar e Liberar"}
                  </button>
                )}
              </div>
              )}
              {/* spacer kept for layout consistency */}
              {false && null}
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
                  const dbId = dbIdMap[selectedExameId];
                  if (dbId) {
                    // Volta exame para "em_analise" no banco (libera para edição) e limpa resultados.
                    // A justificativa precisa ir junto na mesma transação/RPC da mutação.
                    const res = await updateAtendimentoExame(dbId, {
                      status: "em_analise",
                      resultados: {},
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
                        ? { ...e, status: "Em retificação" as ExameStatus, parametros: e.parametros.map((p) => ({ ...p, valor: "" })) }
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
