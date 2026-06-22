import { PageHeader } from "@/components/shared/PageHeader";
/**
 * IA-FIRST OWNERSHIP HEADER
 * ─────────────────────────
 * Soroteca = stored biological sample tracking.
 * NOT inventory management. NOT generic storage CRUD. NOT mini-estoque.
 * Samples are NEVER created manually — they emerge automatically from /registrar-coleta.
 * Focus: localizar amostra, validade, descarte, reuso, freezer/posição, rastreabilidade.
 * Multi-tenant: store resolves tenant_id server-side via current_tenant_id().
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlaskConical,
  Search,
  Trash2,
  RefreshCcw,
  MapPin,
  Clock,
  Barcode,
  HelpCircle,
  ChevronDown,
  ClipboardCheck,
  RefreshCw,
  Send,
  AlertTriangle,
  Layers,
  Timer,
  ScanLine,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  type Amostra,
  type AmostraStatus,
  type AmostraAvancadoFiltros,
  listarAmostras,
  buscarAmostrasAvancado,
  atualizarAmostra,
  marcarVencidas,
  statusVisual,
} from "@/data/sorotecaStore";
import {
  listarLocais,
  listarGalerias,
  type LocalArmazenamento,
  type Galeria,
} from "@/data/sorotecaEstruturaStore";
import {
  listarMateriaisAmostra,
  type MaterialAmostra,
} from "@/data/materiaisAmostraStore";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, searchNormalize } from "@/lib/utils";
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
import AmostraDetalheDialog from "@/components/soroteca/AmostraDetalheDialog";
import BarcodeScannerDialog from "@/components/soroteca/BarcodeScannerDialog";

type StatusFiltro = "TODAS" | AmostraStatus;

const PAGE_SIZE = 30;

const STATUS_TABS: { id: StatusFiltro; label: string }[] = [
  { id: "TODAS", label: "Todas" },
  { id: "DISPONIVEL", label: "Disponíveis" },
  { id: "UTILIZADA", label: "Utilizadas" },
  { id: "VENCIDA", label: "Vencidas" },
  { id: "DESCARTADA", label: "Descartadas" },
];

function fmt(d: string) {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tempoRestante(validade: string): string {
  const ms = new Date(validade).getTime() - Date.now();
  if (ms <= 0) return "Vencida";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

/**
 * Avaliação de proximidade de vencimento para amostras DISPONIVEL.
 * Retorna o nível e o status que será aplicado automaticamente quando expirar.
 */
function avaliarVencimento(amostra: Amostra): {
  nivel: "ok" | "atencao" | "critico" | "vencida";
  proximoStatus?: AmostraStatus;
  mensagem?: string;
} {
  if (amostra.status !== "DISPONIVEL") return { nivel: "ok" };
  const restanteHoras = (new Date(amostra.data_validade).getTime() - Date.now()) / 3_600_000;
  if (restanteHoras <= 0) {
    return {
      nivel: "vencida",
      proximoStatus: "VENCIDA",
      mensagem: "Validade expirada — será marcada como VENCIDA na próxima sincronização.",
    };
  }
  if (restanteHoras < 2) {
    return {
      nivel: "critico",
      proximoStatus: "VENCIDA",
      mensagem: `Vence em menos de 2h — passará automaticamente para VENCIDA.`,
    };
  }
  if (restanteHoras < 6) {
    return {
      nivel: "atencao",
      mensagem: `Vence em breve (~${Math.floor(restanteHoras)}h) — planeje a análise.`,
    };
  }
  return { nivel: "ok" };
}

function statusBadge(status: AmostraStatus) {
  const map: Record<AmostraStatus, string> = {
    DISPONIVEL: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    UTILIZADA: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    VENCIDA: "bg-red-500/10 text-red-600 border-red-500/20",
    DESCARTADA: "bg-muted text-muted-foreground border-border",
  };
  return map[status];
}

