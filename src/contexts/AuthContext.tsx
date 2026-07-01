// AuthContext
// Fonte única de autenticação operacional: 100% Supabase Auth real.
import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import {
  db as supabase,
  clearTenantContextCache,
  refreshContext,
  resetRuntime,
} from "@/runtime/db";
import type { Session } from "@supabase/supabase-js";
import { showError } from "@/lib/showError";
import { withTtlCache } from "@/lib/ttlCache";

export type Perfil = "admin" | "analista" | "recepcionista" | "financeiro";

export interface UserProfile {
  id: number | string;
  nome: string;
  email: string;
  perfil: Perfil;
  permissoes: string[];
  avatar?: string;
  /** Chave S3 do avatar quando armazenado em S3 (preferida sobre avatar base64). */
  avatarKey?: string;
  unidadeIds: string[];
  unidadeAtiva: string;
  source: "supabase";
  isSuperAdmin?: boolean;
  tenantId?: string;
}

export type LoginErrorDetail = {
  /** Machine code returned by the backend (e.g. dedicated_anon_secret_missing). */
  code: string;
  /** Short human title shown as the alert heading. */
  title: string;
  /** Friendly explanation for the operator, safe to show without technical jargon. */
  message: string;
  /** Optional next-step guidance (what the operator or super-admin should do). */
  hint?: string;
  /** Raw backend message — surfaced only in the collapsible "technical details" section. */
  raw?: string;
  /** UI variant. `config` = platform/tenant config issue, `infra` = transient, `auth` = credential. */
  severity: "config" | "infra" | "auth";
};

