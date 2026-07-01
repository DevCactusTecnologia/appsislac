// Shared hardening utilities for edge functions.
// - Stable CORS headers
// - Per-request request_id (correlation)
// - Structured JSON logger
// - Promise.race timeout wrapper
// - Exponential backoff retry for transient errors only
// - Sanitized error responder (never leak internals)

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Max-Age": "3600",
};

export const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

export function newRequestId(req: Request): string {
  const incoming = req.headers.get("x-request-id");
  if (incoming && /^[A-Za-z0-9._-]{1,64}$/.test(incoming)) return incoming;
  return crypto.randomUUID();
}

type LogLevel = "info" | "warn" | "error";

export function createLogger(fn: string, requestId: string) {
  const base = (level: LogLevel, msg: string, ctx?: Record<string, unknown>) => {
    const line = {
      ts: new Date().toISOString(),
      level,
      fn,
      request_id: requestId,
      msg,
      ...(ctx ?? {}),
    };
    // Single structured line per log call — easy to grep/aggregate.
    const out = JSON.stringify(line);
    if (level === "error") console.error(out);
    else if (level === "warn") console.warn(out);
    else console.log(out);
  };
  return {
    info: (msg: string, ctx?: Record<string, unknown>) => base("info", msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>) => base("warn", msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) => base("error", msg, ctx),
  };
}

export class TimeoutError extends Error {
  constructor(public readonly opMs: number) {
    super(`operation timed out after ${opMs}ms`);
    this.name = "TimeoutError";
  }
}

/** Race a promise against a timeout. Throws TimeoutError on expiry. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms) as unknown as number;
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  }) as Promise<T>;
}

/**
 * Retry only on transient failures: TimeoutError, network-ish errors,
 * and 5xx-style messages. NEVER retry on validation/4xx failures —
 * the caller is responsible for not throwing on those.
 */
export async function retryTransient<T>(
  op: () => Promise<T>,
  opts: { attempts?: number; baseMs?: number; opTimeoutMs?: number } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseMs = opts.baseMs ?? 200;
  const opTimeoutMs = opts.opTimeoutMs ?? 15_000;

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await withTimeout(op(), opTimeoutMs);
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || i === attempts - 1) throw err;
      const delay = baseMs * Math.pow(2, i) + Math.floor(Math.random() * 100);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

function isTransient(err: unknown): boolean {
  if (err instanceof TimeoutError) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("network") ||
    msg.includes("fetch failed") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504")
  );
}

/**
 * Translates low-level PostgreSQL or System errors into safe, user-friendly messages.
 * Prevents information disclosure of table names, columns, or constraints.
 */
export function translateError(err: unknown): string {
  if (err === undefined || err === null) return "Erro desconhecido.";
  
  const code = (err as { code?: string })?.code;
  const message = ((err as { message?: string })?.message ?? String(err)).toLowerCase();

  // PostgreSQL specific error codes (PostgREST/pg)
  if (code === "23505") return "Este registro já existe.";
  if (code === "23503") return "Dados relacionados inválidos.";
  if (code === "23502") return "Campo obrigatório não preenchido.";
  if (code === "42501") return "Permissão negada.";
  if (code === "42P01") return "Erro interno de configuração (table).";
  if (code === "42703") return "Erro interno de configuração (column).";
  if (code === "P0001") {
    // Custom SQL exceptions (RAISE EXCEPTION) - if they are intended for the user, 
    // they usually don't look like internal DB errors.
    return (err as { message: string }).message;
  }

  // Common patterns in messages (fallback)
  if (message.includes("unique constraint")) return "Registro já existe.";
  if (message.includes("foreign key")) return "Dados relacionados inválidos.";
  if (message.includes("not-null")) return "Campo obrigatório não preenchido.";
  if (message.includes("permission denied")) return "Permissão negada.";
  if (message.includes("not found")) return "Registro não encontrado.";

  return "Ocorreu um erro interno. Tente novamente.";
}

/**
 * Build an error response without leaking stack traces or DB internals.
 * `publicMessage` is what the client sees. The full error is logged.
 */
export function errorResponse(
  status: number,
  publicMessage: string,
  requestId: string,
  log: ReturnType<typeof createLogger>,
  internal?: unknown,
): Response {
  if (internal !== undefined) {
    const errorToLog = internal instanceof Error
      ? { name: internal.name, message: internal.message, stack: internal.stack }
      : internal;

    log.error("request_failed", {
      status,
      public_message: publicMessage,
      internal: errorToLog,
    });
  }

  // Auto-sanitize the public message if it looks like a raw DB error
  const sanitized = internal ? translateError(internal) : publicMessage;

  return new Response(
    JSON.stringify({ error: sanitized, request_id: requestId }),
    { status, headers: { ...jsonHeaders, "x-request-id": requestId } },
  );
}

export function jsonResponse(
  status: number,
  body: unknown,
  requestId = crypto.randomUUID(),
): Response {
  return new Response(JSON.stringify({ ...(body as object), request_id: requestId }), {
    status,
    headers: { ...jsonHeaders, "x-request-id": requestId },
  });
}

export function preflight(): Response {
  return new Response(null, { headers: corsHeaders });
}
