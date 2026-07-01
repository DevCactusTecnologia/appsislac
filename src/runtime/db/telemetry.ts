/**
 * Runtime 2.0 — Telemetria mínima e única.
 *
 * Ponto central para eventos do runtime. Em dev imprime no console;
 * em prod é no-op até que um sink (PostHog/Sentry) seja decidido.
 * Mantido propositalmente pequeno para evitar acoplamento.
 */

type RuntimeEvent =
  | { type: "runtime.resolve.start"; tenant_id: string }
  | { type: "runtime.resolve.end"; tenant_id: string; strategy: string; ms: number }
  | { type: "runtime.client.created"; tenant_id: string; project_ref: string; strategy: string }
  | { type: "runtime.client.cache_hit"; tenant_id: string; project_ref: string }
  | { type: "runtime.client.disposed"; tenant_id: string; project_ref: string }
  | { type: "runtime.route.dedicated"; tenant_id: string; table: string }
  | { type: "runtime.route.shared_fallback"; tenant_id: string; table: string; reason: string }
  | { type: "runtime.failure"; tenant_id: string; code: string; message: string };

const isDev = typeof import.meta !== "undefined" && (import.meta as { env?: { DEV?: boolean } }).env?.DEV;

export function emit(event: RuntimeEvent): void {
  if (!isDev) return;
  // eslint-disable-next-line no-console
  console.debug(`[runtime] ${event.type}`, event);
}
