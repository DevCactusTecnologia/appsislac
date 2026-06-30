import { db as supabase } from "@/runtime/db";

export type LaudoSource = "manual" | "provider" | "none";

export interface LaudoResolved {
  ok: boolean;
  source: LaudoSource;
  url: string | null;
  mime_type?: string;
  expires_in?: number;
  override?: {
    uploaded_at: string | null;
    uploaded_by: string | null;
    motivo: string | null;
  };
  error?: string;
}

/**
 * Resolver central de laudo PDF de exame terceirizado.
 * Ordem: override manual → PDF do provider → null. Server-side, signed URL.
 */
export async function resolverLaudoPdf(atendimentoExameId: number): Promise<LaudoResolved> {
  try {
    const { data, error } = await supabase.functions.invoke("integration-pdf-resolve", {
      body: { atendimento_exame_id: atendimentoExameId },
    });
    if (error) return { ok: false, source: "none", url: null, error: error.message };
    return data as LaudoResolved;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao resolver laudo";
    return { ok: false, source: "none", url: null, error: msg };
  }
}

/** Abre o laudo resolvido em nova aba (usado por botões "Ver laudo"). */
export async function abrirLaudoResolvido(atendimentoExameId: number): Promise<LaudoResolved> {
  const r = await resolverLaudoPdf(atendimentoExameId);
  if (r.ok && r.url) window.open(r.url, "_blank", "noopener,noreferrer");
  return r;
}