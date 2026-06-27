import { useState, useMemo, useEffect } from "react";
import { Search, User, Phone, Mail, Plus, Eye, EyeOff, ToggleLeft, ToggleRight, Calendar, Fingerprint, Heart, Pencil, MessageCircle, TrendingUp, MoreVertical, ChevronLeft, ChevronRight, Cake, MapPin, ShieldCheck, FileText, Copy, X, ExternalLink, CalendarDays, Wallet, Activity, AtSign } from "lucide-react";
import { isAniversarioHoje, parseDataBR, formatIdadeDetalhada, calcAgeBuckets } from "@/lib/idade";
import RecemNascidoBadge from "@/components/RecemNascidoBadge";
import { useToast } from "@/hooks/use-toast";
import CadastroPacienteDialog from "@/components/CadastroPacienteDialog";
import {
  getAtendimentos,
  subscribe as subscribeAtendimentos,
  fetchAtendimentosByPacienteCpf,
} from "@/data/atendimentoStore";
import type { MockAtendimento } from "@/data/types";
import {
  getPacientes,
  subscribePacientes,
  togglePacienteStatus,
  updatePaciente,
  type Paciente,
} from "@/data/pacienteStore";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import { fmtBRLNumber } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFeatureFlag } from "@/lib/featureFlags";
import { usePaginatedPacientes } from "@/hooks/usePaginatedPacientes";
import { PageHeader } from "@/components/shared/PageHeader";
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const ITEMS_PER_PAGE = 10;

