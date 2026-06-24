import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Plus, Search, ChevronLeft, ChevronRight, MoreVertical, Pencil, Ban, X, Loader2,
  Eye, Building2, Cake, Activity, CircleDollarSign, CheckCircle2, Clock3,
  SlidersHorizontal, Filter, AlertTriangle, Receipt, Globe,
} from "lucide-react";
import { useSolicitacoesNaoLidas } from "@/hooks/useSolicitacoesNaoLidas";
import { getOrcamentos, subscribeOrcamentos } from "@/data/orcamentoStore";
import { formatIdadeDetalhada, isAniversarioHoje } from "@/lib/idade";
import { getAtendimentos, subscribe, updateAtendimento, reloadAtendimentoById } from "@/data/atendimentoStore";
import { getUnidadeById, getUnidades } from "@/data/unidadeStore";
import type { MockAtendimento } from "@/data/types";
import { toast } from "@/hooks/use-toast";
import StatusBadge from "@/components/StatusBadge";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import OrigemBadge from "@/components/OrigemBadge";
import PagamentoDialog from "@/components/PagamentoDialog";
import AtendimentoDetalheDialog from "@/components/AtendimentoDetalheDialog";
import { calculateExamPrice } from "@/domains/appointment/services/pricing";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { requerConfirmacaoEdicao, mensagemAlertaEdicao, setAuditJustificativa } from "@/lib/atendimentoPolicy";
import { useDicionario } from "@/hooks/useDicionario";
import { showError } from "@/lib/showError";
import { useFeatureFlag } from "@/lib/featureFlags";
import { usePaginatedAtendimentos, pageRowToLightAtendimento } from "@/hooks/usePaginatedAtendimentos";
import { normalizeAtendimento } from "@/data/atendimentoNormalize";
import { logger } from "@/lib/logger";
import { getCurrentTenantId } from "@/lib/db/tenantResolver";
import { useAuth } from "@/contexts/AuthContext";

/* ── Helpers ── */
const normalize = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const calcIdadeDetalhada = (nascimento: string): string => formatIdadeDetalhada(nascimento);

const ITEMS_PER_PAGE = 10;

const statusAtendimentoOptions = ["Todos", "Pedido Realizado", "Amostra Coletada", "Amostra Analisada", "Resultado salvo", "Resultado liberado", "Pedido cancelado"];

// Payment filter — value (canonical) + label (display)
const statusPagamentoFilters: { value: string; label: string }[] = [
  { value: "Todos", label: "Todos" },
  { value: "Pagamento efetuado", label: "Pago" },
  { value: "Pagamento pendente", label: "Pendente" },
  { value: "Pagamento parcial", label: "Parcial" },
  { value: "Pagamento cancelado", label: "Cancelado" },
];

// Motivos de cancelamento vêm de `select_options` via useDicionario("motivo_cancelamento").
// "Outro" é incluído sempre como opção final para permitir texto livre.

