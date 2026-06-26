// Manifest Client — único consumidor do Capability Registry no frontend.
// PROIBIDO declarar Capabilities aqui. Tudo vem do Edge ai-manifest (SSOT).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type CapabilityCategory =
  | "paciente" | "atendimento" | "exames" | "resultados"
  | "soroteca" | "financeiro" | "whatsapp" | "producao" | "configuracao";

export type CapabilityVisibility =
  | "always" | "contextual" | "hidden" | "disabled" | "experimental";

export interface ManifestItem {
  id: string;
  title: string;
  description: string;
  category: CapabilityCategory;
  visibility: CapabilityVisibility;
  priority: number;
  icon: string;
  color: "primary" | "secondary" | "muted" | "destructive";
  enabled: boolean;
  needsApproval: boolean;
  quickAction: boolean;
  supportsSuggestions: boolean;
  baselineSeconds: number;
  baselineClicks: number;
  permission: string | null;
  promptTemplate?: string;
}

export interface Manifest {
  version: string;
  generatedAt: string;
  items: ManifestItem[];
}

// Cache em memória — invalidado por login, troca de tenant, mudança de permissões, versão.
interface CacheEntry { key: string; manifest: Manifest; fetchedAt: number }
let cache: CacheEntry | null = null;
const TTL_MS = 5 * 60 * 1000;

function cacheKey(userId: string | undefined, tenantId: string | undefined, permsHash: string) {
  return `${userId ?? "?"}::${tenantId ?? "?"}::${permsHash}`;
}

function hashPerms(perms: readonly string[]): string {
  return [...perms].sort().join("|");
}

async function fetchManifest(): Promise<Manifest> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error("no_session");
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-manifest`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`manifest_${res.status}`);
  return (await res.json()) as Manifest;
}

export function invalidateManifestCache() { cache = null; }

export function useManifest() {
  const { user } = useAuth();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const permsHash = hashPerms((user?.permissoes ?? []) as string[]);
  const key = cacheKey(user?.id, user?.tenant_id, permsHash);

  useEffect(() => {
    if (!user) { setManifest(null); return; }
    if (cache && cache.key === key && Date.now() - cache.fetchedAt < TTL_MS) {
      setManifest(cache.manifest);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchManifest()
      .then((m) => {
        if (cancelled) return;
        cache = { key, manifest: m, fetchedAt: Date.now() };
        setManifest(m);
      })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key, user]);

  return { manifest, loading, error };
}

/** Discovery: filtra o Manifest pelo contexto operacional (rota/módulo/foco). */
export function discoverCapabilities(
  manifest: Manifest | null,
  opts: { module?: string; quickActionOnly?: boolean; suggestionsOnly?: boolean } = {},
): ManifestItem[] {
  if (!manifest) return [];
  return manifest.items
    .filter((i) => i.visibility !== "hidden")
    .filter((i) => i.enabled)
    .filter((i) => (opts.quickActionOnly ? i.quickAction : true))
    .filter((i) => (opts.suggestionsOnly ? i.supportsSuggestions : true))
    .filter((i) => {
      if (i.visibility !== "contextual") return true;
      // contextual: módulo deve bater categoria
      return opts.module ? i.category === (opts.module as CapabilityCategory) : true;
    })
    .sort((a, b) => a.priority - b.priority);
}
