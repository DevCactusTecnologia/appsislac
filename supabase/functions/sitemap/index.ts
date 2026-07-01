// Sitemap dinâmico: lista todos os tenants públicos e suas páginas
// estáticas (home, sobre, contato) para crawling pelo Google.
//
// Endpoint público (sem JWT). Cache de 1h no edge.
import { createClient } from "../_shared/runtime/createClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    // Origem absoluta a usar nas URLs do sitemap. Pode vir por header (proxy)
    // ou cair para o host da request.
    // Origem pública do site. Pode ser sobrescrita via env PUBLIC_SITE_ORIGIN
    // (útil quando o tenant usa domínio próprio), com fallback para o
    // domínio publicado padrão do SISLAC.
    const publicOriginEnv = Deno.env.get("PUBLIC_SITE_ORIGIN");
    const origin = (publicOriginEnv && publicOriginEnv.trim()) || "https://sislac.lovable.app";

    const { data: tenants, error } = await supabase
      .from("tenant_public")
      .select("slug")
      .not("slug", "is", null);

    if (error) throw error;

    const today = new Date().toISOString().slice(0, 10);
    const subroutes = ["", "/sobre", "/contato"];

    const urls: string[] = [];
    // Landing institucional do SaaS.
    urls.push(
      `<url><loc>${escapeXml(origin + "/")}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`,
    );

    for (const t of tenants ?? []) {
      const slug = (t as { slug: string | null }).slug;
      if (!slug) continue;
      for (const sub of subroutes) {
        const loc = `${origin}/site/${slug}${sub}`;
        const priority = sub === "" ? "0.9" : "0.7";
        urls.push(
          `<url><loc>${escapeXml(loc)}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${priority}</priority></url>`,
        );
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
      {
        headers: { ...corsHeaders, "Content-Type": "application/xml; charset=utf-8" },
        status: 200,
      },
    );
  }
});