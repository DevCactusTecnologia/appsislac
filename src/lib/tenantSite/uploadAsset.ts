import { db as supabase } from "@/runtime/db";

export type TenantAssetKind =
  | "logo"
  | "favicon"
  | "og"
  | "hero"
  | "sobre"
  | "servico-resultados"
  | "servico-coleta"
  | "servico-unidades"
  | "servico-exames"
  | "unidade-matriz"
  | "unidade-shopping"
  | "unidade-clinica";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];

/**
 * Faz upload de uma imagem do tenant para o bucket público `tenant-assets`.
 * Estrutura: <tenantId>/<kind>-<timestamp>.<ext>
 * Retorna a URL pública pronta para uso.
 */
export async function uploadTenantAsset(params: {
  tenantId: string;
  kind: TenantAssetKind;
  file: File;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { tenantId, kind, file } = params;

  if (!ALLOWED.includes(file.type)) {
    return { ok: false, error: "Formato não suportado. Use PNG, JPG, WEBP, SVG ou ICO." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Arquivo muito grande (máx. 2MB)." };
  }

  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${tenantId}/${kind}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("tenant-assets")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });

  if (error) return { ok: false, error: error.message };

  const { data } = supabase.storage.from("tenant-assets").getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

/** Remove um arquivo previamente enviado (best-effort). */
export async function removeTenantAsset(publicUrl: string | null | undefined): Promise<void> {
  if (!publicUrl) return;
  const marker = "/tenant-assets/";
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const path = publicUrl.slice(idx + marker.length);
  await supabase.storage.from("tenant-assets").remove([path]);
}