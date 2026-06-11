import { PageHeader } from "@/components/shared/PageHeader";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  MailOpen, Phone, Search, Loader2, RefreshCw, Inbox, Check,
  CircleDot, Clock, CheckCircle2, XCircle, Pencil, Save, X, Eye, EyeOff, ArrowRight,
  Filter, Bell, CircleDollarSign, Globe2, Zap, CalendarClock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  listSolicitacoesFull,
  updateSolicitacaoStatus,
  markSolicitacaoLida,
  updateSolicitacaoContato,
  marcarConvertido,
  type SolicitacaoFull,
  type SolicitacaoStatus,
} from "@/lib/tenantSite/vitrineStore";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useSolicitacoesNaoLidas } from "@/hooks/useSolicitacoesNaoLidas";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import PageErrorBoundary from "@/components/PageErrorBoundary";


const fmtBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const normalize = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const STATUS_META: Record<SolicitacaoStatus, { label: string; icon: typeof CircleDot; cls: string }> = {
  NOVO:        { label: "Novo",        icon: CircleDot,    cls: "bg-primary/10 text-primary border-primary/30" },
  EM_CONTATO:  { label: "Em contato",  icon: Clock,        cls: "bg-warning/10 text-warning border-warning/30" },
  CONVERTIDO:  { label: "Convertido",  icon: CheckCircle2, cls: "bg-success/10 text-success border-success/30" },
  DESCARTADO:  { label: "Descartado",  icon: XCircle,      cls: "bg-muted text-muted-foreground border-border" },
};

/**
 * IA-first governance: badges semânticos do fluxo Web → Atendimento.
 * - Toda solicitação aqui veio do site público → badge "Web" sempre presente.
 * - payment_status reflete o gateway (preenchido pelo webhook na Onda 3).
 * - Sem duplicar essa lógica em outras telas: source of truth é o registro.
 */
function paymentBadge(payment_status?: string | null): { label: string; icon: typeof CircleDot; cls: string } | null {
  switch (payment_status) {
    case "PAID":     return { label: "Pago",         icon: Zap,            cls: "bg-success/10 text-success border-success/30" };
    case "PENDING":  return { label: "Aguard. pagto",icon: Clock,          cls: "bg-warning/10 text-warning border-warning/30" };
    case "EXPIRED":  return { label: "Expirado",     icon: XCircle,        cls: "bg-muted text-muted-foreground border-border" };
    case "FAILED":   return { label: "Falhou",       icon: XCircle,        cls: "bg-destructive/10 text-destructive border-destructive/30" };
    case "REFUNDED": return { label: "Estornado",    icon: XCircle,        cls: "bg-muted text-muted-foreground border-border" };
    default: return null;
  }
}

const FILTROS: Array<{ key: "TODOS" | SolicitacaoStatus; label: string }> = [
  { key: "TODOS", label: "Todas" },
  { key: "NOVO", label: "Novas" },
  { key: "EM_CONTATO", label: "Em contato" },
  { key: "CONVERTIDO", label: "Convertidas" },
  { key: "DESCARTADO", label: "Descartadas" },
];

export default function SolicitacoesSitePage() {
  return (
    <PageErrorBoundary
      scope="SolicitacoesSite"
      fallbackTitle="Não foi possível carregar as solicitações"
      fallbackDescription="Houve uma falha ao abrir a inbox de solicitações do site. Tente novamente — se o problema persistir, recarregue a página."
    >
      <SolicitacoesSiteInner />
    </PageErrorBoundary>
  );
}

