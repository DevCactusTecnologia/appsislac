import { PageHeader } from "@/components/shared/PageHeader";
import { useState, useMemo, useEffect } from "react";
import { Search, Stethoscope, Phone, Mail, Plus, Eye, EyeOff, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight, Pencil, MessageCircle, Copy, X, AtSign, ShieldCheck, Activity, Award, BadgeCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CadastroEspecialistaDialog from "@/components/CadastroEspecialistaDialog";
import {
  getEspecialistas,
  subscribeEspecialistas,
  toggleEspecialistaStatus,
  type Especialista,
} from "@/data/especialistaStore";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const ITEMS_PER_PAGE = 10;

const Especialistas = () => {
  const [especialistas, setEspecialistas] = useState<Especialista[]>(() => getEspecialistas());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Todos" | "Ativo" | "Inativo">("Todos");
  const [cadastroOpen, setCadastroOpen] = useState(false);
  const [detailEspecialista, setDetailEspecialista] = useState<Especialista | null>(null);
  const [editEspecialista, setEditEspecialista] = useState<Especialista | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [revealSensitive, setRevealSensitive] = useState(false);
  const { toast } = useToast();

  // LGPD masking helpers
  const maskPhone = (tel: string) => {
    const d = (tel || "").replace(/\D/g, "");
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
    navigator.clipboard.writeText(text).then(() => toast({ title: `${label} copiado` }));
  };

  useEffect(() => {
    const unsub = subscribeEspecialistas(() => setEspecialistas([...getEspecialistas()]));
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    return especialistas.filter((e) => {
      if (statusFilter !== "Todos" && e.status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = normalize(searchQuery);
      return normalize(e.nome).includes(q) || normalize(e.crm).includes(q) || normalize(e.especialidade).includes(q);
    });
  }, [searchQuery, statusFilter, especialistas]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const toggleStatus = async (id: number) => {
    const esp = especialistas.find((e) => e.id === id);
    if (!esp) return;
    try {
      await toggleEspecialistaStatus(id);
      toast({ title: `Especialista ${esp.status === "Ativo" ? "inativado" : "ativado"} com sucesso` });
    } catch (err: any) {
      toast({
        title: "Erro ao alterar status",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const tabs = [
    { label: "Todos", value: "Todos" as const, count: especialistas.length },
    { label: "Ativos", value: "Ativo" as const, count: especialistas.filter(e => e.status === "Ativo").length },
    { label: "Inativos", value: "Inativo" as const, count: especialistas.filter(e => e.status === "Inativo").length },
  ];

  // Aggregated stats (LGPD: aggregated, never individual data)
  const stats = useMemo(() => {
    const total = especialistas.length;
    const ativos = especialistas.filter(e => e.status === "Ativo").length;
    const especialidades = new Set(especialistas.map(e => e.especialidade).filter(Boolean)).size;
    return { total, ativos, especialidades };
  }, [especialistas]);

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-6">
        <PageHeader
          eyebrow="Cadastro"
          title="Especialistas"
          description="Cadastro com proteção de dados conforme LGPD."
          actions={
            <>
              <button
                onClick={() => setRevealSensitive(v => !v)}
                className={`hidden sm:flex items-center gap-1.5 h-10 px-3.5 rounded-xl border text-xs font-semibold transition-all ${
                  revealSensitive
                    ? "border-primary/30 bg-primary/5 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
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
                <span className="hidden sm:inline">Novo especialista</span>
                <span className="sm:hidden">Novo</span>
              </button>
            </>
          }
        />

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, icon: Stethoscope, bg: "bg-primary/10", iconColor: "text-primary", tone: "text-foreground" },
            { label: "Ativos", value: stats.ativos, icon: Activity, bg: "bg-[hsl(var(--status-success))]/10", iconColor: "text-[hsl(var(--status-success))]", tone: "text-foreground" },
            { label: "Especialidades", value: stats.especialidades, icon: Award, bg: "bg-[hsl(var(--status-info))]/10", iconColor: "text-[hsl(var(--status-info))]", tone: "text-foreground" },
            { label: "Privacidade", value: revealSensitive ? "Aberta" : "Protegida", icon: ShieldCheck, bg: "bg-muted", iconColor: "text-muted-foreground", tone: revealSensitive ? "text-[hsl(var(--status-warning))]" : "text-[hsl(var(--status-success))]" },
          ].map((k, i) => {
            const Icon = k.icon;
            return (
              <div key={i} className="rounded-2xl border border-border bg-card px-4 py-3 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${k.bg}`}>
                  <Icon className={`h-4 w-4 ${k.iconColor}`} />
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
              Dados sensíveis (telefone e e-mail) estão <strong className="text-foreground font-semibold">mascarados por padrão</strong> para atender à LGPD.
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
              <button key={tab.value} onClick={() => { setStatusFilter(tab.value); setCurrentPage(1); }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${statusFilter === tab.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {tab.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-lg font-semibold ${statusFilter === tab.value ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{tab.count}</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Buscar por nome, CRM ou especialidade..." className="pl-10 pr-4 py-2.5 w-full bg-card border border-border/60 rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/30 transition-all" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-3xl border border-border/60 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className="text-left px-6 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Especialista</th>
                  <th className="text-left px-6 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Contato</th>
                  <th className="text-left px-6 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right px-6 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((e) => (
                  <tr key={e.id} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors group cursor-pointer" onClick={() => setDetailEspecialista(e)}>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Stethoscope className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{e.nome}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            <span className="font-medium text-foreground/80">{e.conselhoClasse || "CRM"}</span>
                            <span className="font-mono ml-1">{e.crm || "—"}</span>
                            {e.estadoEmissor && <span className="ml-1">/ {e.estadoEmissor}</span>}
                          </p>
                          {e.especialidade && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{e.especialidade}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 hidden lg:table-cell">
                      <div className="space-y-1">
                        {e.telefone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span className={revealSensitive ? "" : "tracking-wider"}>{revealSensitive ? e.telefone : maskPhone(e.telefone)}</span>
                          </p>
                        )}
                        {e.email && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate max-w-[220px]">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{revealSensitive ? e.email : maskEmail(e.email)}</span>
                          </p>
                        )}
                        {!e.telefone && !e.email && <span className="text-xs text-muted-foreground/60">—</span>}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                        e.status === "Ativo"
                          ? "bg-[hsl(var(--status-success))]/10 text-[hsl(var(--status-success))]"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${e.status === "Ativo" ? "bg-[hsl(var(--status-success))]" : "bg-muted-foreground"}`} />
                        {e.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right" onClick={(ev) => ev.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setDetailEspecialista(e)} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors" title="Ver detalhes">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button onClick={() => setEditEspecialista(e)} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors" title="Editar">
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => toggleStatus(e.id)} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors" title={e.status === "Ativo" ? "Inativar" : "Ativar"}>
                          {e.status === "Ativo" ? <ToggleRight className="h-4 w-4 text-[hsl(var(--status-success))]" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-border/30">
            {paginated.map((e) => (
              <div key={e.id} className="p-4" onClick={() => setDetailEspecialista(e)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Stethoscope className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{e.nome}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        <span className="font-medium text-foreground/80">{e.conselhoClasse || "CRM"}</span>
                        <span className="font-mono ml-1">{e.crm || "—"}</span>
                        {e.estadoEmissor && <span className="ml-1">/ {e.estadoEmissor}</span>}
                        {e.especialidade && <> · {e.especialidade}</>}
                      </p>
                      {e.telefone && (
                        <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          <span className={revealSensitive ? "" : "tracking-wider"}>{revealSensitive ? e.telefone : maskPhone(e.telefone)}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold ${
                    e.status === "Ativo" ? "bg-[hsl(var(--status-success))]/10 text-[hsl(var(--status-success))]" : "bg-muted text-muted-foreground"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${e.status === "Ativo" ? "bg-[hsl(var(--status-success))]" : "bg-muted-foreground"}`} />
                    {e.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="px-6 py-16 text-center">
              <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Stethoscope className="h-6 w-6 text-muted-foreground/50" />
              </div>
              {especialistas.length === 0 ? (
                <>
                  <p className="text-sm font-semibold text-foreground">Sem especialistas cadastrados</p>
                  <p className="text-xs text-muted-foreground/80 mt-1 max-w-sm mx-auto">
                    Cadastre médicos e analistas para vinculá-los a atendimentos e resultados.
                  </p>
                  <button
                    onClick={() => setCadastroOpen(true)}
                    className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Cadastrar especialista
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-muted-foreground">Nenhum especialista encontrado</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Tente ajustar os filtros ou a busca.</p>
                </>
              )}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-border/30 text-xs text-muted-foreground">
              <span>{(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}</span>
              <div className="flex items-center gap-1">
                <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="h-8 w-8 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 flex items-center justify-center"><ChevronLeft className="h-4 w-4" /></button>
                <span className="px-2 font-medium text-foreground">{currentPage} / {totalPages}</span>
                <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="h-8 w-8 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 flex items-center justify-center"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      <CadastroEspecialistaDialog open={cadastroOpen} onClose={() => setCadastroOpen(false)} />

      {/* Detail Sheet */}
      <Sheet open={!!detailEspecialista} onOpenChange={(o) => { if (!o) { setDetailEspecialista(null); setRevealSensitive(false); } }}>
        <SheetContent side="right" className="sm:max-w-[560px] w-full p-0 flex flex-col bg-background">
          <SheetTitle className="sr-only">Detalhes do Especialista</SheetTitle>
          {detailEspecialista && (() => {
            const phoneDigits = (detailEspecialista.telefone || "").replace(/\D/g, "");
            return (
              <>
                {/* Hero header — compacto, sem iniciais */}
                <div className="relative px-6 pt-4 pb-4 border-b border-border bg-gradient-to-b from-muted/30 to-transparent">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          detailEspecialista.status === "Ativo"
                            ? "bg-[hsl(var(--status-success))]/10 text-[hsl(var(--status-success))]"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${detailEspecialista.status === "Ativo" ? "bg-[hsl(var(--status-success))]" : "bg-muted-foreground"}`} />
                          {detailEspecialista.status}
                        </span>
                        {detailEspecialista.crm && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary">
                            <BadgeCheck className="h-3 w-3" />
                            CRM {detailEspecialista.crm}
                          </span>
                        )}
                        {detailEspecialista.friendlyId && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-muted text-muted-foreground"
                            title="ID do especialista (imutável)"
                          >
                            {detailEspecialista.friendlyId}
                          </span>
                        )}
                      </div>
                      <h2 className="text-lg font-semibold text-foreground tracking-tight truncate">{detailEspecialista.nome}</h2>
                      {detailEspecialista.especialidade && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <Stethoscope className="h-3 w-3 inline mr-1 -mt-0.5" />
                          {detailEspecialista.especialidade}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 mr-10">
                      <button
                        className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm"
                        onClick={() => { setEditEspecialista(detailEspecialista); setDetailEspecialista(null); setRevealSensitive(false); }}
                      >
                        <Pencil className="h-3 w-3" />
                        Editar
                      </button>
                      <button
                        className="h-8 w-8 rounded-lg border border-border bg-background hover:bg-muted transition-colors flex items-center justify-center"
                        onClick={() => { toggleStatus(detailEspecialista.id); setDetailEspecialista(null); }}
                        title={detailEspecialista.status === "Ativo" ? "Inativar" : "Ativar"}
                      >
                        {detailEspecialista.status === "Ativo"
                          ? <ToggleRight className="h-4 w-4 text-[hsl(var(--status-success))]" />
                          : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                  {/* Aviso LGPD */}
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

                  {/* Contatos */}
                  <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                    {[
                      {
                        label: "Telefone",
                        icon: Phone,
                        raw: detailEspecialista.telefone,
                        masked: maskPhone(detailEspecialista.telefone),
                        actions: phoneDigits ? [
                          { icon: Phone, title: "Ligar", onClick: () => window.open(`tel:+55${phoneDigits}`) },
                          { icon: MessageCircle, title: "WhatsApp", onClick: () => window.open(`https://wa.me/55${phoneDigits}`, "_blank") },
                          { icon: Copy, title: "Copiar telefone", onClick: () => copyToClipboard(detailEspecialista.telefone, "Telefone") },
                        ] : [],
                      },
                      {
                        label: "E-mail",
                        icon: AtSign,
                        raw: detailEspecialista.email,
                        masked: maskEmail(detailEspecialista.email),
                        actions: detailEspecialista.email ? [
                          { icon: Mail, title: "Enviar e-mail", onClick: () => window.open(`mailto:${detailEspecialista.email}`) },
                          { icon: Copy, title: "Copiar e-mail", onClick: () => copyToClipboard(detailEspecialista.email, "E-mail") },
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

                  {/* Dados profissionais */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-border bg-card px-3 py-2">
                      <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">CRM</p>
                      <p className="text-xs font-semibold text-foreground mt-0.5 font-mono">{detailEspecialista.crm || "—"}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card px-3 py-2">
                      <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Especialidade</p>
                      <p className="text-xs font-semibold text-foreground mt-0.5 truncate">{detailEspecialista.especialidade || "—"}</p>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Edit dialog — pré-preenche com os dados do especialista selecionado */}
      <CadastroEspecialistaDialog
        open={!!editEspecialista}
        onClose={() => setEditEspecialista(null)}
        especialista={editEspecialista}
      />
    </div>
  );
};

export default Especialistas;
