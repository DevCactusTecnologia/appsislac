/**
 * Identity Layer — SupabaseSharedIssuer.
 *
 * Implementação default: delega ao cliente Supabase Shared (que já gerencia
 * refresh, persistência e onAuthStateChange). Não expõe SupabaseClient para
 * fora — só devolve `IdentitySession` canônica.
 */

import { supabase as sharedClient } from "@/integrations/supabase/client";
import type { IdentityClaims, IdentityIssuer, IdentitySession } from "./index";

function toSession(s: unknown): IdentitySession | null {
  if (!s || typeof s !== "object") return null;
  const raw = s as {
    access_token?: string;
    refresh_token?: string | null;
    expires_at?: number | null;
    user?: { id?: string; email?: string | null };
  };
  if (!raw.access_token || !raw.user?.id) return null;
  return {
    access_token: raw.access_token,
    refresh_token: raw.refresh_token ?? null,
    expires_at: raw.expires_at ?? null,
    user: { id: raw.user.id, email: raw.user.email ?? null },
  };
}

export const supabaseSharedIssuer: IdentityIssuer = {
  name: "supabase-shared",
  async signInWithPassword({ email, password }) {
    const { data, error } = await sharedClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const s = toSession(data.session);
    if (!s) throw new Error("Identity: sessão inválida retornada pelo issuer");
    return s;
  },
  async getSession() {
    const { data } = await sharedClient.auth.getSession();
    return toSession(data.session);
  },
  async signOut() {
    await sharedClient.auth.signOut();
  },
  parseClaims(token: string): IdentityClaims | null {
    try {
      const [, payload] = token.split(".");
      if (!payload) return null;
      const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
      return JSON.parse(json) as IdentityClaims;
    } catch {
      return null;
    }
  },
};
