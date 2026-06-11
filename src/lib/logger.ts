// Logger estruturado — substitui console.error solto.
// Em DEV imprime no console; em PROD pode ser plugado em serviço externo
// (Sentry, Datadog, Logflare). Mantém shape consistente para futura ingestão.

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  scope: string;
  message: string;
  ts: string;
  meta?: Record<string, unknown>;
}

const isDev = typeof import.meta !== "undefined" && (import.meta as { env?: { DEV?: boolean } })?.env?.DEV === true;

function emit(entry: LogEntry): void {
  // Console output — formatado por nível
  const prefix = `[${entry.scope}]`;
  const args: unknown[] = [prefix, entry.message];
  if (entry.meta) args.push(entry.meta);

  switch (entry.level) {
    case "debug":
      if (isDev) console.debug(...args);
      break;
    case "info":
      console.info(...args);
      break;
    case "warn":
      console.warn(...args);
      break;
    case "error":
      console.error(...args);
      break;
  }

  // Hook para futuro envio externo
  try {
    const sink = (globalThis as { __logSink?: (e: LogEntry) => void }).__logSink;
    sink?.(entry);
  } catch {
    // ignore
  }
}

function build(level: LogLevel, scope: string, message: string, meta?: Record<string, unknown>): LogEntry {
  return { level, scope, message, ts: new Date().toISOString(), meta };
}

export const logger = {
  debug: (scope: string, message: string, meta?: Record<string, unknown>) =>
    emit(build("debug", scope, message, meta)),
  info: (scope: string, message: string, meta?: Record<string, unknown>) =>
    emit(build("info", scope, message, meta)),
  warn: (scope: string, message: string, meta?: Record<string, unknown>) =>
    emit(build("warn", scope, message, meta)),
  error: (scope: string, message: string, meta?: Record<string, unknown>) =>
    emit(build("error", scope, message, meta)),
};
