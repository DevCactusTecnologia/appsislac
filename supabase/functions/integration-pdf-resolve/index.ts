// Edge: integration-pdf-resolve
// Slice 3: reads via `getUserTenantClient` (JWT preservado → RLS + current_tenant_id
// funcionam no dedicated). Storage segue no control-plane.

import {
  getPlatformClient,
  getUserClient,
  getUserTenantClient,
  MigrationBlockedError,
  resolveUserTenantId,
} from "../_shared/runtime/db.ts";

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

    const userClient = getUserClient(auth);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return j(401, { error: "unauthorized" });

    const tenantId = await resolveUserTenantId(user.id);
    if (!tenantId) return j(403, { error: "tenant not resolved" });

    let tenantDb;
    try {
      tenantDb = await getUserTenantClient(auth, tenantId);
    } catch (e) {
      if (e instanceof MigrationBlockedError) return j(503, { error: "dedicated_unavailable", code: e.code });
      throw e;
    }

    const body = await req.json().catch(() => ({}));
    const atendimento_exame_id = Number(body?.atendimento_exame_id);
    if (!Number.isFinite(atendimento_exame_id) || atendimento_exame_id <= 0) {
      return j(400, { error: "atendimento_exame_id obrigatório" });
    }

    const { data: ae, error: aeErr } = await tenantDb
      .from("atendimento_exames")
      .select("id, tenant_id, pdf_override_url, pdf_override_uploaded_at, pdf_override_uploaded_by, pdf_override_motivo, protocolo_externo")
      .eq("id", atendimento_exame_id)
      .maybeSingle();
    if (aeErr || !ae) return j(403, { error: "forbidden" });

    const admin = getPlatformClient();

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
        console.warn("[pdf-resolve] override inválido, fallback provider", sErr);
      } catch (e) {
        console.warn("[pdf-resolve] override sign falhou, fallback provider", e);
      }
    }

    const { data: pdfs } = await tenantDb
      .from("integration_pdfs")
      .select("id, storage_path, mime_type, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    let providerPdf: { storage_path: string; mime_type: string | null } | null = null;
    if (pdfs && pdfs.length) {
      const { data: results } = await tenantDb
        .from("integration_results")
        .select("id")
        .eq("atendimento_exame_id", atendimento_exame_id);
      const resultIds = new Set((results ?? []).map((r) => r.id));
      const { data: linked } = await tenantDb
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
