// Acesso a tenant_pages e ao lookup público de tenants.
import { supabase } from "@/integrations/supabase/client";
import { sanitizeContent, type TPageContent } from "./blocks";

export interface TenantLookup {
  id: string;
  nome: string;
  slug: string;
  dominio_custom: string | null;
  dominio_verificado: boolean;
}

export interface TenantPage {
  id: string;
  tenant_id: string;
  slug: string;
  titulo: string;
  conteudo: TPageContent;
  publicado: boolean;
}

/** Resolve tenant pelo slug (path-based: /site/:slug). Público. */
export async function getTenantBySlug(slug: string): Promise<TenantLookup | null> {
  const { data } = await supabase
    .from("tenant_public" as never)
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as TenantLookup | null) ?? null;
}

/** Resolve tenant pelo dominio_custom (apenas se verificado). Público. */
export async function getTenantByDomain(host: string): Promise<TenantLookup | null> {
  const cleanHost = host.toLowerCase().replace(/^www\./, "");
  const { data } = await supabase
    .from("tenant_public" as never)
    .select("*")
    .eq("dominio_custom", cleanHost)
    .eq("dominio_verificado", true)
    .maybeSingle();
  return (data as TenantLookup | null) ?? null;
}

/** Carrega uma página publicada do tenant. Público (RLS filtra). */
export async function getPublishedPage(tenantId: string, pageSlug = "home"): Promise<TenantPage | null> {
  // Acesso público via RPC SECURITY DEFINER (exige tenant explícito; bloqueia
  // enumeração cross-tenant). RLS na tabela é restrita a admin/super_admin.
  const { data } = await (supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
  }).rpc("get_published_tenant_page", {
    p_tenant_id: tenantId,
    p_slug: pageSlug,
  });
  const arr = (data as Array<Record<string, unknown>> | null) ?? [];
  const row = arr[0];
  if (!row) return null;
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    slug: row.slug as string,
    titulo: (row.titulo as string) ?? "",
    conteudo: sanitizeContent(row.conteudo),
    publicado: row.publicado as boolean,
  };
}

/** Carrega a página (incluindo rascunho) para o admin do tenant. */
export async function getPageForAdmin(tenantId: string, pageSlug = "home"): Promise<TenantPage | null> {
  const { data } = await supabase
    .from("tenant_pages" as never)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("slug", pageSlug)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    slug: row.slug as string,
    titulo: (row.titulo as string) ?? "",
    conteudo: sanitizeContent(row.conteudo),
    publicado: row.publicado as boolean,
  };
}

/** Upsert (cria ou atualiza) uma página. Admin only. */
export async function savePage(input: {
  tenant_id: string;
  slug?: string;
  titulo: string;
  conteudo: TPageContent;
  publicado: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const sanitized = sanitizeContent(input.conteudo);
  const { error } = await supabase
    .from("tenant_pages" as never)
    .upsert(
      {
        tenant_id: input.tenant_id,
        slug: input.slug ?? "home",
        titulo: input.titulo,
        conteudo: sanitized as unknown as object,
        publicado: input.publicado,
      } as never,
      { onConflict: "tenant_id,slug" } as never,
    );
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Atualiza configurações de site do próprio tenant (slug + dominio_custom). */
export async function updateTenantSiteConfig(input: {
  tenant_id: string;
  slug?: string | null;
  dominio_custom?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  // RLS de tenants só permite UPDATE para super_admin. Para o admin do
  // próprio tenant atualizar slug/domínio, usamos uma RPC SECURITY DEFINER
  // que valida papel + unicidade do slug server-side.
  const { error } = await (supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  }).rpc("update_own_tenant_site_config", {
    p_slug: input.slug ?? null,
    p_dominio_custom: input.dominio_custom ?? null,
  });
  if (!error) return { ok: true };
  const msg = error.message || "";
  const map: Record<string, string> = {
    slug_taken: "Este slug já está em uso por outro laboratório.",
    slug_reserved: "Este slug é reservado pelo sistema.",
    slug_invalid_format: "Slug inválido. Use letras, números e hífens.",
    slug_invalid_length: "Slug deve ter ao menos 3 caracteres.",
    forbidden: "Você não tem permissão para alterar o endereço público.",
    no_tenant: "Tenant não identificado na sessão.",
    not_authenticated: "Sessão expirada. Faça login novamente.",
  };
  const friendly = Object.entries(map).find(([k]) => msg.includes(k))?.[1];
  return { ok: false, error: friendly ?? msg };
}