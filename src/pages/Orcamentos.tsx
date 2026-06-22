import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, ArrowRightLeft, Receipt, Search, Phone, MessageCircle, Tag, Send, Printer, FileText, Flame, Clock, AlertTriangle, CheckCircle2, TrendingUp, DollarSign, Wallet, Activity, CalendarClock, Sparkles, Cake } from "lucide-react";
import { getOrcamentos, markAsConverted, subscribeOrcamentos, updateOrcamentoDesconto, type Orcamento } from "@/data/orcamentoStore";
import { addAtendimento, getNextProtocolo } from "@/data/atendimentoStore";
import { getPacienteByCPF } from "@/data/pacienteStore";
import { formatIdadeDetalhada, isAniversarioHoje } from "@/lib/idade";
import ResultadoPopup from "@/components/ResultadoPopup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StandardDialog from "@/components/ui/standard-dialog";
import PdfPreviewDialog from "@/components/PdfPreviewDialog";
import { buildOrcamentoHtml } from "@/lib/comprovantes";
import { enqueueNotification, buildIdempotencyKey } from "@/lib/whatsapp/enqueueNotification";
import { useAuth } from "@/contexts/AuthContext";
import { showError } from "@/lib/showError";
import { toast } from "sonner";
import { useEnsureStore } from "@/hooks/useEnsureStore";
import { PageHeader } from "@/components/shared/PageHeader";

