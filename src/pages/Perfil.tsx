import { PageHeader } from "@/components/shared/PageHeader";
import { useState, useEffect } from "react";
import { Mail, Lock, Loader2, Check, X, Phone, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AssinaturaSection from "@/components/usuarios/AssinaturaSection";

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const inputClass =
  "w-full px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all";
const labelClass =
  "text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block";

/**
 * Página de perfil do usuário (Equipe 2.1 Fase 2.7).
 * Permite ao próprio usuário editar: nome, telefone, email, senha e
 * assinatura no laudo (carimbo eletrônico ou imagem digitalizada).
 *
 * RLS + trigger profiles_guard_self_update bloqueiam alterações em
 * perfil/permissões/unidades/status/tenant — só admin altera essas.
 */
export default function Perfil() {
  const { user } = useAuth();
  const currentEmail = user?.email ?? "";
  const userId = (user?.id as string | undefined) ?? "";

  const [nome, setNome] = useState(user?.nome ?? "");
  const [telefone, setTelefone] = useState("");
  const [savingNome, setSavingNome] = useState(false);
  const [savingTelefone, setSavingTelefone] = useState(false);

  const [editingEmail, setEditingEmail] = useState(false);
  const [novoEmail, setNovoEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [pwd, setPwd] = useState({ nova: "", confirmar: "" });
  const [savingPwd, setSavingPwd] = useState(false);

  // Assinatura
  const [assinaturaTipo, setAssinaturaTipo] = useState<"carimbo" | "imagem">("carimbo");
  const [assinaturaConselho, setAssinaturaConselho] = useState("");
  const [assinaturaImagemKey, setAssinaturaImagemKey] = useState<string | null>(null);
  const [savingAssinatura, setSavingAssinatura] = useState(false);
  const [loadedAssinatura, setLoadedAssinatura] = useState(false);

  useEffect(() => {
    setNome(user?.nome ?? "");
  }, [user?.nome]);

  // Carrega telefone + assinatura do profile
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("telefone, assinatura_tipo, assinatura_imagem_key, assinatura_conselho")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled || !data) return;
      const p = data as {
        telefone: string | null;
        assinatura_tipo: string | null;
        assinatura_imagem_key: string | null;
        assinatura_conselho: string | null;
      };
      setTelefone(p.telefone ?? "");
      setAssinaturaTipo(p.assinatura_tipo === "imagem" ? "imagem" : "carimbo");
      setAssinaturaImagemKey(p.assinatura_imagem_key);
      setAssinaturaConselho(p.assinatura_conselho ?? "");
      setLoadedAssinatura(true);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const requireRealUser = (): boolean => {
    if (user?.source !== "supabase" || !userId) {
      toast({
        title: "Indisponível no modo demo",
        description: "Faça login com uma conta real para alterar este dado.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleSaveNome = async () => {
    if (!nome.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    if (!requireRealUser()) return;
    setSavingNome(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nome: nome.trim() })
      .eq("user_id", userId);
    setSavingNome(false);
    if (error) {
      toast({ title: "Erro ao salvar nome", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Nome atualizado" });
  };

  const handleSaveTelefone = async () => {
    if (!requireRealUser()) return;
    setSavingTelefone(true);
    const { error } = await supabase
      .from("profiles")
      .update({ telefone: telefone.trim() || null })
      .eq("user_id", userId);
    setSavingTelefone(false);
    if (error) {
      toast({ title: "Erro ao salvar telefone", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Telefone atualizado" });
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
    if (!requireRealUser()) return;
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
    if (!requireRealUser()) return;
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

  const handleSaveAssinatura = async () => {
    if (!requireRealUser()) return;
    setSavingAssinatura(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        assinatura_tipo: assinaturaTipo,
        assinatura_conselho: assinaturaConselho.trim() || null,
        assinatura_imagem_key: assinaturaImagemKey,
      })
      .eq("user_id", userId);
    setSavingAssinatura(false);
    if (error) {
      toast({ title: "Erro ao salvar assinatura", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Assinatura atualizada" });
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
            <div className="flex justify-end mt-2">
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

          <div>
            <label className={labelClass}><Phone className="inline h-3 w-3 mr-1" />Telefone</label>
            <input
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className={inputClass}
              placeholder="(00) 00000-0000"
            />
            <div className="flex justify-end mt-2">
              <Button
                onClick={handleSaveTelefone}
                disabled={savingTelefone}
                variant="outline"
                className="rounded-lg px-6"
              >
                {savingTelefone ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Salvar telefone
              </Button>
            </div>
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

      {/* Assinatura no laudo */}
      {userId && loadedAssinatura && (
        <section className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <PenLine className="h-4 w-4 text-muted-foreground" /> Assinatura no laudo
          </h2>
          <AssinaturaSection
            userId={userId}
            tipo={assinaturaTipo}
            conselho={assinaturaConselho}
            imagemKey={assinaturaImagemKey}
            nome={nome}
            onChangeTipo={setAssinaturaTipo}
            onChangeConselho={setAssinaturaConselho}
            onImagemChange={setAssinaturaImagemKey}
          />
          <div className="flex justify-end mt-4">
            <Button
              onClick={handleSaveAssinatura}
              disabled={savingAssinatura}
              className="rounded-lg px-6"
            >
              {savingAssinatura ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Salvar assinatura
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
