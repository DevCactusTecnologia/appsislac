import { PageHeader } from "@/components/shared/PageHeader";
// ============================================================================
// OWNERSHIP OFICIAL — Página /mapa: workflow operacional de bancada.
// Tela de triagem, agrupamento e disparo de impressão. NÃO renderiza ciência
// (VR/metodologia/cálculo/snapshot/laudo). Usa o pipeline mapaPrint.ts +
// catch-all oficial via flag `isCatchAll`.
// ============================================================================
import { useState, useMemo, useEffect, useSyncExternalStore } from "react";
import { Printer, Search, ChevronLeft, ChevronRight, Map as MapIcon, FlaskConical, Building2, ClipboardList, Users, Loader2, X, User, FileText, Calendar, CheckCircle2, TestTube2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";
import AnalistaAutocomplete from "@/components/mapa/AnalistaAutocomplete";
import MapaDatePicker from "@/components/mapa/MapaDatePicker";
import {
  type TipoMapa, type MapaFilters,
  setoresFiltro, tipoOptions, normalize,
} from "@/components/mapa/MapaConstants";
import { getAtendimentos, subscribe as subscribeAtendimentos, setAnalistaParaExames } from "@/data/atendimentoStore";
import { getExamesCatalogo, subscribeExamesCatalogo } from "@/data/exameCatalogoStore";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { buildMapasHtml, prefetchParametrosForTickets, type MapaExameTicket } from "@/lib/mapaPrint";
import MapaPreviewDialog, { type MapaOrientation } from "@/components/mapa/MapaPreviewDialog";
import type { MockAtendimento } from "@/data/types";
import { useEnsureStore } from "@/hooks/useEnsureStore";

const tipoIcons: Record<TipoMapa, React.ReactNode> = {
  paciente: <Users className="h-4 w-4" />,
  analista: <FlaskConical className="h-4 w-4" />,
  setor: <Building2 className="h-4 w-4" />,
  exame: <ClipboardList className="h-4 w-4" />,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extrai "yyyy-mm-dd" da string brasileira "dd/MM/yyyy [HH:mm:ss]". */
function brToYmd(br: string | undefined): string {
  if (!br) return "";
  const datePart = br.split(" ")[0];
  const [d, m, y] = datePart.split("/");
  if (!y) return "";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function dateToYmd(d: Date | undefined): string {
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Constrói tickets só dos exames PENDENTES de um conjunto de atendimentos. */
function buildTickets(
  atendimentos: MockAtendimento[],
  catalogoBySigla: Map<string, { id: string; categoria: string; codigo: string; material: string }>,
  filterFn?: (ticket: MapaExameTicket, exame: NonNullable<MockAtendimento["examesCobranca"]>[number], at: MockAtendimento) => boolean,
): MapaExameTicket[] {
  const out: MapaExameTicket[] = [];
  for (const at of atendimentos) {
    const cobranca = at.examesCobranca ?? [];
    for (const ex of cobranca) {
      if ((ex.status ?? "pendente") !== "pendente") continue;
      const meta = catalogoBySigla.get(ex.nome) ?? catalogoBySigla.get(ex.nome.toLowerCase());
      const t: MapaExameTicket = {
        protocolo: at.protocolo,
        paciente: { nome: at.nome, cpf: at.cpf, sexo: "", idade: at.idade, nascimento: at.nascimento },
        guia: at.protocolo,
        // Fallback: se o vínculo direto faltar, resolve pelo nome via catálogo.
        // Isso é essencial para que o template individual seja aplicado quando
        // atendimento_exames.exame_id ainda não estiver populado.
        exameId: ex.exameId ?? meta?.id ?? null,
        exameNome: ex.nome,
        exameCodigo: meta?.codigo ?? "",
        exameMaterial: ex.material || meta?.material || "",
        analista: ex.analista ?? "",
        convenio: at.convenio,
        dataAtendimento: at.data,
        amostraSeq: ex.amostraSeq ?? 1,
        grupoExameId: ex.grupoExameId ?? null,
        isReutilizacao: !!ex.isReutilizacao,
        amostraId: ex.amostraId ?? null,
      };
      if (!filterFn || filterFn(t, ex, at)) out.push(t);
    }
  }
  return out;
}

const Mapa = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  // Lazy-load do store de mapas de trabalho (Fase F).
  useEnsureStore("mapasTrabalho");

  // Subscribe a stores reativos
  const atendimentos = useSyncExternalStore(subscribeAtendimentos, getAtendimentos, getAtendimentos);
  const exames = useSyncExternalStore(subscribeExamesCatalogo, getExamesCatalogo, getExamesCatalogo);

  // Mapeia nome_exame → metadata catálogo (categoria/setor, código, material)
  const catalogoBySigla = useMemo(() => {
    const m = new Map<string, { id: string; categoria: string; codigo: string; material: string }>();
    for (const e of exames) {
      const meta = { id: e.id, categoria: e.categoria || "", codigo: e.codigo || "", material: e.material || "" };
      // Indexa por nome exato e por nome em caixa baixa para tolerar variações
      // como "Hemograma Completo" vs "HEMOGRAMA COMPLETO".
      m.set(e.nome, meta);
      m.set(e.nome.toLowerCase(), meta);
    }
    return m;
  }, [exames]);

  // Setores reais derivados do catálogo (categoria não vazia)
  const setoresReais = useMemo(() => {
    const set = new Set<string>();
    for (const e of exames) if (e.categoria?.trim()) set.add(e.categoria.trim());
    const arr = Array.from(set).sort();
    return arr.length > 0 ? arr : setoresFiltro;
  }, [exames]);

  const [filters, setFilters] = useState<MapaFilters>({
    tipo: "paciente",
    nomePaciente: "",
    nomeAnalista: "",
    filtroSetor: "",
    setorExame: "",
    analistaExame: "",
  });
  const [currentPages, setCurrentPages] = useState<Record<TipoMapa, number>>({ paciente: 1, analista: 1, setor: 1, exame: 1 });
  const [rowsPerPage] = useState(10);
  const [analistaQuery, setAnalistaQuery] = useState("");
  const [printing, setPrinting] = useState(false);

  // Aba Paciente: seleção (multi) de pacientes pendentes
  const [pacientesSelecionados, setPacientesSelecionados] = useState<Set<string>>(new Set());

  // Aba Setor: busca livre + seleção múltipla de setores
  const [setorQuery, setSetorQuery] = useState("");
  const [setoresSelecionados, setSetoresSelecionados] = useState<Set<string>>(new Set());

  // Aba Exame: seleção manual + confirmação
  // Aba Exame: seleção por NOME do exame (agrupado) + busca incremental
  const [exameQuery, setExameQuery] = useState("");
  const [examesNomesSelecionados, setExamesNomesSelecionados] = useState<Set<string>>(new Set());
  useEffect(() => { setExamesNomesSelecionados(new Set()); }, [filters.setorExame, filters.dataExame]);

  // Pré-visualização do PDF
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewTitulo, setPreviewTitulo] = useState("Pré-visualização do mapa");
  const [previewTotal, setPreviewTotal] = useState(0);
  const [previewOrientation, setPreviewOrientation] = useState<MapaOrientation>("portrait");
  // Guarda os tickets+analista da última geração para permitir regenerar
  // quando o usuário alternar a orientação dentro do diálogo.
  const [previewContext, setPreviewContext] = useState<{ tickets: MapaExameTicket[]; analistaLote?: string } | null>(null);

  const updateFilter = <K extends keyof MapaFilters>(key: K, value: MapaFilters[K]) => setFilters(prev => ({ ...prev, [key]: value }));

  // ── Aba Paciente: resultado real ────────────────────────────────────────────
  // Lista TODOS os pacientes com pelo menos um exame pendente, agrupados.
  // A busca é incremental (search-as-you-type) por nome, CPF ou protocolo.
  type PacienteAgrupado = {
    protocolo: string;
    nome: string;
    cpf: string;
    idade: string;
    data: string;
    convenio: string;
    tickets: MapaExameTicket[];
  };

  const pacientesPendentes: PacienteAgrupado[] = useMemo(() => {
    const grupos: PacienteAgrupado[] = [];
    for (const at of atendimentos) {
      const tickets = buildTickets([at], catalogoBySigla);
      if (tickets.length === 0) continue;
      grupos.push({
        protocolo: at.protocolo,
        nome: at.nome,
        cpf: at.cpf,
        idade: at.idade,
        data: at.data,
        convenio: at.convenio,
        tickets,
      });
    }
    return grupos;
  }, [atendimentos, catalogoBySigla]);

  const pacientesPendentesFiltrados: PacienteAgrupado[] = useMemo(() => {
    const q = filters.nomePaciente.trim();
    if (!q) return pacientesPendentes;
    const qNorm = normalize(q);
    const qDigits = q.replace(/\D/g, "");
    return pacientesPendentes.filter((g) => {
      const matchNome = qNorm.length > 0 && normalize(g.nome).includes(qNorm);
      const matchProto = g.protocolo.toLowerCase().includes(q.toLowerCase());
      const matchCpf = qDigits.length > 0 && g.cpf.replace(/\D/g, "").includes(qDigits);
      return matchNome || matchProto || matchCpf;
    });
  }, [filters.nomePaciente, pacientesPendentes]);

  // Tickets dos pacientes selecionados (para impressão em lote)
  const ticketsSelecionados: MapaExameTicket[] = useMemo(() => {
    if (pacientesSelecionados.size === 0) return [];
    const out: MapaExameTicket[] = [];
    for (const g of pacientesPendentes) {
      if (pacientesSelecionados.has(g.protocolo)) out.push(...g.tickets);
    }
    return out;
  }, [pacientesSelecionados, pacientesPendentes]);

  // ── Aba Setor: resultado real ───────────────────────────────────────────────
  const setorResultado: MapaExameTicket[] = useMemo(() => {
    if (!filters.filtroSetor) return [];
    const ymd = dateToYmd(filters.dataSetor);
    return buildTickets(atendimentos, catalogoBySigla, (t, _ex, at) => {
      const cat = catalogoBySigla.get(t.exameNome)?.categoria ?? "";
      if (cat !== filters.filtroSetor) return false;
      if (ymd && brToYmd(at.data) !== ymd) return false;
      return true;
    });
  }, [filters.filtroSetor, filters.dataSetor, atendimentos, catalogoBySigla]);

  // ── Aba Setor: agrupamento de TODOS os setores com pendências ──────────────
  type SetorAgrupado = {
    setor: string;
    tickets: MapaExameTicket[];
    pacientesUnicos: number;
    examesUnicos: string[];
  };

  const setoresPendentes: SetorAgrupado[] = useMemo(() => {
    const ymd = dateToYmd(filters.dataSetor);
    const todos = buildTickets(atendimentos, catalogoBySigla, (_t, _ex, at) => {
      if (ymd && brToYmd(at.data) !== ymd) return false;
      return true;
    });
    const map = new Map<string, MapaExameTicket[]>();
    for (const t of todos) {
      const cat = (catalogoBySigla.get(t.exameNome)?.categoria ?? "Sem setor").trim() || "Sem setor";
      const arr = map.get(cat) ?? [];
      arr.push(t);
      map.set(cat, arr);
    }
    const out: SetorAgrupado[] = [];
    for (const [setor, tickets] of map.entries()) {
      const pacientes = new Set(tickets.map((t) => t.protocolo));
      const examesSet = new Set(tickets.map((t) => t.exameNome));
      out.push({
        setor,
        tickets,
        pacientesUnicos: pacientes.size,
        examesUnicos: Array.from(examesSet).sort((a, b) => a.localeCompare(b, "pt-BR")),
      });
    }
    return out.sort((a, b) => a.setor.localeCompare(b.setor, "pt-BR"));
  }, [atendimentos, catalogoBySigla, filters.dataSetor]);

  const setoresPendentesFiltrados: SetorAgrupado[] = useMemo(() => {
    const q = setorQuery.trim();
    if (!q) return setoresPendentes;
    const qNorm = normalize(q);
    return setoresPendentes.filter((g) => normalize(g.setor).includes(qNorm));
  }, [setorQuery, setoresPendentes]);

  const ticketsSetoresSelecionados: MapaExameTicket[] = useMemo(() => {
    if (setoresSelecionados.size === 0) return [];
    const out: MapaExameTicket[] = [];
    for (const g of setoresPendentes) {
      if (setoresSelecionados.has(g.setor)) out.push(...g.tickets);
    }
    return out;
  }, [setoresSelecionados, setoresPendentes]);

  // ── Aba Exame: lista todos os pendentes do setor + data, sem filtrar por analista ─
  const exameTabRows: MapaExameTicket[] = useMemo(() => {
    if (!filters.setorExame || !filters.analistaExame) return [];
    const ymd = dateToYmd(filters.dataExame);
    return buildTickets(atendimentos, catalogoBySigla, (t, _ex, at) => {
      const cat = catalogoBySigla.get(t.exameNome)?.categoria ?? "";
      if (cat !== filters.setorExame) return false;
      if (ymd && brToYmd(at.data) !== ymd) return false;
      return true;
    });
  }, [filters.setorExame, filters.analistaExame, filters.dataExame, atendimentos, catalogoBySigla]);

  // ── Aba Analista: lista de analistas reais e exames pendentes do analista ──
  // Os analistas são extraídos dos exames já atribuídos (atendimento_exames.analista),
  // garantindo que a aba só mostre nomes que de fato têm exames atribuídos.
  const analistasReais = useMemo(() => {
    const set = new Set<string>();
    for (const at of atendimentos) {
      for (const ex of at.examesCobranca ?? []) {
        const nome = (ex.analista ?? "").trim();
        if (nome) set.add(nome);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [atendimentos]);

  const analistaResultado: MapaExameTicket[] = useMemo(() => {
    const nome = filters.nomeAnalista.trim();
    if (!nome) return [];
    const nomeNorm = normalize(nome);
    const ymd = dateToYmd(filters.dataAnalista);
    return buildTickets(atendimentos, catalogoBySigla, (t, ex, at) => {
      if (normalize(ex.analista ?? "") !== nomeNorm) return false;
      if (ymd && brToYmd(at.data) !== ymd) return false;
      return true;
    });
  }, [filters.nomeAnalista, filters.dataAnalista, atendimentos, catalogoBySigla]);

  // ── Impressão ───────────────────────────────────────────────────────────────
  async function gerarPreviewHtml(tickets: MapaExameTicket[], analistaLote: string | undefined, orientation: MapaOrientation) {
    await prefetchParametrosForTickets(tickets);
    return buildMapasHtml({
      tickets,
      usuario: user?.nome || user?.email || "—",
      analistaLote,
      orientation,
    });
  }

  async function abrirPreview(tickets: MapaExameTicket[], titulo: string, analistaLote?: string) {
    if (tickets.length === 0) {
      toast({
        title: "Nada a pré-visualizar",
        description: "Nenhum exame pendente encontrado para os filtros aplicados. Ajuste a busca e tente novamente.",
        variant: "destructive",
      });
      return;
    }
    setPrinting(true);
    setPreviewTitulo(titulo);
    setPreviewTotal(tickets.length);
    setPreviewHtml("");
    setPreviewOpen(true);
    setPreviewContext({ tickets, analistaLote });
    try {
      const html = await gerarPreviewHtml(tickets, analistaLote, previewOrientation);
      setPreviewHtml(html);
    } finally {
      setPrinting(false);
    }
  }

  // Regera o HTML quando a orientação muda (sem reabrir o diálogo).
  async function handleOrientationChange(next: MapaOrientation) {
    setPreviewOrientation(next);
    if (!previewContext) return;
    setPrinting(true);
    try {
      const html = await gerarPreviewHtml(previewContext.tickets, previewContext.analistaLote, next);
      setPreviewHtml(html);
    } finally {
      setPrinting(false);
    }
  }

  async function aplicarEImprimirExameTab() {
    if (!filters.analistaExame) {
      toast({ title: "Selecione um analista", description: "Escolha um analista antes de gerar o mapa.", variant: "destructive" });
      return;
    }
    const selecionados = exameTabRows.filter((t) => examesNomesSelecionados.has(t.exameNome));
    if (selecionados.length === 0) {
      toast({ title: "Selecione ao menos um exame", description: "Marque os exames que serão atribuídos ao analista.", variant: "destructive" });
      return;
    }
    // Persiste analista nos exames selecionados (atendimento_exames.analista)
    // Localiza ids reais via examesCobranca dos atendimentos
    const idsParaPersistir: number[] = [];
    for (const t of selecionados) {
      const at = atendimentos.find((a) => a.protocolo === t.protocolo);
      const ex = at?.examesCobranca?.find((c) => c.nome === t.exameNome);
      if (ex?.atendimentoExameId) idsParaPersistir.push(ex.atendimentoExameId);
    }
    setPrinting(true);
    setPreviewTitulo(`Mapa do analista — ${filters.analistaExame}`);
    setPreviewTotal(selecionados.length);
    setPreviewHtml("");
    setPreviewOpen(true);
    try {
      const res = await setAnalistaParaExames(idsParaPersistir, filters.analistaExame);
      if (!res.ok) {
        toast({ title: "Falha ao atribuir analista", description: res.error, variant: "destructive" });
        setPreviewOpen(false);
        return;
      }
      // Reescreve os tickets usando o analista recém-aplicado
      const ticketsComAnalista = selecionados.map((t) => ({ ...t, analista: filters.analistaExame }));
      setPreviewContext({ tickets: ticketsComAnalista, analistaLote: filters.analistaExame });
      const html = await gerarPreviewHtml(ticketsComAnalista, filters.analistaExame, previewOrientation);
      setPreviewHtml(html);
      toast({ title: "Mapas gerados", description: `${selecionados.length} exame(s) atribuído(s) a ${filters.analistaExame}.` });
    } finally {
      setPrinting(false);
    }
  }

  // ── UI ──────────────────────────────────────────────────────────────────────
  const PaginationBar = ({ tipo, totalItems }: { tipo: TipoMapa; totalItems: number }) => {
    const page = currentPages[tipo];
    const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
    return (
      <div className="flex items-center justify-between px-5 py-3 border-t border-border/30 text-xs text-muted-foreground">
        <span>{totalItems} registro(s)</span>
        <div className="flex items-center gap-2">
          <span>{Math.min((page - 1) * rowsPerPage + 1, totalItems || 1)}–{Math.min(page * rowsPerPage, totalItems)} de {totalItems}</span>
          <div className="flex gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-xl" disabled={page <= 1} onClick={() => setCurrentPages(p => ({ ...p, [tipo]: p[tipo] - 1 }))}><ChevronLeft className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-xl" disabled={page >= totalPages} onClick={() => setCurrentPages(p => ({ ...p, [tipo]: p[tipo] + 1 }))}><ChevronRight className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </div>
    );
  };

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4"><Search className="h-6 w-6 text-muted-foreground" /></div>
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  );

  // ── Aba Paciente — tabela de exames pendentes encontrados ──────────────────
  const renderPacienteTable = () => {
    if (pacientesPendentes.length === 0) {
      return <EmptyState message="Não há pacientes com exames pendentes no momento." />;
    }
    const lista = pacientesPendentesFiltrados;
    const totalPendentesGeral = pacientesPendentes.reduce((a, g) => a + g.tickets.length, 0);
    const allSelected = lista.length > 0 && lista.every((g) => pacientesSelecionados.has(g.protocolo));
    const toggleAll = () => {
      if (allSelected) {
        setPacientesSelecionados((prev) => {
          const next = new Set(prev);
          for (const g of lista) next.delete(g.protocolo);
          return next;
        });
      } else {
        setPacientesSelecionados((prev) => {
          const next = new Set(prev);
          for (const g of lista) next.add(g.protocolo);
          return next;
        });
      }
    };
    const toggleOne = (protocolo: string) => {
      setPacientesSelecionados((prev) => {
        const next = new Set(prev);
        if (next.has(protocolo)) next.delete(protocolo); else next.add(protocolo);
        return next;
      });
    };
    const printSelecionados = () => {
      const titulo = pacientesSelecionados.size === 1
        ? `Mapas — ${lista.find((g) => pacientesSelecionados.has(g.protocolo))?.nome ?? "Paciente"}`
        : `Mapas — ${pacientesSelecionados.size} pacientes`;
      abrirPreview(ticketsSelecionados, titulo);
    };
    const printSingle = (g: PacienteAgrupado) => abrirPreview(g.tickets, `Mapas — ${g.nome}`);

    return (
      <>
        {/* Header com contadores e ação de impressão em lote */}
        <div className="px-5 py-4 border-b border-border/30 bg-muted/10 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} className="h-4 w-4" />
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                {lista.length} paciente{lista.length === 1 ? "" : "s"} pendente{lista.length === 1 ? "" : "s"}
                {filters.nomePaciente.trim() && (
                  <span className="text-muted-foreground font-normal"> · de {pacientesPendentes.length} no total</span>
                )}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {totalPendentesGeral} exame(s) pendente(s) no total
                {pacientesSelecionados.size > 0 && (
                  <span className="text-primary font-medium"> · {pacientesSelecionados.size} paciente(s) selecionado(s) · {ticketsSelecionados.length} exame(s)</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pacientesSelecionados.size > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setPacientesSelecionados(new Set())} className="h-9 rounded-2xl text-xs">
                Limpar seleção
              </Button>
            )}
            <Button
              onClick={printSelecionados}
              disabled={printing || pacientesSelecionados.size === 0}
              size="sm"
              className="gap-2 rounded-2xl h-9"
            >
              {printing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
              Pré-visualizar selecionados
            </Button>
          </div>
        </div>

        {/* Lista de pacientes */}
        {lista.length === 0 ? (
          <EmptyState message="Nenhum paciente corresponde à busca. Tente outro nome, CPF ou protocolo." />
        ) : (
          <ul className="divide-y divide-border/20 max-h-[calc(100vh-200px)] overflow-y-auto">
            {lista.map((g) => {
              const selected = pacientesSelecionados.has(g.protocolo);
              return (
                <li
                  key={g.protocolo}
                  className={cn(
                    "px-5 py-4 transition-colors hover:bg-muted/20",
                    selected && "bg-primary/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggleOne(g.protocolo)}
                      className="h-4 w-4 mt-1 shrink-0"
                    />
                    <div className="flex items-center justify-center h-10 w-10 rounded-2xl bg-primary/10 text-primary shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{g.nome}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              <FileText className="h-3 w-3" /> {g.protocolo}
                            </span>
                            {g.cpf && <span>CPF: {g.cpf}</span>}
                            {g.idade && <span>{g.idade}</span>}
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {g.data}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/10 text-warning text-xs font-semibold">
                            {g.tickets.length} pendente{g.tickets.length === 1 ? "" : "s"}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => printSingle(g)}
                            disabled={printing}
                            className="gap-1.5 h-8 rounded-xl text-xs"
                          >
                            <Printer className="h-3 w-3" />
                            Imprimir
                          </Button>
                        </div>
                      </div>
                      {/* Lista compacta de exames pendentes */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {g.tickets.map((t, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 text-xs text-foreground/80"
                            title={catalogoBySigla.get(t.exameNome)?.categoria ?? ""}
                          >
                            {t.exameNome}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  };

  // ── Aba Setor — exames pendentes do setor + data ───────────────────────────
  const renderSetorTable = () => {
    if (setoresPendentes.length === 0) {
      const dataLabel = filters.dataSetor ? ` em ${filters.dataSetor.toLocaleDateString("pt-BR")}` : "";
      return <EmptyState message={`Nenhum setor possui exames pendentes${dataLabel}.`} />;
    }
    const lista = setoresPendentesFiltrados;
    const totalGeral = setoresPendentes.reduce((a, g) => a + g.tickets.length, 0);
    const allSelected = lista.length > 0 && lista.every((g) => setoresSelecionados.has(g.setor));
    const toggleAll = () => {
      if (allSelected) {
        setSetoresSelecionados((prev) => {
          const next = new Set(prev);
          for (const g of lista) next.delete(g.setor);
          return next;
        });
      } else {
        setSetoresSelecionados((prev) => {
          const next = new Set(prev);
          for (const g of lista) next.add(g.setor);
          return next;
        });
      }
    };
    const toggleOne = (setor: string) => {
      setSetoresSelecionados((prev) => {
        const next = new Set(prev);
        if (next.has(setor)) next.delete(setor); else next.add(setor);
        return next;
      });
    };
    const printSelecionados = () => {
      const titulo = setoresSelecionados.size === 1
        ? `Mapas do setor — ${[...setoresSelecionados][0]}`
        : `Mapas — ${setoresSelecionados.size} setores`;
      abrirPreview(ticketsSetoresSelecionados, titulo);
    };
    const printSingle = (g: SetorAgrupado) => abrirPreview(g.tickets, `Mapas do setor — ${g.setor}`);

    return (
      <>
        <div className="px-5 py-4 border-b border-border/30 bg-muted/10 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} className="h-4 w-4" />
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                {lista.length} setor{lista.length === 1 ? "" : "es"} com pendência
                {setorQuery.trim() && (
                  <span className="text-muted-foreground font-normal"> · de {setoresPendentes.length} no total</span>
                )}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {totalGeral} exame(s) pendente(s) no total
                {setoresSelecionados.size > 0 && (
                  <span className="text-primary font-medium"> · {setoresSelecionados.size} setor(es) selecionado(s) · {ticketsSetoresSelecionados.length} exame(s)</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {setoresSelecionados.size > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSetoresSelecionados(new Set())} className="h-9 rounded-2xl text-xs">
                Limpar seleção
              </Button>
            )}
            <Button
              onClick={printSelecionados}
              disabled={printing || setoresSelecionados.size === 0}
              size="sm"
              className="gap-2 rounded-2xl h-9"
            >
              {printing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
              Pré-visualizar selecionados
            </Button>
          </div>
        </div>

        {lista.length === 0 ? (
          <EmptyState message="Nenhum setor corresponde à busca. Tente outro nome." />
        ) : (
          <ul className="divide-y divide-border/20 max-h-[calc(100vh-200px)] overflow-y-auto">
            {lista.map((g) => {
              const selected = setoresSelecionados.has(g.setor);
              const examesPreview = g.examesUnicos.slice(0, 6);
              const restantes = g.examesUnicos.length - examesPreview.length;
              return (
                <li
                  key={g.setor}
                  className={cn(
                    "px-5 py-4 transition-colors hover:bg-muted/20",
                    selected && "bg-primary/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggleOne(g.setor)}
                      className="h-4 w-4 mt-1 shrink-0"
                    />
                    <div className="flex items-center justify-center h-10 w-10 rounded-2xl bg-primary/10 text-primary shrink-0">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{g.setor}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3 w-3" /> {g.pacientesUnicos} paciente{g.pacientesUnicos === 1 ? "" : "s"}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <ClipboardList className="h-3 w-3" /> {g.examesUnicos.length} tipo{g.examesUnicos.length === 1 ? "" : "s"} de exame
                            </span>
                            {filters.dataSetor && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> {filters.dataSetor.toLocaleDateString("pt-BR")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/10 text-warning text-xs font-semibold">
                            {g.tickets.length} pendente{g.tickets.length === 1 ? "" : "s"}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => printSingle(g)}
                            disabled={printing}
                            className="gap-1.5 h-8 rounded-xl text-xs"
                          >
                            <Printer className="h-3 w-3" />
                            Imprimir
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {examesPreview.map((nome) => (
                          <span
                            key={nome}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 text-xs text-foreground/80"
                          >
                            {nome}
                          </span>
                        ))}
                        {restantes > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 text-xs text-muted-foreground">
                            +{restantes} outro{restantes === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  };

  // ── Aba Exame — atribuição manual + impressão ──────────────────────────────
  const renderExameTable = () => {
    if (!filters.setorExame && !filters.analistaExame) {
      return <EmptyState message="Selecione um setor e um analista para começar." />;
    }
    if (!filters.setorExame) {
      return <EmptyState message="Selecione um setor para listar os exames pendentes." />;
    }
    if (!filters.analistaExame) {
      return <EmptyState message="Selecione o analista que receberá a atribuição." />;
    }

    // Agrupa os tickets pendentes por NOME do exame
    type ExameAgrupado = {
      nome: string;
      tickets: MapaExameTicket[];
      pacientesUnicos: number;
      analistasAtuais: string[]; // distintos
    };
    const grupos: ExameAgrupado[] = (() => {
      const map = new Map<string, MapaExameTicket[]>();
      for (const t of exameTabRows) {
        const arr = map.get(t.exameNome) ?? [];
        arr.push(t);
        map.set(t.exameNome, arr);
      }
      const out: ExameAgrupado[] = [];
      for (const [nome, tickets] of map.entries()) {
        const pacSet = new Set(tickets.map((t) => t.protocolo));
        const anaSet = new Set(tickets.map((t) => (t.analista || "").trim()).filter(Boolean));
        out.push({
          nome,
          tickets,
          pacientesUnicos: pacSet.size,
          analistasAtuais: Array.from(anaSet),
        });
      }
      return out.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    })();

    if (grupos.length === 0) {
      const dataLabel = filters.dataExame ? filters.dataExame.toLocaleDateString("pt-BR") : "qualquer data";
      return <EmptyState message={`Nenhum exame pendente no setor "${filters.setorExame}" para ${dataLabel}.`} />;
    }

    // Aplica busca incremental (nome do exame)
    const qNorm = normalize(exameQuery.trim());
    const lista = qNorm ? grupos.filter((g) => normalize(g.nome).includes(qNorm)) : grupos;

    const totalPendentesGeral = grupos.reduce((a, g) => a + g.tickets.length, 0);
    const totalSelecionados = lista
      .filter((g) => examesNomesSelecionados.has(g.nome))
      .reduce((a, g) => a + g.tickets.length, 0);

    const allSelected = lista.length > 0 && lista.every((g) => examesNomesSelecionados.has(g.nome));
    const toggleAll = () => {
      setExamesNomesSelecionados((prev) => {
        const next = new Set(prev);
        if (allSelected) {
          for (const g of lista) next.delete(g.nome);
        } else {
          for (const g of lista) next.add(g.nome);
        }
        return next;
      });
    };
    const toggleOne = (nome: string) => {
      setExamesNomesSelecionados((prev) => {
        const next = new Set(prev);
        if (next.has(nome)) next.delete(nome); else next.add(nome);
        return next;
      });
    };

    return (
      <>
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/30 bg-muted/10 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} className="h-4 w-4" />
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                {lista.length} tipo{lista.length === 1 ? "" : "s"} de exame pendente{lista.length === 1 ? "" : "s"}
                {exameQuery.trim() && (
                  <span className="text-muted-foreground font-normal"> · de {grupos.length} no total</span>
                )}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {totalPendentesGeral} amostra(s) pendente(s) no setor
                {examesNomesSelecionados.size > 0 && (
                  <span className="text-primary font-medium"> · {examesNomesSelecionados.size} tipo(s) · {totalSelecionados} amostra(s) selecionada(s)</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {examesNomesSelecionados.size > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setExamesNomesSelecionados(new Set())} className="h-9 rounded-2xl text-xs">
                Limpar seleção
              </Button>
            )}
            <Button
              onClick={aplicarEImprimirExameTab}
              disabled={printing || examesNomesSelecionados.size === 0}
              size="sm"
              className="gap-2 rounded-2xl h-9"
            >
              {printing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
              Atribuir a {filters.analistaExame.split(" ")[0] || "analista"} e pré-visualizar
            </Button>
          </div>
        </div>

        {lista.length === 0 ? (
          <EmptyState message="Nenhum exame corresponde à busca. Tente outro nome." />
        ) : (
          <ul className="divide-y divide-border/20 max-h-[calc(100vh-200px)] overflow-y-auto">
            {lista.map((g) => {
              const selected = examesNomesSelecionados.has(g.nome);
              return (
                <li
                  key={g.nome}
                  onClick={() => toggleOne(g.nome)}
                  className={cn(
                    "px-5 py-4 transition-colors hover:bg-muted/20 cursor-pointer",
                    selected && "bg-primary/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggleOne(g.nome)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 mt-1 shrink-0"
                    />
                    <div className="flex items-center justify-center h-10 w-10 rounded-2xl bg-primary/10 text-primary shrink-0">
                      <TestTube2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{g.nome}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3 w-3" /> {g.pacientesUnicos} paciente{g.pacientesUnicos === 1 ? "" : "s"}
                            </span>
                            {g.analistasAtuais.length > 0 && (
                              <span className="inline-flex items-center gap-1" title={g.analistasAtuais.join(", ")}>
                                <FlaskConical className="h-3 w-3" />
                                {g.analistasAtuais.length === 1
                                  ? `Atribuído a ${g.analistasAtuais[0]}`
                                  : `${g.analistasAtuais.length} analistas atribuídos`}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning/10 text-warning text-xs font-bold tabular-nums">
                            {g.tickets.length}× pendente{g.tickets.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  };

  // ── Aba Analista (mantida — comportamento atual mock) ──────────────────────
  // ── Aba Analista — exames pendentes atribuídos a um analista ───────────────
  const renderAnalistaTable = () => {
    if (!filters.nomeAnalista.trim()) {
      return <EmptyState message="Selecione um analista para listar os exames pendentes atribuídos a ele." />;
    }
    if (analistaResultado.length === 0) {
      const dataLabel = filters.dataAnalista ? filters.dataAnalista.toLocaleDateString("pt-BR") : "qualquer data";
      return <EmptyState message={`Nenhum exame pendente atribuído a "${filters.nomeAnalista}" para ${dataLabel}.`} />;
    }
    return (
      <>
        <div className="px-5 py-3 border-b border-border/30 bg-muted/15 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">{filters.nomeAnalista}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">{analistaResultado.length} exame(s) pendentes</p>
          </div>
          <Button onClick={() => abrirPreview(analistaResultado, `Mapa do analista — ${filters.nomeAnalista}`, filters.nomeAnalista)} disabled={printing} size="sm" className="gap-2 rounded-2xl h-9">
            {printing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
            Pré-visualizar
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40 bg-muted/15">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Protocolo</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Paciente</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Exame</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Data</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {analistaResultado.map((t, i) => (
                <tr key={i} className="border-b border-border/20 last:border-0">
                  <td className="px-5 py-3 text-sm font-mono text-muted-foreground">{t.protocolo}</td>
                  <td className="px-5 py-3 text-sm font-semibold">{t.paciente.nome}</td>
                  <td className="px-5 py-3 text-sm">{t.exameNome}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{t.dataAtendimento}</td>
                  <td className="px-5 py-3"><StatusBadge type="warning" label="Pendente" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  return (
    <div className="p-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        eyebrow="Operacional"
        title="Mapas de Trabalho"
        description="Impressão de planilhas e mapas operacionais."
      />

      <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-2xl w-fit border border-border/30 overflow-x-auto no-scrollbar">
        {tipoOptions.map(opt => (
          <button key={opt.value} onClick={() => updateFilter("tipo", opt.value)} className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap",
            filters.tipo === opt.value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-card/60"
          )}>
            {tipoIcons[opt.value]}
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Filtros */}
        <div className="w-full lg:w-[300px] shrink-0">
          <div className="rounded-3xl border border-border/60 bg-card p-5 space-y-5 sticky top-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <div className="h-8 w-8 rounded-2xl bg-primary/8 flex items-center justify-center"><Search className="h-4 w-4 text-primary" /></div>
              Filtros
            </h3>

            {filters.tipo === "paciente" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Buscar paciente</label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Nome, CPF ou protocolo..."
                      className="h-10 text-sm rounded-2xl pl-10 pr-9 border-border/60"
                      value={filters.nomePaciente}
                      onChange={(e) => updateFilter("nomePaciente", e.target.value)}
                    />
                    {filters.nomePaciente && (
                      <button
                        onClick={() => updateFilter("nomePaciente", "")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Limpar busca"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/40 bg-muted/15 px-3 py-2.5 text-xs text-muted-foreground flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/70" />
                  <span>Mostrando apenas pacientes com exames <strong className="text-foreground">pendentes</strong>. Selecione um ou vários para imprimir em lote.</span>
                </div>
              </div>
            )}
            {filters.tipo === "analista" && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Analista</label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Pesquisar..." className="h-10 text-sm rounded-2xl pl-10 border-border/60" value={filters.nomeAnalista} onChange={e => updateFilter("nomeAnalista", e.target.value)} />
                  </div>
                </div>
                <MapaDatePicker label="Data de Atendimento" value={filters.dataAnalista} onChange={d => updateFilter("dataAnalista", d)} />
              </div>
            )}
            {filters.tipo === "setor" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Buscar setor</label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Nome do setor..."
                      className="h-10 text-sm rounded-2xl pl-10 pr-9 border-border/60"
                      value={setorQuery}
                      onChange={(e) => setSetorQuery(e.target.value)}
                    />
                    {setorQuery && (
                      <button
                        onClick={() => setSetorQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Limpar busca"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <MapaDatePicker label="Data de atendimento (opcional)" value={filters.dataSetor} onChange={d => updateFilter("dataSetor", d)} />
                <div className="rounded-2xl border border-border/40 bg-muted/15 px-3 py-2.5 text-xs text-muted-foreground flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/70" />
                  <span>Mostrando setores com exames <strong className="text-foreground">pendentes</strong>. Selecione um ou vários para imprimir em lote.</span>
                </div>
              </div>
            )}
            {filters.tipo === "exame" && (
              <div className="space-y-4">
                <MapaDatePicker label="Data de Atendimento" value={filters.dataExame} onChange={d => updateFilter("dataExame", d)} />
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Setor</label>
                  <Select value={filters.setorExame} onValueChange={v => updateFilter("setorExame", v)}>
                    <SelectTrigger className="h-10 text-sm rounded-2xl border-border/60"><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                    <SelectContent>{setoresReais.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Analista</label>
                  <AnalistaAutocomplete
                    value={filters.analistaExame}
                    query={analistaQuery}
                    analistas={analistasReais}
                    onQueryChange={q => { setAnalistaQuery(q); updateFilter("analistaExame", ""); }}
                    onSelect={name => { updateFilter("analistaExame", name); setAnalistaQuery(""); }}
                    onClear={() => { setAnalistaQuery(""); updateFilter("analistaExame", ""); }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Buscar exame</label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Nome do exame..."
                      className="h-10 text-sm rounded-2xl pl-10 pr-9 border-border/60"
                      value={exameQuery}
                      onChange={(e) => setExameQuery(e.target.value)}
                    />
                    {exameQuery && (
                      <button
                        onClick={() => setExameQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Limpar busca"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/40 bg-muted/15 px-3 py-2.5 text-xs text-muted-foreground flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/70" />
                  <span>Os exames são <strong className="text-foreground">agrupados por tipo</strong>. Selecione os tipos a analisar — todas as amostras pendentes serão atribuídas ao analista.</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="rounded-3xl border border-border/60 bg-card overflow-hidden">
            {filters.tipo === "paciente" && renderPacienteTable()}
            {filters.tipo === "analista" && renderAnalistaTable()}
            {filters.tipo === "setor"    && renderSetorTable()}
            {filters.tipo === "exame"    && renderExameTable()}
          </div>
        </div>
      </div>
      <MapaPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        html={previewHtml}
        titulo={previewTitulo}
        totalExames={previewTotal}
        loading={printing && !previewHtml}
        orientation={previewOrientation}
        onOrientationChange={handleOrientationChange}
      />
    </div>
  );
};

export default Mapa;
