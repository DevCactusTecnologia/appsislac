import { PageHeader } from "@/components/shared/PageHeader";
import { useState, useEffect, useMemo } from "react";
import { Plus, Search, Pencil, Trash2, UserCheck, UserX, Shield, KeyRound, MapPin, Loader2, Mail, ShieldCheck, User, Microscope, Calculator, ClipboardList, Briefcase, IdCard, Phone, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StandardDialog from "@/components/ui/standard-dialog";
import { AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getUnidadesAtivas, getUnidadeById, getTipoLabel } from "@/data/unidadeStore";
import {
  getUsuarios,
  subscribeUsuarios,
  inviteUsuario,
  updateUsuario,
  deleteUsuario,
  sendPasswordResetEmail,
  resolverPermissoesEfetivas,
  PERMISSOES_AGRUPADAS,
  DEFAULTS_POR_PERFIL,
  TODAS_PERMISSOES,
  type Usuario,
  type Perfil,
  fetchUsuariosIntegridade,
  type UsuarioIntegridade,
} from "@/data/usuariosStore";
import { useAuth } from "@/contexts/AuthContext";
import AssinaturaSection from "@/components/usuarios/AssinaturaSection";
import { maskPhoneBR } from "@/lib/masks";

const TIPOS_PROFISSIONAL = [
  "Biomédico",
  "Biomédica",
  "Farmacêutico",
  "Farmacêutica",
  "Bioquímico",
  "Bioquímico Citologista",
] as const;

const CONSELHOS_CLASSE = ["CRBM", "CRF", "CRBio", "CRM", "Outro"] as const;

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

const perfilLabels: Record<Perfil, string> = {
  admin: "Administrador",
  analista: "Analista",
  recepcionista: "Recepcionista",
  financeiro: "Financeiro",
};

const PERFIS_SELECIONAVEIS: Perfil[] = ["analista", "recepcionista", "financeiro"];

const normalize = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

interface FormData {
  nome: string;
  email: string;
  perfil: Perfil;
  unidadeIds: string[];
  permissoesEfetivas: Set<string>;
  isAdmin: boolean;
  password: string;
  assinaturaTipo: "carimbo" | "imagem";
  assinaturaConselho: string;
  assinaturaImagemKey: string | null;
  telefone: string;
  tipoProfissional: string;
  cbo: string;
  cpf: string;
  cns: string;
  conselhoClasse: string;
  conselhoUf: string;
  conselhoNumero: string;
}

const emptyForm = (): FormData => {
  const primeiraUnidade = getUnidadesAtivas()[0]?.id;
  return {
    nome: "",
    email: "",
    perfil: "analista",
    unidadeIds: primeiraUnidade ? [primeiraUnidade] : [],
    permissoesEfetivas: new Set(DEFAULTS_POR_PERFIL.analista),
    isAdmin: false,
    password: "",
    assinaturaTipo: "carimbo",
    assinaturaConselho: "",
    assinaturaImagemKey: null,
    telefone: "",
    tipoProfissional: "",
    cbo: "",
    cpf: "",
    cns: "",
    conselhoClasse: "",
    conselhoUf: "",
    conselhoNumero: "",
  };
};

/**
 * Converte permissões efetivas (toggles marcados) em (extras, revogadas)
 * relativos ao default do perfil. Isso garante que quando os defaults do
 * perfil mudam no backend, usuários sem overrides recebam automaticamente.
 */
function diffPermissoes(perfil: Perfil, efetivas: Set<string>, isAdmin: boolean) {
  if (isAdmin) {
    return { extras: [] as string[], revogadas: [] as string[] };
  }
  const defaults = new Set(DEFAULTS_POR_PERFIL[perfil] ?? []);
  const extras: string[] = [];
  const revogadas: string[] = [];
  for (const perm of TODAS_PERMISSOES) {
    const isDefault = defaults.has(perm);
    const isMarked = efetivas.has(perm);
    if (isMarked && !isDefault) extras.push(perm);
    if (!isMarked && isDefault) revogadas.push(perm);
  }
  return { extras, revogadas };
}

const Usuarios = ({ embedded }: { embedded?: boolean }) => {
  const { user: currentUser } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>(() => getUsuarios());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Todos" | "Ativo" | "Inativo">("Todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [purgeDialog, setPurgeDialog] = useState<string | null>(null);
  const [purgeConfirm, setPurgeConfirm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [permDialogUser, setPermDialogUser] = useState<string | null>(null);
  const [resetSenhaDialog, setResetSenhaDialog] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [integridade, setIntegridade] = useState<UsuarioIntegridade[]>([]);

  useEffect(() => {
    setUsuarios(getUsuarios());
    return subscribeUsuarios(() => setUsuarios(getUsuarios()));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchUsuariosIntegridade().then((rows) => { if (!cancelled) setIntegridade(rows); });
    return () => { cancelled = true; };
  }, [usuarios.length]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return usuarios.filter((u) => {
      if (statusFilter !== "Todos" && u.status !== statusFilter) return false;
      if (q && !normalize(u.nome).includes(q) && !normalize(u.email).includes(q)) return false;
      return true;
    });
  }, [search, statusFilter, usuarios]);

  const handleNovo = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const handleEditar = (u: Usuario) => {
    setEditingId(u.userId);
    setForm({
      nome: u.nome,
      email: u.email,
      perfil: u.perfil,
      unidadeIds: [...u.unidadeIds],
      permissoesEfetivas: resolverPermissoesEfetivas(u),
      isAdmin: u.isAdmin,
      password: "",
      assinaturaTipo: u.assinaturaTipo,
      assinaturaConselho: u.assinaturaConselho ?? "",
      assinaturaImagemKey: u.assinaturaImagemKey,
      telefone: u.telefone ?? "",
      tipoProfissional: u.tipoProfissional ?? "",
      cbo: u.cbo ?? "",
      cpf: u.cpf ?? "",
      cns: u.cns ?? "",
      conselhoClasse: u.conselhoClasse ?? "",
      conselhoUf: u.conselhoUf ?? "",
      conselhoNumero: u.conselhoNumero ?? "",
    });
    setDialogOpen(true);
  };

  const handlePerfilChange = (perfil: Perfil) => {
    // Ao trocar perfil, restaura permissões efetivas para os defaults novos
    setForm((f) => ({
      ...f,
      perfil,
      permissoesEfetivas: f.isAdmin ? new Set(TODAS_PERMISSOES) : new Set(DEFAULTS_POR_PERFIL[perfil] ?? []),
    }));
  };

  const togglePermissao = (permId: string) => {
    setForm((f) => {
      if (f.isAdmin) return f; // admin tem tudo, não permite toggle individual
      const next = new Set(f.permissoesEfetivas);
      if (next.has(permId)) next.delete(permId); else next.add(permId);
      return { ...f, permissoesEfetivas: next };
    });
  };

  const toggleAdmin = (v: boolean) => {
    setForm((f) => ({
      ...f,
      isAdmin: v,
      permissoesEfetivas: v ? new Set(TODAS_PERMISSOES) : new Set(DEFAULTS_POR_PERFIL[f.perfil] ?? []),
    }));
  };

  const handleSalvar = async () => {
    if (!form.nome.trim()) { toast.error("Informe o nome."); return; }
    if (!editingId && !form.email.trim()) { toast.error("Informe o e-mail."); return; }
    if (form.unidadeIds.length === 0) {
      toast.error("Selecione pelo menos uma unidade.");
      return;
    }
    if (form.password && form.password.length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres.");
      return;
    }

    // Validações específicas para perfil Analista (não admin)
    if (form.perfil === "analista" && !form.isAdmin) {
      if (!form.tipoProfissional) { toast.error("Selecione o tipo de profissional."); return; }
      if (!form.conselhoClasse.trim()) { toast.error("Informe o conselho de classe."); return; }
      if (!form.conselhoUf) { toast.error("Selecione a UF emissora do conselho."); return; }
      if (!form.conselhoNumero.trim()) { toast.error("Informe o número do registro."); return; }
    }

    setSaving(true);
    const { extras, revogadas } = diffPermissoes(form.perfil, form.permissoesEfetivas, form.isAdmin);

    const dadosProf = {
      telefone: form.telefone.trim(),
      tipoProfissional: form.tipoProfissional.trim(),
      cbo: form.cbo.trim(),
      cpf: form.cpf.trim(),
      cns: form.cns.trim(),
      conselhoClasse: form.conselhoClasse.trim(),
      conselhoUf: form.conselhoUf.trim(),
      conselhoNumero: form.conselhoNumero.trim(),
    };

    if (editingId) {
      const result = await updateUsuario({
        userId: editingId,
        nome: form.nome.trim(),
        perfil: form.perfil,
        unidadeIds: form.unidadeIds,
        permissoesExtras: extras,
        permissoesRevogadas: revogadas,
        isAdmin: form.isAdmin,
        password: form.password ? form.password : undefined,
        assinaturaTipo: form.assinaturaTipo,
        assinaturaConselho: form.assinaturaConselho,
        ...dadosProf,
      });
      setSaving(false);
      if (!result.ok) { toast.error(result.error || "Falha ao atualizar."); return; }
      toast.success(form.password ? "Usuário atualizado e senha redefinida." : "Usuário atualizado.");
    } else {
      const result = await inviteUsuario({
        email: form.email.trim().toLowerCase(),
        nome: form.nome.trim(),
        perfil: form.perfil,
        unidadeIds: form.unidadeIds,
        permissoesExtras: extras,
        permissoesRevogadas: revogadas,
        isAdmin: form.isAdmin,
        password: form.password ? form.password : undefined,
        ...dadosProf,
      });
      setSaving(false);
      if (!result.ok) { toast.error(result.error || "Falha ao convidar."); return; }
      toast.success(form.password ? "Usuário criado com senha definida." : "Convite enviado por e-mail.");
    }
    setDialogOpen(false);
  };

  const handleToggleStatus = async (u: Usuario) => {
    const novoStatus = u.status === "Ativo" ? "Inativo" : "Ativo";
    const result = await updateUsuario({ userId: u.userId, status: novoStatus });
    if (!result.ok) { toast.error(result.error || "Falha."); return; }
    toast.success(`Usuário ${novoStatus.toLowerCase()}.`);
  };

  const handleResetSenha = async () => {
    if (!resetSenhaDialog) return;
    const u = usuarios.find((x) => x.userId === resetSenhaDialog);
    if (!u) return;
    setSaving(true);
    const result = await sendPasswordResetEmail(u.email);
    setSaving(false);
    if (!result.ok) { toast.error(result.error || "Falha ao enviar."); return; }
    toast.success(`Link de redefinição enviado para ${u.email}.`);
    setResetSenhaDialog(null);
  };

  const handleDesativar = async () => {
    if (!deleteDialog) return;
    const result = await updateUsuario({ userId: deleteDialog, status: "Inativo" });
    setDeleteDialog(null);
    if (!result.ok) { toast.error(result.error || "Falha."); return; }
    toast.success("Usuário desativado.");
  };

  const handleExcluirDefinitivo = async () => {
    if (!purgeDialog) return;
    const u = usuarios.find((x) => x.userId === purgeDialog);
    if (!u) return;
    if (purgeConfirm.trim().toUpperCase() !== "EXCLUIR") {
      toast.error('Digite "EXCLUIR" para confirmar.');
      return;
    }
    setSaving(true);
    const result = await deleteUsuario(purgeDialog);
    setSaving(false);
    if (!result.ok) { toast.error(result.error || "Falha ao excluir."); return; }
    toast.success(`Usuário ${u.nome} excluído definitivamente.`);
    setPurgeDialog(null);
    setPurgeConfirm("");
  };

  const tabs = [
    { label: "Todos", value: "Todos" as const, count: usuarios.length },
    { label: "Ativos", value: "Ativo" as const, count: usuarios.filter((u) => u.status === "Ativo").length },
    { label: "Inativos", value: "Inativo" as const, count: usuarios.filter((u) => u.status === "Inativo").length },
  ];

  return (
    <div className={embedded ? "" : "min-h-screen bg-background"}>
      <div className={embedded ? "space-y-6" : "px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-6"}>
        <PageHeader
          eyebrow="Governança"
          title="Usuários"
          description={`${filtered.length} ${filtered.length === 1 ? "usuário cadastrado" : "usuários cadastrados"}.`}
          actions={
            <button onClick={handleNovo} className="flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]">
              <Plus className="h-4 w-4" /> Convidar usuário
            </button>
          }
        />

        {integridade.length > 0 && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-foreground">
                {integridade.length} {integridade.length === 1 ? "usuário com inconsistência" : "usuários com inconsistência"}
              </p>
              <ul className="mt-1 text-xs text-muted-foreground space-y-0.5">
                {integridade.slice(0, 5).map((i) => (
                  <li key={i.userId} className="truncate">
                    <span className="font-medium text-foreground">{i.nome || i.email}</span> — {i.issue}
                  </li>
                ))}
                {integridade.length > 5 && <li>+ {integridade.length - 5} outros</li>}
              </ul>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1 p-1 bg-muted/50 rounded-2xl border border-border/40">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${statusFilter === tab.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tab.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-lg font-semibold ${statusFilter === tab.value ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{tab.count}</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className="pl-10 pr-4 py-2.5 w-full bg-card border border-border/60 rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-3xl border border-border/60 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left px-6 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Usuário</th>
                  <th className="text-left px-6 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Perfil</th>
                  <th className="text-left px-6 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Unidades</th>
                  <th className="text-left px-6 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right px-6 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-16 text-sm text-muted-foreground">Nenhum usuário encontrado</td></tr>
                ) : filtered.map((u) => (
                  <tr key={u.userId} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">{u.nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-foreground truncate">{u.nome}</p>
                            {u.isAdmin && <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" aria-label="Administrador" />}
                            {u.friendlyId && (
                              <span className="text-[10px] font-mono font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md shrink-0" title="ID do usuário (imutável)">
                                {u.friendlyId}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-primary/8 text-primary">
                        {u.isAdmin ? "Administrador" : perfilLabels[u.perfil]}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {u.unidadeIds.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : u.unidadeIds.map((uid) => {
                          const und = getUnidadeById(uid);
                          return und ? <span key={uid} className="text-[10px] px-2 py-0.5 rounded-lg bg-muted text-muted-foreground">{und.nome}</span> : null;
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold ${u.status === "Ativo" ? "bg-[hsl(var(--status-success))]/10 text-[hsl(var(--status-success))]" : "bg-destructive/10 text-destructive"}`}>{u.status}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEditar(u)} className="p-2 rounded-xl hover:bg-muted transition-colors" title="Editar"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        <button onClick={() => setResetSenhaDialog(u.userId)} className="p-2 rounded-xl hover:bg-muted transition-colors" title="Enviar link de redefinição"><KeyRound className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        <button onClick={() => handleToggleStatus(u)} className="p-2 rounded-xl hover:bg-muted transition-colors" title={u.status === "Ativo" ? "Inativar" : "Ativar"}>
                          {u.status === "Ativo" ? <UserX className="h-3.5 w-3.5 text-destructive" /> : <UserCheck className="h-3.5 w-3.5 text-[hsl(var(--status-success))]" />}
                        </button>
                        <button
                          onClick={() => { setPurgeDialog(u.userId); setPurgeConfirm(""); }}
                          disabled={currentUser?.id === u.userId}
                          className="p-2 rounded-xl hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={currentUser?.id === u.userId ? "Você não pode excluir seu próprio usuário" : "Excluir definitivamente"}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
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
            {filtered.length === 0 ? <div className="p-12 text-center text-sm text-muted-foreground">Nenhum usuário encontrado</div> : filtered.map((u) => (
              <div key={u.userId} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                      {u.nome}
                      {u.isAdmin && <ShieldCheck className="h-3 w-3 text-primary" />}
                      {u.friendlyId && (
                        <span className="text-[10px] font-mono font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md" title="ID do usuário (imutável)">
                          {u.friendlyId}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-semibold ${u.status === "Ativo" ? "bg-[hsl(var(--status-success))]/10 text-[hsl(var(--status-success))]" : "bg-destructive/10 text-destructive"}`}>{u.status}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-primary/8 text-primary">
                    {u.isAdmin ? "Administrador" : perfilLabels[u.perfil]}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs rounded-xl" onClick={() => handleEditar(u)}><Pencil className="h-3 w-3" /> Editar</Button>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl" onClick={() => handleToggleStatus(u)}>{u.status === "Ativo" ? "Inativar" : "Ativar"}</Button>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl" onClick={() => setResetSenhaDialog(u.userId)}><KeyRound className="h-3 w-3" /></Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentUser?.id === u.userId}
                    className="gap-1.5 text-xs rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                    onClick={() => { setPurgeDialog(u.userId); setPurgeConfirm(""); }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <StandardDialog
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
        icon={<Shield className="h-5 w-5 text-primary" />}
        title={editingId ? "Editar Usuário" : "Convidar Usuário"}
        subtitle={editingId ? "Atualize perfil, unidades, permissões e senha." : "Defina uma senha agora ou envie convite por e-mail."}
        maxWidth="3xl"
        footer={
          <>
            <button
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="h-11 px-6 rounded-2xl border border-border/60 bg-background text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              disabled={saving}
              className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-[13px] font-semibold hover:opacity-90 transition-all shadow-sm flex items-center gap-2 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Salvar" : "Enviar convite"}
            </button>
          </>
        }
      >
        <div className="px-6 py-5 space-y-6">
          {/* ── PASSO 1 · Selecione o perfil ───────────────────── */}
          <section className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Passo 1</span>
              <h3 className="text-sm font-semibold text-foreground">Tipo de acesso</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                { key: "analista" as Perfil, icon: Microscope, label: "Analista", desc: "Análise e liberação" },
                { key: "recepcionista" as Perfil, icon: ClipboardList, label: "Recepcionista", desc: "Atendimentos" },
                { key: "financeiro" as Perfil, icon: Calculator, label: "Financeiro", desc: "Caixa e relatórios" },
                { key: "__admin" as const, icon: ShieldCheck, label: "Administrador", desc: "Acesso total" },
              ]).map((opt) => {
                const isAdminCard = opt.key === "__admin";
                const selected = isAdminCard ? form.isAdmin : (!form.isAdmin && form.perfil === opt.key);
                const disabled = isAdminCard && !!editingId && currentUser?.id === editingId;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (isAdminCard) toggleAdmin(true);
                      else { if (form.isAdmin) toggleAdmin(false); handlePerfilChange(opt.key as Perfil); }
                    }}
                    className={cn(
                      "flex flex-col items-start gap-1.5 p-3 rounded-2xl border text-left transition-all",
                      selected
                        ? "border-primary/50 bg-primary/5 ring-2 ring-primary/15"
                        : "border-border/60 hover:bg-muted/40 hover:border-border",
                      disabled && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <div className={cn("p-1.5 rounded-lg", selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-[13px] font-semibold text-foreground">{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── PASSO 2 · Identificação ──────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Passo 2</span>
              <h3 className="text-sm font-semibold text-foreground">Identificação</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Nome completo *</Label>
                <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Maria Silva Souza" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> E-mail *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="usuario@email.com"
                  className="rounded-xl"
                  disabled={!!editingId}
                />
                {editingId && <p className="text-[10px] text-muted-foreground">O e-mail não pode ser alterado.</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> {editingId ? "Redefinir senha" : "Senha"} <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={editingId ? "Manter atual" : "Min. 8 caracteres"}
                  className="rounded-xl"
                  autoComplete="new-password"
                />
                <p className="text-[10px] text-muted-foreground">{editingId ? "Em branco mantém a atual." : "Em branco envia convite por e-mail."}</p>
              </div>
            </div>
          </section>

          {/* ── PASSO 3 · Dados profissionais (somente Analista) ─ */}
          {form.perfil === "analista" && !form.isAdmin && (
            <section className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Passo 3</span>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" /> Dados profissionais do analista</h3>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Tipo de profissional *</Label>
                    <Select value={form.tipoProfissional} onValueChange={(v) => setForm((f) => ({ ...f, tipoProfissional: v }))}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_PROFISSIONAL.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5"><IdCard className="h-3.5 w-3.5" /> CPF</Label>
                    <Input value={form.cpf} onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Telefone</Label>
                    <Input value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: maskPhoneBR(e.target.value) }))} placeholder="(00) 00000-0000" className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">CBO</Label>
                    <Input value={form.cbo} onChange={(e) => setForm((f) => ({ ...f, cbo: e.target.value.replace(/\D/g, "").slice(0, 6) }))} placeholder="Ex.: 223505" className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">CNS</Label>
                    <Input value={form.cns} onChange={(e) => setForm((f) => ({ ...f, cns: e.target.value.replace(/\D/g, "").slice(0, 15) }))} placeholder="Cartão Nacional de Saúde" className="rounded-xl" />
                  </div>
                </div>

                <div className="pt-2 border-t border-border/50">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Registro no conselho</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Conselho *</Label>
                      <Select value={form.conselhoClasse} onValueChange={(v) => setForm((f) => ({ ...f, conselhoClasse: v }))}>
                        <SelectTrigger className="rounded-xl"><SelectValue placeholder="CRBM..." /></SelectTrigger>
                        <SelectContent>
                          {CONSELHOS_CLASSE.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">UF *</Label>
                      <Select value={form.conselhoUf} onValueChange={(v) => setForm((f) => ({ ...f, conselhoUf: v }))}>
                        <SelectTrigger className="rounded-xl"><SelectValue placeholder="UF" /></SelectTrigger>
                        <SelectContent>
                          {UFS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs">Número do registro *</Label>
                      <Input value={form.conselhoNumero} onChange={(e) => setForm((f) => ({ ...f, conselhoNumero: e.target.value }))} placeholder="Ex.: 12345" className="rounded-xl" />
                    </div>
                  </div>
                </div>

                {editingId ? (
                  <div className="pt-2 border-t border-border/50">
                    <AssinaturaSection
                      userId={editingId}
                      tipo={form.assinaturaTipo}
                      conselho={
                        form.conselhoClasse && form.conselhoUf && form.conselhoNumero
                          ? `${form.conselhoClasse}/${form.conselhoUf} ${form.conselhoNumero}`
                          : form.assinaturaConselho
                      }
                      imagemKey={form.assinaturaImagemKey}
                      nome={form.nome}
                      onChangeTipo={(t) => setForm((f) => ({ ...f, assinaturaTipo: t }))}
                      onChangeConselho={(v) => setForm((f) => ({ ...f, assinaturaConselho: v }))}
                      onImagemChange={(k) => setForm((f) => ({ ...f, assinaturaImagemKey: k }))}
                    />
                  </div>
                ) : (
                  <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                    A assinatura scaneada poderá ser enviada após criar o usuário (reabra em "Editar").
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── PASSO · Unidades ───────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80">{form.perfil === "analista" && !form.isAdmin ? "Passo 4" : "Passo 3"}</span>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Unidades de acesso</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {getUnidadesAtivas().map((u) => {
                const checked = form.unidadeIds.includes(u.id);
                return (
                  <label
                    key={u.id}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors",
                      checked ? "border-primary/40 bg-primary/5" : "border-border/60 hover:bg-muted/50",
                    )}
                  >
                    <Switch
                      checked={checked}
                      onCheckedChange={() => setForm((f) => ({
                        ...f,
                        unidadeIds: checked ? f.unidadeIds.filter((id) => id !== u.id) : [...f.unidadeIds, u.id],
                      }))}
                      className="scale-90"
                    />
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-foreground truncate block">{u.nome}</span>
                      <p className="text-[11px] text-muted-foreground truncate">{getTipoLabel(u.tipo)} · {u.cidade}/{u.estado}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>

          {/* ── Permissões avançadas (colapsado) ──────────── */}
          {!form.isAdmin && (
            <details className="group rounded-2xl border border-border/60 overflow-hidden">
              <summary className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors list-none">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Permissões avançadas</span>
                </div>
                <span className="text-[11px] text-muted-foreground">Ajustes finos — opcional</span>
              </summary>
              <div className="p-3 space-y-3">
                {PERMISSOES_AGRUPADAS.map((grupo) => (
                  <div key={grupo.id} className="rounded-2xl border border-border/60 overflow-hidden">
                    <div className="px-3 py-2 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{grupo.label}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2">
                      {grupo.permissoes.map((p) => {
                        const checked = form.permissoesEfetivas.has(p.id);
                        return (
                          <label
                            key={p.id}
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors",
                              checked ? "bg-primary/5" : "hover:bg-muted/40",
                            )}
                          >
                            <Switch checked={checked} onCheckedChange={() => togglePermissao(p.id)} className="scale-90" />
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-foreground">{p.label}</span>
                              <p className="text-[11px] text-muted-foreground truncate">{p.descricao}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </StandardDialog>


      {/* Desativar Dialog */}
      <StandardDialog
        open={deleteDialog !== null}
        onClose={() => setDeleteDialog(null)}
        icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
        title="Desativar usuário?"
        subtitle="Ele perderá acesso, mas o histórico será preservado."
        maxWidth="sm"
        footer={
          <>
            <Button variant="outline" className="rounded-2xl" onClick={() => setDeleteDialog(null)}>Cancelar</Button>
            <Button onClick={handleDesativar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-2xl">Desativar</Button>
          </>
        }
      >
        <div className="px-6 py-5 text-sm text-muted-foreground">
          O usuário não conseguirá mais entrar no sistema. Você pode reativá-lo a qualquer momento.
        </div>
      </StandardDialog>

      {/* Reset Senha Dialog */}
      <StandardDialog
        open={resetSenhaDialog !== null}
        onClose={() => !saving && setResetSenhaDialog(null)}
        icon={<Mail className="h-5 w-5 text-primary" />}
        title="Enviar link de redefinição"
        subtitle={`Para ${usuarios.find((u) => u.userId === resetSenhaDialog)?.nome ?? ""}`}
        maxWidth="sm"
        footer={
          <>
            <button
              onClick={() => setResetSenhaDialog(null)}
              disabled={saving}
              className="h-10 px-5 rounded-2xl border border-border/60 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleResetSenha}
              disabled={saving}
              className="h-10 px-5 rounded-2xl bg-primary text-primary-foreground text-[13px] font-semibold hover:opacity-90 transition-all shadow-sm flex items-center gap-2 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar e-mail
            </button>
          </>
        }
      >
        <div className="px-6 py-5 text-sm text-muted-foreground space-y-2">
          <p>O usuário receberá um e-mail com link seguro para definir uma nova senha.</p>
          <p className="text-xs">Destinatário: <strong className="text-foreground">{usuarios.find((u) => u.userId === resetSenhaDialog)?.email}</strong></p>
        </div>
      </StandardDialog>

      {/* Excluir DEFINITIVAMENTE Dialog */}
      <StandardDialog
        open={purgeDialog !== null}
        onClose={() => !saving && (setPurgeDialog(null), setPurgeConfirm(""))}
        icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
        title="Excluir usuário definitivamente?"
        subtitle="Esta ação é IRREVERSÍVEL e não pode ser desfeita."
        maxWidth="sm"
        footer={
          <>
            <button
              onClick={() => { setPurgeDialog(null); setPurgeConfirm(""); }}
              disabled={saving}
              className="h-10 px-5 rounded-2xl border border-border/60 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleExcluirDefinitivo}
              disabled={saving || purgeConfirm.trim().toUpperCase() !== "EXCLUIR"}
              className="h-10 px-5 rounded-2xl bg-destructive text-destructive-foreground text-[13px] font-semibold hover:opacity-90 transition-all shadow-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Excluir definitivamente
            </button>
          </>
        }
      >
        <div className="px-6 py-5 space-y-4 text-sm">
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
            <p className="font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Atenção
            </p>
            <p className="text-xs mt-1 text-destructive/90">
              O cadastro do usuário <strong>{usuarios.find((u) => u.userId === purgeDialog)?.nome}</strong> será removido
              permanentemente do sistema, incluindo acesso, perfil e permissões. O histórico de auditoria das ações
              realizadas por ele será preservado.
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">
              Para confirmar, digite <strong className="text-foreground">EXCLUIR</strong> abaixo:
            </Label>
            <Input
              value={purgeConfirm}
              onChange={(e) => setPurgeConfirm(e.target.value)}
              placeholder="EXCLUIR"
              className="rounded-xl"
              autoFocus
            />
          </div>
        </div>
      </StandardDialog>
    </div>
  );
};

export default Usuarios;
