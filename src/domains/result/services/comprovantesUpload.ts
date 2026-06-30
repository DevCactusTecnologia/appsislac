// ----------------------------------------------------------------------------
// Comprovantes — Upload pipeline
//   Convert Blob → base64 e invoca a edge function `upload-pdf`, devolvendo
//   uma URL pública. Inclui helper `criarShortlinkPdf` para encurtar a URL
//   via `comprovante-shortlink`. Extraído de `src/lib/comprovantes.ts`
//   (Domain Slicing — Fase Render/Upload/WhatsApp).
// ----------------------------------------------------------------------------
import { db as supabase } from "@/runtime/db";
import type { ComprovanteTipo } from "@/lib/comprovantes";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("read error"));
    reader.readAsDataURL(blob);
  });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-");
}

/**
 * Uploads a generated PDF (as Blob) to the public `comprovantes` bucket
 * via the `upload-pdf` edge function and returns the resulting public URL.
 */
export async function uploadPdfAndGetUrl(
  blob: Blob,
  filename: string,
  options?: {
    pacienteId?: number | null;
    pacienteCpf?: string | null;
    category?: "comprovantes" | "documentos" | "laudos";
  },
): Promise<string> {
  const base64 = await blobToBase64(blob);
  const safeName = sanitizeFilename(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
  const { data, error } = await supabase.functions.invoke("upload-pdf", {
    body: {
      filename: safeName,
      contentBase64: base64,
      pacienteId: options?.pacienteId ?? null,
      pacienteCpf: options?.pacienteCpf ?? null,
      category: options?.category ?? "comprovantes",
    },
  });
  if (error) throw new Error(error.message || "Falha ao enviar PDF");
  const url = (data as { url?: string } | null)?.url;
  if (!url) throw new Error("URL pública não retornada pelo servidor");
  return url;
}

/**
 * Cria um link curto (`/p/:codigo`) que aponta para o PDF assinado.
 * Use depois de `uploadPdfAndGetUrl` para encurtar a URL antes de mandar
 * pelo WhatsApp / e-mail. TTL padrão: 24h.
 */
export async function criarShortlinkPdf(params: {
  pdfUrl: string;
  protocolo: string;
  tipo: ComprovanteTipo;
  ttlHours?: number;
}): Promise<{ shortUrl: string; codigo: string; expiraEm: string } | null> {
  try {
    const origin =
      typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
    const { data, error } = await supabase.functions.invoke("comprovante-shortlink", {
      body: {
        url: params.pdfUrl,
        protocolo: params.protocolo,
        tipo: params.tipo,
        ttlHours: params.ttlHours ?? 24,
        hostHint: origin,
      },
    });
    if (error) return null;
    const d = data as { shortUrl?: string; codigo?: string; expiraEm?: string } | null;
    if (!d?.shortUrl || !d?.codigo) return null;
    return { shortUrl: d.shortUrl, codigo: d.codigo, expiraEm: d.expiraEm ?? "" };
  } catch {
    return null;
  }
}
