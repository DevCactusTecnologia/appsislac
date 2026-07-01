// Edge: integration-pdf-resolve
// Resolver central de laudo PDF de exame terceirizado.
//
// Ordem fixa:
//   1) atendimento_exames.pdf_override_url (manual)
//   2) integration_pdfs mais recente (provider, automático)
//   3) null
//
// Fail-safe: se override existir mas storage não responder, cai para provider.
// Multi-tenant: lê via RLS do usuário; signed URL gerado server-side com service-role.
// Bucket privado, URL expira em 5 min.

import { createClient } from "../_shared/runtime/createClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TTL = 300;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("authorization") ?? "";
    if (!auth.toLowerCase().startsWith("bearer ")) return j(401, { error: "unauthorized" });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return j(401, { error: "unauthorized" });

    const body = await req.json().catch(() => ({}));
    const atendimento_exame_id = Number(body?.atendimento_exame_id);
    if (!Number.isFinite(atendimento_exame_id) || atendimento_exame_id <= 0) {
      return j(400, { error: "atendimento_exame_id obrigatório" });
    }

    // Lê via RLS: garante isolamento de tenant.
    const { data: ae, error: aeErr } = await userClient
      .from("atendimento_exames")
      .select("id, tenant_id, pdf_override_url, pdf_override_uploaded_at, pdf_override_uploaded_by, pdf_override_motivo, protocolo_externo")
      .eq("id", atendimento_exame_id)
      .maybeSingle();
    if (aeErr || !ae) return j(403, { error: "forbidden" });

    const admin = createClient(SUPABASE_URL, SERVICE);

    // 1) override manual
    if (ae.pdf_override_url) {
      try {
        const { data: signed, error: sErr } = await admin.storage
          .from("integration-pdfs")
          .createSignedUrl(ae.pdf_override_url, TTL);
        if (!sErr && signed?.signedUrl) {
          return j(200, {
            ok: true,
            source: "manual",
            url: signed.signedUrl,
            mime_type: "application/pdf",
            expires_in: TTL,
            override: {
              uploaded_at: ae.pdf_override_uploaded_at,
              uploaded_by: ae.pdf_override_uploaded_by,
              motivo: ae.pdf_override_motivo,
            },
          });
        }
        // Fail-safe: cai para provider abaixo
        console.warn("[pdf-resolve] override inválido, fallback provider", sErr);
      } catch (e) {
        console.warn("[pdf-resolve] override sign falhou, fallback provider", e);
      }
    }

    // 2) provider PDF (mais recente)
    const { data: pdfs } = await userClient
      .from("integration_pdfs")
      .select("id, storage_path, mime_type, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    let providerPdf: { storage_path: string; mime_type: string | null } | null = null;
    if (pdfs && pdfs.length) {
      // integration_pdfs liga via result_id → integration_results.atendimento_exame_id
      const { data: results } = await userClient
        .from("integration_results")
        .select("id")
        .eq("atendimento_exame_id", atendimento_exame_id);
      const resultIds = new Set((results ?? []).map((r) => r.id));
      const { data: linked } = await userClient
        .from("integration_pdfs")
        .select("id, storage_path, mime_type, created_at, result_id, external_protocol")
        .order("created_at", { ascending: false })
        .limit(50);
      const match = (linked ?? []).find((p) =>
        (p.result_id && resultIds.has(p.result_id)) ||
        (ae.protocolo_externo && p.external_protocol === ae.protocolo_externo),
      );
      if (match) providerPdf = { storage_path: match.storage_path, mime_type: match.mime_type };
    }
    if (providerPdf) {
      const { data: signed, error: sErr } = await admin.storage
        .from("integration-assets")
        .createSignedUrl(providerPdf.storage_path, TTL);
      if (!sErr && signed?.signedUrl) {
        return j(200, {
          ok: true,
          source: "provider",
          url: signed.signedUrl,
          mime_type: providerPdf.mime_type ?? "application/pdf",
          expires_in: TTL,
        });
      }
    }

    // 3) sem laudo
    return j(200, { ok: true, source: "none", url: null });
  } catch (e) {
    console.error("[integration-pdf-resolve] fatal", e);
    return j(500, { error: "internal_error" });
  }
});

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}