const Pacientes = () => {
  const [pacientes, setPacientes] = useState<Paciente[]>(() => getPacientes());
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebouncedValue(searchQuery, 250);
  const [statusFilter, setStatusFilter] = useState<"Todos" | "Ativo" | "Inativo">("Todos");
  const [birthdayOnly, setBirthdayOnly] = useState(false);
  const [cadastroOpen, setCadastroOpen] = useState(false);
  const [detailPaciente, setDetailPaciente] = useState<Paciente | null>(null);
  const [editPaciente, setEditPaciente] = useState<Paciente | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [, setAtdTick] = useState(0);
  const [revealSensitive, setRevealSensitive] = useState(false);
  const [detailTab, setDetailTab] = useState<"overview" | "history">("overview");
  const { toast } = useToast();

  // Canary: paginação server-side (cursor) — fallback transparente para o legado.
  const paginatedFlag = useFeatureFlag("paginated_atendimentos");
  const legacyForced = useFeatureFlag("USE_LEGACY_STORE");
  const paginationEnabled = paginatedFlag && !legacyForced;

  const paginatedHook = usePaginatedPacientes(
    { status: statusFilter, q: searchQuery },
    paginationEnabled,
  );

  // Histórico do Sheet: servidor (sem cache global) quando pagination ON.
  const [historico, setHistorico] = useState<MockAtendimento[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  useEffect(() => {
    if (!detailPaciente) { setHistorico([]); return; }
    let alive = true;
    if (paginationEnabled) {
      setHistoricoLoading(true);
      fetchAtendimentosByPacienteCpf(detailPaciente.cpf, { limit: 100 })
        .then((rows) => { if (alive) setHistorico(rows); })
        .finally(() => { if (alive) setHistoricoLoading(false); });
    } else {
      setHistorico(getAtendimentos().filter((a) => a.cpf === detailPaciente.cpf));
    }
    return () => { alive = false; };
  }, [detailPaciente, paginationEnabled]);

  const maskCpf = (cpf: string) => {
    const d = cpf.replace(/\D/g, "");
    if (d.length !== 11) return cpf;
    return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  };
  const maskPhone = (tel: string) => {
    const d = tel.replace(/\D/g, "");
    if (d.length < 10) return tel || "—";
    return d.length === 11
      ? `(${d.slice(0, 2)}) *****-${d.slice(7)}`
      : `(${d.slice(0, 2)}) ****-${d.slice(6)}`;
  };
  const maskEmail = (email: string) => {
    if (!email || !email.includes("@")) return email || "—";
    const [u, dom] = email.split("@");
    const visible = u.slice(0, 2);
    return `${visible}${"*".repeat(Math.max(1, u.length - 2))}@${dom}`;
  };
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${label} copiado` });
    });
  };

  useEffect(() => {
    const unsub = subscribePacientes(() => setPacientes([...getPacientes()]));
    const unsubAt = subscribeAtendimentos(() => {
      setAtdTick((t) => t + 1);
      // Se o detalhe estiver aberto em modo legado, refleti mudanças locais.
      if (!paginationEnabled && detailPaciente) {
        setHistorico(getAtendimentos().filter((a) => a.cpf === detailPaciente.cpf));
      }
    });
    return () => { unsub(); unsubAt(); };
  }, [paginationEnabled, detailPaciente]);

  const filteredLegacy = useMemo(() => {
    return pacientes.filter((p) => {
      if (statusFilter !== "Todos" && p.status !== statusFilter) return false;
      if (birthdayOnly && !isAniversarioHoje(p.dataNascimento)) return false;
      if (!debouncedQuery.trim()) return true;
      const q = normalize(debouncedQuery);
      const digits = debouncedQuery.replace(/\D/g, "");
      return normalize(p.nome).includes(q) || (digits.length > 0 && p.cpf.replace(/\D/g, "").includes(digits));
    });
  }, [debouncedQuery, statusFilter, pacientes, birthdayOnly]);

  // Em modo paginado (servidor), `items` já vem filtrado/ordenado pelo hook.
  // Em modo legado, mantemos paginação client-side.
  const paginatedItemsFiltered = paginationEnabled
    ? (birthdayOnly ? paginatedHook.items.filter((p) => isAniversarioHoje(p.dataNascimento)) : paginatedHook.items)
    : [];
  const filtered = paginationEnabled ? paginatedItemsFiltered : filteredLegacy;
  const totalPages = paginationEnabled
    ? 1 // controlado por loadMore (cursor)
    : Math.max(1, Math.ceil(filteredLegacy.length / ITEMS_PER_PAGE));
  const paginated = paginationEnabled
    ? paginatedItemsFiltered
    : filteredLegacy.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const toggleStatus = (id: number) => {
    const paciente = pacientes.find((p) => p.id === id);
    togglePacienteStatus(id);
    if (paginationEnabled) {
      // Re-sincroniza a página atual após mutação.
      paginatedHook.refresh();
    }
    toast({ title: `Paciente ${paciente?.status === "Ativo" ? "inativado" : "ativado"} com sucesso` });
  };

  const tabs = [
    { label: "Todos", value: "Todos" as const, count: pacientes.length },
    { label: "Ativos", value: "Ativo" as const, count: pacientes.filter(p => p.status === "Ativo").length },
    { label: "Inativos", value: "Inativo" as const, count: pacientes.filter(p => p.status === "Inativo").length },
  ];

  // Estatísticas gerais (LGPD: agregados, não expõem dados individuais)
  const stats = useMemo(() => {
    const total = pacientes.length;
    const ativos = pacientes.filter(p => p.status === "Ativo").length;
    const aniversariantes = pacientes.filter(p => isAniversarioHoje(p.dataNascimento)).length;
    return { total, ativos, aniversariantes };
  }, [pacientes]);

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
        <PageHeader
          eyebrow="Cadastro"
          title="Pacientes"
          description="Cadastro com proteção de dados conforme LGPD."
          actions={
            <>
              <button
                onClick={() => setRevealSensitive(v => !v)}
                className={`hidden sm:flex items-center gap-1.5 h-10 px-3.5 rounded-xl border text-xs font-semibold transition-all ${
                  revealSensitive
                    ? "border-primary/30 bg-primary/5 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-border"
                }`}
                title={revealSensitive ? "Ocultar dados sensíveis" : "Revelar dados sensíveis"}
              >
                {revealSensitive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {revealSensitive ? "Ocultar dados" : "Revelar dados"}
              </button>
              <button
                onClick={() => setCadastroOpen(true)}
                className="flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Novo paciente</span>
                <span className="sm:hidden">Novo</span>
              </button>
            </>
          }
        />


        {/* Stats cards (KPI strip) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, icon: User, tone: "text-foreground", bg: "bg-primary/10", iconColor: "text-primary" },
            { label: "Ativos", value: stats.ativos, icon: Activity, tone: "text-foreground", bg: "bg-[hsl(var(--status-success))]/10", iconColor: "text-[hsl(var(--status-success))]" },
            { label: "Aniversariantes", value: stats.aniversariantes, icon: Cake, tone: "text-foreground", bg: "bg-[hsl(var(--status-purple))]/10", iconColor: "text-[hsl(var(--status-purple))]" },
            { label: "Privacidade", value: revealSensitive ? "Aberta" : "Protegida", icon: ShieldCheck, tone: revealSensitive ? "text-[hsl(var(--status-warning))]" : "text-[hsl(var(--status-success))]", bg: "bg-muted", iconColor: "text-muted-foreground" },
          ].map((k, i) => {
            const Icon = k.icon;
            const isBirthday = k.label === "Aniversariantes";
            const active = isBirthday && birthdayOnly;
            return (
              <div
                key={i}
                onClick={isBirthday ? () => { setBirthdayOnly((v) => !v); setCurrentPage(1); } : undefined}
                role={isBirthday ? "button" : undefined}
                tabIndex={isBirthday ? 0 : undefined}
                onKeyDown={isBirthday ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setBirthdayOnly((v) => !v); setCurrentPage(1); } } : undefined}
                className={`rounded-2xl border bg-card px-4 py-3 flex items-center gap-3 transition-all ${
                  isBirthday ? "cursor-pointer hover:border-[hsl(var(--status-purple))]/40" : ""
                } ${active ? "border-[hsl(var(--status-purple))]/60 ring-2 ring-[hsl(var(--status-purple))]/20" : "border-border"}`}
                title={isBirthday ? (active ? "Mostrar todos" : "Filtrar aniversariantes de hoje") : undefined}
              >
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${k.bg}`}>
                  <Icon className={`h-4.5 w-4.5 ${k.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{k.label}</p>
                  <p className={`text-lg font-bold tracking-tight ${k.tone}`}>{k.value}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* LGPD banner */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-border bg-muted/30">
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground min-w-0">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">
              Dados sensíveis (CPF, telefone e e-mail) estão <strong className="text-foreground font-semibold">mascarados por padrão</strong> para atender à LGPD.
            </span>
          </div>
          <button
            onClick={() => setRevealSensitive(v => !v)}
            className="sm:hidden shrink-0 h-8 px-2.5 rounded-lg text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors flex items-center gap-1"
          >
            {revealSensitive ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {revealSensitive ? "Ocultar" : "Revelar"}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1 p-1 bg-muted/50 rounded-2xl border border-border/40 self-start">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => { setStatusFilter(tab.value); setCurrentPage(1); }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  statusFilter === tab.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-lg font-semibold ${
                  statusFilter === tab.value ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>{tab.count}</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Buscar por nome ou CPF..."
              className="pl-10 pr-4 py-2.5 w-full bg-card border border-border/60 rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/30 transition-all"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-3xl border border-border/60 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          {/* Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className="text-left px-6 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Paciente</th>
                  <th className="text-left px-6 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Contato</th>
                  <th className="text-left px-6 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right px-6 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((p) => {
                  const idadeDetalhada = formatIdadeDetalhada(p.dataNascimento);
                  const tel = p.telefone || p.celular || "";
                  return (
                    <tr key={p.id} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors group cursor-pointer" onClick={() => setDetailPaciente(p)}>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">{p.nome.split(" ").map(n => n[0]).slice(0, 2).join("")}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 truncate">
                              <span className="truncate">{p.nome}</span>
                              {isAniversarioHoje(p.dataNascimento) && (
                                <Cake className="h-3.5 w-3.5 text-[hsl(var(--status-purple))] shrink-0" aria-label="Aniversário hoje" />
                              )}
                              {calcAgeBuckets(p.dataNascimento).isNewborn && (
                                <RecemNascidoBadge variant="compact" />
                              )}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {p.sexo === "M" || p.sexo === "Masculino" ? "Masculino" : "Feminino"}
                              {p.dataNascimento && <> · Nasc. {p.dataNascimento}</>}
                              {idadeDetalhada && <> · {idadeDetalhada}</>}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              <span className={`font-mono ${revealSensitive ? "text-foreground" : "tracking-wider"}`}>
                                {revealSensitive ? p.cpf : maskCpf(p.cpf)}
                              </span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="space-y-1">
                          {tel && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span className={revealSensitive ? "" : "tracking-wider"}>{revealSensitive ? tel : maskPhone(tel)}</span>
                            </p>
                          )}
                          {p.email && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate max-w-[220px]">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate">{revealSensitive ? p.email : maskEmail(p.email)}</span>
                            </p>
                          )}
                          {!tel && !p.email && <span className="text-xs text-muted-foreground/60">—</span>}
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                          p.status === "Ativo"
                            ? "bg-[hsl(var(--status-success))]/10 text-[hsl(var(--status-success))]"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${p.status === "Ativo" ? "bg-[hsl(var(--status-success))]" : "bg-muted-foreground"}`} />
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setDetailPaciente(p)} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors" title="Ver detalhes">
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </button>
                          <button onClick={() => { setEditPaciente(p); }} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors" title="Editar">
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <button onClick={() => toggleStatus(p.id)} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors" title={p.status === "Ativo" ? "Inativar" : "Ativar"}>
                            {p.status === "Ativo"
                              ? <ToggleRight className="h-4 w-4 text-[hsl(var(--status-success))]" />
                              : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="lg:hidden divide-y divide-border/30">
            {paginated.map((p) => {
              const tel = p.telefone || p.celular || "";
              return (
                <div key={p.id} className="p-4" onClick={() => setDetailPaciente(p)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{p.nome.split(" ").map(n => n[0]).slice(0, 2).join("")}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                          <span className="truncate">{p.nome}</span>
                          {isAniversarioHoje(p.dataNascimento) && (
                            <Cake className="h-3.5 w-3.5 text-[hsl(var(--status-purple))] shrink-0" />
                          )}
                          {calcAgeBuckets(p.dataNascimento).isNewborn && (
                            <RecemNascidoBadge variant="compact" />
                          )}
                        </p>
                        {p.dataNascimento && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Nasc. {p.dataNascimento} · {formatIdadeDetalhada(p.dataNascimento)}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-0.5 font-mono tracking-wider">
                          {revealSensitive ? p.cpf : maskCpf(p.cpf)}
                        </p>
                        {tel && (
                          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span className={revealSensitive ? "" : "tracking-wider"}>{revealSensitive ? tel : maskPhone(tel)}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold ${
                      p.status === "Ativo" ? "bg-[hsl(var(--status-success))]/10 text-[hsl(var(--status-success))]" : "bg-muted text-muted-foreground"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${p.status === "Ativo" ? "bg-[hsl(var(--status-success))]" : "bg-muted-foreground"}`} />
                      {p.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="px-6 py-16 text-center">
              <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <User className="h-6 w-6 text-muted-foreground/50" />
              </div>
              {pacientes.length === 0 ? (
                <>
                  <p className="text-sm font-semibold text-foreground">Sem pacientes cadastrados</p>
                  <p className="text-xs text-muted-foreground/80 mt-1 max-w-sm mx-auto">
                    Comece adicionando o primeiro paciente para que ele apareça em atendimentos, resultados e relatórios.
                  </p>
                  <button
                    onClick={() => setCadastroOpen(true)}
                    className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Cadastrar paciente
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-muted-foreground">Nenhum paciente encontrado</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Tente ajustar os filtros ou a busca.</p>
                </>
              )}
            </div>
          )}

          {/* Pagination */}
          {!paginationEnabled && totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-border/30 text-xs text-muted-foreground">
              <span>{(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}</span>
              <div className="flex items-center gap-1">
                <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="h-8 w-8 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 flex items-center justify-center"><ChevronLeft className="h-4 w-4" /></button>
                <span className="px-2 font-medium text-foreground">{currentPage} / {totalPages}</span>
                <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="h-8 w-8 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 flex items-center justify-center"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
          {paginationEnabled && (paginatedHook.hasMore || paginatedHook.loading) && (
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-border/30 text-xs text-muted-foreground">
              <span>
                {paginatedHook.loading
                  ? "Carregando…"
                  : `${paginatedHook.items.length} carregados`}
              </span>
              {paginatedHook.hasMore && (
                <button
                  disabled={paginatedHook.loadingMore}
                  onClick={() => paginatedHook.loadMore()}
                  className="h-8 px-3 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50 text-xs font-medium"
                >
                  {paginatedHook.loadingMore ? "Carregando…" : "Carregar mais"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <CadastroPacienteDialog open={cadastroOpen} onClose={() => setCadastroOpen(false)} />

      {editPaciente && (
        <CadastroPacienteDialog
          open={!!editPaciente}
          onClose={() => setEditPaciente(null)}
          editMode
          initialData={editPaciente}
          onSave={async (data: any) => {
            await updatePaciente(editPaciente.id, data);
            setEditPaciente(null);
            toast({ title: "Paciente atualizado com sucesso" });
          }}
        />
      )}

      {/* Detail Sheet — modern, intuitivo */}
      <Sheet open={!!detailPaciente} onOpenChange={(o) => { if (!o) { setDetailPaciente(null); setRevealSensitive(false); setDetailTab("overview"); } }}>
        <SheetContent side="right" className="sm:max-w-[640px] w-full p-0 flex flex-col bg-background">
          <SheetTitle className="sr-only">Detalhes do Paciente</SheetTitle>
          {detailPaciente && (() => {
            const atendimentos = paginationEnabled
              ? historico
              : getAtendimentos().filter(a => a.cpf === detailPaciente.cpf);
            const totalPedidos = atendimentos.length;
            const valorTotal = atendimentos.reduce((sum, a) => (a.pagamentosRealizados?.reduce((s, p) => s + p.valor, 0) || 0) + sum, 0);
            const totalDevido = atendimentos.reduce((sum, a) => {
              if (a.statusPagamento.label === "Pagamento cancelado") return sum;
              return sum + a.exames.reduce((es, exameName) => {
                const meta = a.examesCobranca?.find(c => c.nome === exameName);
                return es + (Number(meta?.valor) || 0);
              }, 0);
            }, 0);
            const saldoCarteira = valorTotal - totalDevido;
            const ultimoAtd = atendimentos[0];
            const statusColor: Record<string, string> = {
              "Pagamento efetuado": "bg-[hsl(var(--status-success))]/10 text-[hsl(var(--status-success))]",
              "Pagamento parcial": "bg-[hsl(var(--status-info))]/10 text-[hsl(var(--status-info))]",
              "Pagamento pendente": "bg-[hsl(var(--status-warning))]/10 text-[hsl(var(--status-warning))]",
              "Pagamento cancelado": "bg-[hsl(var(--status-danger))]/10 text-[hsl(var(--status-danger))]",
            };

            const idadeDetalhada = formatIdadeDetalhada(detailPaciente.dataNascimento);
            const idadeAnos = (() => {
              const b = parseDataBR(detailPaciente.dataNascimento);
              if (!b) return null;
              const today = new Date();
              let y = today.getFullYear() - b.getFullYear();
              if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) y--;
              return y;
            })();

            const enderecoCompleto = [
              detailPaciente.endereco,
              detailPaciente.numero && `nº ${detailPaciente.numero}`,
              detailPaciente.complemento,
              detailPaciente.bairro,
              [detailPaciente.cidade, detailPaciente.estado].filter(Boolean).join(" - "),
              detailPaciente.cep,
            ].filter(Boolean).join(", ");

            const phoneDigits = (detailPaciente.celular || detailPaciente.telefone || "").replace(/\D/g, "");

            return (
              <>
                {/* Hero header — compacto, sem avatar/iniciais */}
                <div className="relative px-6 pt-4 pb-4 border-b border-border bg-gradient-to-b from-muted/30 to-transparent">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          detailPaciente.status === "Ativo"
                            ? "bg-[hsl(var(--status-success))]/10 text-[hsl(var(--status-success))]"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${detailPaciente.status === "Ativo" ? "bg-[hsl(var(--status-success))]" : "bg-muted-foreground"}`} />
                          {detailPaciente.status}
                        </span>
                        {isAniversarioHoje(detailPaciente.dataNascimento) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[hsl(var(--status-purple))]/10 text-[hsl(var(--status-purple))]">
                            <Cake className="h-3 w-3" />
                            Aniversário
                          </span>
                        )}
                        {detailPaciente.friendlyId && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-muted text-muted-foreground"
                            title="ID do paciente (imutável)"
                          >
                            {detailPaciente.friendlyId}
                          </span>
                        )}
                      </div>
                      <h2 className="text-lg font-semibold text-foreground tracking-tight truncate">{detailPaciente.nome}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {detailPaciente.sexo === "M" || detailPaciente.sexo === "Masculino" ? "Masculino" : "Feminino"}
                        {detailPaciente.dataNascimento && (
                          <>
                            <span className="mx-1.5 text-muted-foreground/40">·</span>
                            <span className="text-foreground font-medium">Nasc. {detailPaciente.dataNascimento}</span>
                          </>
                        )}
                        <span className="mx-1.5 text-muted-foreground/40">·</span>
                        <span className="text-foreground font-medium">{idadeDetalhada}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 mr-10">
                      <button
                        className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm"
                        onClick={() => { setEditPaciente(detailPaciente); setDetailPaciente(null); setRevealSensitive(false); setDetailTab("overview"); }}
                      >
                        <Pencil className="h-3 w-3" />
                        Editar
                      </button>
                      <button
                        className="h-8 w-8 rounded-lg border border-border bg-background hover:bg-muted transition-colors flex items-center justify-center"
                        onClick={() => { toggleStatus(detailPaciente.id); setDetailPaciente(null); }}
                        aria-label={detailPaciente.status === "Ativo" ? "Inativar" : "Ativar"}
                        title={detailPaciente.status === "Ativo" ? "Inativar paciente" : "Ativar paciente"}
                      >
                        {detailPaciente.status === "Ativo"
                          ? <ToggleRight className="h-4 w-4 text-[hsl(var(--status-success))]" />
                          : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>

                  {/* KPI strip */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Atendimentos", value: String(totalPedidos), icon: Activity, tone: "text-foreground" },
                      { label: "Total pago", value: `R$ ${fmtBRLNumber(valorTotal)}`, icon: Wallet, tone: "text-foreground" },
                      {
                        label: saldoCarteira < 0 ? "Devendo" : "Saldo",
                        value: `R$ ${fmtBRLNumber(Math.abs(saldoCarteira))}`,
                        icon: TrendingUp,
                        tone: saldoCarteira < 0 ? "text-destructive" : "text-[hsl(var(--status-success))]",
                      },
                    ].map((k, i) => {
                      const Icon = k.icon;
                      return (
                        <div key={i} className="rounded-lg border border-border bg-card px-2.5 py-2">
                          <div className="flex items-center gap-1 text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                            <Icon className="h-2.5 w-2.5" />
                            {k.label}
                          </div>
                          <p className={`text-sm font-semibold tracking-tight ${k.tone}`}>{k.value}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Tabs */}
                <div className="px-6 border-b border-border">
                  <div className="flex gap-1">
                    {[
                      { id: "overview" as const, label: "Visão geral", count: null },
                      { id: "history" as const, label: "Histórico", count: totalPedidos },
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => setDetailTab(t.id)}
                        className={`relative px-3 py-2.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                          detailTab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t.label}
                        {t.count !== null && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                            detailTab === t.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                          }`}>{t.count}</span>
                        )}
                        {detailTab === t.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                  {detailTab === "overview" ? (
                    <div className="px-5 py-4 space-y-3">
                      {/* Aviso LGPD compacto */}
                      <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/30">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
                          <ShieldCheck className="h-3 w-3 text-primary shrink-0" />
                          <span className="truncate">Dados protegidos pela <strong className="text-foreground font-medium">LGPD</strong></span>
                        </div>
                        <button
                          onClick={() => setRevealSensitive(v => !v)}
                          className="shrink-0 h-6 px-2 rounded-md text-[10px] font-semibold text-primary hover:bg-primary/10 transition-colors flex items-center gap-1"
                        >
                          {revealSensitive ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          {revealSensitive ? "Ocultar" : "Revelar"}
                        </button>
                      </div>

                      {/* Contatos — compactos em uma única lista */}
                      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                        {[
                          {
                            label: "CPF",
                            icon: Fingerprint,
                            raw: detailPaciente.cpf,
                            masked: maskCpf(detailPaciente.cpf),
                            actions: detailPaciente.cpf ? [
                              { icon: Copy, title: "Copiar CPF", onClick: () => copyToClipboard(detailPaciente.cpf, "CPF") },
                            ] : [],
                          },
                          {
                            label: "Telefone",
                            icon: Phone,
                            raw: detailPaciente.telefone || detailPaciente.celular,
                            masked: maskPhone(detailPaciente.telefone || detailPaciente.celular || ""),
                            actions: phoneDigits ? [
                              { icon: Phone, title: "Ligar", onClick: () => window.open(`tel:+55${phoneDigits}`) },
                              { icon: MessageCircle, title: "WhatsApp", onClick: () => window.open(`https://wa.me/55${phoneDigits}`, "_blank") },
                              { icon: Copy, title: "Copiar telefone", onClick: () => copyToClipboard(detailPaciente.telefone || detailPaciente.celular || "", "Telefone") },
                            ] : [],
                          },
                          {
                            label: "E-mail",
                            icon: AtSign,
                            raw: detailPaciente.email,
                            masked: maskEmail(detailPaciente.email),
                            actions: detailPaciente.email ? [
                              { icon: Mail, title: "Enviar e-mail", onClick: () => window.open(`mailto:${detailPaciente.email}`) },
                              { icon: Copy, title: "Copiar e-mail", onClick: () => copyToClipboard(detailPaciente.email, "E-mail") },
                            ] : [],
                          },
                        ].map((row, i) => {
                          const Icon = row.icon;
                          const value = revealSensitive ? (row.raw || "—") : (row.raw ? row.masked : "—");
                          return (
                            <div key={i} className="px-3 py-2 flex items-center gap-2.5 hover:bg-muted/20 transition-colors">
                              <div className="h-7 w-7 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0 flex items-center gap-2">
                                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider w-16 shrink-0">{row.label}</p>
                                <p className={`text-sm font-medium text-foreground truncate ${revealSensitive ? "" : "tracking-wider"}`}>{value}</p>
                              </div>
                              {row.raw && (
                                <div className="flex gap-0.5 shrink-0">
                                  {row.actions.map((a, ai) => {
                                    const AIcon = a.icon;
                                    return (
                                      <button
                                        key={ai}
                                        onClick={a.onClick}
                                        className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
                                        title={a.title}
                                        aria-label={a.title}
                                      >
                                        <AIcon className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Dados pessoais (Nascimento, Idade, Sexo) já exibidos no cabeçalho */}

                      {/* Endereço — compacto */}
                      {enderecoCompleto && (
                        <div className="px-3 py-2 rounded-lg border border-border bg-card flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Endereço</p>
                            <p className="text-xs text-foreground leading-snug truncate">{enderecoCompleto}</p>
                          </div>
                          <button
                            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`, "_blank")}
                            className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center transition-colors shrink-0"
                            title="Abrir no Google Maps"
                            aria-label="Abrir endereço no Google Maps"
                          >
                            <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                          </button>
                        </div>
                      )}

                      {/* Último atendimento — visível sem scroll */}
                      {ultimoAtd && (
                        <div className="px-3 py-2 rounded-lg border border-border bg-card flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                            <CalendarDays className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Último atendimento</p>
                            <p className="text-xs text-foreground leading-snug truncate">
                              <span className="font-mono">{ultimoAtd.protocolo}</span>
                              <span className="mx-1.5 text-muted-foreground/40">·</span>
                              {ultimoAtd.data}
                              {ultimoAtd.convenio && <><span className="mx-1.5 text-muted-foreground/40">·</span>{ultimoAtd.convenio}</>}
                            </p>
                          </div>
                          <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${statusColor[ultimoAtd.statusPagamento.label] || "bg-muted text-muted-foreground"}`}>
                            {ultimoAtd.statusPagamento.label.replace("Pagamento ", "")}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="px-6 py-5">
                      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                        {paginationEnabled && historicoLoading ? (
                          <div className="p-10 text-center">
                            <p className="text-xs text-muted-foreground">Carregando histórico…</p>
                          </div>
                        ) : atendimentos.length === 0 ? (
                          <div className="p-10 text-center">
                            <div className="h-12 w-12 rounded-xl bg-muted/60 flex items-center justify-center mx-auto mb-3">
                              <FileText className="h-5 w-5 text-muted-foreground/60" />
                            </div>
                            <p className="text-sm font-medium text-foreground mb-1">Sem atendimentos</p>
                            <p className="text-xs text-muted-foreground">Este paciente ainda não tem atendimentos registrados.</p>
                          </div>
                        ) : atendimentos.map((atd, idx) => {
                          const pago = atd.pagamentosRealizados?.reduce((s, p) => s + p.valor, 0) || 0;
                          return (
                            <div key={idx} className="px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="h-9 w-9 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                                  <CalendarDays className="h-4 w-4 text-primary" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{atd.solicitante || "Sem solicitante"}</p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                    <span className="font-mono">{atd.protocolo}</span> · {atd.data}
                                    {atd.convenio && <> · {atd.convenio}</>}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                <p className="text-sm font-semibold text-foreground">R$ {fmtBRLNumber(pago)}</p>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${statusColor[atd.statusPagamento.label] || "bg-muted text-muted-foreground"}`}>
                                  {atd.statusPagamento.label.replace("Pagamento ", "")}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Pacientes;