type LoginResult = { ok: boolean; error?: string; errorDetail?: LoginErrorDetail };

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, senha: string, options?: LoginOptions) => Promise<LoginResult>;
  signInWithPassword: (email: string, senha: string, options?: LoginOptions) => Promise<LoginResult>;
  signUpWithPassword: (
    email: string,
    senha: string,
    nome?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasPermission: (permissao: string) => boolean;
  hasAnyPermission: (permissoes: string[]) => boolean;
  switchUnidade: (unidadeId: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface LoginOptions {
  /** Tenant selecionado na etapa 1 do Login V2. Impede login cruzado entre laboratórios. */
  expectedTenantId?: string;
}

// Defaults espelham public.has_permission no banco e DEFAULTS_POR_PERFIL em usuariosStore.
// IMPORTANTE: chaves devem ser as permissões finas (ex: "visualizar_atendimentos"),
// pois é isso que `hasPermission()` consulta tanto no menu (PERMISSION_BY_PATH) quanto no backend.
const DEFAULT_PERMS_BY_PERFIL: Record<Perfil, string[]> = {
  admin: ["*"],
  analista: [
    "visualizar_dashboard", "visualizar_pacientes", "visualizar_atendimentos",
    "analisar_amostra", "liberar_resultado", "imprimir_laudo", "registrar_coleta",
    "consultar_resultados", "lab_apoio_acesso", "mapa_trabalho_acesso",
  ],
  recepcionista: [
    "visualizar_dashboard", "cadastrar_paciente", "editar_paciente", "visualizar_pacientes",
    "criar_atendimento", "editar_atendimento", "visualizar_atendimentos",
    "registrar_coleta", "registrar_pagamento", "criar_orcamento", "visualizar_orcamentos",
    "consultar_resultados", "solicitacoes_site_acesso",
  ],
  financeiro: [
    "visualizar_dashboard", "visualizar_pacientes", "visualizar_atendimentos",
    "gestao_financeira", "registrar_pagamento", "visualizar_financeiro",
    "criar_orcamento", "visualizar_orcamentos",
    "consultar_resultados", "relatorios_producao",
  ],
};

interface DbProfile {
  user_id: string;
  nome: string;
  email: string;
  avatar: string | null;
  avatar_key: string | null;
  perfil: Perfil;
  unidade_ids: string[];
  unidade_ativa: string;
  permissoes_extras: string[];
  permissoes_revogadas: string[];
  tenant_id: string;
}

// Limpeza defensiva: remove qualquer token mock antigo que ainda esteja no
// localStorage de usuários que utilizaram versões anteriores do sistema.
if (typeof window !== "undefined") {
  try { localStorage.removeItem("sislac_auth_user"); } catch { /* noop */ }
}

/**
 * Validar se um tenant está ativo
 * 
 * FALHA SEGURA: Se não conseguir validar, NEGA acesso (não permite)
 * NUNCA: Deixar passar por erro de rede ou falta de validação
 */
async function _isTenantActiveImpl(tenantId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("tenants" as never)
      .select("status")
      .eq("id", tenantId)
      .maybeSingle();

    if (error) {
      console.error("❌ [Auth] Erro ao validar tenant", { tenantId, error });
      return false;
    }

    const status = (data as { status?: string } | null)?.status;
    if (!status) {
      console.warn("⚠️  [Auth] Tenant não encontrado no banco", tenantId);
      return false;
    }

    const isActive = status === "ativo";
    if (!isActive) {
      console.warn("⚠️  [Auth] Tenant inativo", { tenantId, status });
    }
    return isActive;
  } catch (error) {
    console.error("❌ [Auth] Erro inesperado ao validar tenant", { tenantId, error });
    return false;
  }
}

// TTL de 60s: status do tenant raramente muda. Realtime de profiles/user_roles
// dispara `isTenantActive` repetidas vezes — sem cache, eram dezenas de hits/min.
const _isTenantActiveCached = withTtlCache(
  _isTenantActiveImpl,
  (tid: string) => tid,
  { ttlMs: 60_000 },
);

async function isTenantActive(tenantId: string | null | undefined): Promise<boolean> {
  if (!tenantId) {
    console.error("❌ [Auth] Tenant ID ausente - acesso bloqueado");
    return false;
  }
  return _isTenantActiveCached(tenantId);
}

async function hydrateFromSupabase(session: Session): Promise<UserProfile | null> {
  return _hydrateDedup(session);
}

async function rebuildRuntimeContext(): Promise<void> {
  clearTenantContextCache();
  await resetRuntime();
  await refreshContext();
}

async function validateDedicatedLoginGate(): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke("tenant-dedicated-login-gate", { body: {} });
    if (error) return error.message || "Falha ao validar o banco dedicado.";
    const resp = data as { ok?: boolean; error?: string; message?: string } | null;
    if (resp?.ok === false) return resp.error || resp.message || "Banco dedicado ainda não está pronto para login.";
  } catch (e) {
    return e instanceof Error ? e.message : "Falha ao validar o banco dedicado.";
  }
  return null;
}

async function validateDedicatedRuntimeReachable(): Promise<string | null> {
  const ctx = await refreshContext();
  if (ctx.strategy !== "dedicated") return null;

  const { error } = await supabase
    .from("pacientes" as never)
    .select("id")
    .limit(1);

  if (!error) return null;
  return `Banco dedicado configurado, mas ainda não está acessível para o runtime (${error.message}).`;
}

// Dedup: se duas chamadas chegarem em <250ms para o mesmo usuário, reusa a
// promise em voo. Evita N execuções paralelas em rajadas de realtime/auth.
const _hydrateInflight = new Map<string, Promise<UserProfile | null>>();
function _hydrateDedup(session: Session): Promise<UserProfile | null> {
  const uid = session.user.id;
  const existing = _hydrateInflight.get(uid);
  if (existing) return existing;
  const p = _hydrateImpl(session).finally(() => {
    // Mantém na janela curta para coalescer eventos próximos.
    setTimeout(() => { _hydrateInflight.delete(uid); }, 250);
  });
  _hydrateInflight.set(uid, p);
  return p;
}

