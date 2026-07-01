// Edge function: valida se o dominio_custom de um tenant aponta para o
// host de produção do SISLAC via DNS-over-HTTPS (Cloudflare/Google).
// Marca tenant.dominio_verificado = true quando o CNAME/A bater com o
// alvo esperado. Apenas o admin do próprio tenant ou super_admin podem
// disparar a verificação.

import { createClient } from "../_shared/runtime/createClient.ts";
import {
  corsHeaders,
  createLogger,
  errorResponse,
  jsonResponse,
  newRequestId,
  preflight,
  retryTransient,
} from "../_shared/hardening.ts";

// Hosts/IPs aceitos como alvo de apontamento. Se o tenant migrar para
// Vercel, o admin do SaaS adiciona o domínio Vercel correspondente aqui.
const EXPECTED_TARGETS = [
  "lovable.app",
  "sislac.lovable.app",
  "cname.vercel-dns.com",
  "76.76.21.21", // Vercel A record padrão
  "185.158.133.1", // Lovable A record padrão
];

interface DohAnswer { name: string; type: number; data: string }
interface DohResp { Status: number; Answer?: DohAnswer[] }

async function dohQuery(host: string, type: "A" | "CNAME"): Promise<string[]> {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`;
  const r = await fetch(url, { headers: { accept: "application/dns-json" } });
  if (!r.ok) throw new Error(`doh_${type}_${r.status}`);
  const j = (await r.json()) as DohResp;
  if (j.Status !== 0 || !j.Answer) return [];
  return j.Answer.filter((a) => a.type === (type === "A" ? 1 : 5)).map((a) =>
    a.data.replace(/\.$/, "").toLowerCase()
  );
}

function matches(values: string[]): boolean {
  return values.some((v) => EXPECTED_TARGETS.some((t) => v === t || v.endsWith(`.${t}`)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("tenant-domain-verify", requestId);

  if (req.method !== "POST") {
    return errorResponse(405, "method not allowed", requestId, log);
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return errorResponse(401, "missing token", requestId, log);
    }

    // Identifica o usuário chamador (RLS-aware client)
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userResp, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userResp?.user) {
      return errorResponse(401, "invalid token", requestId, log);
    }
    const userId = userResp.user.id;

    const body = await req.json().catch(() => ({} as { tenant_id?: string }));
    const tenantId = (body as { tenant_id?: string }).tenant_id;
    if (!tenantId || !/^[0-9a-f-]{36}$/i.test(tenantId)) {
      return errorResponse(400, "tenant_id inválido", requestId, log);
    }

    // Service-role client para ler tenant + atualizar (já validamos autorização)
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Autorização: precisa ser super_admin OU admin do tenant
    const [{ data: superFlag }, { data: profile }] = await Promise.all([
      admin.rpc("is_super_admin", { _user_id: userId }),
      admin.from("profiles").select("tenant_id").eq("user_id", userId).maybeSingle(),
    ]);
    const isSuper = Boolean(superFlag);
    const isTenantAdmin = profile?.tenant_id === tenantId &&
      Boolean(
        (await admin.rpc("has_role", { _user_id: userId, _role: "admin" })).data,
      );
    if (!isSuper && !isTenantAdmin) {
      return errorResponse(403, "sem permissão para verificar este tenant", requestId, log);
    }

    const { data: tenant, error: tErr } = await admin
      .from("tenants")
      .select("id, dominio_custom")
      .eq("id", tenantId)
      .maybeSingle();
    if (tErr || !tenant) {
      return errorResponse(404, "tenant não encontrado", requestId, log);
    }
    const host = (tenant.dominio_custom ?? "").trim().toLowerCase().replace(/^www\./, "");
    if (!host) {
      return errorResponse(400, "tenant sem domínio configurado", requestId, log);
    }

    // Lookup DNS (CNAME e A) com retry transitório
    const [cnames, as] = await Promise.all([
      retryTransient(() => dohQuery(host, "CNAME"), { attempts: 2, opTimeoutMs: 8000 }),
      retryTransient(() => dohQuery(host, "A"), { attempts: 2, opTimeoutMs: 8000 }),
    ]);
    const verified = matches(cnames) || matches(as);

    if (verified) {
      const { error: updErr } = await admin
        .from("tenants")
        .update({ dominio_verificado: true })
        .eq("id", tenantId);
      if (updErr) {
        return errorResponse(500, "falha ao atualizar status", requestId, log, updErr);
      }
    }

    return jsonResponse(
      200,
      {
        verified,
        host,
        cnames,
        a_records: as,
        expected_targets: EXPECTED_TARGETS,
      },
      requestId,
    );
  } catch (err) {
    return errorResponse(500, "erro interno na verificação de domínio", requestId, log, err);
  }
});

// Garante uso do header CORS exportado (evita tree-shake acidental).
export { corsHeaders };