// AuthContext
// Fonte única de autenticação operacional: 100% Supabase Auth real.
import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { showError } from "@/lib/showError";

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

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, senha: string) => Promise<{ ok: boolean; error?: string }>;
  signInWithPassword: (email: string, senha: string) => Promise<{ ok: boolean; error?: string }>;
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

async function isTenantActive(tenantId: string | null | undefined): Promise<boolean> {
  if (!tenantId) return true;
  try {
    const { data } = await supabase
      .from("tenants" as never)
      .select("status")
      .eq("id", tenantId)
      .maybeSingle();
    const status = (data as { status?: string } | null)?.status;
    // Sem registro acessível → não bloqueia (evita falso-positivo por RLS).
    if (!status) return true;
    return status === "ativo";
  } catch {
    return true;
  }
}

async function hydrateFromSupabase(session: Session): Promise<UserProfile | null> {
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

    const guardAndSet = async (session: Session) => {
      const hydrated = await hydrateFromSupabase(session);
      if (!mountedRef.current) return;
      if (hydrated?.tenantId && !hydrated.isSuperAdmin) {
        const active = await isTenantActive(hydrated.tenantId);
        if (!active) {
          await supabase.auth.signOut();
          if (mountedRef.current) setUser(null);
          return;
        }
      }
      if (mountedRef.current) setUser(hydrated);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;
      if (session) {
        setTimeout(async () => {
          await guardAndSet(session);
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
        await guardAndSet(session);
        if (mountedRef.current) {
          setLoading(false);
          subscribeProfileChanges(session.user.id, session);
        }
        return;
      }
      if (mountedRef.current) {
        setUser(readMockUser());
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

  const login = useCallback(async (email: string, senha: string): Promise<{ ok: boolean; error?: string }> => {
    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      // Fallback para credenciais de demonstração quando o Supabase Auth falhar (somente DEV).
      if (DEMO_ENABLED && email.trim().toLowerCase() === DEMO_EMAIL && senha === DEMO_PASSWORD) {
        const demoUser = createDemoUser();
        persistMockUser(demoUser);
        setUser(demoUser);
        return { ok: true };
      }
      return { ok: false, error: error.message };
    }

    const uid = signInData.user?.id;
    if (uid) {
      const { data: prof } = await supabase
        .from("profiles" as never)
        .select("status, tenant_id")
        .eq("user_id", uid)
        .maybeSingle();
      const profRow = prof as { status?: string; tenant_id?: string } | null;
      if (profRow?.status === "Inativo") {
        await supabase.auth.signOut();
        return { ok: false, error: "Conta bloqueada. Entre em contato com o administrador." };
      }
      if (profRow?.tenant_id && !(await isTenantActive(profRow.tenant_id))) {
        await supabase.auth.signOut();
        return { ok: false, error: "Laboratório suspenso. Entre em contato com o suporte." };
      }
    }


    return { ok: true };
  }, []);

  // === Supabase login =====================================================
  // Bloqueia login de usuários inativos: faz signIn, checa profile.status,
  // se Inativo faz signOut imediatamente e devolve erro amigável.
  const signInWithPassword = useCallback(
    async (email: string, senha: string): Promise<{ ok: boolean; error?: string }> => {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) {
        if (DEMO_ENABLED && email.trim().toLowerCase() === DEMO_EMAIL && senha === DEMO_PASSWORD) {
          const demoUser = createDemoUser();
          persistMockUser(demoUser);
          setUser(demoUser);
          return { ok: true };
        }
        return { ok: false, error: error.message };
      }
      const uid = signInData.user?.id;
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles" as never)
          .select("status, tenant_id")
          .eq("user_id", uid)
          .maybeSingle();
        const profRow = prof as { status?: string; tenant_id?: string } | null;
        if (profRow?.status === "Inativo") {
          await supabase.auth.signOut();
          return { ok: false, error: "Conta bloqueada. Entre em contato com o administrador." };
        }
        if (profRow?.tenant_id && !(await isTenantActive(profRow.tenant_id))) {
          await supabase.auth.signOut();
          return { ok: false, error: "Laboratório suspenso. Entre em contato com o suporte." };
        }
      }
      return { ok: true };
    },
    [],
  );

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

    // 2) Encerra a sessão Supabase (se aplicável).
    if (user?.source === "supabase") {
      await supabase.auth.signOut();
    }

    // 3) Limpa cache mock e estado em memória.
    try { localStorage.removeItem(MOCK_STORAGE_KEY); } catch { /* noop */ }
    setUser(null);
  }, [user]);

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
