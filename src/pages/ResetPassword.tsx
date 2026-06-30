// Página pública de definição de nova senha após link de recovery enviado
// pelo Supabase Auth (resetPasswordForEmail). O Supabase processa o token
// no fragmento da URL automaticamente — aqui só precisamos chamar updateUser.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, Loader2, FlaskConical, CheckCircle2 } from "lucide-react";
import { db as supabase } from "@/runtime/db";
import { toast } from "sonner";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [novaSenha, setNovaSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasRecovery, setHasRecovery] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Quando o usuário chega via link, o supabase-js dispara PASSWORD_RECOVERY
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setHasRecovery(true);
    });
    // Verificação inicial (caso o evento já tenha sido disparado antes do listener)
    (async () => {
      const { data } = await supabase.auth.getSession();
      // Se há sessão ativa, presumimos que o link de recovery foi processado
      if (data.session) setHasRecovery(true);
      else if (hasRecovery === null) {
        // Aguarda 1.5s pelo evento; se nada vier, considera link inválido
        setTimeout(() => setHasRecovery((v) => v ?? false), 1500);
      }
    })();
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (novaSenha.length < 6) { toast.error("A senha deve ter pelo menos 6 caracteres."); return; }
    if (novaSenha !== confirma) { toast.error("As senhas não coincidem."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Senha redefinida com sucesso!");
    setDone(true);
    setTimeout(() => navigate("/login", { replace: true }), 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-5">
      <div className="w-full max-w-[420px] space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="p-3 rounded-2xl bg-primary text-primary-foreground">
            <FlaskConical className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Redefinir senha</h1>
            <p className="text-xs text-muted-foreground mt-1">SISLAC — Sistema Laboratorial</p>
          </div>
        </div>

        {hasRecovery === false ? (
          <div className="p-5 rounded-2xl border border-destructive/30 bg-destructive/5 text-sm text-foreground space-y-2">
            <p className="font-semibold">Link inválido ou expirado.</p>
            <p className="text-xs text-muted-foreground">Solicite um novo link de redefinição na tela de login.</p>
            <button
              onClick={() => navigate("/login", { replace: true })}
              className="mt-2 w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all"
            >
              Voltar para login
            </button>
          </div>
        ) : hasRecovery === null ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : done ? (
          <div className="p-5 rounded-2xl border border-[hsl(var(--status-success))]/30 bg-[hsl(var(--status-success))]/5 text-sm text-foreground flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-[hsl(var(--status-success))]" />
            <span>Senha redefinida! Redirecionando...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nova senha</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full h-11 pl-10 pr-11 bg-card border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Confirmar senha</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirma}
                  onChange={(e) => setConfirma(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full h-11 pl-10 pr-4 bg-card border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/10 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Redefinir senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
