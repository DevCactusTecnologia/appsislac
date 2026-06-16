// Detalhe do Laboratório — Control Plane SaaS.
import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Building2, Database, Settings, Shield, Activity, DollarSign,
  ChevronDown, ChevronUp, Users, FileText, Lock, History, ExternalLink,
  KeyRound, LogIn, Trash2, AlertTriangle, Globe, CreditCard, Calendar, Download,
  Pencil, Mail, Phone, ShieldCheck, Stethoscope, MapPin, Building,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StatusBadge, toneForTenantStatus } from "@/components/superadmin/StatusBadge";
import { TenantDatabaseConfig } from "@/components/superadmin/TenantDatabaseConfig";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maskPhoneBR, maskCNPJ } from "@/lib/masks";
import { PlanCard, type SubscriptionPlan } from "@/components/superadmin/PlanCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EstadoCidadeFields from "@/components/EstadoCidadeFields";

interface Tenant {
  id: string;
  nome: string;
  slug: string;
  status: string;
  created_at: string;
  lab_code: string;
  cnpj?: string | null;
  email_contato?: string | null;
  telefone?: string | null;
  cidade?: string | null;
  estado?: string | null;
  database_strategy: string;
}

interface AdminUser {
  user_id: string;
  email: string | null;
  nome: string | null;
  perfil: string | null;
  status: string | null;
  telefone?: string | null;
  last_sign_in_at?: string | null;
  auth_created_at?: string | null;
}

interface Billing {
  plan_code: string;
  status: string;
  billing_cycle: string;
  mrr_cents: number;
  current_period_start: string;
  current_period_end: string | null;
  trial_ends_at: string | null;
  canceled_at: string | null;
  plan?: {
    nome: string;
    descricao?: string | null;
    preco_mensal_cents: number;
    preco_anual_cents?: number | null;
    limite_usuarios?: number | null;
    limite_unidades?: number | null;
    limite_atendimentos_mes?: number | null;
  } | null;
}

interface Snapshot {
  ok: true;
  usuarios_ativos: number;
  usuarios_total: number;
  usuarios_por_perfil: Record<string, number>;
  atendimentos_mes: number;
  atendimentos_total: number;
  pacientes_total: number;
  unidades_total: number;
  exames_total: number;
  receita_mes_cents: number;
  admin_user: AdminUser | null;
  billing: Billing | null;
  registry: {
    runtime_mode?: string;
    database_strategy?: string;
    db_provider?: string;
    db_region?: string;
    schema_version?: string;
    last_health_check?: string;
    last_health_result?: string;
  } | null;
}

const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (s?: string | null) => {
  if (!s) return "—";
  try { return new Date(s).toLocaleString("pt-BR"); } catch { return "—"; }
};
const fmtDateShort = (s?: string | null) => {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("pt-BR"); } catch { return "—"; }
};