import { fmtBRL, fmtBRLNumber, searchNormalize } from "@/lib/utils";
const Orcamentos = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Lazy-load do store de orçamentos (Fase F): hidrata on-demand ao entrar na rota.
  useEnsureStore("orcamentos");
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>(getOrcamentos());
  const [searchQuery, setSearchQuery] = useState("");
  const [detailOrc, setDetailOrc] = useState<Orcamento | null>(null);
  const [convertSuccess, setConvertSuccess] = useState(false);
  const [convertedProtocolo, setConvertedProtocolo] = useState("");
  const [showDesconto, setShowDesconto] = useState(false);
  const [descontoValue, setDescontoValue] = useState("");
  const [descontoAplicado, setDescontoAplicado] = useState(0);
  const [convertDialogOrc, setConvertDialogOrc] = useState<Orcamento | null>(null);
  const [convertDescontoEnabled, setConvertDescontoEnabled] = useState(false);
  const [convertDescontoValue, setConvertDescontoValue] = useState("");
  const [convertDescontoApplied, setConvertDescontoApplied] = useState(0);
  const [showWhatsappAfterConvert, setShowWhatsappAfterConvert] = useState(false);
  const [convertedOrcForWhatsapp, setConvertedOrcForWhatsapp] = useState<Orcamento | null>(null);
  const [previewOrc, setPreviewOrc] = useState<Orcamento | null>(null);

  useEffect(() => {
    const unsub = subscribeOrcamentos(() => setOrcamentos([...getOrcamentos()]));
    return unsub;
  }, []);


  const openConvertDialog = (orc: Orcamento) => {
    setConvertDialogOrc(orc);
    setConvertDescontoEnabled(false);
    setConvertDescontoValue("");
    setConvertDescontoApplied(0);
  };

  const confirmConvert = async () => {
    if (!convertDialogOrc) return;
    const orc = convertDialogOrc;
    const today = new Date();
    const dataStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
    const protocolo = getNextProtocolo();
    const cpfDigits = (orc.cpf || "").replace(/\D/g, "");
    const paciente = cpfDigits ? getPacienteByCPF(cpfDigits) : undefined;
    const nascimento = paciente?.dataNascimento ?? "";
    const idade = nascimento ? formatIdadeDetalhada(nascimento) : "";

    // Persistir desconto adicional aplicado no diálogo de conversão (se houver)
    // Mantém desconto original + acréscimo aplicado agora.
    if (convertDescontoApplied > 0) {
      const novoDesconto = orc.desconto + convertDescontoApplied;
      const novoTotal = Math.max(0, orc.subtotal - novoDesconto);
      try {
        await updateOrcamentoDesconto(orc.id, novoDesconto, novoTotal);
      } catch (e) {
        showError(e, { scope: "Orcamentos.confirmConvert.desconto", userMessage: "Não foi possível aplicar o desconto." });
        return;
      }
    }

    try {
      await addAtendimento({
        protocolo, data: dataStr, nome: orc.nome, cpf: orc.cpf, nascimento, idade,
        statusAtendimento: { label: "Pedido Realizado", type: "neutral" },
        statusPagamento: { label: "Pagamento pendente", type: "warning" },
        solicitante: orc.solicitante, convenio: orc.convenio, exames: orc.exames,
        unidadeId: user?.unidadeAtiva,
      });
      await markAsConverted(orc.id);
      setConvertedProtocolo(protocolo);
      setConvertedOrcForWhatsapp(orc);
      setConvertDialogOrc(null);
      setDetailOrc(null);
      setShowWhatsappAfterConvert(true);
    } catch (e) {
      showError(e, { scope: "Orcamentos.confirmConvert", userMessage: "Não foi possível converter o orçamento em atendimento." });
    }
  };

  // ===== Inteligência Fase 1: validade, score, temperatura =====
  const VALIDADE_DIAS = 30;

  const parseOrcDate = (dataStr: string): Date | null => {
    // Formato: "dd/mm/yyyy HH:mm:ss" ou "dd/mm/yyyy"
    const m = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(dataStr || "");
    if (!m) return null;
    const [, dd, mm, yyyy, hh = "0", mi = "0", ss = "0"] = m;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss));
    return isNaN(d.getTime()) ? null : d;
  };

  const diasDesde = (dataStr: string): number => {
    const d = parseOrcDate(dataStr);
    if (!d) return 0;
    const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
    return Math.floor(diff);
  };

  const diasParaVencer = (dataStr: string): number => VALIDADE_DIAS - diasDesde(dataStr);

  type Temperatura = "hot" | "followup" | "risco" | "convertido" | "expirado";

  const calcScore = (orc: Orcamento): number => {
    if (orc.convertido) return 100;
    const dias = diasDesde(orc.data);
    let score = 50;
    // Frescor
    if (dias <= 2) score += 35;
    else if (dias <= 7) score += 15;
    else if (dias <= 14) score -= 10;
    else score -= 30;
    // Particular costuma fechar mais rápido
    if (/particular/i.test(orc.convenio)) score += 8;
    // Ticket alto = mais friction
    if (orc.total > 800) score -= 10;
    else if (orc.total < 200) score += 5;
    // Tem telefone = canal de retomada
    if ((orc.telefone || "").replace(/\D/g, "").length >= 10) score += 12;
    // Paciente já é cliente (CPF cadastrado)
    if (orc.cpf && getPacienteByCPF(orc.cpf.replace(/\D/g, ""))) score += 15;
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const getTemperatura = (orc: Orcamento): Temperatura => {
    if (orc.convertido) return "convertido";
    const dias = diasDesde(orc.data);
    if (dias > VALIDADE_DIAS) return "expirado";
    const score = calcScore(orc);
    if (score >= 70 && dias <= 3) return "hot";
    if (dias >= 14) return "risco";
    return "followup";
  };

  const enriched = useMemo(() => orcamentos.map(o => ({
    orc: o,
    score: calcScore(o),
    temperatura: getTemperatura(o),
    diasRestantes: diasParaVencer(o.data),
    dias: diasDesde(o.data),
  })), [orcamentos]);

  const [tempTab, setTempTab] = useState<"todos" | Temperatura>("todos");

  const filtered = useMemo(() => {
    return enriched.filter(({ orc, temperatura }) => {
      if (tempTab !== "todos" && temperatura !== tempTab) return false;
      if (!searchQuery.trim()) return true;
      const q = searchNormalize(searchQuery);
      return searchNormalize(orc.nome).includes(q) || searchNormalize(orc.id).includes(q) || searchNormalize(orc.convenio).includes(q);
    });
  }, [enriched, searchQuery, tempTab]);

  // ===== KPIs =====
  const kpis = useMemo(() => {
    const ativos = enriched.filter(e => !e.orc.convertido && e.temperatura !== "expirado");
    const pendentes = ativos.length;
    const convertidos = enriched.filter(e => e.orc.convertido).length;
    const total30d = enriched.filter(e => e.dias <= 30).length;
    const taxa = total30d > 0 ? Math.round((convertidos / Math.max(1, total30d)) * 100) : 0;
    const receitaPendente = ativos.reduce((s, e) => s + e.orc.total, 0);
    const ticketMedio = ativos.length > 0 ? receitaPendente / ativos.length : 0;
    const emRisco = enriched.filter(e => e.temperatura === "risco").reduce((s, e) => s + e.orc.total, 0);
    return { pendentes, convertidos, taxa, receitaPendente, ticketMedio, emRisco };
  }, [enriched]);

  const tempCounts = useMemo(() => ({
    todos: enriched.length,
    hot: enriched.filter(e => e.temperatura === "hot").length,
    followup: enriched.filter(e => e.temperatura === "followup").length,
    risco: enriched.filter(e => e.temperatura === "risco").length,
    convertido: enriched.filter(e => e.temperatura === "convertido").length,
    expirado: enriched.filter(e => e.temperatura === "expirado").length,
  }), [enriched]);

  const tempBadge = (t: Temperatura) => {
    const map: Record<Temperatura, { label: string; cls: string; Icon: typeof Flame }> = {
      hot:        { label: "Quente",      cls: "bg-[hsl(var(--status-error))]/10 text-[hsl(var(--status-error))]", Icon: Flame },
      followup:   { label: "Follow-up",   cls: "bg-[hsl(var(--status-warning))]/10 text-[hsl(var(--status-warning))]", Icon: Clock },
      risco:      { label: "Em risco",    cls: "bg-[hsl(var(--status-purple))]/10 text-[hsl(var(--status-purple))]", Icon: AlertTriangle },
      convertido: { label: "Convertido",  cls: "bg-[hsl(var(--status-success))]/10 text-[hsl(var(--status-success))]", Icon: CheckCircle2 },
      expirado:   { label: "Expirado",    cls: "bg-muted text-muted-foreground", Icon: AlertTriangle },
    };
    const { label, cls, Icon } = map[t];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold ${cls}`}>
        <Icon className="h-3 w-3" /> {label}
      </span>
    );
  };

  const validadeBadge = (diasRest: number, convertido: boolean) => {
    if (convertido) return null;
    if (diasRest < 0) {
      return <span className="whitespace-nowrap text-[10px] font-semibold text-[hsl(var(--status-error))]">Vencido há {Math.abs(diasRest)}d</span>;
    }
    if (diasRest <= 3) {
      return <span className="whitespace-nowrap text-[10px] font-semibold text-[hsl(var(--status-warning))]">Vence em {diasRest}d ⚠️</span>;
    }
    if (diasRest <= 7) {
      return <span className="whitespace-nowrap text-[10px] font-medium text-[hsl(var(--status-warning))]">{diasRest}d restantes</span>;
    }
    return <span className="whitespace-nowrap text-[10px] text-muted-foreground">{diasRest}d restantes</span>;
  };

    // Resolve idade detalhada e flag de aniversário a partir do CPF do orçamento
  const getPacienteInfo = (cpf: string): { idade: string; aniversario: boolean } => {
    if (!cpf) return { idade: "", aniversario: false };
    const p = getPacienteByCPF(cpf);
    if (!p?.dataNascimento) return { idade: "", aniversario: false };
    return { idade: formatIdadeDetalhada(p.dataNascimento), aniversario: isAniversarioHoje(p.dataNascimento) };
  };

  // WhatsApp 2.0 (Fase 3D.2): templates comerciais de marketing
  // (lembrete/reforço/última chance) foram REMOVIDOS. O SISLAC não
  // possui módulo de marketing — apenas notificações operacionais via
  // enqueueNotification() / Outbox / Meta.


  // ===== Fase 3: Desconto inteligente sugerido =====
  // Heurística: cruza temperatura + score + dias para sugerir um % de desconto
  // que aumenta o probabilidade de fechamento sem comprometer a margem.
  const sugerirDescontoPct = (temperatura: Temperatura, score: number, dias: number): number => {
    if (temperatura === "convertido") return 0;
    if (temperatura === "expirado") return 15;            // "última cartada" para reativar
    if (temperatura === "risco") {
      // 5–10% em função do score (quanto menor o score, mais agressivo)
      if (score < 25) return 10;
      if (score < 40) return 8;
      return 5;
    }
    if (dias >= 12) return 10;                            // borderline última chance
    if (temperatura === "followup" && dias >= 7) return 5;
    return 0;                                             // hot / followup recente: não queimar margem
  };

  const motivoDesconto = (temperatura: Temperatura, dias: number): string => {
    if (temperatura === "expirado") return "Reativação de orçamento expirado";
    if (temperatura === "risco") return `Lead frio há ${dias}d — incentivo ao fechamento`;
    if (dias >= 12) return "Próximo do vencimento — gatilho de urgência";
    if (temperatura === "followup" && dias >= 7) return "Follow-up sem retorno — empurrão final";
    return "Lead aquecido — desconto não recomendado";
  };




  const tempTabs: { key: "todos" | Temperatura; label: string; count: number; Icon: typeof Flame; tone: string }[] = [
    { key: "todos",      label: "Todos",      count: tempCounts.todos,      Icon: Receipt,        tone: "text-foreground" },
    { key: "hot",        label: "Quentes",    count: tempCounts.hot,        Icon: Flame,          tone: "text-[hsl(var(--status-error))]" },
    { key: "followup",   label: "Follow-up",  count: tempCounts.followup,   Icon: Clock,          tone: "text-[hsl(var(--status-warning))]" },
    { key: "risco",      label: "Em risco",   count: tempCounts.risco,      Icon: AlertTriangle,  tone: "text-[hsl(var(--status-purple))]" },
    { key: "convertido", label: "Convertidos",count: tempCounts.convertido, Icon: CheckCircle2,   tone: "text-[hsl(var(--status-success))]" },
    { key: "expirado",   label: "Expirados",  count: tempCounts.expirado,   Icon: AlertTriangle,  tone: "text-muted-foreground" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Header (design system unificado SA) */}
        <PageHeader
          eyebrow="Comercial"
          title="Orçamentos"
          description={`Pipeline inteligente · validade ${VALIDADE_DIAS} dias.`}
        />

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          {[
            { label: "Pendentes",        value: String(kpis.pendentes),                     Icon: Activity,      bg: "bg-[hsl(var(--status-warning))]/10", color: "text-[hsl(var(--status-warning))]" },
            { label: "Receita pendente", value: fmtBRL(kpis.receitaPendente),               Icon: Wallet,        bg: "bg-primary/10",                       color: "text-primary" },
            { label: "Ticket médio",     value: fmtBRL(kpis.ticketMedio),                   Icon: DollarSign,    bg: "bg-muted",                            color: "text-foreground" },
            { label: "Taxa conversão",   value: `${kpis.taxa}%`,                            Icon: TrendingUp,    bg: "bg-[hsl(var(--status-success))]/10", color: "text-[hsl(var(--status-success))]" },
            { label: "Receita em risco", value: fmtBRL(kpis.emRisco),                       Icon: AlertTriangle, bg: "bg-[hsl(var(--status-error))]/10",   color: "text-[hsl(var(--status-error))]" },
          ].map((k, i) => {
            const Icon = k.Icon;
            return (
              <div key={i} className="rounded-2xl border border-border bg-card px-3 py-2.5 sm:px-4 sm:py-3 flex items-center gap-2 sm:gap-3 min-w-0">
                <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shrink-0 ${k.bg}`}>
                  <Icon className={`h-4 w-4 ${k.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] sm:text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate">{k.label}</p>
                  <p className="text-xs sm:text-sm font-bold tracking-tight text-foreground truncate">{k.value}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabs por temperatura + Search */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex gap-1 p-1 bg-muted/50 rounded-2xl border border-border/40 overflow-x-auto no-scrollbar w-full lg:w-auto max-w-full">
            {tempTabs.map(t => {
              const Icon = t.Icon;
              const active = tempTab === t.key;
              return (
                <button key={t.key} onClick={() => setTempTab(t.key)}
                  className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? t.tone : ""}`} />
                  <span>{t.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-lg font-semibold ${active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{t.count}</span>
                </button>
              );
            })}
          </div>
          <div className="relative flex-1 lg:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por nome, código ou convênio..."
              className="pl-10 pr-4 py-2.5 w-full bg-card border border-border/60 rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 rounded-3xl border border-border/60 bg-card">
            <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3"><Receipt className="h-6 w-6 text-muted-foreground/50" /></div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum orçamento nesta categoria</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 xl:hidden">
              {filtered.map(({ orc, score, temperatura, diasRestantes }) => {
                return (
                <div key={orc.id} className="bg-card border border-border/60 rounded-3xl p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {(() => {
                        const info = getPacienteInfo(orc.cpf);
                        return (
                          <>
                            <p className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
                              {orc.nome}
                              {info.aniversario && <Cake className="h-4 w-4 text-[hsl(var(--status-warning))] shrink-0" />}
                            </p>
                            {info.idade && <p className="text-[11px] text-muted-foreground mt-0.5">{info.idade}</p>}
                          </>
                        );
                      })()}
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">{orc.id} · {orc.data.split(" ")[0]}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        {tempBadge(temperatura)}
                        {validadeBadge(diasRestantes, orc.convertido)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-foreground">{fmtBRL(orc.total)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Score {score}</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={() => setDetailOrc(orc)} className="flex-1 min-w-0 py-2 px-3 rounded-2xl border border-border/60 text-sm font-medium text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap">
                      <Eye className="h-4 w-4 text-muted-foreground shrink-0" /> Detalhes
                    </button>
                  </div>
                </div>
                );
              })}

            </div>

            {/* Desktop table */}
            <div className="hidden xl:block bg-card rounded-3xl border border-border/60 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/20">
                      <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Código</th>
                      <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Paciente</th>
                      <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Total</th>
                      <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Score</th>
                      <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Temperatura</th>
                      <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Validade</th>
                      <th className="text-right px-4 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(({ orc, score, temperatura, diasRestantes }) => {
                      const scoreCls = score >= 70 ? "text-[hsl(var(--status-success))]" : score >= 40 ? "text-[hsl(var(--status-warning))]" : "text-[hsl(var(--status-error))]";

                      return (
                        <tr key={orc.id} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors group cursor-pointer" onClick={() => setDetailOrc(orc)}>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="font-mono text-xs text-foreground">{orc.id}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">{orc.data.split(" ")[0]}</div>
                          </td>
                          <td className="px-4 py-3.5 max-w-[260px]">
                            {(() => {
                              const info = getPacienteInfo(orc.cpf);
                              return (
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-foreground truncate" title={orc.nome}>{orc.nome}</span>
                                    {info.aniversario && (
                                      <span title="Aniversariante hoje 🎉" className="shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-full bg-[hsl(var(--status-warning))]/15">
                                        <Cake className="h-3 w-3 text-[hsl(var(--status-warning))]" />
                                      </span>
                                    )}
                                  </div>
                                  {info.idade && <div className="text-[11px] text-muted-foreground mt-0.5 truncate" title={info.idade}>{info.idade}</div>}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3.5 font-bold text-foreground whitespace-nowrap">{fmtBRL(orc.total)}</td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className={`h-full ${score >= 70 ? "bg-[hsl(var(--status-success))]" : score >= 40 ? "bg-[hsl(var(--status-warning))]" : "bg-[hsl(var(--status-error))]"}`} style={{ width: `${score}%` }} />
                              </div>
                              <span className={`text-xs font-bold ${scoreCls}`}>{score}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">{tempBadge(temperatura)}</td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <CalendarClock className="h-3 w-3 text-muted-foreground shrink-0" />
                              {validadeBadge(diasRestantes, orc.convertido) ?? <span className="text-[10px] text-[hsl(var(--status-success))] font-semibold">—</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setDetailOrc(orc)} className="p-2 rounded-xl border border-border/60 hover:bg-muted transition-colors shrink-0"><Eye className="h-4 w-4 text-muted-foreground" /></button>
                            </div>

                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail dialog */}
      <StandardDialog
        open={!!detailOrc}
        onClose={() => { setDetailOrc(null); setShowDesconto(false); setDescontoValue(""); setDescontoAplicado(0); }}
        icon={<Receipt className="h-5 w-5 text-primary" />}
        title="Detalhes do orçamento"
        subtitle={detailOrc ? `${detailOrc.id} — ${detailOrc.data}` : undefined}
        maxWidth="lg"
      >
        {detailOrc && (
          <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {[
                { label: "Paciente", value: detailOrc.nome },
                { label: "Convênio", value: detailOrc.convenio },
                { label: "Solicitante", value: detailOrc.solicitante || "—" },
                { label: "Status", value: detailOrc.convertido ? "Convertido" : "Pendente" },
              ].map((item) => (
                <div key={item.label} className="p-3 rounded-2xl bg-muted/40 border border-border/30 min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase">{item.label}</p>
                  <p className="text-sm font-medium text-foreground mt-0.5 break-words">{item.value}</p>
                </div>
              ))}
            </div>

            {detailOrc.telefone && (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border border-border/30">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground flex-1">{detailOrc.telefone}</span>
              </div>
            )}


            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Exames ({detailOrc.exames.length})</p>
              <div className="rounded-2xl border border-border/30 divide-y divide-border/20 max-h-40 overflow-y-auto">
                {detailOrc.exames.map((e, i) => <div key={i} className="px-4 py-2.5 text-sm text-foreground">{e}</div>)}
              </div>
            </div>

            <div className="rounded-2xl bg-muted/40 border border-border/30 p-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-medium text-foreground">R$ {fmtBRLNumber(detailOrc.subtotal)}</span></div>
              {(detailOrc.desconto > 0 || descontoAplicado > 0) && (
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Desconto</span><span className="text-[hsl(var(--status-success))] font-medium">- R$ {fmtBRLNumber((detailOrc.desconto + descontoAplicado))}</span></div>
              )}
              <div className="border-t border-border/30 pt-2 flex justify-between text-base font-bold"><span>Total</span><span>R$ {fmtBRLNumber(Math.max(0, detailOrc.total - descontoAplicado))}</span></div>
            </div>

            {!detailOrc.convertido && (() => {
              const t = getTemperatura(detailOrc);
              const s = calcScore(detailOrc);
              const d = diasDesde(detailOrc.data);
              const pct = sugerirDescontoPct(t, s, d);
              const valorSugerido = +(detailOrc.total * (pct / 100)).toFixed(2);
              return (
                <div className="space-y-3">
                  {pct > 0 && descontoAplicado === 0 && (
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Sparkles className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-xs font-bold text-foreground">Desconto sugerido pela IA</p>
                            <span className="text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">IA</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">{motivoDesconto(t, d)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sugestão</p>
                          <p className="text-base font-bold text-foreground">{pct}% <span className="text-xs font-medium text-muted-foreground">· {fmtBRL(valorSugerido)}</span></p>
                        </div>
                        <button
                          onClick={() => {
                            const novoDesc = detailOrc.desconto + valorSugerido;
                            const novoTotal = Math.max(0, detailOrc.subtotal - novoDesc);
                            updateOrcamentoDesconto(detailOrc.id, novoDesc, novoTotal);
                            setDescontoAplicado(valorSugerido);
                            setShowDesconto(false);
                          }}
                          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5" /> Aplicar {pct}%
                        </button>
                      </div>
                    </div>
                  )}
                  {!showDesconto ? (
                    <button onClick={() => setShowDesconto(true)} className="w-full py-2.5 rounded-2xl border border-border/60 text-sm font-medium text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2"><Tag className="h-4 w-4" /> {descontoAplicado > 0 ? "Ajustar desconto manualmente" : "Oferecer desconto manual"}</button>
                  ) : (
                    <div className="rounded-2xl border border-border/30 p-4 space-y-3">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">Valor do desconto (R$)</p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input type="number" min="0" max={detailOrc.total} step="0.01" placeholder="0,00" value={descontoValue} onChange={(e) => setDescontoValue(e.target.value)} className="rounded-xl" />
                        <Button size="sm" className="rounded-xl px-4 shrink-0" onClick={() => {
                          const val = parseFloat(descontoValue);
                          if (!isNaN(val) && val > 0 && val <= detailOrc.total) {
                            const novoDesc = detailOrc.desconto + val;
                            const novoTotal = Math.max(0, detailOrc.subtotal - novoDesc);
                            updateOrcamentoDesconto(detailOrc.id, novoDesc, novoTotal);
                            setDescontoAplicado(val);
                          }
                        }}>Aplicar</Button>
                        <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground shrink-0" onClick={() => {
                          // Cancelar: zera o desconto adicional aplicado nesta sessão (mantém desconto original)
                          if (descontoAplicado > 0) {
                            const novoDesc = Math.max(0, detailOrc.desconto);
                            const novoTotal = Math.max(0, detailOrc.subtotal - novoDesc);
                            updateOrcamentoDesconto(detailOrc.id, novoDesc, novoTotal);
                          }
                          setShowDesconto(false); setDescontoValue(""); setDescontoAplicado(0);
                        }}>Cancelar</Button>
                      </div>
                      {descontoAplicado > 0 && <p className="text-xs text-[hsl(var(--status-success))] font-medium">✓ Desconto de R$ {fmtBRLNumber(descontoAplicado)} aplicado</p>}
                    </div>
                  )}
                </div>
              );
            })()}

            <button onClick={() => setPreviewOrc(detailOrc)} className="w-full py-2.5 rounded-2xl text-sm font-semibold text-primary-foreground bg-primary hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <FileText className="h-4 w-4" /> Pré-visualizar PDF
            </button>

            {!detailOrc.convertido && (
              <button onClick={() => openConvertDialog(detailOrc)} className="w-full py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
                <ArrowRightLeft className="h-4 w-4" /> Converter em atendimento
              </button>
            )}
          </div>
        )}
      </StandardDialog>

      {/* Convert dialog */}
      <StandardDialog
        open={!!convertDialogOrc}
        onClose={() => { setConvertDialogOrc(null); setConvertDescontoEnabled(false); setConvertDescontoValue(""); setConvertDescontoApplied(0); }}
        icon={<ArrowRightLeft className="h-5 w-5 text-primary" />}
        title="Converter orçamento"
        subtitle={convertDialogOrc ? `${convertDialogOrc.id} — ${convertDialogOrc.nome}` : undefined}
        maxWidth="md"
      >
        {convertDialogOrc && (
          <div className="px-6 py-5 space-y-4">
            <div className="rounded-2xl bg-muted/40 border border-border/30 p-4 space-y-2">
              <div className="flex justify-between text-sm"><span>Subtotal</span><span className="font-medium">R$ {fmtBRLNumber(convertDialogOrc.subtotal)}</span></div>
              {(convertDialogOrc.desconto > 0 || convertDescontoApplied > 0) && (
                <div className="flex justify-between text-sm"><span>Desconto</span><span className="text-[hsl(var(--status-success))] font-medium">- R$ {fmtBRLNumber((convertDialogOrc.desconto + convertDescontoApplied))}</span></div>
              )}
              <div className="border-t border-border/30 pt-2 flex justify-between text-base font-bold"><span>Total</span><span>R$ {fmtBRLNumber(Math.max(0, convertDialogOrc.total - convertDescontoApplied))}</span></div>
            </div>
            {(() => {
              const t = getTemperatura(convertDialogOrc);
              const s = calcScore(convertDialogOrc);
              const d = diasDesde(convertDialogOrc.data);
              const pct = sugerirDescontoPct(t, s, d);
              const valorSugerido = +(convertDialogOrc.total * (pct / 100)).toFixed(2);
              return (
                <>
                  {pct > 0 && convertDescontoApplied === 0 && (
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Sparkles className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-xs font-bold text-foreground">Desconto sugerido pela IA</p>
                            <span className="text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">IA</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">{motivoDesconto(t, d)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sugestão</p>
                          <p className="text-base font-bold text-foreground">{pct}% <span className="text-xs font-medium text-muted-foreground">· {fmtBRL(valorSugerido)}</span></p>
                        </div>
                        <button
                          onClick={() => { setConvertDescontoApplied(valorSugerido); setConvertDescontoEnabled(false); }}
                          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5" /> Aplicar {pct}%
                        </button>
                      </div>
                    </div>
                  )}
                  {!convertDescontoEnabled ? (
                    <button onClick={() => setConvertDescontoEnabled(true)} className="w-full py-2.5 rounded-2xl border border-border/60 text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"><Tag className="h-4 w-4" /> {convertDescontoApplied > 0 ? "Ajustar desconto manualmente" : "Oferecer desconto manual"}</button>
                  ) : (
                    <div className="rounded-2xl border border-border/30 p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input type="number" min="0" max={convertDialogOrc.total} step="0.01" placeholder="0,00" value={convertDescontoValue} onChange={(e) => setConvertDescontoValue(e.target.value)} className="rounded-xl" />
                        <Button size="sm" className="rounded-xl px-4 shrink-0" onClick={() => { const val = parseFloat(convertDescontoValue); if (!isNaN(val) && val > 0 && val <= convertDialogOrc.total) setConvertDescontoApplied(val); }}>Aplicar</Button>
                      </div>
                      {convertDescontoApplied > 0 && <p className="text-xs text-[hsl(var(--status-success))] font-medium">✓ R$ {fmtBRLNumber(convertDescontoApplied)} aplicado</p>}
                    </div>
                  )}
                </>
              );
            })()}
            <button onClick={confirmConvert} className="w-full py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
              <ArrowRightLeft className="h-4 w-4" /> Confirmar conversão
            </button>
          </div>
        )}
      </StandardDialog>

      {/* WhatsApp after conversion */}
      <StandardDialog
        open={showWhatsappAfterConvert}
        onClose={() => { setShowWhatsappAfterConvert(false); setConvertSuccess(true); }}
        icon={<MessageCircle className="h-5 w-5 text-[hsl(142,70%,45%)]" />}
        title="Enviar confirmação"
        subtitle="Orçamento convertido! Deseja notificar o paciente?"
        maxWidth="md"
      >
        {convertedOrcForWhatsapp && (
          <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4">
            <div className="p-3 rounded-2xl bg-muted/40 border border-border/30">
              <p className="text-sm font-medium text-foreground">{convertedOrcForWhatsapp.nome}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{convertedOrcForWhatsapp.telefone} · Protocolo: {convertedProtocolo}</p>
            </div>
            {convertedOrcForWhatsapp.telefone && user?.tenantId ? (
              <button onClick={async () => {
                const orc = convertedOrcForWhatsapp;
                const tenantId = user.tenantId!;
                try {
                  const idempotencyKey = await buildIdempotencyKey([
                    tenantId, "comprovante_atendimento", convertedProtocolo, orc.telefone,
                  ]);
                  await enqueueNotification({
                    tenantId,
                    telefone: orc.telefone,
                    template: "comprovante_atendimento",
                    tipo: "comprovante_atendimento",
                    atendimentoProtocolo: convertedProtocolo,
                    idempotencyKey,
                    variaveis: {
                      1: orc.nome,
                      2: convertedProtocolo,
                      3: `R$ ${fmtBRLNumber(Math.max(0, orc.total - convertDescontoApplied))}`,
                    },
                  });
                  toast.success(`WhatsApp enfileirado para ${orc.nome}.`);
                } catch (e) {
                  showError(e, { scope: "Orcamentos.convertWhatsapp" });
                }
                setShowWhatsappAfterConvert(false); setConvertSuccess(true);
              }} className="w-full py-2.5 rounded-2xl text-sm font-semibold text-white bg-[hsl(142,70%,45%)] hover:opacity-90 transition-opacity flex items-center justify-center gap-2" title="Send mensagem pelo WhatsApp" aria-label="Send mensagem pelo WhatsApp">
                <Send className="h-4 w-4" /> Send WhatsApp
              </button>
            ) : <p className="text-sm text-muted-foreground text-center">Telefone não cadastrado.</p>}
            <button onClick={() => { setShowWhatsappAfterConvert(false); setConvertSuccess(true); }} className="w-full py-2.5 rounded-2xl border border-border/60 text-sm font-medium hover:bg-muted transition-colors">Pular</button>
          </div>
        )}
      </StandardDialog>

      <ResultadoPopup
        open={convertSuccess}
        onOpenChange={(open) => { setConvertSuccess(open); if (!open) navigate("/atendimentos"); }}
        variant="success"
        title="Orçamento convertido com sucesso!"
        description={`Protocolo nº ${convertedProtocolo}.`}
        footer={
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
            <button onClick={() => { setConvertSuccess(false); navigate("/atendimentos"); }} className="flex-1 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">Ver atendimentos</button>
            <button onClick={() => setConvertSuccess(false)} className="flex-1 py-2.5 rounded-2xl border text-sm font-medium hover:bg-muted">Fechar</button>
          </div>
        }
      />

      {previewOrc && (() => {
        const totalFinal = Math.max(0, previewOrc.total - descontoAplicado);
        const orcData = {
          id: previewOrc.id,
          data: previewOrc.data,
          paciente: previewOrc.nome,
          convenio: previewOrc.convenio,
          solicitante: previewOrc.solicitante,
          exames: previewOrc.exames,
          subtotal: previewOrc.subtotal,
          desconto: previewOrc.desconto + descontoAplicado,
          total: totalFinal,
        };
        return (
          <PdfPreviewDialog
            open={!!previewOrc}
            onClose={() => setPreviewOrc(null)}
            html={buildOrcamentoHtml(orcData)}
            filename={`orcamento-${orcData.id}`}
            title={`Orçamento ${orcData.id}`}
            subtitle={`${orcData.paciente} · ${orcData.data}`}
            whatsappPhone={previewOrc.telefone}
            notify={user?.tenantId ? {
              tenantId: user.tenantId,
              template: "orcamento",
              tipo: "orcamento",
              idempotencyParts: [orcData.id, previewOrc.telefone],
              variaveis: (url: string) => ({
                1: orcData.paciente,
                2: orcData.id,
                3: `R$ ${fmtBRLNumber(orcData.total)}`,
                4: url,
              }),
            } : undefined}
          />
        );
      })()}



    </div>
  );
};

export default Orcamentos;