/* ── Generic Filter Chip ── */
function FilterChip({ label, options, value, onChange, displayMap }: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  displayMap?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isFiltered = value !== "Todos";
  const display = (v: string) => displayMap?.[v] ?? v;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium border transition-colors ${
          isFiltered
            ? "border-primary/40 bg-primary/5 text-primary"
            : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-border"
        }`}
      >
        <Filter className="w-3 h-3" />
        {label}{isFiltered ? `: ${display(value)}` : ""}
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-56 bg-popover border border-border rounded-lg shadow-md z-30 py-1 max-h-64 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                value === opt
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              {display(opt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Row Actions (menu ancorado em portal/fixed para nunca ser cortado) ── */
function RowActions({ onEdit, onCancel, onView, canEdit, canCancel }: {
  onEdit: () => void;
  onCancel: () => void;
  onView: () => void;
  canEdit: boolean;
  canCancel: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Reposiciona o menu na abertura (e fecha em scroll/resize para evitar âncora "voando")
  useEffect(() => {
    if (!open) return;

    const place = () => {
      const rect = btnRef.current?.getBoundingClientRect();
      if (!rect) return;
      const MENU_WIDTH = 208; // ~w-52
      const MENU_HEIGHT = 156;
      const margin = 8;
      // Por padrão abre abaixo e alinhado à direita do botão
      let top = rect.bottom + 4;
      let left = rect.right - MENU_WIDTH;
      // Se não couber para baixo, abre para cima
      if (top + MENU_HEIGHT > window.innerHeight - margin) {
        top = Math.max(margin, rect.top - MENU_HEIGHT - 4);
      }
      if (left < margin) left = margin;
      if (left + MENU_WIDTH > window.innerWidth - margin) {
        left = window.innerWidth - MENU_WIDTH - margin;
      }
      setCoords({ top, left });
    };

    place();
    const close = () => setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (
        menuRef.current?.contains(e.target as Node) ||
        btnRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        className="size-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Ações"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && coords && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: coords.top, left: coords.left }}
          className="w-52 bg-popover border border-border rounded-lg shadow-md z-[60] py-1"
        >
          <button
            onClick={() => { setOpen(false); onView(); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <Eye className="w-4 h-4 text-muted-foreground" /> Ver detalhes
          </button>
          {canEdit && (
            <button
              onClick={() => { setOpen(false); onEdit(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Pencil className="w-4 h-4 text-muted-foreground" /> Editar
            </button>
          )}
          {canCancel && (
            <>
              {canEdit && <div className="h-px bg-border mx-2 my-1" />}
              <button
                onClick={() => { setOpen(false); onCancel(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/5 transition-colors"
              >
                <Ban className="w-4 h-4" /> Cancelar
              </button>
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

/* ── Confirm Alert Dialog (alerta + justificativa obrigatória para edições sensíveis) ── */
function ConfirmAlertDialog({ open, onClose, onConfirm, message, confirmLabel = "Continuar", requireJustificativa = false }: {
  open: boolean;
  onClose: () => void;
  onConfirm: (justificativa: string) => void;
  message: string;
  confirmLabel?: string;
  requireJustificativa?: boolean;
}) {
  const [justificativa, setJustificativa] = useState("");
  useBodyScrollLock(open);

  // Reset ao abrir
  useEffect(() => {
    if (open) setJustificativa("");
  }, [open]);

  if (!open) return null;

  const trimmed = justificativa.trim();
  const minChars = 10;
  const valid = !requireJustificativa || trimmed.length >= minChars;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card rounded-lg border border-border shadow-md overflow-hidden">
        <div className="flex items-start gap-3 px-6 py-5">
          <div className="h-10 w-10 rounded-md bg-warning/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-foreground tracking-tight">Confirmar alteração</h2>
            <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        {requireJustificativa && (
          <div className="px-6 pb-4">
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Justificativa <span className="text-destructive">*</span>
            </label>
            <textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Descreva o motivo desta alteração (mín. 10 caracteres)..."
              className="w-full rounded-md bg-background border border-border px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 resize-none h-24 transition-colors"
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {trimmed.length}/{minChars} caracteres mínimos. Será gravada na auditoria.
            </p>
          </div>
        )}
        <div className="h-px bg-border" />
        <div className="px-6 py-4 flex items-center gap-3 bg-card">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-md border border-border bg-card text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Voltar
          </button>
          <button
            onClick={() => valid && onConfirm(trimmed)}
            disabled={!valid}
            className="flex-1 h-10 rounded-md bg-warning text-warning-foreground text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Cancel Dialog ── */
function CancelDialog({ open, onClose, onConfirm, pacienteNome }: {
  open: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
  pacienteNome: string;
}) {
  const [selectedMotivo, setSelectedMotivo] = useState("");
  const [motivoCustom, setMotivoCustom] = useState("");

  const { data: motivosOpts = [] } = useDicionario("motivo_cancelamento", { ativosOnly: true });

  useBodyScrollLock(open);

  if (!open) return null;

  // Lista do dicionário + garante "Outro" no final para texto livre
  const motivosStore = motivosOpts.map((m) => m.label);
  const motivosCancelamento = motivosStore.includes("Outro")
    ? motivosStore
    : [...motivosStore, "Outro"];

  const motivoFinal = selectedMotivo === "Outro" ? motivoCustom.trim() : selectedMotivo;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] flex flex-col bg-card rounded-lg border border-border shadow-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-card">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-destructive/10 flex items-center justify-center">
              <Ban className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground tracking-tight">Cancelar Atendimento</h2>
              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[260px]">{pacienteNome}</p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-px bg-border" />

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-muted/30">
          <p className="text-[13px] text-muted-foreground">
            Selecione o motivo do cancelamento.
          </p>
          <div className="space-y-2">
            {motivosCancelamento.map((m) => {
              const active = selectedMotivo === m;
              return (
                <button
                  key={m}
                  onClick={() => setSelectedMotivo(m)}
                  className={`w-full text-left px-4 py-3 rounded-md text-[13px] font-medium border transition-colors ${
                    active
                      ? "border-destructive/40 bg-card text-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
          {selectedMotivo === "Outro" && (
            <textarea
              value={motivoCustom}
              onChange={(e) => setMotivoCustom(e.target.value)}
              placeholder="Descreva o motivo..."
              className="w-full rounded-md bg-background border border-border px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 resize-none h-20 transition-colors"
            />
          )}
        </div>

        <div className="h-px bg-border" />

        {/* Footer */}
        <div className="px-6 py-4 flex items-center gap-3 bg-card">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-md border border-border bg-card text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Voltar
          </button>
          <button
            disabled={!motivoFinal}
            onClick={() => { onConfirm(motivoFinal); setSelectedMotivo(""); setMotivoCustom(""); }}
            className="flex-1 h-10 rounded-md bg-destructive text-destructive-foreground text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Status Pill (inline) ── */
function StatusPill({ label, type, onClick }: { label: string; type: string; onClick?: () => void }) {
  const colorMap: Record<string, string> = {
    success: "bg-secondary/10 text-secondary ring-secondary/20",
    warning: "bg-warning/10 text-warning ring-warning/20",
    danger: "bg-destructive/10 text-destructive ring-destructive/20",
    info: "bg-info/10 text-info ring-info/20",
    neutral: "bg-muted text-muted-foreground ring-border",
  };
  const cls = colorMap[type] ?? colorMap.neutral;

  return (
    <span onClick={onClick} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ring-1 ring-inset ${cls} ${onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

/* ── Mini KPI tile ── */
function StatTile({ label, value, icon: Icon, tone, onClick, hint }: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  tone: "primary" | "warning" | "secondary" | "info";
  onClick?: () => void;
  hint?: string;
}) {
  const toneMap = {
    primary:   { iconBg: "bg-primary/10",   iconText: "text-primary" },
    warning:   { iconBg: "bg-warning/10",   iconText: "text-warning" },
    secondary: { iconBg: "bg-secondary/10", iconText: "text-secondary" },
    info:      { iconBg: "bg-info/10",      iconText: "text-info" },
  } as const;
  const t = toneMap[tone] ?? toneMap.primary;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left bg-card rounded-lg border border-border p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex items-center gap-3">
        <div className={`size-10 rounded-md flex items-center justify-center ${t.iconBg}`}>
          <Icon className={`w-[18px] h-[18px] ${t.iconText}`} strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground tracking-wide">{label}</p>
          <p className="text-xl font-semibold tracking-[-0.01em] tabular-nums leading-tight">{value}</p>
          {hint && <p className="text-[10.5px] text-muted-foreground mt-0.5">{hint}</p>}
        </div>
      </div>
    </button>
  );
}

/* ════════════════════════════════════════════
   ██  MAIN PAGE COMPONENT
   ════════════════════════════════════════════ */
const Index = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  // RBAC visual — fonte única é o AuthContext (que reflete has_permission do backend).
  // O backend revalida em create-atendimento / update-atendimento; aqui só evitamos
  // mostrar ações que o usuário não pode executar.
  const canCreate = hasPermission("criar_atendimento");
  const canEdit = hasPermission("editar_atendimento");
  const canCancel = hasPermission("cancelar_atendimento");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAtendimento, setFilterAtendimento] = useState("Todos");
  const [filterPagamento, setFilterPagamento] = useState("Todos");
  const [filterUnidade, setFilterUnidade] = useState("Todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [, forceUpdate] = useState(0);

  // Dialogs
  const [pagamentoDialogOpen, setPagamentoDialogOpen] = useState(false);
  const [detalheDialogOpen, setDetalheDialogOpen] = useState(false);
  const [selectedAtendimento, setSelectedAtendimento] = useState<MockAtendimento | null>(null);
  const [localPagamentos, setLocalPagamentos] = useState<MockAtendimento["pagamentosRealizados"]>([]);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<MockAtendimento | null>(null);

  useEffect(() => subscribe(() => forceUpdate(n => n + 1)), []);
  useEffect(() => subscribeOrcamentos(() => forceUpdate(n => n + 1)), []);
  const orcamentosPendentes = getOrcamentos().filter(o => !o.convertido).length;
  const { count: pedidosNaoLidos } = useSolicitacoesNaoLidas({ notify: false });
  const canPedidosSite = hasPermission("solicitacoes_site_acesso");

  // ── Canary: UI paginada server-side ──
  // Kill-switch global: `USE_LEGACY_STORE` força modo legado (cache global)
  // mesmo com `paginated_atendimentos` ON. Precedência: kill-switch vence.
  const paginatedFlag = useFeatureFlag("paginated_atendimentos");
  const legacyForced = useFeatureFlag("USE_LEGACY_STORE");
  const paginatedEnabled = paginatedFlag && !legacyForced;
  // Sempre normalizamos: garante shape consistente vs items vindos da paginação.
  // `getAtendimentos()` é síncrono e o componente rerrenderiza via `subscribe`
  // → forceUpdate, então recomputar a cada render é seguro e barato.
  const cacheData = getAtendimentos().map(normalizeAtendimento);
  const paginated = usePaginatedAtendimentos(
    {
      status: filterAtendimento,
      pagamento: filterPagamento,
      unidadeId: filterUnidade === "Todos" ? "Todos" : (() => {
        const u = getUnidades().find(u => u.nome === filterUnidade);
        return u?.id ?? "Todos";
      })(),
      q: searchQuery,
    },
    paginatedEnabled,
  );

  // Canary observability — log único quando flag liga.
  useEffect(() => {
    if (!paginatedEnabled) return;
    let alive = true;
    (async () => {
      try {
        const tenantId = await getCurrentTenantId();
        if (!alive) return;
        logger.info("Index", "canary:paginated_atendimentos ON", { tenant_id: tenantId });
      } catch {
        /* fail-safe */
      }
    })();
    return () => { alive = false; };
  }, [paginatedEnabled]);

  // Em modo paginado: lista vem do server; quando o item já existe no cache
  // global usamos o objeto completo (para que dialogs de detalhe/pagamento
  // tenham exames + pagamentos hidratados sem refetch).
  // Sempre passa por `normalizeAtendimento` → shape consistente.
  const data = useMemo(() => {
    if (!paginatedEnabled) return cacheData;
    const cacheByProtocolo = new Map(cacheData.map(a => [a.protocolo, a]));
    return paginated.items.map(row => {
      const hit = cacheByProtocolo.get(row.protocolo);
      return normalizeAtendimento(hit ?? pageRowToLightAtendimento(row));
    });
  }, [paginatedEnabled, paginated.items, cacheData]);

  // Map protocolo → DB id (apenas modo paginado). Usado para hidratar o
  // atendimento completo (exames + pagamentos) quando o dialog abre — sem
  // depender do cache global ter o item carregado.
  const idByProtocolo = useMemo(() => {
    if (!paginatedEnabled) return new Map<string, number>();
    return new Map(paginated.items.map(r => [r.protocolo, r.id]));
  }, [paginatedEnabled, paginated.items]);

  /**
   * Garante que o atendimento esteja totalmente hidratado no cache antes de
   * abrir um dialog (detalhe / pagamento / cancelamento). No modo paginado
   * a lista vem leve (sem exames/pagamentos) — fazemos um reload pontual.
   * Retorna o objeto hidratado (ou o original como fallback).
   */
  const ensureHydrated = async (item: MockAtendimento): Promise<MockAtendimento> => {
    if (!paginatedEnabled) return item;
    const hasExames = (item.exames?.length ?? 0) > 0;
    const hasPagamentos = (item.pagamentosRealizados?.length ?? 0) > 0;
    // Heurística: se já tem exames OU já tem pagamentos, considera hidratado.
    // (Atendimento sem exames é raro; pior caso = 1 reload extra inofensivo.)
    if (hasExames || hasPagamentos) return item;
    const id = idByProtocolo.get(item.protocolo);
    if (!id) return item;
    try {
      await reloadAtendimentoById(id);
      const hydrated = getAtendimentos().find(a => a.protocolo === item.protocolo);
      return hydrated ? normalizeAtendimento(hydrated) : item;
    } catch {
      return item;
    }
  };

  const unidadeOptions = useMemo(() => ["Todos", ...getUnidades().map(u => u.nome)], []);

  // Build payment filter values & display mapping
  const pagamentoValues = statusPagamentoFilters.map(f => f.value);
  const pagamentoDisplayMap = Object.fromEntries(statusPagamentoFilters.map(f => [f.value, f.label]));

  /* ── Top KPIs (computed from full data) ── */
  const kpis = useMemo(() => {
    // Modo paginado: TODOS os KPIs (incluindo receita) vêm do server via
    // RPC `atendimentos_kpis` — agregados sobre o dataset completo do tenant
    // já com os mesmos filtros aplicados na lista. Sem cálculo local.
    if (paginatedEnabled) {
      return {
        total: paginated.kpis.total,
        pendentes: paginated.kpis.aguardando_coleta + paginated.kpis.em_analise,
        finalizados: paginated.kpis.finalizados,
        receita: paginated.kpis.receita_total,
      };
    }
    const total = data.length;
    const pendentes = data.filter(a =>
      ["Pedido Realizado", "Amostra Coletada"].includes(a.statusAtendimento.label)
    ).length;
    const finalizados = data.filter(a => a.statusAtendimento.label === "Resultado liberado").length;

    const receita = data.reduce((sum, a) => {
      if (a.statusAtendimento.label === "Pedido cancelado") return sum;
      const examesCobranca = a.examesCobranca ?? [];
      const valorAtend = (a.exames ?? []).reduce((s, nomeExame) => {
        const meta = examesCobranca.find(c => c.nome === nomeExame);
        return s + (Number(meta?.valor) || 0);
      }, 0);
      return sum + valorAtend;
    }, 0);

    return { total, pendentes, finalizados, receita };
  }, [data, paginatedEnabled, paginated.kpis]);

  // Em modo paginado: filtros JÁ foram aplicados server-side no RPC.
  // O client NÃO deve filtrar de novo (poderia esconder linhas válidas
  // por causa de divergência de label/normalização).
  const filteredData = useMemo(() => {
    if (paginatedEnabled) return data;
    return data.filter((item) => {
    const matchAtendimento = filterAtendimento === "Todos" || item.statusAtendimento.label === filterAtendimento;
    const matchPagamento = filterPagamento === "Todos" || item.statusPagamento.label === filterPagamento;
    const matchUnidade = filterUnidade === "Todos" || (() => {
      const u = item.unidadeId ? getUnidadeById(item.unidadeId) : undefined;
      return u?.nome === filterUnidade;
    })();
    const query = normalize(searchQuery);
    const queryDigits = searchQuery.replace(/\D/g, "");
    const matchSearch =
      !query ||
      normalize(item.nome).includes(query) ||
      normalize(item.protocolo).includes(query) ||
      (queryDigits.length > 0 && (item.cpf ?? "").replace(/\D/g, "").includes(queryDigits));
    return matchAtendimento && matchPagamento && matchUnidade && matchSearch;
    });
  }, [data, paginatedEnabled, searchQuery, filterAtendimento, filterPagamento, filterUnidade]);

  // Em modo paginado: server controla as páginas → renderizamos tudo que
  // está em memória (até MAX_PAGES_IN_CACHE) e oferecemos "Carregar mais".
  const totalPages = paginatedEnabled
    ? 1
    : Math.max(1, Math.ceil(filteredData.length / ITEMS_PER_PAGE));
  const paginatedData = paginatedEnabled
    ? filteredData
    : filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, filterAtendimento, filterPagamento, filterUnidade]);

  /* ── Pagamento logic ── */
  const openPagamentoDialog = async (item: MockAtendimento) => {
    const full = await ensureHydrated(item);
    setSelectedAtendimento(full);
    setLocalPagamentos([...(full.pagamentosRealizados ?? [])]);
    setPagamentoDialogOpen(true);
  };

  /* ── Detalhe (open + hidratar) ── */
  const openDetalheDialog = async (item: MockAtendimento) => {
    setSelectedAtendimento(item);
    setDetalheDialogOpen(true);
    const full = await ensureHydrated(item);
    if (full !== item) setSelectedAtendimento(full);
  };

  const pagamentoData = useMemo(() => {
    if (!selectedAtendimento) return { itens: 0, subtotal: 0, desconto: 0, acrescimo: 0, total: 0, valorPago: 0, saldoDevedor: 0, pagamentosRealizados: [] as MockAtendimento["pagamentosRealizados"], exames: [] as { nome: string; valor: number }[] };
    // Apenas exames cobrados do PACIENTE entram no cálculo do modal de pagamento.
    const convenioNome = selectedAtendimento.convenio ?? "Particular";
    const examesPaciente = (selectedAtendimento.examesCobranca ?? selectedAtendimento.exames.map(nome => ({ nome, cobrancaDestino: "paciente" as const, valor: 0, valorOriginal: 0 })))
      .filter(c => c.cobrancaDestino !== "convenio")
      .map(e => {
        const valor = Number(e.valor) || 0;
        const valorTabela = calculateExamPrice({ nomeExame: e.nome, convenioNome });
        const voRaw = Number(e.valorOriginal) || 0;
        // Se já existe `valorOriginal` no registro (SSOT do preço cheio), respeitar — assim
        // acréscimos (valor > valorOriginal) e descontos (valor < valorOriginal) são preservados.
        // Sem `valorOriginal`, fallback = max(valor, tabela) para dados legados sem desconto.
        const valorOriginal = voRaw > 0 ? voRaw : Math.max(valor, valorTabela);
        return { ...e, valor, valorOriginal };
      });
    // Subtotal = soma dos valores ORIGINAIS (preço cheio antes do desconto).
    // O desconto/acréscimo histórico aparece destacado como linha separada.
    const subtotal = examesPaciente.reduce((sum, e) => sum + e.valorOriginal, 0);
    const totalEfetivo = examesPaciente.reduce((sum, e) => sum + e.valor, 0);
    const ajusteCents = Math.round((totalEfetivo - subtotal) * 100);
    const descontoHistorico = ajusteCents < 0 ? Math.abs(ajusteCents) / 100 : 0;
    const acrescimoHistorico = ajusteCents > 0 ? ajusteCents / 100 : 0;
    const totalPago = (localPagamentos ?? []).reduce((sum, p) => sum + p.valor, 0);
    return {
      itens: examesPaciente.length,
      subtotal,
      desconto: descontoHistorico,
      acrescimo: acrescimoHistorico,
      total: totalEfetivo,
      valorPago: totalPago,
      saldoDevedor: Math.max(0, totalEfetivo - totalPago),
      pagamentosRealizados: localPagamentos ?? [],
      // Exames com valor ORIGINAL (descontos novos no dialog se aplicam sobre o cheio).
      exames: examesPaciente.map(e => ({ nome: e.nome, valor: e.valorOriginal })),
    };
  }, [selectedAtendimento, localPagamentos]);


  const handlePagamentoConfirm = async (resultado: { valorPago: number; desconto: number; acrescimo: number; novosPagamentos: MockAtendimento["pagamentosRealizados"] }) => {
    if (!selectedAtendimento) return;
    const novos = resultado.novosPagamentos ?? [];
    const pagamentosFinais = [...(localPagamentos ?? []), ...novos];
    const acrescimo = Math.max(0, Math.round((resultado.acrescimo || 0) * 100) / 100);
    const desconto = Math.max(0, Math.round((resultado.desconto || 0) * 100) / 100);
    const totalAjustado = pagamentoData.subtotal - desconto + acrescimo;
    const totalPagoFinal = pagamentosFinais.reduce((sum, p) => sum + p.valor, 0);
    const statusPag = totalPagoFinal >= totalAjustado && totalAjustado > 0
      ? { label: "Pagamento efetuado", type: "success" as const }
      : totalPagoFinal > 0
        ? { label: "Pagamento parcial", type: "info" as const }
        : { label: "Pagamento pendente", type: "warning" as const };

    // Redistribui o ajuste líquido (acrescimo − desconto) proporcionalmente sobre
    // o `valorOriginal` (preço cheio) de cada exame cobrado do paciente.
    // `valorOriginal` é preservado como SSOT do preço cheio; `valor` reflete o efetivo.
    // IMPORTANTE: quando NÃO há novo desconto/acréscimo neste ciclo, NÃO redistribuímos
    // — preservamos o `valor` corrente (que já carrega ajustes históricos).
    const updates: Partial<MockAtendimento> = {
      // Apenas os NOVOS pagamentos vão para o backend (modo aditivo da RPC).
      // Para a UI/cache local, manteremos a lista completa após o sucesso.
      pagamentosRealizados: novos,
      statusPagamento: statusPag,
    };
    const ajusteLiquidoCents = Math.round((acrescimo - desconto) * 100); // pode ser negativo
    const examesCobrancaAtuais = selectedAtendimento.examesCobranca;
    if (ajusteLiquidoCents !== 0 && examesCobrancaAtuais && examesCobrancaAtuais.length > 0) {
      const pacienteIdxs = examesCobrancaAtuais
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => e.cobrancaDestino !== "convenio");
      const baseOriginalPorIdx = new Map<number, number>();
      pacienteIdxs.forEach(({ e, i }) => {
        const orig = Number(e.valorOriginal) > 0 ? Number(e.valorOriginal) : (Number(e.valor) || 0);
        baseOriginalPorIdx.set(i, orig);
      });
      const subtotalOriginalCents = Array.from(baseOriginalPorIdx.values()).reduce((s, v) => s + Math.round(v * 100), 0);
      if (subtotalOriginalCents > 0) {
        // Clamp do desconto para nunca passar do subtotal (acréscimo não tem teto).
        const ajusteCentsClamped = ajusteLiquidoCents < 0
          ? Math.max(ajusteLiquidoCents, -subtotalOriginalCents)
          : ajusteLiquidoCents;
        let restante = ajusteCentsClamped;
        const novosValores = new Map<number, number>();
        pacienteIdxs.forEach(({ i }, idx) => {
          const origCents = Math.round((baseOriginalPorIdx.get(i) ?? 0) * 100);
          const isLast = idx === pacienteIdxs.length - 1;
          const share = isLast
            ? restante
            : Math.round((origCents / subtotalOriginalCents) * ajusteCentsClamped);
          restante -= share;
          const novoCents = Math.max(0, origCents + share);
          novosValores.set(i, novoCents / 100);
        });
        const novaCobranca = examesCobrancaAtuais.map((e, i) => {
          const orig = baseOriginalPorIdx.get(i);
          if (orig == null) return e;
          return {
            ...e,
            valorOriginal: orig,
            valor: novosValores.has(i) ? novosValores.get(i)! : orig,
          };
        });
        updates.examesCobranca = novaCobranca;
        updates.exames = novaCobranca.map((e) => e.nome);
      }
    }

    try {
      await updateAtendimento(selectedAtendimento.protocolo, updates);
      setLocalPagamentos(pagamentosFinais);
      // Fase 2: no modo paginado, NÃO confiamos no cache pós-update.
      // Revalidamos a página atual + KPIs via RPC (fonte da verdade = DB).
      if (paginatedEnabled) {
        void paginated.refresh();
      }
      toast({ title: "Pagamento atualizado", description: `Status alterado para "${statusPag.label}"` });
    } catch (e) {
      showError(e, { scope: "Index.handlePagamentoConfirm", userMessage: "Não foi possível atualizar o pagamento." });
    }
  };



  const handleRemovePagamentoRealizado = (index: number) => {
    setLocalPagamentos(prev => (prev ?? []).filter((_, i) => i !== index));
  };

  /* ── Cancel logic ── */
  const [pendingCancel, setPendingCancel] = useState<MockAtendimento | null>(null);
  const [pendingCancelJustificativa, setPendingCancelJustificativa] = useState<string>("");
  const handleCancelRequest = (item: MockAtendimento) => {
    // Hidrata antes de qualquer fluxo: garante que o motivo será aplicado
    // ao atendimento COMPLETO (com exames/pagamentos atuais do servidor).
    void (async () => {
      const full = await ensureHydrated(item);
      if (requerConfirmacaoEdicao(full.statusAtendimento, full.data)) {
        setPendingCancel(full);
        return;
      }
      setCancelTarget(full);
      setCancelDialogOpen(true);
    })();
  };
  const proceedCancel = (justificativa: string) => {
    if (pendingCancel) {
      setCancelTarget(pendingCancel);
      setPendingCancelJustificativa(justificativa);
      setCancelDialogOpen(true);
      setPendingCancel(null);
    }
  };

  const handleCancelConfirm = async (motivo: string) => {
    if (!cancelTarget) return;
    // Validação: motivo é obrigatório para cancelamento.
    const motivoFinal = (motivo || "").trim();
    if (!motivoFinal) {
      toast({ title: "Motivo obrigatório", description: "Informe o motivo do cancelamento.", variant: "destructive" });
      return;
    }
    // Se houver justificativa de edição sensível, registra antes do update
    if (pendingCancelJustificativa) {
      await setAuditJustificativa(pendingCancelJustificativa);
    }
    try {
      await updateAtendimento(cancelTarget.protocolo, {
        statusAtendimento: { label: "Pedido cancelado", type: "danger", showIcon: true },
        motivoCancelamento: motivoFinal,
      });
      // Fase 2: revalidação pós-ação no modo paginado (sem confiar no cache).
      if (paginatedEnabled) {
        void paginated.refresh();
      }
      toast({ title: "Atendimento Cancelado", description: `${cancelTarget.protocolo} foi cancelado. A ação foi registrada na auditoria.` });
    } catch (e) {
      showError(e, { scope: "Index.handleCancelConfirm", userMessage: "Não foi possível cancelar o atendimento." });
    } finally {
      setCancelDialogOpen(false);
      setCancelTarget(null);
      setPendingCancelJustificativa("");
    }
  };

  /* ── Edit logic ── */
  const [pendingEdit, setPendingEdit] = useState<MockAtendimento | null>(null);
  const handleEdit = (item: MockAtendimento) => {
    if (requerConfirmacaoEdicao(item.statusAtendimento, item.data)) {
      setPendingEdit(item);
      return;
    }
    navigate(`/atendimentos/${encodeURIComponent(item.protocolo)}/editar`);
  };
  const proceedEdit = async (justificativa: string) => {
    if (pendingEdit) {
      const target = pendingEdit;
      setPendingEdit(null);
      // Registra a justificativa para a sessão atual; será capturada
      // pelos próximos triggers de auditoria executados nesta página de edição.
      await setAuditJustificativa(justificativa);
      navigate(`/atendimentos/${encodeURIComponent(target.protocolo)}/editar`);
    }
  };

  const activeFilters = [filterAtendimento, filterPagamento, filterUnidade].filter(f => f !== "Todos").length;

  return (
    <PageContainer>

      {/* ── Header (design system unificado SA) ── */}
      <PageHeader
        eyebrow="Operacional"
        title="Atendimentos"
        description="Gerencie e acompanhe os atendimentos do laboratório."
        actions={
          <>
            <button
              onClick={() => navigate("/orcamentos")}
              className="relative inline-flex items-center gap-2 h-10 px-4 bg-card text-foreground text-[13px] font-semibold rounded-xl border border-border hover:bg-muted transition-colors"
            >
              <Receipt className="w-4 h-4" />
              Orçamentos
              {orcamentosPendentes > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold leading-none shadow-sm">
                  {orcamentosPendentes > 99 ? "99+" : orcamentosPendentes}
                </span>
              )}
            </button>
            {canPedidosSite && (
              <button
                onClick={() => navigate("/pedidos-site")}
                className="relative inline-flex items-center gap-2 h-10 px-4 bg-card text-foreground text-[13px] font-semibold rounded-xl border border-border hover:bg-muted transition-colors"
              >
                <Globe className="w-4 h-4" />
                Pedidos do site
                {pedidosNaoLidos > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold leading-none shadow-sm">
                    {pedidosNaoLidos > 99 ? "99+" : pedidosNaoLidos}
                  </span>
                )}
              </button>
            )}
            {canCreate && (
              <button
                onClick={() => navigate("/atendimentos/novo")}
                className="inline-flex items-center gap-2 h-10 px-4 bg-primary text-primary-foreground text-[13px] font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]"
              >
                <Plus className="w-4 h-4" />
                Novo Atendimento
              </button>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-6">


      {/* ── KPI Strip ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Total"
          value={kpis.total}
          icon={Activity}
          tone="primary"
          hint="Atendimentos cadastrados"
          onClick={() => { setFilterAtendimento("Todos"); setFilterPagamento("Todos"); setFilterUnidade("Todos"); }}
        />
        <StatTile
          label="Em andamento"
          value={kpis.pendentes}
          icon={Clock3}
          tone="warning"
          hint="Pedido / Coleta"
          onClick={() => setFilterAtendimento("Pedido Realizado")}
        />
        <StatTile
          label="Finalizados"
          value={kpis.finalizados}
          icon={CheckCircle2}
          tone="secondary"
          hint="Resultado liberado"
          onClick={() => setFilterAtendimento("Resultado liberado")}
        />
        <StatTile
          label="Receita estimada"
          value={`R$ ${kpis.receita.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={CircleDollarSign}
          tone="info"
          hint="Excluindo cancelados"
        />
      </section>

      {/* ── Search & Filters Bar ── */}
      <div className="bg-card border border-border rounded-lg p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, CPF ou protocolo..."
            className="w-full pl-10 pr-4 h-9 bg-background rounded-md text-sm placeholder:text-muted-foreground border border-border focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-colors"
          />
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <FilterChip label="Status" options={statusAtendimentoOptions} value={filterAtendimento} onChange={setFilterAtendimento} />
          <FilterChip label="Pagamento" options={pagamentoValues} value={filterPagamento} onChange={setFilterPagamento} displayMap={pagamentoDisplayMap} />
          <FilterChip label="Unidade" options={unidadeOptions} value={filterUnidade} onChange={setFilterUnidade} />
          {activeFilters > 0 && (
            <button
              onClick={() => { setFilterAtendimento("Todos"); setFilterPagamento("Todos"); setFilterUnidade("Todos"); }}
              className="inline-flex items-center gap-1 h-9 px-2.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-3 h-3" /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* ── Content: Atendimento List ── */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">

        {/* ── Banner de erro do canary (não bloqueia UI) ── */}
        {paginatedEnabled && paginated.error && (
          <div className="px-4 py-2.5 border-b border-destructive/20 bg-destructive/5 text-xs text-destructive flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Falha ao carregar atendimentos paginados: {paginated.error}</span>
            <button
              onClick={() => paginated.refresh()}
              className="ml-auto h-6 px-2 rounded-md text-[11px] font-medium border border-destructive/30 hover:bg-destructive/10 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Loading inicial / Empty state / Lista */}
        {paginatedEnabled && paginated.loading && paginatedData.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin mx-auto mb-3" />
            <p className="text-xs text-muted-foreground">Carregando atendimentos…</p>
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <div className="size-14 rounded-md bg-muted flex items-center justify-center mx-auto mb-4">
              <SlidersHorizontal className="w-5 h-5 text-muted-foreground" />
            </div>
            {data.length === 0 ? (
              <>
                <p className="text-sm font-semibold text-foreground mb-1">Sem atendimentos cadastrados</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Inicie um novo atendimento para começar a registrar coletas, resultados e cobranças.
                </p>
                {canCreate && (
                  <button
                    onClick={() => navigate("/atendimentos/novo")}
                    className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Novo atendimento
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground mb-1">Nenhum atendimento encontrado</p>
                <p className="text-xs text-muted-foreground">Tente ajustar os filtros ou buscar por outro termo.</p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* ── Mobile: Card list ── */}
            <div className="lg:hidden divide-y divide-border">
              {paginatedData.map((item) => (
                <div key={item.protocolo} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary shrink-0">
                          {item.nome.split(" ").filter((_, i, arr) => i === 0 || i === arr.length - 1).map(w => w[0]).join("")}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate flex items-center gap-1.5">
                            <span className="truncate">{item.nome}</span>
                            {isAniversarioHoje(item.nascimento) && (
                              <Cake className="h-3.5 w-3.5 text-[hsl(var(--status-purple))] shrink-0" aria-label="Aniversário hoje" />
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                            {item.protocolo}
                          </p>
                        </div>
                      </div>
                    </div>
                    <RowActions
                      onView={() => { void openDetalheDialog(item); }}
                      onEdit={() => handleEdit(item)}
                      onCancel={() => handleCancelRequest(item)}
                      canEdit={canEdit}
                      canCancel={canCancel}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 pl-11">
                    <span className="text-[11px] text-muted-foreground">{item.data}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-11">
                    <StatusPill label={item.statusAtendimento.label} type={item.statusAtendimento.type} onClick={() => { void openDetalheDialog(item); }} />
                    <StatusBadge label={item.statusPagamento.label} type={item.statusPagamento.type} onClick={() => openPagamentoDialog(item)} />
                    <OrigemBadge origem={item.origem} />
                  </div>
                  {item.motivoCancelamento && (
                    <div className="px-3 py-2 bg-destructive/5 border border-destructive/20 rounded-md">
                      <p className="text-xs text-destructive font-medium">Motivo: {item.motivoCancelamento}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ── Desktop: Row list ── */}
            <div className="hidden lg:block">
              {/* Header row */}
              <div className="grid grid-cols-[minmax(220px,2fr)_minmax(140px,160px)_minmax(110px,140px)_minmax(140px,160px)_minmax(120px,140px)_48px] gap-3 xl:gap-4 px-4 xl:px-6 py-3 border-b border-border bg-muted/30 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <div>Paciente</div>
                <div>Protocolo</div>
                <div>Unidade</div>
                <div>Status</div>
                <div>Pagamento</div>
                <div />
              </div>

              {/* Data rows */}
              <div className="divide-y divide-border/50">
                {paginatedData.map((item) => {
                  const unidade = item.unidadeId ? getUnidadeById(item.unidadeId) : undefined;

                  return (
                    <div
                      key={item.protocolo}
                      className="grid grid-cols-[minmax(220px,2fr)_minmax(140px,160px)_minmax(110px,140px)_minmax(140px,160px)_minmax(120px,140px)_48px] gap-3 xl:gap-4 px-4 xl:px-6 py-3.5 items-center hover:bg-muted/30 transition-colors group"
                    >
                      {/* Patient */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary shrink-0">
                          {item.nome.split(" ").filter((_, i, arr) => i === 0 || i === arr.length - 1).map(w => w[0]).join("")}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate flex items-center gap-1.5">
                            <span className="truncate">{item.nome}</span>
                            {isAniversarioHoje(item.nascimento) && (
                              <Cake className="h-3.5 w-3.5 text-[hsl(var(--status-purple))] shrink-0" aria-label="Aniversário hoje" />
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{item.nascimento} · {calcIdadeDetalhada(item.nascimento)}</p>
                        </div>
                      </div>

                      {/* Protocol */}
                      <div>
                        <p className="text-xs font-mono font-medium">{item.protocolo}</p>
                        <p className="text-[11px] text-muted-foreground">{item.data}</p>
                      </div>

                      {/* Unidade */}
                      <div className="text-xs text-muted-foreground truncate">
                        {unidade ? (
                          <span className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{unidade.nome}</span>
                          </span>
                        ) : "—"}
                      </div>

                      {/* Status */}
                      <StatusPill label={item.statusAtendimento.label} type={item.statusAtendimento.type} onClick={() => { void openDetalheDialog(item); }} />

                      {/* Pagamento */}
                      <div>
                        <StatusBadge label={item.statusPagamento.label} type={item.statusPagamento.type} onClick={() => openPagamentoDialog(item)} />
                        <OrigemBadge origem={item.origem} className="ml-1 align-middle" compact />
                      </div>

                      {/* Actions */}
                      <RowActions
                        onView={() => { void openDetalheDialog(item); }}
                        onEdit={() => handleEdit(item)}
                        onCancel={() => handleCancelRequest(item)}
                        canEdit={canEdit}
                        canCancel={canCancel}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── Pagination ── */}
        {!paginatedEnabled && filteredData.length > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border text-xs text-muted-foreground">
            <span>{filteredData.length} registro(s)</span>
            <div className="flex items-center gap-3">
              <span className="tabular-nums">
                {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredData.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)} de {filteredData.length}
              </span>
              <div className="flex gap-1">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="size-7 rounded-md flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="size-7 rounded-md flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Carregar mais (canary paginado) ── */}
        {paginatedEnabled && paginatedData.length > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border text-xs text-muted-foreground gap-3">
            <span className="tabular-nums">
              Exibindo {paginatedData.length} de {paginated.kpis.total} registro(s)
            </span>
            {paginated.hasMore ? (
              <button
                onClick={() => paginated.loadMore()}
                disabled={paginated.loadingMore}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[11px] font-medium border border-border hover:bg-muted disabled:opacity-50 transition-colors"
              >
                {paginated.loadingMore ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Carregando…</>
                ) : (
                  <>Carregar mais</>
                )}
              </button>
            ) : (
              <span className="text-[11px] text-muted-foreground">Fim dos resultados</span>
            )}
          </div>
        )}
      </div>

      {/* ── Dialogs ── */}
      <PagamentoDialog
        open={pagamentoDialogOpen}
        onClose={() => setPagamentoDialogOpen(false)}
        itens={pagamentoData.itens}
        subtotal={pagamentoData.subtotal}
        desconto={pagamentoData.desconto}
        acrescimo={pagamentoData.acrescimo}
        total={pagamentoData.total}
        valorPago={pagamentoData.valorPago}
        saldoDevedor={pagamentoData.saldoDevedor}
        exames={pagamentoData.exames}
        pagamentosRealizados={pagamentoData.pagamentosRealizados}
        onRemovePagamentoRealizado={handleRemovePagamentoRealizado}
        onConfirm={handlePagamentoConfirm}
        descontoData={selectedAtendimento?.data}
        acrescimoData={selectedAtendimento?.data}
        isEditing={true}
      />
      <AtendimentoDetalheDialog
        open={detalheDialogOpen}
        onClose={() => setDetalheDialogOpen(false)}
        atendimento={selectedAtendimento}
      />
      <CancelDialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        onConfirm={handleCancelConfirm}
        pacienteNome={cancelTarget?.nome ?? ""}
      />
      <ConfirmAlertDialog
        open={!!pendingEdit}
        onClose={() => setPendingEdit(null)}
        onConfirm={proceedEdit}
        message={pendingEdit ? mensagemAlertaEdicao(pendingEdit.statusAtendimento, pendingEdit.data) : ""}
        confirmLabel="Editar mesmo assim"
        requireJustificativa
      />
      <ConfirmAlertDialog
        open={!!pendingCancel}
        onClose={() => setPendingCancel(null)}
        onConfirm={proceedCancel}
        message={pendingCancel ? mensagemAlertaEdicao(pendingCancel.statusAtendimento, pendingCancel.data) : ""}
        confirmLabel="Cancelar mesmo assim"
        requireJustificativa
      />
      </div>
    </PageContainer>

  );
};

export default Index;