export default function SuperAdminTenantDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [activeTab, setActiveTab] = useState("identidade");
  const [showTechnical, setShowTechnical] = useState(false);

  // Form state — laboratório
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [emailContato, setEmailContato] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingDados, setEditingDados] = useState(false);

  // Snapshot
  const [snap, setSnap] = useState<Snapshot | null>(null);

  // Dialogs
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editAdminOpen, setEditAdminOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [impersonateOpen, setImpersonateOpen] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);

  // Plan change
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>("");
  const [selectedCycle, setSelectedCycle] = useState<"monthly" | "annual" | "free">("monthly");

  // Edit admin form
  const [adminNome, setAdminNome] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminTelefone, setAdminTelefone] = useState("");

  // Tenant query (cached)
  const { data: tenantData, isLoading: loading, refetch: refetchTenant } = useQuery<Tenant | null>({
    queryKey: ["super-admin", "tenant", id],
    enabled: !!id,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      if (!id) return null;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const isNumeric = /^[0-9]+$/.test(id);
      let query = supabase.from("tenants").select("*");
      if (isUUID) query = query.eq("id", id);
      else if (isNumeric) query = query.eq("lab_code", id);
      else query = query.eq("slug", id);
      const { data, error } = await query.maybeSingle();
      if (error) { toast.error(error.message); throw error; }
      return data as Tenant | null;
    },
  });

  useEffect(() => {
    if (!tenantData) { setTenant(null); return; }
    setTenant(tenantData);
    setNome(tenantData.nome ?? "");
    setCnpj(maskCNPJ(tenantData.cnpj ?? ""));
    setEmailContato(tenantData.email_contato ?? "");
    setTelefone(maskPhoneBR(tenantData.telefone ?? ""));
    setCidade(tenantData.cidade ?? "");
    setEstado(tenantData.estado ?? "");
  }, [tenantData]);

  const loadTenant = useCallback(async () => { await refetchTenant(); }, [refetchTenant]);

  // Snapshot query (cached per tenant)
  const { data: snapData, isFetching: snapFetching, refetch: refetchSnapshot } = useQuery<Snapshot | null>({
    queryKey: ["super-admin", "tenant-snapshot", tenant?.id],
    enabled: !!tenant?.id,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      if (!tenant?.id) return null;
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-tenant-snapshot?tenantId=${tenant.id}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const json = await res.json();
      return json?.ok ? (json as Snapshot) : null;
    },
  });
  const snapLoading = snapFetching && !snapData;
  useEffect(() => { if (snapData) setSnap(snapData); }, [snapData]);
  const loadSnapshot = useCallback(async () => { await refetchSnapshot(); }, [refetchSnapshot]);

  // Load plans (cached globally)
  const { data: plansData } = useQuery<SubscriptionPlan[]>({
    queryKey: ["super-admin", "plans"],
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("super-admin-plans", { body: { action: "list" } });
      return (data?.plans ?? []) as SubscriptionPlan[];
    },
  });
  useEffect(() => { if (plansData) setPlans(plansData); }, [plansData]);


  const openChangePlan = () => {
    setSelectedPlanCode(snap?.billing?.plan_code ?? plans.find(p => p.is_default)?.code ?? plans[0]?.code ?? "");
    const cur = snap?.billing?.billing_cycle;
    setSelectedCycle(cur === "annual" || cur === "free" ? cur : "monthly");
    setChangePlanOpen(true);
  };

  const handleChangePlan = async () => {
    if (!tenant || !selectedPlanCode) return;
    setActionBusy(true);
    const { data, error } = await supabase.functions.invoke("super-admin-change-tenant-plan", {
      body: { tenantId: tenant.id, planCode: selectedPlanCode, billingCycle: selectedCycle },
    });
    setActionBusy(false);
    if (error || !data?.ok) { toast.error(error?.message ?? data?.error ?? "Erro ao trocar plano"); return; }
    toast.success("Plano atualizado");
    setChangePlanOpen(false);
    loadSnapshot();
  };

  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("super-admin-update-tenant", {
      body: {
        tenantId: tenant.id,
        nome,
        cnpj: cnpj.replace(/\D/g, ""),
        emailContato,
        telefone: telefone.replace(/\D/g, ""),
        cidade,
        estado,
      },
    });
    setSaving(false);
    if (error || !data?.ok) { toast.error(error?.message ?? "Erro ao salvar"); return; }
    toast.success("Dados atualizados");
    setEditingDados(false);
    loadTenant();
  };

  const handleCancelDados = () => {
    if (!tenant) return;
    setNome(tenant.nome ?? "");
    setCnpj(maskCNPJ(tenant.cnpj ?? ""));
    setEmailContato(tenant.email_contato ?? "");
    setTelefone(maskPhoneBR(tenant.telefone ?? ""));
    setCidade(tenant.cidade ?? "");
    setEstado(tenant.estado ?? "");
    setEditingDados(false);
  };

  const handleToggleStatus = async () => {
    if (!tenant) return;
    const novo = tenant.status === "suspenso" ? "ativo" : "suspenso";
    setActionBusy(true);
    const { data, error } = await supabase.functions.invoke("super-admin-update-tenant", {
      body: { tenantId: tenant.id, status: novo },
    });
    setActionBusy(false);
    setSuspendOpen(false);
    if (error || !data?.ok) { toast.error(error?.message ?? "Erro"); return; }
    toast.success(novo === "ativo" ? "Acesso liberado" : "Acesso suspenso");
    loadTenant();
  };

  const handleResetPassword = async () => {
    if (!tenant || !snap?.admin_user) return;
    if (newPassword.length < 6) { toast.error("Senha deve ter ao menos 6 caracteres"); return; }
    setActionBusy(true);
    const { data, error } = await supabase.functions.invoke("super-admin-reset-tenant-password", {
      body: { tenantId: tenant.id, userId: snap.admin_user.user_id, newPassword },
    });
    setActionBusy(false);
    if (error || !data?.ok) { toast.error(error?.message ?? data?.error ?? "Erro"); return; }
    toast.success("Senha redefinida");
    setResetOpen(false);
    setNewPassword("");
  };

  const handleImpersonate = async () => {
    if (!tenant) return;
    setActionBusy(true);
    const tname = encodeURIComponent(tenant.nome);
    const redirectTo = `${window.location.origin}/atendimentos?impersonated=1&tname=${tname}`;
    const { data, error } = await supabase.functions.invoke("super-admin-impersonate-tenant", {
      body: { tenantId: tenant.id, redirectTo },
    });
    setActionBusy(false);
    setImpersonateOpen(false);
    if (error || !data?.ok) { toast.error(error?.message ?? "Erro ao gerar link"); return; }
    window.open(data.actionLink, "_blank", "noopener,noreferrer");
    toast.success("Acesso aberto em nova aba", {
      description: "A nova aba exibirá um banner indicando o modo impersonação.",
    });
  };

  const handleDelete = async () => {
    if (!tenant) return;
    setActionBusy(true);
    const { data, error } = await supabase.functions.invoke("super-admin-delete-tenant", {
      body: { tenantId: tenant.id, confirmName: deleteConfirmName },
    });
    setActionBusy(false);
    if (error || !data?.ok) { toast.error(error?.message ?? data?.error ?? "Erro"); return; }
    toast.success("Laboratório excluído");
    navigate("/super-admin/laboratorios");
  };

  const openEditAdmin = () => {
    if (!snap?.admin_user) return;
    setAdminNome(snap.admin_user.nome ?? "");
    setAdminEmail(snap.admin_user.email ?? "");
    setAdminTelefone(maskPhoneBR(snap.admin_user.telefone ?? ""));
    setEditAdminOpen(true);
  };

  const handleSaveAdmin = async () => {
    if (!tenant || !snap?.admin_user) return;
    setActionBusy(true);
    const { data, error } = await supabase.functions.invoke("super-admin-update-tenant-admin", {
      body: {
        tenantId: tenant.id,
        userId: snap.admin_user.user_id,
        nome: adminNome,
        email: adminEmail,
        telefone: adminTelefone.replace(/\D/g, ""),
      },
    });
    setActionBusy(false);
    if (error || !data?.ok) { toast.error(error?.message ?? data?.error ?? "Erro"); return; }
    toast.success("Responsável atualizado");
    setEditAdminOpen(false);
    loadSnapshot();
  };

  const handleBackup = async (format: "sql" | "json" | "xlsx") => {
    if (!tenant) return;
    setBackupBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-tenant-backup?tenantId=${tenant.id}&format=${format}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j?.error ?? `Erro ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const ext = format === "sql" ? "sql.gz" : format;
      const fname = cd.match(/filename="?([^"]+)"?/)?.[1]
        ?? `backup_${tenant.lab_code ?? tenant.slug}.${ext}`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Backup gerado com sucesso");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar backup");
    } finally {
      setBackupBusy(false);
    }
  };

  if (loading) return <div className="p-8 animate-pulse space-y-4"><div className="h-8 w-48 bg-muted rounded-md" /><div className="h-64 bg-muted rounded-xl" /></div>;
  if (!tenant) return <div className="p-8 text-center text-muted-foreground">Laboratório não encontrado.</div>;

  const isSuspenso = tenant.status === "suspenso";
  const isolatedDb = (snap?.registry?.runtime_mode === "isolated_db")
    || tenant.database_strategy === "isolated_db"
    || tenant.database_strategy === "dedicated";

  const TABS = [
    { id: "identidade", label: "Identidade & Acesso", icon: Building2 },
    { id: "plano", label: "Plano & Assinatura", icon: CreditCard },
    { id: "operacao", label: "Operação", icon: Settings },
    { id: "banco", label: "Banco de dados", icon: Database },
    { id: "seguranca", label: "Segurança", icon: Shield },
  ];

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="rounded-full">
            <Link to="/super-admin/laboratorios"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">{tenant.nome}</h1>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
              <span>Código: {tenant.lab_code}</span>
              <span className="opacity-30">•</span>
              <span>Slug: /{tenant.slug}</span>
            </div>
          </div>
          <StatusBadge tone={toneForTenantStatus(tenant.status)} label={tenant.status} size="xs" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-full px-4 text-xs font-semibold" onClick={() => setSuspendOpen(true)}>
            {isSuspenso ? "Reativar" : "Suspender"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border/50 flex gap-6 overflow-x-auto no-scrollbar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 py-3 border-b-2 transition-all text-xs font-bold uppercase tracking-wider whitespace-nowrap",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        <div className="space-y-6">
          {activeTab === "identidade" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Dados cadastrais */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Dados cadastrais</h3>
                  {editingDados ? (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCancelDados} disabled={saving}>
                        Cancelar
                      </Button>
                      <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>
                        {saving ? "Salvando..." : "Salvar"}
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingDados(true)}>
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FieldGroup label="Nome do laboratório" value={nome} onChange={setNome} disabled={!editingDados} />
                  <FieldGroup
                    label="CNPJ"
                    value={cnpj}
                    onChange={(v) => setCnpj(maskCNPJ(v))}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                    disabled={!editingDados}
                  />
                  <FieldGroup label="E-mail de contato" value={emailContato} onChange={setEmailContato} placeholder="contato@lab.com" type="email" disabled={!editingDados} />
                  <FieldGroup
                    label="Telefone"
                    value={telefone}
                    onChange={(v) => setTelefone(maskPhoneBR(v))}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    inputMode="tel"
                    disabled={!editingDados}
                  />
                  <EstadoCidadeFields
                    estado={estado}
                    cidade={cidade}
                    onChange={(next) => { setEstado(next.estado); setCidade(next.cidade); }}
                    disabled={!editingDados}
                    labelClassName="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block"
                  />
                  <FieldGroup label="Slug (URL)" value={`/${tenant.slug}`} disabled />
                  <FieldGroup label="Código de acesso" value={tenant.lab_code || "—"} disabled />
                </div>
              </div>

              {/* Admin do laboratório */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Responsável / Admin do laboratório</h3>
                  {snap?.admin_user && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={openEditAdmin}>
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                  )}
                </div>
                {snap?.admin_user ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <InfoRow icon={Users} label="Nome" value={snap.admin_user.nome || "—"} />
                      <InfoRow icon={Mail} label="E-mail" value={snap.admin_user.email || "—"} mono />
                      <InfoRow icon={Phone} label="Telefone" value={snap.admin_user.telefone ? maskPhoneBR(snap.admin_user.telefone) : "—"} />
                      <InfoRow icon={ShieldCheck} label="Perfil" value={`${snap.admin_user.perfil} • ${snap.admin_user.status}`} />
                      <InfoRow icon={Calendar} label="Cadastrado em" value={fmtDate(snap.admin_user.auth_created_at)} />
                      <InfoRow icon={Activity} label="Último acesso" value={fmtDate(snap.admin_user.last_sign_in_at)} />
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-border/50">
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => setResetOpen(true)}>
                        <KeyRound className="h-3.5 w-3.5 mr-1" /> Redefinir senha
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => setImpersonateOpen(true)} disabled={actionBusy}>
                        <LogIn className="h-3.5 w-3.5 mr-1" /> Acessar como admin
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nenhum usuário admin cadastrado neste laboratório ainda.
                  </p>
                )}
              </div>

              {/* Técnico */}
              <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
                <button
                  onClick={() => setShowTechnical(!showTechnical)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Informações técnicas</span>
                  </div>
                  {showTechnical ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showTechnical && (
                  <div className="p-4 pt-0 space-y-4 border-t border-border/50 bg-card/50">
                    <div className="grid grid-cols-1 gap-4 mt-4">
                      <FieldGroup label="UUID interno (tenant_id)" value={tenant.id} disabled />
                      <FieldGroup label="Data de criação" value={new Date(tenant.created_at).toLocaleString("pt-BR")} disabled />
                      <FieldGroup label="Estratégia de banco" value={snap?.registry?.runtime_mode ?? tenant.database_strategy} disabled />
                      <FieldGroup label="Schema version" value={snap?.registry?.schema_version ?? "—"} disabled />
                    </div>
                  </div>
                )}
              </div>

              {/* Danger zone */}
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-destructive">Zona de perigo</h3>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs text-muted-foreground max-w-md">
                    Excluir o laboratório remove permanentemente todos os dados vinculados (atendimentos, pacientes, configurações, usuários). Esta ação é irreversível.
                  </p>
                  <Button variant="destructive" size="sm" className="text-xs" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir laboratório
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "plano" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="rounded-xl border border-border bg-card p-6 space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" /> Plano vigente
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Assinatura comercial atual deste laboratório.</p>
                  </div>
                  {snap?.billing && <BillingStatusBadge status={snap.billing.status} />}
                </div>

                {snap?.billing?.plan ? (
                  <div className="space-y-5">
                    <div className="flex items-baseline gap-3">
                      <span className="text-2xl font-bold tracking-tight">{snap.billing.plan.nome}</span>
                      <span className="text-xs text-muted-foreground font-mono">{snap.billing.plan_code}</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <PlanStat label="Valor mensal" value={fmtBRL(snap.billing.plan.preco_mensal_cents)} />
                      <PlanStat label="Ciclo de cobrança" value={cycleLabel(snap.billing.billing_cycle)} />
                      <PlanStat label="MRR contabilizado" value={fmtBRL(snap.billing.mrr_cents)} />
                      <PlanStat label="Início do período" value={fmtDateShort(snap.billing.current_period_start)} />
                      <PlanStat label="Próximo vencimento" value={fmtDateShort(snap.billing.current_period_end)} />
                      <PlanStat label="Fim do trial" value={fmtDateShort(snap.billing.trial_ends_at)} />
                    </div>

                    <div className="pt-4 border-t border-border space-y-2">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Limites do plano</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <LimitBadge label="Usuários" value={snap.billing.plan.limite_usuarios} />
                        <LimitBadge label="Unidades" value={snap.billing.plan.limite_unidades} />
                        <LimitBadge label="Atend./mês" value={snap.billing.plan.limite_atendimentos_mes} />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
                      <p className="text-[11px] text-muted-foreground">Faça upgrade, downgrade ou troque o ciclo de cobrança.</p>
                      <Button size="sm" onClick={openChangePlan}>
                        <CreditCard className="h-3.5 w-3.5 mr-1.5" /> Trocar plano
                      </Button>
                    </div>

                    {snap.billing.canceled_at && (
                      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <p className="text-xs text-foreground">
                          Assinatura cancelada em <strong>{fmtDate(snap.billing.canceled_at)}</strong>.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Nenhuma assinatura vinculada. Atribua um plano ou gerencie o catálogo em <Link to="/super-admin/planos" className="text-primary underline">Planos & Preços</Link>.
                    </p>
                    <Button size="sm" onClick={openChangePlan}>
                      <CreditCard className="h-3.5 w-3.5 mr-1.5" /> Atribuir plano
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "operacao" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="rounded-xl border border-border bg-card p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                    <Activity className="h-4 w-4 text-primary" /> Operação (mês atual)
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricCard label="Usuários ativos" value={snap?.usuarios_ativos ?? 0} hint={`de ${snap?.usuarios_total ?? 0} total`} />
                    <MetricCard label="Atend. no mês" value={snap?.atendimentos_mes ?? 0} hint={`${snap?.atendimentos_total ?? 0} histórico`} />
                    <MetricCard label="Pacientes" value={snap?.pacientes_total ?? 0} />
                    <MetricCard label="Receita (mês)" value={fmtBRL(snap?.receita_mes_cents ?? 0)} />
                  </div>
                </div>

                <div className="pt-6 border-t border-border">
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                    <Building className="h-4 w-4 text-primary" /> Catálogo
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <MetricCard label="Unidades cadastradas" value={snap?.unidades_total ?? 0} />
                    <MetricCard label="Exames no catálogo" value={snap?.exames_total ?? 0} />
                    <MetricCard label="Perfis configurados" value={Object.keys(snap?.usuarios_por_perfil ?? {}).length} />
                  </div>
                </div>

                <div className="pt-6 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-xs font-bold">Acesso de suporte técnico</label>
                      <p className="text-[11px] text-muted-foreground">Permitir que o time do SISLAC acesse este tenant para depuração.</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "banco" && (
            <div className="animate-in fade-in duration-300 space-y-6">
              <TenantDatabaseConfig tenantId={tenant.id} initial={null} />

              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Download className="h-4 w-4 text-primary" /> Backup de dados
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-1 max-w-xl">
                    {isolatedDb
                      ? "Banco dedicado: o backup é gerenciado pelo provedor externo (Neon/Supabase dedicado)."
                      : "Gera um snapshot completo das tabelas operacionais deste laboratório."}
                  </p>
                </div>

                {!isolatedDb && (
                  <div className="grid gap-3 md:grid-cols-2 pt-2">
                    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Backup oficial</div>
                      <div className="text-sm font-medium">SQL compactado</div>
                      <p className="text-[11px] text-muted-foreground">
                        Dump completo (.sql.gz) para restauração técnica do banco.
                      </p>
                      <Button
                        onClick={() => handleBackup("sql")}
                        disabled={backupBusy}
                        size="sm"
                        className="w-full mt-2"
                      >
                        <Download className="h-4 w-4 mr-1.5" />
                        {backupBusy ? "Gerando..." : "Baixar .sql.gz"}
                      </Button>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exportação operacional</div>
                      <div className="text-sm font-medium">JSON e XLSX</div>
                      <p className="text-[11px] text-muted-foreground">
                        Dados estruturados para análise, conferência ou migração assistida.
                      </p>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <Button
                          onClick={() => handleBackup("json")}
                          disabled={backupBusy}
                          size="sm"
                          variant="outline"
                        >
                          <Download className="h-4 w-4 mr-1.5" />
                          JSON
                        </Button>
                        <Button
                          onClick={() => handleBackup("xlsx")}
                          disabled={backupBusy}
                          size="sm"
                          variant="outline"
                        >
                          <Download className="h-4 w-4 mr-1.5" />
                          XLSX
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-border/50 grid grid-cols-2 gap-3 text-xs">
                  <KV label="Provedor" value={snap?.registry?.db_provider ?? "shared_supabase"} />
                  <KV label="Região" value={snap?.registry?.db_region ?? "sa-east-1"} />
                  <KV label="Schema" value={snap?.registry?.schema_version ?? "v0"} />
                  <KV label="Último health check" value={fmtDate(snap?.registry?.last_health_check)} />
                </div>
              </div>
            </div>
          )}

          {activeTab === "seguranca" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="rounded-xl border border-border bg-card p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                    <Lock className="h-4 w-4 text-primary" /> Acesso e usuários
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(snap?.usuarios_por_perfil ?? {}).map(([perfil, count]) => (
                      <MetricCard key={perfil} label={perfil} value={count} />
                    ))}
                    {Object.keys(snap?.usuarios_por_perfil ?? {}).length === 0 && (
                      <p className="text-xs text-muted-foreground col-span-full">Nenhum usuário cadastrado.</p>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-border space-y-3">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" /> Sinais de segurança
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <KV label="Último login do admin" value={fmtDate(snap?.admin_user?.last_sign_in_at)} />
                    <KV label="Status do laboratório" value={tenant.status} />
                    <KV label="Health do banco" value={snap?.registry?.last_health_result ?? "—"} />
                    <KV label="Isolamento" value={isolatedDb ? "Dedicado" : "Compartilhado (RLS)"} />
                  </div>
                </div>

                <div className="pt-6 border-t border-border space-y-4">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" /> Políticas
                  </h3>
                  <div className="space-y-4">
                    <PolicyRow
                      label="Exigir 2FA para administradores"
                      hint="Autenticação de dois fatores obrigatória para acesso administrativo."
                    />
                    <PolicyRow
                      label="Restrição por IP"
                      hint="Limitar acesso apenas a IPs autorizados do laboratório."
                    />
                    <PolicyRow
                      label="Rotação automática de senhas"
                      hint="Forçar usuários a redefinir a senha periodicamente."
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-border">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <History className="h-4 w-4 text-muted-foreground" /> Auditoria
                    </h3>
                    <Button variant="link" className="text-[11px] h-auto p-0" asChild>
                      <Link to="/super-admin/auditoria">Abrir painel de auditoria <ExternalLink className="h-3 w-3 ml-1" /></Link>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Os eventos detalhados deste tenant estão disponíveis no painel global de auditoria.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Snapshot do laboratório</h3>
            <SidebarItem label="Usuários ativos" value={snapLoading ? "…" : String(snap?.usuarios_ativos ?? 0)} icon={Users} />
            <SidebarItem label="Atendimentos (mês)" value={snapLoading ? "…" : String(snap?.atendimentos_mes ?? 0)} icon={FileText} />
            <SidebarItem label="Pacientes" value={snapLoading ? "…" : String(snap?.pacientes_total ?? 0)} icon={Stethoscope} />
            <SidebarItem label="Receita (mês)" value={snapLoading ? "…" : fmtBRL(snap?.receita_mes_cents ?? 0)} icon={DollarSign} />
            <SidebarItem label="Unidades" value={snapLoading ? "…" : String(snap?.unidades_total ?? 0)} icon={MapPin} />
          </div>

          {snap?.billing && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Plano vigente</h3>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{snap.billing.plan?.nome ?? snap.billing.plan_code}</span>
                <BillingStatusBadge status={snap.billing.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                {fmtBRL(snap.billing.plan?.preco_mensal_cents ?? 0)} / mês
              </p>
              <p className="text-[10px] text-muted-foreground">
                Próx. cobrança: <span className="font-medium text-foreground">{fmtDateShort(snap.billing.current_period_end)}</span>
              </p>
              <Button variant="ghost" size="sm" className="w-full h-7 text-[11px] mt-1" onClick={() => setActiveTab("plano")}>
                Ver detalhes
              </Button>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Infraestrutura</h3>
            <div className="flex items-center gap-2 text-xs font-medium">
              <Database className="h-3.5 w-3.5 text-primary" />
              <span>Banco: <strong>{isolatedDb ? "Dedicado" : "Compartilhado"}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium">
              <Globe className="h-3.5 w-3.5 text-emerald-500" />
              <span>Região: <strong>{snap?.registry?.db_region ?? "sa-east-1"}</strong></span>
            </div>
            <Button variant="ghost" size="sm" className="w-full h-7 text-[11px] mt-1" onClick={() => setActiveTab("banco")}>
              <Download className="h-3 w-3 mr-1" /> Backup
            </Button>
          </div>
        </aside>
      </div>

      {/* Dialog: Edit admin */}
      <Dialog open={editAdminOpen} onOpenChange={setEditAdminOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar responsável</DialogTitle>
            <DialogDescription>
              Atualizar dados de cadastro e login do admin deste laboratório.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome completo</Label>
              <Input value={adminNome} onChange={(e) => setAdminNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">E-mail de login</Label>
              <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
              <p className="text-[10px] text-muted-foreground">Alterar o e-mail muda o login do usuário no Auth.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Telefone</Label>
              <Input
                value={adminTelefone}
                onChange={(e) => setAdminTelefone(maskPhoneBR(e.target.value))}
                placeholder="(00) 00000-0000"
                maxLength={15}
                inputMode="tel"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAdminOpen(false)} disabled={actionBusy}>Cancelar</Button>
            <Button onClick={handleSaveAdmin} disabled={actionBusy}>Salvar alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Reset password */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha do admin</DialogTitle>
            <DialogDescription>
              Definir nova senha para <strong>{snap?.admin_user?.email}</strong>.
              O usuário poderá entrar imediatamente com a senha definida.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs">Nova senha (mín. 6 caracteres)</Label>
            <Input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancelar</Button>
            <Button onClick={handleResetPassword} disabled={actionBusy}>Redefinir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Delete tenant */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Excluir laboratório</DialogTitle>
            <DialogDescription>
              Esta ação é <strong>irreversível</strong>. Para confirmar, digite o nome exato do laboratório:
              <br />
              <span className="font-mono font-bold mt-2 inline-block">{tenant.nome}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder="Digite o nome do laboratório"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={actionBusy || deleteConfirmName.trim() !== tenant.nome.trim()}
            >
              Excluir permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Change plan */}
      <Dialog open={changePlanOpen} onOpenChange={setChangePlanOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Trocar plano</DialogTitle>
            <DialogDescription>
              Selecione um plano e o ciclo de cobrança. A mudança entra em vigor imediatamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Ciclo de cobrança</Label>
              <Select value={selectedCycle} onValueChange={(v) => setSelectedCycle(v as typeof selectedCycle)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="annual">Anual</SelectItem>
                  <SelectItem value="free">Gratuito (sem cobrança)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Plano</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                {plans.filter(p => p.is_active).map(p => (
                  <PlanCard
                    key={p.code}
                    plan={p}
                    selected={selectedPlanCode === p.code}
                    onSelect={() => setSelectedPlanCode(p.code)}
                    compact
                  />
                ))}
                {plans.length === 0 && (
                  <p className="text-xs text-muted-foreground col-span-full">Nenhum plano cadastrado. Crie planos em Planos & Preços.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePlanOpen(false)} disabled={actionBusy}>Cancelar</Button>
            <Button onClick={handleChangePlan} disabled={actionBusy || !selectedPlanCode}>
              {actionBusy ? "Aplicando..." : "Aplicar plano"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar suspensão / reativação */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={isSuspenso ? "" : "text-destructive"}>
              {isSuspenso ? "Reativar laboratório" : "Suspender laboratório"}
            </DialogTitle>
            <DialogDescription>
              {isSuspenso
                ? `Tem certeza que deseja reativar o acesso de ${tenant.nome}? Todos os usuários poderão voltar a utilizar o sistema.`
                : `Tem certeza que deseja suspender ${tenant.nome}? Essa ação bloqueia o acesso de todos os usuários imediatamente.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)} disabled={actionBusy}>Cancelar</Button>
            <Button variant={isSuspenso ? "default" : "destructive"} onClick={handleToggleStatus} disabled={actionBusy}>
              {actionBusy ? "Processando..." : (isSuspenso ? "Reativar" : "Suspender")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cycleLabel(c: string) {
  if (c === "monthly") return "Mensal";
  if (c === "yearly") return "Anual";
  if (c === "free") return "Gratuito";
  return c || "—";
}

function FieldGroup({
  label, value, onChange, disabled, placeholder, type, maxLength, inputMode,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        value={value}
        type={type ?? "text"}
        maxLength={maxLength}
        inputMode={inputMode}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        disabled={disabled}
        placeholder={placeholder}
        readOnly={!onChange}
        className="w-full h-9 px-3 rounded-lg bg-background border border-border/60 text-sm focus:ring-1 focus:ring-primary/20 outline-none disabled:bg-muted/30 disabled:text-muted-foreground"
      />
    </div>
  );
}

function SidebarItem({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <span className="text-xs font-bold">{value}</span>
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="p-3 rounded-lg border border-border bg-muted/30">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-mono font-bold">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, mono }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className={cn("text-sm font-medium truncate", mono && "font-mono")}>{value}</p>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium font-mono truncate ml-2">{value}</span>
    </div>
  );
}

function PlanStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg border border-border bg-muted/20">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

function LimitBadge({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">{label}</p>
      <p className="text-sm font-bold">{value == null ? "Ilimitado" : value.toLocaleString("pt-BR")}</p>
    </div>
  );
}

function BillingStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Ativa", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    trial: { label: "Trial", cls: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    past_due: { label: "Atrasada", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    canceled: { label: "Cancelada", cls: "bg-muted text-muted-foreground border-border" },
    paused: { label: "Pausada", cls: "bg-muted text-muted-foreground border-border" },
  };
  const m = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={cn("inline-flex items-center h-6 px-2 rounded-md border text-[10px] font-bold uppercase tracking-wider", m.cls)}>
      {m.label}
    </span>
  );
}

function PolicyRow({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <label className="text-xs font-bold">{label}</label>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <Switch />
    </div>
  );
}
