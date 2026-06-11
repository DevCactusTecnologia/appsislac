// Rate limit utilitário para endpoints públicos.
// Política padrão: até 5 tentativas / 60s por (scope, key).
// Após exceder: bloqueio com backoff exponencial (2^n minutos, máx 30 min).
//
// Uso:
//   const rl = await checkRateLimit(admin, "comprovante-resolve", `ip:${ip}`);
//   if (!rl.allowed) return errorResponse(429, "Muitas tentativas", ...);
//
// Persiste em public.public_rate_limits (service_role only).

// deno-lint-ignore no-explicit-any
type SupabaseAdmin = any;

const DEFAULT_WINDOW_SEC = 60;
const DEFAULT_MAX = 5;
const MAX_BACKOFF_MIN = 30;

export interface RateLimitResult {
  allowed: boolean;
  attempts: number;
  blockedUntil?: string;
  retryAfterSec?: number;
}

export function extractIp(req: Request): string {
  const xfwd = req.headers.get("x-forwarded-for");
  if (xfwd) return xfwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Verifica e contabiliza uma tentativa. Não joga exceções: em caso de erro
 * de infra, libera (fail-open) e loga via console.warn.
 */
export async function checkRateLimit(
  admin: SupabaseAdmin,
  scope: string,
  key: string,
  opts: { windowSec?: number; max?: number } = {},
): Promise<RateLimitResult> {
  const windowSec = opts.windowSec ?? DEFAULT_WINDOW_SEC;
  const max = opts.max ?? DEFAULT_MAX;
  const now = new Date();

  try {
    const { data: row } = await admin
      .from("public_rate_limits")
      .select("id, attempts, window_start, blocked_until")
      .eq("scope", scope)
      .eq("key", key)
      .maybeSingle();

    // Já bloqueado?
    if (row?.blocked_until && new Date(row.blocked_until).getTime() > now.getTime()) {
      const retryAfterSec = Math.ceil(
        (new Date(row.blocked_until).getTime() - now.getTime()) / 1000,
      );
      return { allowed: false, attempts: row.attempts, blockedUntil: row.blocked_until, retryAfterSec };
    }

    // Sem registro → cria
    if (!row) {
      await admin.from("public_rate_limits").insert({
        scope,
        key,
        window_start: now.toISOString(),
        attempts: 1,
      });
      return { allowed: true, attempts: 1 };
    }

    const windowStart = new Date(row.window_start).getTime();
    const expired = now.getTime() - windowStart > windowSec * 1000;

    if (expired) {
      await admin
        .from("public_rate_limits")
        .update({
          window_start: now.toISOString(),
          attempts: 1,
          blocked_until: null,
          updated_at: now.toISOString(),
        })
        .eq("id", row.id);
      return { allowed: true, attempts: 1 };
    }

    const attempts = (row.attempts ?? 0) + 1;
    let blockedUntil: string | null = null;
    let retryAfterSec: number | undefined;

    if (attempts > max) {
      // Backoff exponencial: 2^(attempts-max) minutos
      const exp = Math.min(attempts - max, 5);
      const blockMin = Math.min(Math.pow(2, exp), MAX_BACKOFF_MIN);
      const until = new Date(now.getTime() + blockMin * 60_000);
      blockedUntil = until.toISOString();
      retryAfterSec = blockMin * 60;
    }

    await admin
      .from("public_rate_limits")
      .update({
        attempts,
        blocked_until: blockedUntil,
        updated_at: now.toISOString(),
      })
      .eq("id", row.id);

    if (blockedUntil) {
      return { allowed: false, attempts, blockedUntil, retryAfterSec };
    }
    return { allowed: true, attempts };
  } catch (e) {
    console.warn("rate_limit_failed_open", scope, key, e);
    return { allowed: true, attempts: 0 };
  }
}