function SolicitacoesSiteInner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const tenantId = user?.tenantId ?? "";
  const [leads, setLeads] = useState<SolicitacaoFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const buscaDeb = useDebouncedValue(busca, 300);
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | SolicitacaoStatus>("TODOS");
  const [filtroNaoLidas, setFiltroNaoLidas] = useState(false);
  const { count: naoLidasCount, refresh: refreshBadge } = useSolicitacoesNaoLidas();

  const reload = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const data = await listSolicitacoesFull(tenantId);
    setLeads(data);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { void reload(); }, [reload]);

  // Realtime: atualiza a lista quando algo mudar para este tenant.
  // Refatorado (Fase 1): usa useRealtimeChannel (back-off + pauseOnHidden encapsulados).
  useRealtimeChannel({
    channelName: tenantId ? `solicpub-list:${tenantId}` : "solicpub-list:disabled",
    table: "solicitacoes_publicas",
    filter: tenantId ? `tenant_id=eq.${tenantId}` : undefined,
    enabled: !!tenantId,
    onPayload: () => { void reload(); },
  });

  const counters = useMemo(() => {
    const c: Record<SolicitacaoStatus | "TODOS", number> = { TODOS: leads.length, NOVO: 0, EM_CONTATO: 0, CONVERTIDO: 0, DESCARTADO: 0 };
    leads.forEach((l) => { c[l.status as SolicitacaoStatus] = (c[l.status as SolicitacaoStatus] ?? 0) + 1; });
    return c;
  }, [leads]);

  const filtered = useMemo(() => {
    const q = normalize(buscaDeb);
    return leads.filter((l) => {
      if (filtroStatus !== "TODOS" && l.status !== filtroStatus) return false;
      if (filtroNaoLidas && l.lida) return false;
      if (!q) return true;
      return (
        normalize(l.nome).includes(q) ||
        (l.telefone ?? "").includes(q) ||
        (l.cpf ?? "").includes(q) ||
        normalize(l.observacao ?? "").includes(q)
      );
    });
  }, [leads, buscaDeb, filtroStatus, filtroNaoLidas]);

  const onChangeStatus = async (id: string, status: SolicitacaoStatus) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status, lida: true } : l)));
    const r = await updateSolicitacaoStatus(id, status);
    if (!r.ok) { toast({ title: "Erro ao atualizar status", description: r.error, variant: "destructive" }); void reload(); }
    refreshBadge();
  };

  const onToggleLida = async (l: SolicitacaoFull) => {
    const novo = !l.lida;
    setLeads((prev) => prev.map((x) => (x.id === l.id ? { ...x, lida: novo } : x)));
    const r = await markSolicitacaoLida(l.id, novo);
    if (!r.ok) { toast({ title: "Erro", description: r.error, variant: "destructive" }); void reload(); }
    refreshBadge();
  };

  const onConverter = async (l: SolicitacaoFull) => {
    // Marca como convertido e leva para o cadastro de novo atendimento com os dados pré-preenchidos.
    const examesArr = Array.isArray(l.exames) ? (l.exames as Array<{ exame_id?: string; nome?: string; valor?: number }>) : [];
    const r = await marcarConvertido(l.id, l.id);
    if (!r.ok) { toast({ title: "Erro ao converter", description: r.error, variant: "destructive" }); return; }
    refreshBadge();
    toast({ title: "Solicitação convertida", description: "Abrindo novo atendimento com os dados do paciente." });
    navigate("/novo-atendimento", {
      state: {
        from: "solicitacao",
        solicitacao_id: l.id,
        nome: l.nome,
        telefone: l.telefone,
        cpf: l.cpf,
        observacao: l.observacao,
        exames: examesArr,
        // Web → preserva contexto operacional para o NovoAtendimento.
        origem: "WEB_APROVADO",
        payment_status: (l as { payment_status?: string }).payment_status ?? null,
        payment_provider: (l as { payment_provider?: string }).payment_provider ?? null,
        total_estimado: l.total_estimado ?? null,
      },
    });
  };

  const receitaEstim = useMemo(
    () => leads.filter((l) => l.status !== "DESCARTADO").reduce((s, l) => s + (Number(l.total_estimado) || 0), 0),
    [leads]
  );
  const activeFiltersCount = (filtroStatus !== "TODOS" ? 1 : 0) + (filtroNaoLidas ? 1 : 0);

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-[1400px] mx-auto flex flex-col gap-4 sm:gap-6">
      <PageHeader
        eyebrow="Site público"
        title="Pedidos do site"
        description="Pedidos de orçamento e contato recebidos pela landing pública."
        actions={
          <button
            onClick={reload}
            disabled={loading}
            className="inline-flex items-center gap-2 h-10 px-4 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Atualizar
          </button>
        }
      />

      {/* ── KPI Strip ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <StatTile
          label="Total"
          value={counters.TODOS}
          icon={MailOpen}
          tone="primary"
          hint="Solicitações recebidas"
          onClick={() => { setFiltroStatus("TODOS"); setFiltroNaoLidas(false); }}
        />
        <StatTile
          label="Não lidas"
          value={naoLidasCount}
          icon={Bell}
          tone="warning"
          hint="Pendentes de visualização"
          onClick={() => setFiltroNaoLidas(true)}
        />
        <StatTile
          label="Convertidas"
          value={counters.CONVERTIDO}
          icon={CheckCircle2}
          tone="secondary"
          hint="Viraram atendimento"
          onClick={() => setFiltroStatus("CONVERTIDO")}
        />
        <StatTile
          label="Receita estimada"
          value={`R$ ${receitaEstim.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={CircleDollarSign}
          tone="info"
          hint="Excluindo descartadas"
        />
      </section>

      {/* ── Search & Filters Bar ── */}
      <div className="bg-card border border-border rounded-lg p-2.5 sm:p-3 flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5 sm:gap-3">
        <div className="relative flex-1 lg:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, telefone ou CPF..."
            className="w-full pl-10 pr-4 h-9 bg-background rounded-md text-sm placeholder:text-muted-foreground border border-border focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap overflow-x-auto no-scrollbar -mx-0.5 px-0.5">
          {FILTROS.map((f) => {
            const active = filtroStatus === f.key;
            const n = counters[f.key];
            return (
              <button
                key={f.key}
                onClick={() => setFiltroStatus(f.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-medium border transition-colors",
                  active
                    ? "border-primary/40 bg-primary/5 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                <Filter className="w-3 h-3" />
                {f.label}
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", active ? "bg-primary/15" : "bg-muted")}>{n}</span>
              </button>
            );
          })}
          <button
            onClick={() => setFiltroNaoLidas((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-medium border transition-colors",
              filtroNaoLidas
                ? "border-warning/40 bg-warning/5 text-warning"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {filtroNaoLidas ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {filtroNaoLidas ? "Não lidas" : "Apenas não lidas"}
          </button>
          {activeFiltersCount > 0 && (
            <button
              onClick={() => { setFiltroStatus("TODOS"); setFiltroNaoLidas(false); }}
              className="inline-flex items-center gap-1 h-9 px-2.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-3 h-3" /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* ── Lista ── */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="px-6 py-20 text-center">
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin mx-auto mb-3" />
            <p className="text-xs text-muted-foreground">Carregando solicitações…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <div className="size-14 rounded-md bg-muted flex items-center justify-center mx-auto mb-4">
              <Inbox className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">
              {leads.length === 0 ? "Nenhuma solicitação ainda" : "Nenhum resultado para os filtros"}
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Pedidos enviados pela landing pública aparecem aqui automaticamente.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((l) => (
              <LeadCard
                key={l.id}
                lead={l}
                onChangeStatus={onChangeStatus}
                onToggleLida={onToggleLida}
                onConverter={onConverter}
                onSavedEdit={(patch) => {
                  setLeads((prev) => prev.map((x) => (x.id === l.id ? { ...x, ...patch } : x)));
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── KPI Tile (mesmo padrão de /atendimentos) ── */
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

/* ─────────── Card individual ─────────── */

interface LeadCardProps {
  lead: SolicitacaoFull;
  onChangeStatus: (id: string, status: SolicitacaoStatus) => void;
  onToggleLida: (l: SolicitacaoFull) => void;
  onConverter: (l: SolicitacaoFull) => void;
  onSavedEdit: (patch: Partial<SolicitacaoFull>) => void;
}

function LeadCard({ lead: l, onChangeStatus, onToggleLida, onConverter, onSavedEdit }: LeadCardProps) {
  const [editing, setEditing] = useState(false);
  const [telefone, setTelefone] = useState(l.telefone);
  const [cpf, setCpf] = useState(l.cpf ?? "");
  const [observacao, setObservacao] = useState(l.observacao ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) {
      setTelefone(l.telefone); setCpf(l.cpf ?? ""); setObservacao(l.observacao ?? "");
    }
  }, [editing, l]);

  const exames = Array.isArray(l.exames) ? (l.exames as Array<{ nome?: string }>) : [];
  const meta = STATUS_META[l.status as SolicitacaoStatus] ?? STATUS_META.NOVO;
  const StatusIcon = meta.icon;

  const handleSave = async () => {
    setSaving(true);
    const r = await updateSolicitacaoContato(l.id, { telefone, cpf: cpf || null, observacao });
    setSaving(false);
    if (!r.ok) { toast({ title: "Erro ao salvar", description: r.error, variant: "destructive" }); return; }
    onSavedEdit({ telefone: telefone.replace(/\D/g, ""), cpf: cpf ? cpf.replace(/\D/g, "") : null, observacao, updated_at: new Date().toISOString() });
    setEditing(false);
    toast({ title: "Solicitação atualizada" });
  };

  return (
    <div className={cn(
      "px-3 sm:px-4 py-3 sm:py-4 transition-colors hover:bg-muted/30",
      !l.lida && "bg-primary/[0.025]"
    )}>
      <div className="flex items-start justify-between gap-2 sm:gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground break-words">{l.nome}</p>
            {!l.lida && <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">NÃO LIDA</span>}
            <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border", meta.cls)}>
              <StatusIcon className="h-3 w-3" /> {meta.label}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border bg-primary/5 text-primary border-primary/20" title="Origem: site público">
              <Globe2 className="h-3 w-3" /> Web
            </span>
            {(() => {
              const pb = paymentBadge(l.payment_status);
              if (!pb) return null;
              const PIcon = pb.icon;
              return (
                <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border", pb.cls)}>
                  <PIcon className="h-3 w-3" /> {pb.label}
                </span>
              );
            })()}
          </div>

          {!editing ? (
            <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1 flex-wrap">
              <Phone className="h-3 w-3" /> {l.telefone || "—"}
              {l.cpf ? <span className="text-muted-foreground/70">· CPF {l.cpf}</span> : null}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-w-md">
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Telefone" className="h-8 text-xs" />
              <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="CPF (opcional)" className="h-8 text-xs" />
            </div>
          )}
        </div>

        <div className="text-right shrink-0">
          <p className="text-[10.5px] sm:text-[11px] text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</p>
          {l.total_estimado > 0 && (
            <p className="text-sm font-semibold text-primary mt-0.5 whitespace-nowrap">{fmtBRL.format(l.total_estimado)}</p>
          )}
          {l.updated_at && l.updated_at !== l.created_at && (
            <p className="text-[10px] text-muted-foreground/70 mt-0.5 whitespace-nowrap">editado em {new Date(l.updated_at).toLocaleString("pt-BR")}</p>
          )}
        </div>
      </div>

      {exames.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          {exames.length} exame(s): {exames.slice(0, 4).map((e) => e?.nome).filter(Boolean).join(", ")}
          {exames.length > 4 ? "..." : ""}
        </p>
      )}

      {!editing ? (
        l.observacao ? (
          <p className="text-xs mt-2 text-foreground bg-muted/40 rounded-md px-3 py-2">{l.observacao}</p>
        ) : null
      ) : (
        <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} className="mt-2 text-xs" placeholder="Observação" />
      )}

      {/* Ações */}
      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        {!editing ? (
          <>
            {/* Mudança de status (oculta o atual) */}
            {(["NOVO", "EM_CONTATO", "CONVERTIDO", "DESCARTADO"] as SolicitacaoStatus[])
              .filter((s) => s !== l.status && s !== "CONVERTIDO")
              .map((s) => {
                const m = STATUS_META[s];
                const Icon = m.icon;
                return (
                  <Button key={s} size="sm" variant="outline" className="h-8 text-xs flex-1 sm:flex-none min-w-[44%] sm:min-w-0" onClick={() => onChangeStatus(l.id, s)}>
                    <Icon className="h-3 w-3 mr-1" /> {m.label}
                  </Button>
                );
              })}

            {l.status !== "CONVERTIDO" && (
              <Button size="sm" className="h-8 text-xs w-full sm:w-auto" onClick={() => onConverter(l)}>
                <ArrowRight className="h-3 w-3 mr-1" />
                <span className="sm:hidden">Converter</span>
                <span className="hidden sm:inline">Converter em atendimento</span>
              </Button>
            )}

            <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-1.5 flex-wrap justify-end">
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onToggleLida(l)}>
                {l.lida ? (<><EyeOff className="h-3 w-3 mr-1" /> <span className="hidden sm:inline">Marcar </span>não lida</>) : (<><Check className="h-3 w-3 mr-1" /> <span className="hidden sm:inline">Marcar como </span>lida</>)}
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditing(true)}>
                <Pencil className="h-3 w-3 mr-1" /> Editar
              </Button>
            </div>
          </>
        ) : (
          <>
            <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 text-xs flex-1 sm:flex-none">
              {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />} Salvar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving} className="h-8 text-xs flex-1 sm:flex-none">
              <X className="h-3 w-3 mr-1" /> Cancelar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}