async function _hydrateImpl(session: Session): Promise<UserProfile | null> {
  const userId = session.user.id;
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles" as never).select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("user_roles" as never).select("role").eq("user_id", userId),
  ]);

  const rolesList = Array.isArray(roles) ? (roles as { role: string }[]).map((r) => r.role) : [];
  const isSuperAdminEarly = rolesList.includes("super_admin");

  // Super admin é entidade de plataforma — pode existir sem linha em `profiles`
  // (não pertence a nenhum tenant). Hidratamos um perfil mínimo nesse caso.
  if (!profile) {
    if (!isSuperAdminEarly) return null;
    return {
      id: userId,
      nome: session.user.email?.split("@")[0] || "Super Admin",
      email: session.user.email || "",
      perfil: "admin",
      permissoes: ["*"],
      unidadeIds: ["und-001"],
      unidadeAtiva: "und-001",
      source: "supabase",
      isSuperAdmin: true,
      tenantId: undefined,
    };
  }
  const p = profile as unknown as DbProfile;

  const base = new Set<string>(DEFAULT_PERMS_BY_PERFIL[p.perfil] ?? []);
  for (const e of p.permissoes_extras ?? []) base.add(e);
  for (const r of p.permissoes_revogadas ?? []) base.delete(r);
  const isAdminByRole = rolesList.includes("admin");
  const isSuperAdmin = rolesList.includes("super_admin");
  if (isAdminByRole || isSuperAdmin) base.add("*");

  // Resolve avatar: preferimos avatar_key (S3) → URL assinada; fallback para base64 legado.
  let avatarUrl: string | undefined = p.avatar ?? undefined;
  if (p.avatar_key) {
    try {
      const { data } = await supabase.functions.invoke("image-url", { body: { key: p.avatar_key } });
      const r = data as { ok?: boolean; url?: string };
      if (r?.url) avatarUrl = r.url;
    } catch { /* mantém fallback */ }
  }

  return {
    id: userId,
    nome: p.nome || session.user.email?.split("@")[0] || "Usuário",
    email: p.email || session.user.email || "",
    perfil: isAdminByRole || isSuperAdmin ? "admin" : p.perfil,
    permissoes: Array.from(base),
    avatar: avatarUrl,
    avatarKey: p.avatar_key ?? undefined,
    unidadeIds: p.unidade_ids?.length ? p.unidade_ids : ["und-001"],
    unidadeAtiva: p.unidade_ativa || "und-001",
    source: "supabase",
    isSuperAdmin,
    tenantId: p.tenant_id,
  };
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let unsub: (() => void) | null = null;
    let profileChannel: ReturnType<typeof supabase.channel> | null = null;

    const subscribeProfileChanges = (userId: string, session: Session) => {
      // Limpa canal anterior se existir
      if (profileChannel) {
        try { supabase.removeChannel(profileChannel); } catch { /* noop */ }
        profileChannel = null;
      }
      profileChannel = supabase
        .channel(`profile-self:${userId}`, { config: { private: true } })
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${userId}` },
          async () => {
            if (!mountedRef.current) return;
            const hydrated = await hydrateFromSupabase(session);
            if (!mountedRef.current) return;
            // Se conta foi desativada remotamente, força logout.
            const { data: prof } = await supabase
              .from("profiles" as never)
              .select("status")
              .eq("user_id", userId)
              .maybeSingle();
            if ((prof as { status?: string } | null)?.status === "Inativo") {
              await supabase.auth.signOut();
              setUser(null);
              return;
            }
            // Se tenant foi suspenso, derruba a sessão imediatamente.
            if (hydrated?.tenantId && !hydrated.isSuperAdmin) {
              const active = await isTenantActive(hydrated.tenantId);
              if (!active) {
                await supabase.auth.signOut();
                setUser(null);
                return;
              }
            }
            setUser(hydrated);
          },
        )

        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${userId}` },
          async () => {
            if (!mountedRef.current) return;
            const hydrated = await hydrateFromSupabase(session);
            if (!mountedRef.current) return;
            setUser(hydrated);
          },
        )
        .subscribe();
    };

    const guardAndSet = async (session: Session, opts?: { refreshRuntime?: boolean }) => {
      const hydrated = await hydrateFromSupabase(session);
      if (!mountedRef.current) return;
      if (hydrated?.tenantId && !hydrated.isSuperAdmin) {
        const active = await isTenantActive(hydrated.tenantId);
        if (!active) {
          await supabase.auth.signOut();
          if (mountedRef.current) setUser(null);
          return;
        }
        const gateError = await validateDedicatedLoginGate();
        if (gateError) {
          await supabase.auth.signOut();
          if (mountedRef.current) setUser(null);
          showError(gateError, { scope: "AuthContext", userMessage: gateError });
          return;
        }
      }
      if (opts?.refreshRuntime && !hydrated?.isSuperAdmin) {
        await rebuildRuntimeContext();
      }
      if (mountedRef.current) setUser(hydrated);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return;
      if (session) {
        setTimeout(async () => {
          await guardAndSet(session, { refreshRuntime: event === "SIGNED_IN" || event === "INITIAL_SESSION" });
          subscribeProfileChanges(session.user.id, session);
        }, 0);
      } else {
        if (profileChannel) {
          try { supabase.removeChannel(profileChannel); } catch { /* noop */ }
          profileChannel = null;
        }
        setUser(null);
      }
    });
    unsub = () => sub.subscription.unsubscribe();

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mountedRef.current) return;
      if (session) {
        await guardAndSet(session, { refreshRuntime: true });
        if (mountedRef.current) {
          setLoading(false);
          subscribeProfileChanges(session.user.id, session);
        }
        return;
      }
      if (mountedRef.current) {
        setUser(null);
        setLoading(false);
      }
    })();


    return () => {
      mountedRef.current = false;
      unsub?.();
      if (profileChannel) {
        try { supabase.removeChannel(profileChannel); } catch { /* noop */ }
        profileChannel = null;
      }
    };
  }, []);

  const login = useCallback(
    async (
      email: string,
      senha: string,
      options?: LoginOptions,
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        // 1. Validar entrada
        if (!email || !senha) {
          return { ok: false, error: "Email e senha são obrigatórios" };
        }

        // 2. Tentar autenticar
        const { data: signInData, error: authError } =
          await supabase.auth.signInWithPassword({
            email,
            password: senha,
          });

        if (authError) {
          console.warn("⚠️  [Auth] Erro de autenticação", {
            email,
            message: authError.message,
          });

          // Diferenciar erros para mensagem melhor
          if (
            authError.message?.includes("Invalid login credentials") ||
            authError.message?.includes("credentials")
          ) {
            return { ok: false, error: "Email ou senha incorretos" };
          }

          return { ok: false, error: authError.message || "Erro ao fazer login" };
        }

        if (!signInData.user?.id) {
          console.error("❌ [Auth] User ID não retornado após login");
          return { ok: false, error: "Erro ao fazer login - tente novamente" };
        }

        const uid = signInData.user.id;

        // 3. Validar status do usuário
        const { data: prof, error: profileError } = await supabase
          .from("profiles" as never)
          .select("status, tenant_id")
          .eq("user_id", uid)
          .maybeSingle();

        if (profileError) {
          console.error("❌ [Auth] Erro ao carregar profile", {
            uid,
            error: profileError,
          });
          await supabase.auth.signOut();
          return { ok: false, error: "Erro ao validar sua conta" };
        }

        const profRow = prof as
          | { status?: string; tenant_id?: string }
          | null;

        if (options?.expectedTenantId && profRow?.tenant_id !== options.expectedTenantId) {
          console.warn("⚠️  [Auth] Login em tenant divergente bloqueado", {
            uid,
            expectedTenantId: options.expectedTenantId,
            profileTenantId: profRow?.tenant_id,
          });
          await supabase.auth.signOut();
          await rebuildRuntimeContext();
          return {
            ok: false,
            error: "Esta conta não pertence ao laboratório selecionado.",
          };
        }

        // 4. Validar se conta está ativa
        if (profRow?.status === "Inativo") {
          console.warn("⚠️  [Auth] Conta inativa", { uid });
          await supabase.auth.signOut();
          return {
            ok: false,
            error: "Sua conta foi desativada. Entre em contato com o administrador.",
          };
        }

        // 5. Validar se tenant está ativo
        if (profRow?.tenant_id) {
          const tenantActive = await isTenantActive(profRow.tenant_id);
          if (!tenantActive) {
            console.warn("⚠️  [Auth] Tenant inativo", {
              uid,
              tenantId: profRow.tenant_id,
            });
            await supabase.auth.signOut();
            return {
              ok: false,
              error: "Seu laboratório foi suspenso. Entre em contato com o suporte.",
            };
          }

          const gateError = await validateDedicatedLoginGate();
          if (gateError) {
            console.warn("⚠️  [Auth] Login bloqueado pelo gate dedicado", {
              uid,
              tenantId: profRow.tenant_id,
              gateError,
            });
            await supabase.auth.signOut();
            await rebuildRuntimeContext();
            return { ok: false, error: gateError };
          }
        }

        await rebuildRuntimeContext();
        const dedicatedError = await validateDedicatedRuntimeReachable();
        if (dedicatedError) {
          console.warn("⚠️  [Auth] Runtime dedicado inacessível", { uid, tenantId: profRow?.tenant_id, dedicatedError });
          await supabase.auth.signOut();
          await rebuildRuntimeContext();
          return { ok: false, error: dedicatedError };
        }

        return { ok: true };
      } catch (error) {
        console.error("❌ [Auth] Erro inesperado no login", error);
        return {
          ok: false,
          error: "Erro inesperado - tente novamente em alguns instantes",
        };
      }
    },
    []
  );

  // Equipe 2.1 Fase 2.8: `signInWithPassword` agora é alias de `login`.
  // Antes existiam duas funções gêmeas com lógica idêntica.
  const signInWithPassword = login;

  const signUpWithPassword = useCallback(
    async (
      email: string,
      senha: string,
      nome?: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      const { error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: nome ? { full_name: nome } : undefined,
        },
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
    [],
  );

  const logout = useCallback(async () => {
    // 1) Limpa TODOS os canais Realtime antes de qualquer outra coisa.
    //    Fail-safe: nunca bloqueia o logout — apenas loga.
    try {
      await supabase.removeAllChannels();
    } catch (e) {
      console.warn("[realtime] erro ao limpar canais no logout", e);
    }

    // 1.b) Limpa cache de feature flags do tenant (canary). Fail-safe.
    try {
      const { resetFeatureFlags } = await import("@/lib/featureFlags");
      resetFeatureFlags();
    } catch (e) {
      console.warn("[featureFlags] erro ao limpar flags no logout", e);
    }

    // 2) Encerra a sessão Supabase.
    await supabase.auth.signOut();

    // 2.b) Volta o roteamento para o bootstrap shared e limpa metadados do tenant.
    try {
      clearTenantContextCache();
      await resetRuntime();
    } catch (e) {
      console.warn("[runtime] erro ao resetar runtime no logout", e);
    }

    // 3) Limpa estado em memória.
    setUser(null);
  }, []);

  // Permissões: admin (perfil ou wildcard) tem tudo
  const hasPermission = useCallback(
    (permissao: string) => {
      if (!user) return false;
      if (user.perfil === "admin" || user.permissoes.includes("*")) return true;
      return user.permissoes.includes(permissao);
    },
    [user],
  );

  const hasAnyPermission = useCallback(
    (permissoes: string[]) => permissoes.some((p) => hasPermission(p)),
    [hasPermission],
  );

  const switchUnidade = useCallback(
    (unidadeId: string) => {
      setUser((prev) => {
        if (!prev || !prev.unidadeIds.includes(unidadeId)) return prev;
        const next = { ...prev, unidadeAtiva: unidadeId };
        // Persiste no banco se for usuário Supabase (best-effort)
        if (prev.source === "supabase" && typeof prev.id === "string") {
          (supabase as unknown as {
            from: (t: string) => {
              update: (v: Record<string, unknown>) => {
                eq: (c: string, v: string) => Promise<{ error: { message: string } | null }>;
              };
            };
          })
            .from("profiles")
            .update({ unidade_ativa: unidadeId })
            .eq("user_id", prev.id)
            .then(({ error }) => {
              if (error) {
                showError(error, { scope: "AuthContext.switchUnidade", silent: true });
              }
            });
        }
        return next;
      });
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        signInWithPassword,
        signUpWithPassword,
        logout,
        hasPermission,
        hasAnyPermission,
        switchUnidade,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
