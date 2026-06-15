// ============================================================================
// validarCredenciaisAnalista — valida e-mail/senha de um analista SEM
// substituir a sessão atual do operador logado.
//
// Estratégia:
//   • cria um cliente Supabase TRANSITÓRIO (storage em memória, sem persistir
//     sessão), chama signInWithPassword e descarta tudo em seguida.
//   • se OK, busca o usuário em `usuariosStore` (cache local do tenant) para
//     extrair nome/iniciais e validar que ele é analista/admin neste tenant.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { getUsuarios } from "@/data/usuariosStore";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

/** Storage em memória — nunca toca em localStorage do operador atual. */
class MemStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.get(k) ?? null; }
  setItem(k: string, v: string) { this.store.set(k, v); }
  removeItem(k: string) { this.store.delete(k); }
}

const computeIniciais = (nome: string): string => {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export interface AnalistaValidado {
  ok: true;
  userId: string;
  email: string;
  nome: string;
  iniciais: string;
}

export interface AnalistaErro {
  ok: false;
  error: string;
}

export async function validarCredenciaisAnalista(
  email: string,
  senha: string,
): Promise<AnalistaValidado | AnalistaErro> {
  const emailNorm = email.trim().toLowerCase();
  if (!emailNorm || !senha) {
    return { ok: false, error: "Informe e-mail e senha." };
  }

  const transient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: new MemStorage() as unknown as Storage,
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const { data, error } = await transient.auth.signInWithPassword({
      email: emailNorm,
      password: senha,
    });
    if (error || !data?.user) {
      return { ok: false, error: "E-mail ou senha incorretos." };
    }

    // Verificação de role server-side via RPC SECURITY DEFINER `has_role`.
    // Não confiamos no cache local (`usuariosStore`): o cache pode estar vazio
    // ou pertencer a outro tenant. A RPC roda no banco com o JWT recém-emitido
    // pelo signIn transitório e responde "true" apenas se o user tiver o role
    // pedido (admin OU analista) — qualquer outra resposta = rejeição.
    const [{ data: isAnalista }, { data: isAdmin }] = await Promise.all([
      transient.rpc("has_role", { _user_id: data.user.id, _role: "analista" }),
      transient.rpc("has_role", { _user_id: data.user.id, _role: "admin" }),
    ]);
    if (!isAnalista && !isAdmin) {
      return { ok: false, error: "Este usuário não tem perfil de analista." };
    }

    const cache = getUsuarios();
    const found = cache.find((u) => u.email.toLowerCase() === emailNorm);
    const meta = (data.user.user_metadata ?? {}) as { nome?: string; full_name?: string };
    const nome = found?.nome || meta.nome || meta.full_name || emailNorm.split("@")[0];

    return {
      ok: true,
      userId: data.user.id,
      email: emailNorm,
      nome,
      iniciais: computeIniciais(nome),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha ao validar credenciais.",
    };
  } finally {
    try { await transient.auth.signOut(); } catch { /* ignore */ }
  }
}