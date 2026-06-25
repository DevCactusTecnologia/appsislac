// ════════════════════════════════════════════════════════════════════════
// Login V2 — Gateway multi-database
//
// Fluxo em 2 etapas:
//   1) Identificar o laboratório (slug ou e-mail) → tenant-resolve
//   2) Senha (com branding aplicado do tenant resolvido)
//
//
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Database,
  Phone,
  HelpCircle,
  CheckCircle2,
  FlaskConical,
  Sparkles,
  Activity,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

type ResolvedTenant = {
  id: string;
  nome: string;
  slug: string;
  status: string;
  lab_code: string | null;
  logo_url: string | null;
  tema: string;
  runtime_mode: "shared_db" | "isolated_db";
};

// Mapeamento tema → HSL primary (espelha tokens do design system).
// Default = indigo institucional do SISLAC (#4D41F3) — mesma paleta do login clássico.
const TEMA_HSL: Record<string, string> = {
  indigo: "243 88% 60%",
  emerald: "160 70% 40%",
  rose: "346 80% 56%",
  ocean: "200 85% 45%",
  amber: "38 92% 50%",
  violet: "270 75% 60%",
};
const DEFAULT_PRIMARY = "243 88% 60%"; // indigo SISLAC

const LAST_CODIGO_KEY = "sislac:last-lab-code";

export default function LoginV2() {
  const navigate = useNavigate();
  const { signInWithPassword, isAuthenticated, user, loading: authLoading } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [codigo, setCodigo] = useState(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem(LAST_CODIGO_KEY) ?? ""; } catch { return ""; }
  });
  const [email, setEmail] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [tenant, setTenant] = useState<ResolvedTenant | null>(null);
  const [senha, setSenha] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const isMobile = useIsMobile();



  // Redireciona se já autenticado.
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(user?.isSuperAdmin ? "/super-admin" : "/dashboard", { replace: true });
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  // Cor primária fixa do SISLAC — não muda conforme o tenant resolvido,
  // mantendo a mesma identidade visual antes e depois da transição.
  const primaryHsl = DEFAULT_PRIMARY;
  void TEMA_HSL;

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    const raw = codigo.trim().toUpperCase();
    // Aceita lab_code humano (LAB001, SJMED) OU código numérico legado (1234)
    const isLabCode = /^[A-Z0-9]{3,12}$/.test(raw);
    if (!isLabCode) {
      toast.error("Informe o código do laboratório (3 a 12 caracteres, ex.: LAB905).");
      return;
    }
    setResolving(true);
    try {
      let res: { ok?: boolean; tenant?: ResolvedTenant; error?: string } | null = null;
      try {
        const { data } = await supabase.functions.invoke("tenant-resolve", {
          body: { identifier: raw },
        });
        res = (data ?? null) as typeof res;
      } catch (err: unknown) {
        // supabase-js lança FunctionsHttpError em respostas não-2xx;
        // tenta extrair o corpo JSON do erro.
        const ctx = (err as { context?: Response })?.context;
        if (ctx && typeof ctx.json === "function") {
          try { res = await ctx.json(); } catch { /* noop */ }
        }
      }
      if (!res?.ok || !res.tenant) {
        const msg =
          res?.error === "tenant_inactive"
            ? "Este laboratório está suspenso. Fale com o suporte."
            : res?.error === "not_found"
              ? "Código não encontrado. Verifique o código do laboratório."
              : "Não foi possível identificar o laboratório.";
        toast.error(msg);
        return;
      }
      setTenant(res.tenant);
      try { localStorage.setItem(LAST_CODIGO_KEY, raw); } catch { /* noop */ }
      setStep(2);
    } finally {
      setResolving(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    const mail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    if (senha.length < 6) {
      toast.error("Senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setSigningIn(true);
    const { ok, error } = await signInWithPassword(mail, senha);
    setSigningIn(false);
    if (!ok) {
      toast.error(error ?? "E-mail ou senha inválidos.");
      return;
    }
    toast.success(`Bem-vindo a ${tenant.nome}!`);
    navigate("/dashboard", { replace: true });
  }

  function handleBack() {
    setStep(1);
    setSenha("");
  }

  

  const renderCardFooter = () => (
    <>
      <div className="mt-8 space-y-1.5 text-center">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
        >
          <HelpCircle className="h-4 w-4" />
          Ainda com dúvida?
        </button>
        <p className="text-xs text-muted-foreground">Contate suporte por telefone</p>
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
          <Phone className="h-3.5 w-3.5" />
          (83) 9 9672-9999
        </p>
      </div>

      <div className="mt-6 border-t border-border/60 pt-5 text-center">
        <p className="text-sm text-muted-foreground">
          Ainda não tem uma conta?{" "}
          <Link
            to="/inscricao"
            className="font-semibold text-primary hover:text-primary/80 hover:underline"
          >
            Criar conta
          </Link>
        </p>
      </div>
    </>
  );

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-background"
      style={{ ["--primary" as string]: primaryHsl }}
    >
      {/* Fundo limpo: linha sutil de grid + halo discreto da cor primária.
          Sem imagens, sem carrossel — foco total no conteúdo. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(var(--border) / 0.35) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.35) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 40%, black 40%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 40%, black 40%, transparent 100%)",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 right-[-10%] h-[420px] w-[420px] rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="absolute -bottom-40 left-[-10%] h-[420px] w-[420px] rounded-full bg-primary/[0.05] blur-3xl" />
      </div>


      <div className="relative mx-auto grid min-h-screen w-full max-w-[1400px] lg:grid-cols-[1.1fr_minmax(0,520px)]">
        {/* ───────── Lado esquerdo: hero/branding ───────── */}
        <section className="relative hidden flex-col justify-between p-10 xl:p-16 lg:flex">
          <Link to="/" className="group inline-flex items-center gap-3 self-start">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/25 transition-transform group-hover:scale-105">
              <FlaskConical className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-60" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-secondary" />
              </span>
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-foreground">SISLAC</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Sistema laboratorial
              </p>
            </div>
          </Link>

          <div className="max-w-xl space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-[11px] font-medium text-muted-foreground backdrop-blur-sm">
              <Sparkles className="h-3 w-3 text-primary" />
              Seu laboratório no controle, do atendimento ao laudo
            </div>

            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-foreground xl:text-5xl">
              Bem-vindo de volta ao{" "}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                SISLAC
              </span>
              .
            </h1>

            <p className="text-base leading-7 text-muted-foreground">
              Da recepção à liberação do laudo — gerencie atendimentos, amostras, resultados e financeiro do
              seu laboratório em um único lugar.
            </p>

            <ul className="space-y-3.5">
              {[
                { icon: Activity, label: "Laudos liberados em minutos, não em dias" },
                { icon: CheckCircle2, label: "Reduz retrabalho, recoletas e perda de receita" },
                { icon: ShieldCheck, label: "Rastreabilidade ponta a ponta, do paciente ao laudo" },
              ].map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-sm text-foreground/80">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-card/80 ring-1 ring-border/60 backdrop-blur-sm">
                    <Icon className="h-4 w-4 text-primary" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <p>© 2026 SISLAC. Todos os direitos reservados.</p>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary" />
              <span>Sistema operacional</span>
            </div>
          </div>
        </section>

        {/* ───────── Lado direito: card de autenticação ───────── */}
        <section className="relative flex items-center justify-center px-5 py-10 sm:px-8 lg:px-10">
          <div className="w-full max-w-md">
            {/* Logo mobile */}
            <Link to="/" className="mb-8 inline-flex items-center gap-3 lg:hidden">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md shadow-primary/25">
                <FlaskConical className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
              </div>
              <div>
                <p className="text-lg font-bold tracking-tight text-foreground">SISLAC</p>
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Sistema laboratorial
                </p>
              </div>
            </Link>

            <div>
              <motion.div
                initial={false}
                className="grid"
                style={
                  isMobile
                    ? undefined
                    : { perspective: "1600px" }
                }
              >
                {/* Inner flip container — só ativa em tablet/desktop */}
                <div
                  className="col-start-1 row-start-1 grid"
                  style={
                    isMobile
                      ? undefined
                      : {
                          transformStyle: "preserve-3d",
                          transition: "transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)",
                          transform: step === 2 ? "rotateY(180deg)" : "rotateY(0deg)",
                        }
                  }
                >
                {(isMobile ? step === 1 : true) && (
                <motion.div
                  initial={isMobile ? { opacity: 0 } : false}
                  animate={isMobile ? { opacity: 1 } : undefined}
                  transition={{ duration: 0.25 }}
                  className="col-start-1 row-start-1 rounded-3xl border border-border/60 bg-card/80 p-7 shadow-2xl shadow-foreground/5 backdrop-blur-xl sm:p-9"
                  style={isMobile ? undefined : { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
                >
                  <div>
                    <div className="mb-7 space-y-1.5">
                      <h2 className="text-2xl font-bold tracking-tight text-foreground">
                        Acesse sua conta
                      </h2>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Informe o código do seu laboratório para continuar.
                      </p>
                    </div>

                    <form onSubmit={handleResolve} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">Código do laboratório</label>
                        <div className="group relative">
                          <Building2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                          <span className="pointer-events-none absolute left-9 top-1/2 -translate-y-1/2 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            LAB
                          </span>
                          <input
                            type="text"
                            inputMode="text"
                            autoCapitalize="characters"
                            maxLength={9}
                            value={codigo.replace(/^LAB/, "")}
                            onChange={(e) => {
                              const raw = e.target.value
                                .toUpperCase()
                                .replace(/[^A-Z0-9]/g, "")
                                .replace(/^LAB/, "")
                                .slice(0, 9);
                              setCodigo("LAB" + raw);
                            }}
                            placeholder="0001"
                            autoComplete="off"
                            autoFocus
                            className="h-11 w-full rounded-2xl border border-input bg-background pl-[4.75rem] pr-4 text-sm font-semibold tracking-[0.18em] uppercase text-foreground outline-none transition-all placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/10"
                          />
                        </div>
                        <div className="flex items-center justify-between pl-1 text-[11px] text-muted-foreground">
                          <span>Apenas números (ex.: 0001, 0999)</span>
                          <button
                            type="button"
                            onClick={() => setShowHelp((v) => !v)}
                            className="inline-flex items-center gap-1 font-medium text-primary transition-colors hover:text-primary/80"
                          >
                            <HelpCircle className="h-3 w-3" />
                            Onde encontro?
                          </button>
                        </div>
                        <AnimatePresence>
                          {showHelp && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-[12px] leading-relaxed text-foreground/80">
                                O <strong>código do laboratório</strong> é o identificador
                                operacional do seu laboratório no SISLAC (por exemplo,{" "}
                                <span className="font-mono font-semibold">LAB905</span> ou{" "}
                                <span className="font-mono font-semibold">SJMED</span>). Ele é
                                enviado por e-mail no momento da contratação. Não tem o código?{" "}
                                <span className="font-medium text-primary">Ligue (83) 9 9672-9999</span>.
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <button
                        type="submit"
                        disabled={resolving || codigo.length < 3}
                        className="group relative mt-2 flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-primary/85 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                      >
                        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                        {resolving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            Continuar
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                  {renderCardFooter()}
                </motion.div>
                )}

                {(isMobile ? step === 2 : true) && (
                <motion.div
                  initial={isMobile ? { opacity: 0 } : false}
                  animate={isMobile ? { opacity: 1 } : undefined}
                  transition={{ duration: 0.25 }}
                  className="col-start-1 row-start-1 rounded-3xl border border-border/60 bg-card/80 p-7 shadow-2xl shadow-foreground/5 backdrop-blur-xl sm:p-9"
                  style={
                    isMobile
                      ? undefined
                      : {
                          backfaceVisibility: "hidden",
                          WebkitBackfaceVisibility: "hidden",
                          transform: "rotateY(180deg)",
                        }
                  }
                >
                  {tenant?.logo_url && (
                    <div className="mb-6 flex items-center justify-center">
                      <img
                        src={tenant.logo_url}
                        alt={tenant.nome}
                        className="h-10 object-contain"
                      />
                    </div>
                  )}

                  {tenant && (
                    <div>
                      <div className="mb-5 space-y-1.5">
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">
                          Acesse sua conta
                        </h2>
                        <p className="text-sm leading-6 text-muted-foreground">
                          Entre com seu e-mail e senha para acessar sua conta.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleBack}
                        className="mb-5 inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        <span className="font-medium">
                          Laboratório: <span className="text-foreground">{codigo}</span>
                        </span>
                        {tenant.runtime_mode === "isolated_db" ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                            <Database className="h-2.5 w-2.5" />
                            Banco dedicado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                            <ShieldCheck className="h-2.5 w-2.5" />
                            Plataforma
                          </span>
                        )}
                      </button>

                      <form onSubmit={handleSignIn} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-foreground">E-mail</label>
                          <div className="group relative">
                            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                            <input
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="seu@email.com"
                              autoComplete="email"
                              required
                              autoFocus
                              className="h-11 w-full rounded-2xl border border-input bg-background pl-10 pr-4 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/10"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-foreground">Senha</label>
                            <Link
                              to="/reset-password"
                              className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
                            >
                              Esqueceu?
                            </Link>
                          </div>
                          <div className="group relative">
                            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                            <input
                              type={showPwd ? "text" : "password"}
                              value={senha}
                              onChange={(e) => setSenha(e.target.value)}
                              placeholder="••••••••"
                              autoComplete="current-password"
                              required
                              minLength={6}
                              className="h-11 w-full rounded-2xl border border-input bg-background pl-10 pr-11 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPwd((v) => !v)}
                              tabIndex={-1}
                              aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                              className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={signingIn || senha.length < 6}
                          className="group relative mt-2 flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-primary/85 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                        >
                          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                          {signingIn ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              Entrar
                              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  )}

                  {renderCardFooter()}
                </motion.div>
                )}
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}