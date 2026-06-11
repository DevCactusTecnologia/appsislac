// Tela de login exclusiva para o Super Admin do SaaS.
// Visual sóbrio e técnico, sem opção de cadastro nem login social — área restrita.
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield, Eye, EyeOff, ArrowRight, Mail, Lock, Loader2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const LAST_EMAIL_KEY = "sislac:last-superadmin-email";

const SuperAdminLogin = () => {
  const { signInWithPassword, isAuthenticated, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem(LAST_EMAIL_KEY) ?? ""; } catch { return ""; }
  });
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) return;
    // Se já está autenticado mas NÃO é super admin, força logout — esta área é exclusiva.
    if (!user?.isSuperAdmin) {
      void supabase.auth.signOut();
      toast.error("Esta área é exclusiva para administradores do SaaS.");
      return;
    }
    navigate("/super-admin", { replace: true });
  }, [authLoading, isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !senha.trim()) {
      toast.error("Preencha e-mail e senha.");
      return;
    }
    setLoading(true);
    const { ok, error } = await signInWithPassword(email.trim(), senha);
    if (!ok) {
      setLoading(false);
      toast.error(error ?? "E-mail ou senha inválidos.");
      return;
    }

    // Confirma role super_admin antes de prosseguir; caso contrário derruba a sessão.
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user.id;
    if (!uid) {
      setLoading(false);
      toast.error("Sessão inválida.");
      return;
    }
    const { data: roles } = await supabase
      .from("user_roles" as never)
      .select("role")
      .eq("user_id", uid);
    const isSuper = Array.isArray(roles) && (roles as { role: string }[]).some((r) => r.role === "super_admin");
    if (!isSuper) {
      await supabase.auth.signOut();
      setLoading(false);
      toast.error("Esta conta não tem permissão de Super Admin.");
      return;
    }

    try { localStorage.setItem(LAST_EMAIL_KEY, email.trim()); } catch { /* ignore */ }
    setLoading(false);
    toast.success("Acesso autorizado.");
    navigate("/super-admin", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-background">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">SISLAC · SaaS</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Acesso Super Admin</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Área restrita à administração da plataforma.</p>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
          <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" />
            <p>
              Acesso monitorado. Tentativas de login em contas sem permissão são registradas e a sessão é encerrada automaticamente.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                E-mail administrativo
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@empresa.com"
                  autoComplete="email"
                  required
                  className="h-11 w-full rounded-2xl border border-input bg-background pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  minLength={6}
                  className="h-11 w-full rounded-2xl border border-input bg-background pl-10 pr-11 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Entrar como Super Admin <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>
        </div>

        <div className="text-center text-xs text-muted-foreground">
          Usuário do laboratório?{" "}
          <Link to="/login" className="font-semibold text-primary transition-colors hover:text-primary/80">
            Entrar pela área operacional
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminLogin;