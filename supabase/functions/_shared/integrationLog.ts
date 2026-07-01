// Helpers compartilhados pelas edge functions de integração laboratorial.
// - Logger persistente em integration_logs
// - Auditoria de request/response em integration_requests / integration_responses

// deno-lint-ignore-file no-explicit-any
import { createClient } from "../_shared/runtime/createClient.ts";

export type AdminClient = ReturnType<typeof createClient>;

export function getAdminClient(): AdminClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL";

// =====================================================================
// PII redaction — H3 (LGPD)
// Mascara dados sensíveis em logs/envelopes antes de persistir no DB.
// Campos cobertos: cpf, rg, email, telefone, endereço, nome do paciente,
// data de nascimento. Atua em strings (regex) e em chaves nomeadas (objeto).
// =====================================================================

const PII_KEY_PATTERN = /(cpf|rg|email|e[-_]?mail|telefone|fone|celular|whatsapp|endereco|endereço|logradouro|complemento|bairro|nome[-_ ]?paciente|paciente[-_ ]?nome|patient[-_ ]?name|data[-_ ]?nascimento|dt[-_ ]?nasc|nascimento|password|senha|token|authorization)/i;

const CPF_RE = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const RG_RE = /\b\d{1,2}\.?\d{3}\.?\d{3}-?[0-9Xx]\b/g;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /\b(?:\+?55\s?)?\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}\b/g;
const DATE_RE = /\b\d{2}\/\d{2}\/\d{4}\b/g;

function redactString(input: string): string {
  if (!input) return input;
  return input
    .replace(CPF_RE, "[CPF]")
    .replace(RG_RE, "[RG]")
    .replace(EMAIL_RE, "[EMAIL]")
    .replace(PHONE_RE, "[FONE]")
    .replace(DATE_RE, "[DATA]");
}

export function redactPII<T = unknown>(value: T, depth = 0): T {
  if (depth > 6 || value == null) return value;
  if (typeof value === "string") return redactString(value) as unknown as T;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((v) => redactPII(v, depth + 1)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (PII_KEY_PATTERN.test(k)) {
      out[k] = v == null ? v : "[REDACTED]";
    } else if (typeof v === "string") {
      out[k] = redactString(v);
    } else {
      out[k] = redactPII(v, depth + 1);
    }
  }
  return out as unknown as T;
}

export async function logIntegration(
  admin: AdminClient,
  args: {
    tenant_id: string;
    integration_id?: string | null;
    job_id?: string | null;
    level?: LogLevel;
    message: string;
    context?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await admin.from("integration_logs").insert({
      tenant_id: args.tenant_id,
      integration_id: args.integration_id ?? null,
      job_id: args.job_id ?? null,
      level: args.level ?? "INFO",
      message: redactString(args.message ?? ""),
      context: redactPII(args.context ?? {}),
    });
  } catch (e) {
    console.error("[integrationLog] insert failed", e);
  }
}

export async function persistRequestResponse(
  admin: AdminClient,
  args: {
    tenant_id: string;
    integration_id: string;
    job_id?: string | null;
    method: string;
    endpoint?: string | null;
    envelope: string;
    headers?: Record<string, unknown>;
    rawResponse: string;
    parsed?: any;
    statusCode: number;
    durationMs: number;
    parseError?: string | null;
  },
): Promise<{ requestId: string; responseId: string }> {
  const { data: req, error: reqErr } = await admin
    .from("integration_requests")
    .insert({
      tenant_id: args.tenant_id,
      integration_id: args.integration_id,
      job_id: args.job_id ?? null,
      method: args.method,
      endpoint: args.endpoint ?? null,
      envelope: redactString(args.envelope ?? ""),
      headers: redactPII(args.headers ?? {}),
      status_code: args.statusCode,
      duration_ms: args.durationMs,
    })
    .select("id")
    .single();
  if (reqErr) throw reqErr;

  const { data: resp, error: respErr } = await admin
    .from("integration_responses")
    .insert({
      tenant_id: args.tenant_id,
      integration_id: args.integration_id,
      request_id: req.id,
      raw_payload: redactString(args.rawResponse ?? ""),
      parsed_payload: args.parsed == null ? null : redactPII(args.parsed),
      status_code: args.statusCode,
      parse_error: args.parseError ?? null,
    })
    .select("id")
    .single();
  if (respErr) throw respErr;

  return { requestId: req.id as string, responseId: resp.id as string };
}