export default function Soroteca() {
  const [amostras, setAmostras] = useState<Amostra[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("TODAS");
  const [search, setSearch] = useState("");
  const [confirmDescarte, setConfirmDescarte] = useState<Amostra | null>(null);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [scannerAberto, setScannerAberto] = useState(false);
  const [destaqueId, setDestaqueId] = useState<string | null>(null);
  const linhasRef = useRef<Map<string, HTMLLIElement>>(new Map());
  const hidBufferRef = useRef<{ value: string; lastAt: number }>({ value: "", lastAt: 0 });

  // ---- Fase 5: Pesquisa avançada (server-side) ----
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [materiais, setMateriais] = useState<MaterialAmostra[]>([]);
  const [locais, setLocais] = useState<LocalArmazenamento[]>([]);
  const [galerias, setGalerias] = useState<Galeria[]>([]);
  const [advMaterialIds, setAdvMaterialIds] = useState<string[]>([]);
  const [advLocalId, setAdvLocalId] = useState<string>("");
  const [advGaleriaId, setAdvGaleriaId] = useState<string>("");
  const [advPaciente, setAdvPaciente] = useState("");
  const [advProtocolo, setAdvProtocolo] = useState("");
  const [advColetaInicio, setAdvColetaInicio] = useState("");
  const [advColetaFim, setAdvColetaFim] = useState("");
  const [advValidadeInicio, setAdvValidadeInicio] = useState("");
  const [advValidadeFim, setAdvValidadeFim] = useState("");
  const [advArmazenamento, setAdvArmazenamento] = useState<"todas" | "armazenadas" | "pendentes">("todas");
  const [advPage, setAdvPage] = useState(1);
  const [advPageSize] = useState(30);
  const [advItems, setAdvItems] = useState<Amostra[]>([]);
  const [advTotal, setAdvTotal] = useState(0);
  const [advLoading, setAdvLoading] = useState(false);

  const debPaciente = useDebouncedValue(advPaciente, 350);
  const debProtocolo = useDebouncedValue(advProtocolo, 350);
  const debCodigo = useDebouncedValue(search, 350);

  // O modo avançado é ativado quando o painel de filtros está aberto.
  const advancadoAtivo = filtrosAbertos;

  // Localiza uma amostra pelo código de barra (case-insensitive, trim).
  const handleCodigoLido = (codigoBruto: string) => {
    const codigo = codigoBruto.trim();
    if (!codigo) return;
    const lista = advancadoAtivo ? advItems : amostras;
    const alvo = lista.find(
      (a) => a.codigo_barra.toLowerCase() === codigo.toLowerCase(),
    );
    if (!alvo) {
      toast.error(`Amostra não encontrada para o código ${codigo}.`);
      return;
    }
    // Garante visibilidade na lista
    setStatusFiltro("TODAS");
    setSearch(codigo);
    setVisibleCount((c) => Math.max(c, PAGE_SIZE));
    setDetalheId(alvo.id);
    setDestaqueId(alvo.id);
    // scroll + remoção do highlight após uns segundos
    setTimeout(() => {
      const el = linhasRef.current.get(alvo.id);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    setTimeout(() => setDestaqueId((cur) => (cur === alvo.id ? null : cur)), 3500);
    toast.success(`Amostra ${alvo.codigo_barra} localizada.`);
  };

  // Captura HID global: leitores USB/Bluetooth emulam teclado e disparam
  // ~10ms entre teclas, finalizando com Enter. Acumulamos enquanto não há
  // input/textarea/select focado e nenhum dialog aberto sobre o foco.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Se o usuário está digitando em um campo, não interferimos.
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const editable = (e.target as HTMLElement | null)?.isContentEditable;
      if (tag === "input" || tag === "textarea" || tag === "select" || editable) return;
      // Scanner ou detalhe abertos têm seus próprios inputs — deixamos passar.
      if (scannerAberto) return;
      const now = Date.now();
      const buf = hidBufferRef.current;
      // reset se demorou demais entre teclas (digitação humana)
      if (now - buf.lastAt > 50) buf.value = "";
      buf.lastAt = now;
      if (e.key === "Enter") {
        const code = buf.value;
        buf.value = "";
        if (code.length >= 4) {
          e.preventDefault();
          handleCodigoLido(code);
        }
        return;
      }
      if (e.key.length === 1) {
        buf.value += e.key;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amostras, scannerAberto]);

  const carregar = async () => {
    setLoading(true);
    const lista = await listarAmostras();
    setAmostras(lista);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  // Carrega catálogos auxiliares uma única vez (para o painel de filtros).
  useEffect(() => {
    (async () => {
      const [mats, locs] = await Promise.all([
        listarMateriaisAmostra({ ativosOnly: true, pageSize: 100 }),
        listarLocais(),
      ]);
      setMateriais(mats.rows);
      setLocais(locs);
    })();
  }, []);

  // Galerias dependentes do local selecionado.
  useEffect(() => {
    (async () => {
      if (!advLocalId) {
        setGalerias([]);
        return;
      }
      setGalerias(await listarGalerias(advLocalId));
      // Se a galeria atual não pertence ao novo local, limpa.
      setAdvGaleriaId((g) => (g ? "" : g));
    })();
  }, [advLocalId]);

  // Fetch server-side quando o modo avançado está ativo.
  useEffect(() => {
    if (!advancadoAtivo) return;
    let cancel = false;
    (async () => {
      setAdvLoading(true);
      const statusList: AmostraStatus[] | undefined =
        statusFiltro === "TODAS" ? undefined : [statusFiltro as AmostraStatus];
      const filtros: AmostraAvancadoFiltros = {
        status: statusList,
        material_ids: advMaterialIds.length > 0 ? advMaterialIds : undefined,
        local_id: advLocalId || undefined,
        galeria_id: advGaleriaId || undefined,
        paciente_search: debPaciente || undefined,
        protocolo: debProtocolo || undefined,
        codigo_barra: debCodigo || undefined,
        coleta_inicio: advColetaInicio ? new Date(advColetaInicio).toISOString() : undefined,
        coleta_fim: advColetaFim
          ? new Date(advColetaFim + "T23:59:59").toISOString()
          : undefined,
        validade_inicio: advValidadeInicio
          ? new Date(advValidadeInicio).toISOString()
          : undefined,
        validade_fim: advValidadeFim
          ? new Date(advValidadeFim + "T23:59:59").toISOString()
          : undefined,
        sem_armazenamento: advArmazenamento === "pendentes" || undefined,
        armazenadas: advArmazenamento === "armazenadas" || undefined,
      };
      const r = await buscarAmostrasAvancado(filtros, { page: advPage, pageSize: advPageSize });
      if (cancel) return;
      setAdvItems(r.items);
      setAdvTotal(r.total);
      setAdvLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [
    advancadoAtivo,
    statusFiltro,
    advMaterialIds,
    advLocalId,
    advGaleriaId,
    debPaciente,
    debProtocolo,
    debCodigo,
    advColetaInicio,
    advColetaFim,
    advValidadeInicio,
    advValidadeFim,
    advArmazenamento,
    advPage,
    advPageSize,
  ]);

  // Reset página ao alterar filtros avançados.
  useEffect(() => {
    setAdvPage(1);
  }, [
    statusFiltro,
    advMaterialIds,
    advLocalId,
    advGaleriaId,
    debPaciente,
    debProtocolo,
    debCodigo,
    advColetaInicio,
    advColetaFim,
    advValidadeInicio,
    advValidadeFim,
    advArmazenamento,
  ]);

  const limparFiltrosAvancados = () => {
    setAdvMaterialIds([]);
    setAdvLocalId("");
    setAdvGaleriaId("");
    setAdvPaciente("");
    setAdvProtocolo("");
    setAdvColetaInicio("");
    setAdvColetaFim("");
    setAdvValidadeInicio("");
    setAdvValidadeFim("");
    setAdvArmazenamento("todas");
  };

  const filtrosAtivosCount =
    (advMaterialIds.length > 0 ? 1 : 0) +
    (advLocalId ? 1 : 0) +
    (advGaleriaId ? 1 : 0) +
    (advPaciente ? 1 : 0) +
    (advProtocolo ? 1 : 0) +
    (advColetaInicio || advColetaFim ? 1 : 0) +
    (advValidadeInicio || advValidadeFim ? 1 : 0) +
    (advArmazenamento !== "todas" ? 1 : 0);


  const handleSincronizarVencidas = async () => {
    const n = await marcarVencidas();
    toast.success(n > 0 ? `${n} amostra(s) marcada(s) como vencida(s).` : "Nenhuma amostra vencida.");
    carregar();
  };

  const handleDescartar = async (amostra: Amostra) => {
    const r = await atualizarAmostra(amostra.id, { status: "DESCARTADA" });
    if (r.ok) {
      toast.success("Amostra descartada.");
      setConfirmDescarte(null);
      carregar();
    } else {
      toast.error(r.error || "Erro ao descartar.");
    }
  };

  const filtradas = useMemo(() => {
    let lista = amostras;
    if (statusFiltro !== "TODAS") lista = lista.filter((a) => a.status === statusFiltro);
    if (search.trim()) {
      const q = searchNormalize(search);
      lista = lista.filter(
        (a) =>
          searchNormalize(a.codigo_barra).includes(q) ||
          searchNormalize(a.tipo_material).includes(q) ||
          searchNormalize(a.localizacao).includes(q),
      );
    }
    return lista;
  }, [amostras, statusFiltro, search]);

  // Reset paginação ao mudar filtros
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [statusFiltro, search]);

  const visiveisLegacy = useMemo(() => filtradas.slice(0, visibleCount), [filtradas, visibleCount]);
  const restantesLegacy = filtradas.length - visiveisLegacy.length;

  // Lista final que vai para a UI (server-side avançado OU legado client-side).
  const visiveis = advancadoAtivo ? advItems : visiveisLegacy;
  const totalListagem = advancadoAtivo ? advTotal : filtradas.length;
  const restantes = advancadoAtivo ? 0 : restantesLegacy;
  const listaVazia = advancadoAtivo ? advItems.length === 0 : filtradas.length === 0;
  const carregando = advancadoAtivo ? advLoading : loading;

  const counts = useMemo(() => {
    const c: Record<AmostraStatus, number> = {
      DISPONIVEL: 0,
      UTILIZADA: 0,
      VENCIDA: 0,
      DESCARTADA: 0,
    };
    amostras.forEach((a) => {
      c[a.status] = (c[a.status] || 0) + 1;
    });
    return c;
  }, [amostras]);

  /**
   * Mapa: atendimento_id|material -> número de amostras nesse grupo.
   * Usado para sinalizar "mesmo tubo / múltiplos exames" no card.
   * Aproximação: amostras do mesmo atendimento com mesmo material foram
   * agrupadas pelo fluxo de coleta.
   */
  const grupoMaterial = useMemo(() => {
    const map = new Map<string, number>();
    amostras.forEach((a) => {
      if (!a.atendimento_id) return;
      const k = `${a.atendimento_id}|${(a.tipo_material || "").toUpperCase()}`;
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return map;
  }, [amostras]);

  /** Conta amostras DISPONIVEL próximas do vencimento (<6h). */
  const totalProximasVencimento = useMemo(
    () =>
      amostras.filter((a) => {
        const v = avaliarVencimento(a);
        return v.nivel === "atencao" || v.nivel === "critico";
      }).length,
    [amostras],
  );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <PageHeader
        eyebrow="Operacional"
        title="Soroteca"
        description="Amostras armazenadas, validade e rastreabilidade."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAjudaAberta((v) => !v)}
              className={cn(ajudaAberta && "bg-primary/5 border-primary/30")}
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              Como funciona
            </Button>
            <Button variant="outline" size="sm" onClick={handleSincronizarVencidas}>
              <RefreshCcw className="w-4 h-4 mr-2" />
              Atualizar vencidas
            </Button>
          </>
        }
      />

      {/* Seção de ajuda */}
      {ajudaAberta && (
        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              <h2 className="text-base font-semibold text-foreground">
                Como as amostras chegam à Soroteca
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAjudaAberta(false)}
              className="h-7 px-2 text-muted-foreground"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Amostras <span className="font-medium text-foreground">não são criadas manualmente</span>{" "}
            — elas surgem automaticamente como efeito do fluxo operacional. Existem 3 caminhos:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">1. Coleta</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Quando o coletor marca um exame como <span className="font-medium text-foreground">Amostra Coletada</span> em{" "}
                <span className="font-mono text-[11px] text-foreground">/registrar-coleta</span>, o
                sistema gera o código{" "}
                <span className="font-mono text-[11px] text-foreground">A-AAAAMMDD-NNNNNN-D</span> e
                cria o registro com validade calculada a partir da estabilidade do exame.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <RefreshCw className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">2. Reutilização</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Uma amostra <span className="font-medium text-foreground">DISPONIVEL</span> dentro
                da validade pode ser reaproveitada por outro exame compatível. A amostra física não é
                duplicada — só ganha mais um exame vinculado, marcado com o badge{" "}
                <span className="font-medium text-blue-600">Reuso</span>.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Send className="w-4 h-4 text-violet-600" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">3. Terceirizado</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Exames com destino a um <span className="font-medium text-foreground">laboratório de apoio</span>{" "}
                geram a amostra do mesmo modo, mas ela fica{" "}
                <span className="font-medium text-violet-600">reservada para envio</span>.
                O detalhe da amostra mostra o lab destino e as datas de envio/retorno.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 flex items-start gap-2">
            <Layers className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-foreground/80">
              <span className="font-semibold">Mesmo tubo, múltiplos exames:</span> exames do mesmo
              atendimento que compartilham material/recipiente são agrupados automaticamente em uma
              única amostra física. Você verá um indicador no card quando isso acontecer.
            </p>
          </div>

          {/* Bloco: cálculo da validade */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Timer className="w-4 h-4 text-amber-600" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Como o prazo de validade é calculado
              </h3>
            </div>
            <div className="rounded-lg bg-muted/50 border border-border px-3 py-2 font-mono text-xs text-foreground">
              data_validade = data_coleta + estabilidade do exame
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              A <span className="font-medium text-foreground">data de coleta</span> é gravada no
              momento em que o coletor marca o exame como{" "}
              <span className="font-medium text-foreground">Amostra Coletada</span>. A{" "}
              <span className="font-medium text-foreground">estabilidade</span> vem do cadastro do
              exame em{" "}
              <span className="font-mono text-[11px] text-foreground">
                Configurações → Exames
              </span>
              , campo <span className="font-mono text-[11px] text-foreground">estabilidade</span>.
            </p>
            <div>
              <p className="text-xs font-medium text-foreground mb-2">
                O sistema interpreta o texto extraindo número + unidade:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center justify-between rounded-md border border-border bg-background/60 px-2.5 py-1.5">
                  <span className="font-mono text-foreground">Temperatura ambiente: 8h</span>
                  <span className="text-muted-foreground">→ +8 horas</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border bg-background/60 px-2.5 py-1.5">
                  <span className="font-mono text-foreground">Refrigerado (2-8°C): 24h</span>
                  <span className="text-muted-foreground">→ +24 horas</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border bg-background/60 px-2.5 py-1.5">
                  <span className="font-mono text-foreground">Refrigerado (2-8°C): 7 dias</span>
                  <span className="text-muted-foreground">→ +7 dias</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border bg-background/60 px-2.5 py-1.5">
                  <span className="font-mono text-foreground">Congelado (-20°C): 30 dias</span>
                  <span className="text-muted-foreground">→ +30 dias</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border bg-background/60 px-2.5 py-1.5">
                  <span className="font-mono text-foreground">Congelado (-80°C): 6 meses</span>
                  <span className="text-muted-foreground">→ +6 meses (~180d)</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-dashed border-border bg-background/30 px-2.5 py-1.5">
                  <span className="font-mono text-muted-foreground italic">(sem estabilidade)</span>
                  <span className="text-muted-foreground">→ default 24h</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2.5">
                <p className="text-[11px] text-foreground/80 leading-relaxed">
                  <span className="font-semibold">Tubo compartilhado:</span> quando vários exames
                  usam a mesma amostra, vale a <span className="font-semibold">menor estabilidade</span>{" "}
                  — o exame mais restritivo limita a validade do tubo.
                </p>
              </div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
                <p className="text-[11px] text-foreground/80 leading-relaxed">
                  <span className="font-semibold">Alertas automáticos:</span> &lt;6h restantes →
                  atenção; &lt;2h → crítico; ao expirar, a rotina marca o status como{" "}
                  <span className="font-mono">VENCIDA</span>.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Banner global de vencimento próximo */}
      {totalProximasVencimento > 0 && statusFiltro !== "VENCIDA" && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-foreground">
              {totalProximasVencimento} amostra{totalProximasVencimento !== 1 ? "s" : ""}
            </span>{" "}
            <span className="text-muted-foreground">
              próxima{totalProximasVencimento !== 1 ? "s" : ""} do vencimento — serão automaticamente
              marcadas como <span className="font-semibold text-foreground">VENCIDA</span> ao
              expirar.
            </span>
          </div>
        </div>
      )}

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["DISPONIVEL", "UTILIZADA", "VENCIDA", "DESCARTADA"] as AmostraStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFiltro(s)}
            className={cn(
              "rounded-2xl border p-4 text-left transition-all",
              statusFiltro === s
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:bg-accent/40",
            )}
          >
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {STATUS_TABS.find((t) => t.id === s)?.label}
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">{counts[s] ?? 0}</p>
          </button>
        ))}
      </div>

      {/* Tabs + busca + toggle de filtros avançados */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-muted/50 border border-border">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setStatusFiltro(t.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                statusFiltro === t.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              advancadoAtivo
                ? "Filtrar por código de barra…"
                : "Buscar por código de barra, material ou localização…"
            }
            className="pl-9 pr-10"
          />
          <button
            type="button"
            onClick={() => setScannerAberto(true)}
            title="Ler código de barras (câmera ou leitor USB/Bluetooth)"
            aria-label="Ler código de barras"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ScanLine className="w-4 h-4" />
          </button>
        </div>
        <Button
          variant={advancadoAtivo ? "default" : "outline"}
          size="sm"
          onClick={() => setFiltrosAbertos((v) => !v)}
          className="gap-2"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filtros avançados
          {filtrosAtivosCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1">
              {filtrosAtivosCount}
            </span>
          )}
        </Button>
      </div>

      {/* Painel de filtros avançados */}
      {filtrosAbertos && (
        <section className="rounded-2xl border border-border bg-card p-4 md:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              Pesquisa avançada
            </h3>
            <div className="flex items-center gap-2">
              {filtrosAtivosCount > 0 && (
                <Button variant="ghost" size="sm" onClick={limparFiltrosAvancados} className="h-8">
                  <X className="w-3.5 h-3.5 mr-1" />
                  Limpar filtros
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Paciente */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Paciente (nome ou CPF)
              </label>
              <Input
                value={advPaciente}
                onChange={(e) => setAdvPaciente(e.target.value)}
                placeholder="Ex.: Maria Silva ou 123.456…"
                className="h-9"
              />
            </div>

            {/* Protocolo */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Protocolo do atendimento
              </label>
              <Input
                value={advProtocolo}
                onChange={(e) => setAdvProtocolo(e.target.value)}
                placeholder="Ex.: 2026000123"
                className="h-9"
              />
            </div>

            {/* Material */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Material
              </label>
              <select
                multiple={false}
                value={advMaterialIds[0] ?? ""}
                onChange={(e) =>
                  setAdvMaterialIds(e.target.value ? [e.target.value] : [])
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Todos os materiais</option>
                {materiais.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                    {m.sigla ? ` (${m.sigla})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Local */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Local de armazenamento
              </label>
              <select
                value={advLocalId}
                onChange={(e) => setAdvLocalId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Todos os locais</option>
                {locais.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Galeria */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Galeria
              </label>
              <select
                value={advGaleriaId}
                onChange={(e) => setAdvGaleriaId(e.target.value)}
                disabled={!advLocalId}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
              >
                <option value="">{advLocalId ? "Todas as galerias" : "Selecione um local"}</option>
                {galerias.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Status de armazenamento */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Armazenamento
              </label>
              <select
                value={advArmazenamento}
                onChange={(e) =>
                  setAdvArmazenamento(e.target.value as typeof advArmazenamento)
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="todas">Todas</option>
                <option value="armazenadas">Apenas armazenadas</option>
                <option value="pendentes">Pendentes de armazenamento</option>
              </select>
            </div>

            {/* Coleta — período */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Coleta — período
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={advColetaInicio}
                  onChange={(e) => setAdvColetaInicio(e.target.value)}
                  className="h-9"
                />
                <span className="text-xs text-muted-foreground">até</span>
                <Input
                  type="date"
                  value={advColetaFim}
                  onChange={(e) => setAdvColetaFim(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            {/* Validade — período */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Validade — período
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={advValidadeInicio}
                  onChange={(e) => setAdvValidadeInicio(e.target.value)}
                  className="h-9"
                />
                <span className="text-xs text-muted-foreground">até</span>
                <Input
                  type="date"
                  value={advValidadeFim}
                  onChange={(e) => setAdvValidadeFim(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground border-t border-border pt-3">
            Resultados consultados <span className="font-medium text-foreground">no servidor</span> com paginação —
            os filtros se combinam (AND). A aba de status acima também é aplicada.
          </div>
        </section>
      )}

      {/* Lista */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {carregando ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : listaVazia ? (

          <div className="p-12 text-center">
            <FlaskConical className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Nenhuma amostra encontrada</p>
            <p className="text-xs text-muted-foreground mt-1">
              Amostras são criadas automaticamente ao registrar a coleta de exames.
            </p>
          </div>
        ) : (
          <>
          <ul className="divide-y divide-border">
            {visiveis.map((a) => {
              const visual = statusVisual(a);
              const venc = avaliarVencimento(a);
              const grupoKey = a.atendimento_id
                ? `${a.atendimento_id}|${(a.tipo_material || "").toUpperCase()}`
                : null;
              const tamanhoGrupo = grupoKey ? grupoMaterial.get(grupoKey) ?? 1 : 1;
              return (
                <li
                  key={a.id}
                  ref={(el) => {
                    if (el) linhasRef.current.set(a.id, el);
                    else linhasRef.current.delete(a.id);
                  }}
                  onClick={() => setDetalheId(a.id)}
                  className={cn(
                    "p-4 flex flex-col md:flex-row md:items-center gap-3 hover:bg-accent/30 transition-colors cursor-pointer",
                    destaqueId === a.id && "bg-primary/10 ring-2 ring-primary/50",
                  )}
                >
                  {/* Indicador visual */}
                  <div
                    className={cn(
                      "w-1 h-12 rounded-full shrink-0 self-stretch md:self-auto",
                      visual === "ok" && "bg-emerald-500",
                      visual === "warning" && "bg-amber-500",
                      visual === "danger" && "bg-red-500",
                    )}
                  />

                  {/* Código + material */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Barcode className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {a.codigo_barra}
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border",
                          statusBadge(a.status),
                        )}
                      >
                        {a.status}
                      </span>
                      {tamanhoGrupo > 1 && (
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-blue-500/10 text-blue-600 border border-blue-500/30 flex items-center gap-1"
                          title={`Mesmo tubo atende ${tamanhoGrupo} exames do atendimento`}
                        >
                          <Layers className="w-2.5 h-2.5" />
                          Mesmo tubo · {tamanhoGrupo}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 flex-wrap">
                      <span className="font-medium text-foreground/80">
                        {a.tipo_material || "—"}
                      </span>
                      {a.localizacao && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {a.localizacao}
                        </span>
                      )}
                    </div>
                    {(venc.nivel === "atencao" || venc.nivel === "critico") && (
                      <div
                        className={cn(
                          "mt-2 inline-flex items-start gap-1.5 px-2 py-1 rounded-md text-[11px] border",
                          venc.nivel === "critico"
                            ? "bg-red-500/10 text-red-700 border-red-500/30"
                            : "bg-amber-500/10 text-amber-700 border-amber-500/30",
                        )}
                      >
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>
                          {venc.mensagem}{" "}
                          {venc.proximoStatus && (
                            <span className="font-semibold">→ {venc.proximoStatus}</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Datas */}
                  <div className="flex flex-col text-xs text-muted-foreground md:items-end md:min-w-[180px]">
                    <span>
                      Coleta: <span className="text-foreground">{fmt(a.data_coleta)}</span>
                    </span>
                    <span className="flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {a.status === "DISPONIVEL" ? (
                        <>Vence em <span className="text-foreground font-medium">{tempoRestante(a.data_validade)}</span></>
                      ) : (
                        <>Validade <span className="text-foreground">{fmt(a.data_validade)}</span></>
                      )}
                    </span>
                  </div>

                  {/* Ação */}
                  <div className="flex md:justify-end">
                    {a.status === "DISPONIVEL" || a.status === "VENCIDA" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDescarte(a);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-1.5" />
                        Descartar
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">—</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {advancadoAtivo ? (
            advTotal > advPageSize && (
              <div className="p-4 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Página <span className="font-semibold text-foreground">{advPage}</span> de{" "}
                  <span className="font-semibold text-foreground">{Math.max(1, Math.ceil(advTotal / advPageSize))}</span>{" "}
                  · <span className="font-semibold text-foreground">{advTotal}</span> amostra(s)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={advPage <= 1 || advLoading}
                    onClick={() => setAdvPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={advPage * advPageSize >= advTotal || advLoading}
                    onClick={() => setAdvPage((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )
          ) : (
            restantes > 0 && (
              <div className="p-4 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Mostrando <span className="font-semibold text-foreground">{visiveis.length}</span> de{" "}
                  <span className="font-semibold text-foreground">{totalListagem}</span> amostras
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                >
                  Carregar mais ({Math.min(PAGE_SIZE, restantes)})
                </Button>
              </div>
            )
          )}

          </>
        )}
      </div>

      <AlertDialog open={!!confirmDescarte} onOpenChange={(o) => !o && setConfirmDescarte(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar amostra?</AlertDialogTitle>
            <AlertDialogDescription>
              A amostra <span className="font-mono font-semibold">{confirmDescarte?.codigo_barra}</span>{" "}
              será marcada como descartada e não poderá mais ser reutilizada. Essa ação é registrada na
              auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDescarte && handleDescartar(confirmDescarte)}
            >
              Confirmar descarte
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AmostraDetalheDialog
        amostraId={detalheId}
        open={!!detalheId}
        onOpenChange={(o) => !o && setDetalheId(null)}
      />

      <BarcodeScannerDialog
        open={scannerAberto}
        onOpenChange={setScannerAberto}
        onDetected={(codigo) => {
          setScannerAberto(false);
          handleCodigoLido(codigo);
        }}
      />
    </div>
  );
}