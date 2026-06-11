// Helper unificado de erro: loga estruturado + exibe toast amigável.
// Use em catch blocks para garantir feedback ao usuário e rastreabilidade.

import { toast } from "sonner";
import { logger } from "./logger";

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const maybe = err as { message?: string; error?: { message?: string }; details?: string };
    return maybe.message || maybe.error?.message || maybe.details || "Erro desconhecido";
  }
  return "Erro desconhecido";
}

export interface ShowErrorOptions {
  /** Escopo para log (ex: "atendimentoStore", "Resultados.tsx") */
  scope: string;
  /** Mensagem amigável exibida ao usuário (fallback: extrai do erro) */
  userMessage?: string;
  /** Metadados adicionais para o log */
  meta?: Record<string, unknown>;
  /** Se true, não exibe toast (apenas loga). Default: false */
  silent?: boolean;
}

export function showError(err: unknown, opts: ShowErrorOptions): void {
  const raw = extractMessage(err);
  const userMsg = opts.userMessage || raw;

  logger.error(opts.scope, raw, {
    ...opts.meta,
    raw: err instanceof Error ? { name: err.name, stack: err.stack } : err,
  });

  if (!opts.silent) {
    toast.error(userMsg);
  }
}
