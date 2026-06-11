// Edge: integration-pdf-url
// Gera signed URL temporária para um PDF salvo em integration-assets.
// Valida que o usuário pode ver o integration_pdfs (via RLS).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { loadS3Config, recordStorageAudit, s3PresignGet } from "../_shared/s3.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("authorization") ?? "";
    if (!auth.toLowerCase().startsWith("bearer ")) return j(401, { error: "unauthorized" });
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return j(401, { error: "unauthorized" });
    const body = await req.json().catch(() => ({}));
    const pdf_id = String(body?.pdf_id ?? "");
    if (!pdf_id) return j(400, { error: "pdf_id obrigatório" });
    const { data: pdf, error } = await userClient
      .from("integration_pdfs")
      .select("id, storage_path, mime_type, tenant_id")
      .eq("id", pdf_id).maybeSingle();
    if (error || !pdf) return j(403, { error: "forbidden" });
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const objectKey = pdf.storage_path as string;

    // Tenta S3 primeiro (se configurado); cai para Supabase Storage caso contrário.
    const s3 = await loadS3Config(SUPABASE_URL, SERVICE_KEY);
    if (s3) {
      try {
        const url = await s3PresignGet(s3, objectKey, 300);
        await recordStorageAudit(SUPABASE_URL, SERVICE_KEY, {
          tenant_id: pdf.tenant_id as string, user_id: user.id,
          category: "laudos", backend: "s3", bucket: s3.bucket, object_key: objectKey,
          action: "sign_read", content_type: pdf.mime_type as string,
          metadata: { pdf_id },
        });
        return j(200, { ok: true, url, mime_type: pdf.mime_type, backend: "s3" });
      } catch (e) {
        console.error("[integration-pdf-url] s3 sign failed, trying supabase fallback", e);
      }
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: signed, error: sErr } = await admin.storage
      .from("integration-assets").createSignedUrl(objectKey, 300);
    if (sErr || !signed) return j(500, { error: sErr?.message ?? "sign_failed" });
    await recordStorageAudit(SUPABASE_URL, SERVICE_KEY, {
      tenant_id: pdf.tenant_id as string, user_id: user.id,
      category: "laudos", backend: "supabase", bucket: "integration-assets",
      object_key: objectKey, action: "sign_read", content_type: pdf.mime_type as string,
      metadata: { pdf_id },
    });
    return j(200, { ok: true, url: signed.signedUrl, mime_type: pdf.mime_type, backend: "supabase" });
  } catch (e) {
    console.error("[integration-pdf-url] fatal", e);
    return j(500, { error: "internal_error" });
  }
});

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}