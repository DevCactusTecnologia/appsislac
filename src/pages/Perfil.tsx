import { PageHeader } from "@/components/shared/PageHeader";
import { useState, useEffect } from "react";
import { UserCog, Mail, Lock, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const inputClass =
  "w-full px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all";
const labelClass =
  "text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block";

/**
 * Página de perfil do usuário.
 * Disponível para todos os perfis (admin, analista, recepcionista, financeiro)
 * — permite editar nome (display), email e senha sem dar acesso a /configuracoes.
 */
export default function Perfil() {
  const { user } = useAuth();
  const currentEmail = user?.email ?? "";

  const [nome, setNome] = useState(user?.nome ?? "");
  const [editingEmail, setEditingEmail] = useState(false);
  const [novoEmail, setNovoEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [pwd, setPwd] = useState({ nova: "", confirmar: "" });
  const [savingPwd, setSavingPwd] = useState(false);
  const [savingNome, setSavingNome] = useState(false);

  useEffect(() => {
    setNome(user?.nome ?? "");
  }, [user?.nome]);

  const handleSaveNome = async () => {
    if (!nome.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    if (user?.source !== "supabase") {
      toast({
        title: "Indisponível no modo demo",
        description: "Faça login com uma conta real para atualizar o nome.",
        variant: "destructive",
      });
      return;
    }
    setSavingNome(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nome: nome.trim() })
      .eq("id", user.id as string);
    setSavingNome(false);
    if (error) {
      toast({ title: "Erro ao salvar nome", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Nome atualizado" });
  };

  const handleChangeEmail = async () => {
    const target = novoEmail.trim().toLowerCase();
    if (!isValidEmail(target)) {
      toast({ title: "Email inválido", variant: "destructive" });
      return;
    }
    if (target === currentEmail.toLowerCase()) {
      toast({ title: "Nenhuma alteração" });
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
      toast({ title: "Erro ao alterar email", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Confirmação enviada",
      description: `Enviamos um link de confirmação para ${target}.`,
    });
    setEditingEmail(false);
    setNovoEmail("");
  };

  const handleChangePassword = async () => {
    if (pwd.nova.length < 6) {
      toast({ title: "Senha fraca", description: "Mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    if (pwd.nova !== pwd.confirmar) {
      toast({ title: "Senhas não conferem", variant: "destructive" });
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
      toast({ title: "Erro ao alterar senha", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Senha atualizada" });
    setPwd({ nova: "", confirmar: "" });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <PageHeader
        eyebrow="Conta"
        title="Meu perfil"
        description={`${user?.perfil ?? "Usuário"} · ${currentEmail}`}
      />

      {/* Dados pessoais */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Dados pessoais</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Nome completo</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={inputClass}
              placeholder="Seu nome"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleSaveNome}
              disabled={savingNome || nome.trim() === (user?.nome ?? "")}
              className="rounded-lg px-6"
            >
              {savingNome ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Salvar nome
            </Button>
          </div>
        </div>
      </section>

      {/* Email */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" /> Email de acesso
        </h2>
        {!editingEmail ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-foreground truncate">{currentEmail || "—"}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Alterações exigem confirmação por email.
              </p>
            </div>
            <Button
              variant="outline"
              className="rounded-lg shrink-0"
              onClick={() => {
                setNovoEmail(currentEmail);
                setEditingEmail(true);
              }}
            >
              Alterar
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Novo email</label>
              <input
                type="email"
                value={novoEmail}
                onChange={(e) => setNovoEmail(e.target.value)}
                className={inputClass}
                placeholder="seu@email.com"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-lg"
                onClick={() => {
                  setEditingEmail(false);
                  setNovoEmail("");
                }}
              >
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
              <Button onClick={handleChangeEmail} disabled={savingEmail} className="rounded-lg">
                {savingEmail ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Confirmar
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Senha */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" /> Senha
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nova senha</label>
              <input
                type="password"
                value={pwd.nova}
                onChange={(e) => setPwd((p) => ({ ...p, nova: e.target.value }))}
                className={inputClass}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className={labelClass}>Confirmar nova senha</label>
              <input
                type="password"
                value={pwd.confirmar}
                onChange={(e) => setPwd((p) => ({ ...p, confirmar: e.target.value }))}
                className={inputClass}
                placeholder="Repita a senha"
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleChangePassword}
              disabled={savingPwd || !pwd.nova || !pwd.confirmar}
              className="rounded-lg px-6"
            >
              {savingPwd ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Alterar senha
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}