/** Backoff exponencial com jitter (ms). */
export function nextRetryDelayMs(retry: number): number {
  const base = Math.min(60_000 * Math.pow(2, retry), 30 * 60_000); // até 30 min
  return Math.round(base + Math.random() * 5_000);
}

/** Comparação em tempo constante para o cron secret. */
export function safeEq(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  const len = Math.min(ea.length, eb.length);
  for (let i = 0; i < len; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

// =====================================================================
// IntegrationEvent — discriminated union TIPADO para logs estruturados.
// Persiste em `integration_logs.context.event` mantendo retrocompat
// com `logIntegration` (que continua aceitando strings livres).
//
// Regra IA-first: NUNCA inventar `event_type` solto — sempre estender
// este union. Dashboards/analytics dependem desta lista fechada.
// =====================================================================

export type IntegrationJobKind =
  | "SEND_ORDER" | "POLL_RESULT" | "FETCH_PDF" | "FETCH_PENDING"
  | "FETCH_TRACE" | "FETCH_LABEL" | "CANCEL_EXAM" | "CANCEL_SAMPLE"
  | "SYNC_EXAM_MAP";

interface BaseEvent<T extends string> {
  type: T;
  job_id?: string | null;
  integration_id?: string | null;
  provider?: string;
  correlation_id?: string;
  occurred_at?: string; // ISO; defaultado em emitEvent
}

export interface JobStartedEvent extends BaseEvent<"job.started"> {
  kind: IntegrationJobKind;
  attempt: number;
}
export interface JobCompletedEvent extends BaseEvent<"job.completed"> {
  kind: IntegrationJobKind;
  duration_ms?: number;
  http_status?: number;
}
export interface JobFailedEvent extends BaseEvent<"job.failed"> {
  kind: IntegrationJobKind;
  reason: string;
  attempt: number;
  retriable: boolean;
}
export interface JobDeadEvent extends BaseEvent<"job.dead"> {
  kind: IntegrationJobKind;
  death_reason: string;
  message: string;
}
export interface ProviderTimeoutEvent extends BaseEvent<"provider.timeout"> {
  endpoint?: string;
  duration_ms: number;
}
export interface CircuitOpenedEvent extends BaseEvent<"circuit.opened"> {
  failure_count: number;
  cooldown_ms: number;
}
export interface CircuitHalfOpenEvent extends BaseEvent<"circuit.half_open"> {}
export interface CircuitClosedEvent extends BaseEvent<"circuit.closed"> {}
export interface PollingStartedEvent extends BaseEvent<"polling.started"> {
  protocol: string;
}
export interface PdfImportedEvent extends BaseEvent<"pdf.imported"> {
  size_bytes: number;
  storage_path?: string;
}
export interface OverrideManualEvent extends BaseEvent<"override.manual"> {
  actor_user_id?: string | null;
  reason: string;
}

export type IntegrationEvent =
  | JobStartedEvent | JobCompletedEvent | JobFailedEvent | JobDeadEvent
  | ProviderTimeoutEvent | CircuitOpenedEvent | CircuitHalfOpenEvent
  | CircuitClosedEvent | PollingStartedEvent | PdfImportedEvent
  | OverrideManualEvent;

const EVENT_LEVEL: Record<IntegrationEvent["type"], LogLevel> = {
  "job.started": "INFO",
  "job.completed": "INFO",
  "job.failed": "WARN",
  "job.dead": "ERROR",
  "provider.timeout": "WARN",
  "circuit.opened": "ERROR",
  "circuit.half_open": "INFO",
  "circuit.closed": "INFO",
  "polling.started": "DEBUG",
  "pdf.imported": "INFO",
  "override.manual": "WARN",
};

/**
 * Helper tipado — deve ser preferido a `logIntegration` para eventos
 * estruturados. Mantém retrocompatibilidade: persiste no mesmo
 * `integration_logs` com `context.event = <IntegrationEvent>`.
 */
export async function emitEvent(
  admin: AdminClient,
  tenant_id: string,
  event: IntegrationEvent,
  extra?: Record<string, unknown>,
): Promise<void> {
  const ev: IntegrationEvent = {
    ...event,
    occurred_at: event.occurred_at ?? new Date().toISOString(),
  };
  await logIntegration(admin, {
    tenant_id,
    integration_id: ev.integration_id ?? null,
    job_id: ev.job_id ?? null,
    level: EVENT_LEVEL[ev.type],
    message: `[${ev.type}]${ev.provider ? " " + ev.provider : ""}`,
    context: { event: ev, ...(extra ?? {}) },
  });
}