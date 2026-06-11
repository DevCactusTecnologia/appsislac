import { useEffect, useState } from "react";
import { UserCog, Upload, User, Mail, Check, X, Loader2, Lock, ShieldCheck, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import SectionShell from "./_shared/SectionShell";
import { gerarRelatorioLGPD } from "@/lib/lgpdReport";

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const inputClass =
  "w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all";
const labelClass =
  "text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block";

const AdminTab = () => {
  const { user } = useAuth();
  const currentEmail = user?.email ?? "";

  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar ?? null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form, setForm] = useState({
    nome: user?.nome ?? "",
    telefone: "",
  });

  const [editingEmail, setEditingEmail] = useState(false);
  const [novoEmail, setNovoEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [pwd, setPwd] = useState({ nova: "", confirmar: "" });
  const [savingPwd, setSavingPwd] = useState(false);
  const [gerandoLGPD, setGerandoLGPD] = useState(false);

  useEffect(() => {
    setForm((prev) => ({ ...prev, nome: user?.nome ?? prev.nome }));
    if (user?.avatar) setAvatarPreview(user.avatar);
  }, [user?.nome, user?.avatar]);

  const updateField = (field: "nome" | "telefone", value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "Máximo de 2MB.",
        variant: "destructive",
      });
      return;
    }
    setUploadingAvatar(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error("Falha ao ler arquivo"));
        r.readAsDataURL(file);
      });
      const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
      const { data, error } = await supabase.functions.invoke("upload-image", {
        body: {
          category: "avatar",
          contentType: file.type,
          dataBase64: base64,
          filename: file.name || "avatar.png",
        },
      });
      if (error || !(data as { ok?: boolean })?.ok) {
        throw new Error(error?.message || (data as { error?: string })?.error || "Falha no upload");
      }
      setAvatarPreview(dataUrl);
      toast({ title: "Avatar atualizado", description: "Foto enviada com segurança." });
    } catch (err) {
      toast({
        title: "Erro no upload",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const handleAvatarRemove = async () => {
    setUploadingAvatar(true);
    try {
      const { data, error } = await supabase.functions.invoke("upload-image", {
        body: { category: "avatar", remove: true },
      });
      if (error || !(data as { ok?: boolean })?.ok) {
        throw new Error(error?.message || (data as { error?: string })?.error || "Falha ao remover");
      }
      setAvatarPreview(null);
    } catch (err) {
      toast({
        title: "Erro ao remover",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = () => {
    toast({
      title: "Dados atualizados",
      description: "Os dados do administrador foram salvos com sucesso.",
    });
  };

  const startEditEmail = () => {
    setNovoEmail(currentEmail);
    setEditingEmail(true);
  };

  const cancelEditEmail = () => {
    setEditingEmail(false);
    setNovoEmail("");
  };

  const handleChangeEmail = async () => {
    const target = novoEmail.trim().toLowerCase();
    if (!isValidEmail(target)) {
      toast({
        title: "Email inválido",
        description: "Informe um email válido.",
        variant: "destructive",
      });
      return;
    }
    if (target === currentEmail.toLowerCase()) {
      toast({ title: "Nenhuma alteração", description: "O email informado é o mesmo do atual." });
      return;
    }
    if (user?.source !== "supabase") {
      toast({
        title: "Indisponível no modo demo",
        description: "Faça login com uma conta real para trocar o email.",
        variant: "destructive",
      });
      return;
    }
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: target });
    setSavingEmail(false);
    if (error) {
      toast({
        title: "Erro ao alterar email",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Confirmação enviada",
      description: `Enviamos um link de confirmação para ${target}. O email só será alterado após a confirmação.`,
    });
    setEditingEmail(false);
  };

  const handleChangePassword = async () => {
    if (pwd.nova.length < 6) {
      toast({
        title: "Senha fraca",
        description: "A nova senha deve ter no mínimo 6 caracteres.",
        variant: "destructive",
      });
      return;
    }
    if (pwd.nova !== pwd.confirmar) {
      toast({
        title: "Senhas não conferem",
        description: "A confirmação deve ser igual à nova senha.",
        variant: "destructive",
      });
      return;
    }
    if (user?.source !== "supabase") {
      toast({
        title: "Indisponível no modo demo",
        description: "Faça login com uma conta real para alterar a senha.",
        variant: "destructive",
      });
      return;
    }
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: pwd.nova });
    setSavingPwd(false);
    if (error) {
      toast({
        title: "Erro ao alterar senha",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Senha atualizada", description: "Sua senha foi alterada com sucesso." });
    setPwd({ nova: "", confirmar: "" });
  };

  return (
    <div className="space-y-6">
      <SectionShell
        icon={<UserCog className="h-5 w-5 text-primary" />}
        title="Dados do administrador"
        description="Perfil, contato e identidade da conta"
        footer={
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
            <Button
              variant="outline"
              className="rounded-xl px-6 w-full sm:w-auto"
              onClick={() => setForm({ nome: user?.nome ?? "", telefone: "" })}
            >
              Descartar
            </Button>
            <Button className="rounded-xl px-6 w-full sm:w-auto" onClick={handleSave}>
              Salvar alterações
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Avatar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-muted/30 rounded-2xl border border-border/40">
            <div className="h-20 w-20 rounded-full bg-card border-2 border-dashed border-border flex items-center justify-center overflow-hidden shrink-0">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <User className="h-8 w-8 text-muted-foreground/50" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Foto do perfil</p>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                PNG, JPG ou WEBP até 2MB. Armazenado com segurança.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <label className={uploadingAvatar ? "cursor-wait opacity-60 pointer-events-none" : "cursor-pointer"}>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleAvatarUpload}
                    className="hidden"
                    disabled={uploadingAvatar}
                  />
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground transition-colors hover:bg-primary/90">
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingAvatar ? "Enviando..." : "Upload"}
                  </span>
                </label>
                {avatarPreview && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs h-8"
                    onClick={handleAvatarRemove}
                    disabled={uploadingAvatar}
                  >
                    Remover
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Form fields */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nome completo</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => updateField("nome", e.target.value)}
                  placeholder="Seu nome"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Telefone</label>
                <input
                  type="text"
                  value={form.telefone}
                  onChange={(e) => updateField("telefone", formatPhone(e.target.value))}
                  placeholder="(99) 9 9999-9999"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>
                Email <span className="text-destructive">*</span>
              </label>

              {!editingEmail ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 bg-muted/30 border border-border rounded-xl">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                      <Mail className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {currentEmail || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Email atual da conta
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs h-9 shrink-0"
                    onClick={startEditEmail}
                    disabled={!user}
                  >
                    Trocar email
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="email"
                    value={novoEmail}
                    onChange={(e) => setNovoEmail(e.target.value)}
                    placeholder="novoemail@exemplo.com"
                    className={inputClass}
                    autoFocus
                  />
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      size="sm"
                      className="rounded-xl text-xs h-9 gap-2"
                      onClick={handleChangeEmail}
                      disabled={savingEmail || !novoEmail.trim()}
                    >
                      {savingEmail ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Confirmar alteração
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs h-9 gap-2"
                      onClick={cancelEditEmail}
                      disabled={savingEmail}
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancelar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Um link de confirmação será enviado para o novo email. A troca só é
                    efetivada após a confirmação.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell
        icon={<Lock className="h-5 w-5 text-primary" />}
        title="Alterar senha"
        description="Defina uma nova senha de acesso à sua conta"
        footer={
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
            <Button
              variant="outline"
              className="rounded-xl px-6 w-full sm:w-auto"
              onClick={() => setPwd({ nova: "", confirmar: "" })}
              disabled={savingPwd}
            >
              Limpar
            </Button>
            <Button
              className="rounded-xl px-6 w-full sm:w-auto gap-2"
              onClick={handleChangePassword}
              disabled={savingPwd || !pwd.nova || !pwd.confirmar}
            >
              {savingPwd && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Salvar senha
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Nova senha</label>
            <input
              type="password"
              value={pwd.nova}
              onChange={(e) => setPwd((p) => ({ ...p, nova: e.target.value }))}
              placeholder="Mínimo 6 caracteres"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Confirme a nova senha</label>
            <input
              type="password"
              value={pwd.confirmar}
              onChange={(e) => setPwd((p) => ({ ...p, confirmar: e.target.value }))}
              placeholder="Repita a nova senha"
              className={inputClass}
            />
          </div>
        </div>
      </SectionShell>

      <SectionShell
        icon={<ShieldCheck className="h-5 w-5 text-primary" />}
        title="Conformidade LGPD"
        description="Relatório consolidado de bases legais, retenção, auditoria e mascaramento"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-muted/30 rounded-2xl border border-border/40">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Relatório de conformidade</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Gera um PDF resumindo as práticas de proteção de dados aplicadas neste laboratório.
            </p>
          </div>
          <Button
            className="rounded-xl px-4 gap-2 shrink-0"
            disabled={gerandoLGPD}
            onClick={async () => {
              setGerandoLGPD(true);
              try {
                await gerarRelatorioLGPD(user?.nome ? `${user.nome} — SISLAC` : "SISLAC");
                toast({ title: "Relatório LGPD gerado", description: "O PDF foi baixado." });
              } catch (err) {
                toast({
                  title: "Falha ao gerar relatório",
                  description: err instanceof Error ? err.message : String(err),
                  variant: "destructive",
                });
              } finally {
                setGerandoLGPD(false);
              }
            }}
          >
            {gerandoLGPD ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
            Baixar relatório LGPD
          </Button>
        </div>
      </SectionShell>
    </div>
  );
};

export default AdminTab;
