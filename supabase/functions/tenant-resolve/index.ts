// ════════════════════════════════════════════════════════════════════════
// tenant-resolve — endpoint público para o Login V2 multi-database.
//
// Entrada (JSON): { identifier: string }
//   - identifier pode ser:
//     • lab_code humano (ex.: "LAB905", "SJMED")  ← preferido para o login
//     • slug do laboratório (ex.: "saolucas")
//     • e-mail do usuário (ex.: "ana@saolucas.com")
//     • código legado numérico de 4-6 dígitos (`tenants.codigo`)
//
// Saída (JSON): {
//   ok: true,
//   tenant: {
//     id, nome, slug, status, lab_code,
//     logo_url, tema,            // branding p/ pintar a UI
//     runtime_mode               // "shared_db" | "isolated_db"
//   }
// } | { ok:false, error:string }
//
// 🔒 Privacidade: NUNCA expõe credenciais, db_secret_ref, host, porta,
//    feature flags, lista de usuários ou e-mails. Apenas o branding
//    mínimo necessário para etapa 2 (senha).
// ════════════════════════════════════════════════════════════════════════

import { createClient } from "../_shared/runtime/createClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeError(err: unknown): string {
  // Public resolver never returns internal details
  return "Ocorreu um erro interno. Tente novamente.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  let body: { identifier?: unknown };
  try { body = await req.json(); } catch { return json(400, { ok: false, error: "invalid_json" }); }

  const raw = typeof body.identifier === "string" ? body.identifier.trim() : "";
  if (!raw || raw.length > 200) return json(400, { ok: false, error: "invalid_identifier" });

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const isEmail = raw.includes("@");
  const upper = raw.toUpperCase();
  const isLabCode = /^[A-Z0-9]{3,12}$/.test(upper) && /[A-Z]/.test(upper);
  const isLegacyNumeric = /^[0-9]{4,6}$/.test(raw);

  let tenantId: string | null = null;

  // Prioridade 1: lab_code no tenant_registry (novo padrão humano)
  const { data: regByCode } = await supa
    .from("tenant_registry")
    .select("tenant_id")
    .eq("lab_code", upper)
    .maybeSingle();
  tenantId = (regByCode as { tenant_id?: string } | null)?.tenant_id ?? null;

  // Prioridade 2: slug no tenant_registry (consolidado como fonte de roteamento)
  if (!tenantId) {
    const slug = raw.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (slug) {
      const { data: regBySlug } = await supa
        .from("tenant_registry")
        .select("tenant_id")
        .eq("slug", slug)
        .maybeSingle();
      tenantId = (regBySlug as { tenant_id?: string } | null)?.tenant_id ?? null;
    }
  }

  // Prioridade 3: e-mail (lookup via profiles)
  if (!tenantId && isEmail) {
    const { data: prof } = await supa
      .from("profiles")
      .select("tenant_id")
      .ilike("email", raw)
      .maybeSingle();
    tenantId = (prof as { tenant_id?: string } | null)?.tenant_id ?? null;
  }

  // Prioridade 3: código numérico (novo padrão lab_code em tenants).
  // Aceita tanto o número puro ("0001") quanto a forma "LAB0001" usada
  // no input do Login V2 (que sempre prefixa "LAB" + dígitos).
  if (!tenantId) {
    const stripped = upper.replace(/^LAB/, "");
    const numericCandidate = isLegacyNumeric ? raw : (/^[0-9]{3,6}$/.test(stripped) ? stripped : null);
    if (numericCandidate) {
      const { data: t } = await supa
        .from("tenants")
        .select("id")
        .eq("lab_code", numericCandidate)
        .maybeSingle();
      tenantId = (t as { id?: string } | null)?.id ?? null;
    }
  }

  if (!tenantId) return json(200, { ok: false, error: "not_found" });

  const [{ data: tenant }, { data: settings }, { data: registry }] = await Promise.all([
    supa.from("tenants").select("id, nome, slug, status").eq("id", tenantId).maybeSingle(),
    supa.from("tenant_settings_public").select("logo_url, tema").eq("tenant_id", tenantId).maybeSingle(),
    supa.from("tenant_registry").select("runtime_mode, runtime_status, lab_code").eq("tenant_id", tenantId).maybeSingle(),
  ]);

  if (!tenant) return json(200, { ok: false, error: "not_found" });
  const t = tenant as { id: string; nome: string; slug: string; status: string };
  if (t.status !== "ativo") return json(200, { ok: false, error: "tenant_inactive" });

  const s = (settings ?? {}) as { logo_url?: string | null; tema?: string | null };
  const r = (registry ?? {}) as { runtime_mode?: string | null; lab_code?: string | null };

  return json(200, {
    ok: true,
    tenant: {
      id: t.id,
      nome: t.nome,
      slug: t.slug,
      status: t.status,
      lab_code: r.lab_code ?? null,
      logo_url: s.logo_url ?? null,
      tema: s.tema ?? "indigo",
      runtime_mode: r.runtime_mode ?? "shared_db",
    },
  });
});