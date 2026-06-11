// ============================================================
// Helpers centrais — Integração Hermes / APOIO
// ------------------------------------------------------------
// Centraliza:
//   • resolveIntegrationStatus(row) → status operacional unificado
//   • resolveIntegrationWarnings(row, ctx) → alertas não-bloqueantes
//   • resolveIntegrationTimeline({ jobs, logs, requests, overrides })
//       → eventos cronológicos padronizados para a timeline operacional
//
// Regra: nunca duplicar lógica de status/timeline em componentes.
// ============================================================

import type { AtendimentoExameRow, StatusExterno } from "@/data/atendimentoStore";

// ---------- Status operacional unificado ----------

export type IntegrationStatusKey =
  | "SEM_CONFIGURACAO"
  | "AGUARDANDO_ENVIO"
  | "ENVIADO"
  | "PROCESSANDO"
  | "RETORNO_RECEBIDO"
  | "PDF_IMPORTADO"
  | "FINALIZADO"
  | "FALHA"
  | "OVERRIDE_MANUAL";

export type IntegrationTone = "muted" | "warning" | "info" | "success" | "danger" | "primary";

export interface IntegrationStatus {
  key: IntegrationStatusKey;
  label: string;
  tone: IntegrationTone;
}

const STATUS_EXTERNO_MAP: Record<StatusExterno, IntegrationStatus> = {
  NAO_APLICAVEL:      { key: "SEM_CONFIGURACAO", label: "Sem configuração",  tone: "muted"   },
  AGUARDANDO_ENVIO:   { key: "AGUARDANDO_ENVIO", label: "Aguardando envio",  tone: "warning" },
  ENVIADO:            { key: "ENVIADO",          label: "Enviado",           tone: "info"    },
  EM_ANALISE_LAB:     { key: "PROCESSANDO",      label: "Processando",       tone: "info"    },
  RESULTADO_RECEBIDO: { key: "RETORNO_RECEBIDO", label: "Retorno recebido",  tone: "info"    },
  IMPORTADO:          { key: "PDF_IMPORTADO",    label: "PDF importado",     tone: "success" },
  FINALIZADO:         { key: "FINALIZADO",       label: "Finalizado",        tone: "success" },
  ERRO_INTEGRACAO:    { key: "FALHA",            label: "Falha",             tone: "danger"  },
};

export function resolveIntegrationStatus(row: Pick<AtendimentoExameRow, "status_externo" | "pdf_override_url">): IntegrationStatus {
  // Override manual prevalece visualmente (o operador anexou um PDF).
  if (row.pdf_override_url) {
    return { key: "OVERRIDE_MANUAL", label: "Override manual", tone: "warning" };
  }
  return STATUS_EXTERNO_MAP[row.status_externo] ?? STATUS_EXTERNO_MAP.NAO_APLICAVEL;
}

// ---------- Warnings operacionais (não-bloqueantes) ----------

export type WarningSeverity = "info" | "warning" | "critical";

export interface IntegrationWarning {
  /** Identificador estável do warning (para React key e dedupe). */
  id: string;
  /** Código semântico (ex.: "cfg.provider", "flow.timeout"). Igual ao id. */
  code: string;
  severity: WarningSeverity;
  /** Mensagem curta — usada como texto principal. */
  message: string;
  /** Orientação opcional ao operador (1 frase). */
  hint?: string;
}

export interface ResolveWarningsContext {
  /** Catálogo do exame (para validar configuração de apoio). */
  catalogo?: {
    tipoProcesso?: "INTERNO" | "TERCEIRIZADO";
    permiteEnvioApoio?: boolean;
    providerIntegracao?: string;
    codigoExameApoio?: string;
  } | null;
  /** Existe registro em integration_exam_map para este exame? */
  hasExamMap?: boolean;
  /** Maior retry_count entre os jobs deste exame. */
  maxRetryCount?: number;
  /** Algum job FAILED nas últimas execuções. */
  hasFailedJob?: boolean;
  /** Tempo decorrido (ms) desde o envio sem retorno. */
  awaitingMs?: number | null;
}

const HOURS_24 = 24 * 60 * 60 * 1000;
const RETRY_THRESHOLD = 3;

export function resolveIntegrationWarnings(
  row: Pick<AtendimentoExameRow, "tipo_processo" | "integracao_ativa" | "lab_apoio_id" | "protocolo_externo" | "status_externo" | "pdf_override_url" | "pdf_override_motivo" | "arquivo_resultado_path">,
  ctx: ResolveWarningsContext = {},
): IntegrationWarning[] {
  const out: IntegrationWarning[] = [];
  if (row.tipo_processo !== "TERCEIRIZADO") return out;

  const push = (w: Omit<IntegrationWarning, "id"> & { id?: string }) => {
    const id = w.id ?? w.code;
    out.push({ ...w, id, code: w.code });
  };

  const cat = ctx.catalogo;
  const isFinalState = row.status_externo === "IMPORTADO" || row.status_externo === "FINALIZADO";
  const hasResultReceived = row.status_externo === "RESULTADO_RECEBIDO" || isFinalState;

  // ---------- Configuração ----------
  if (cat?.permiteEnvioApoio && !cat?.providerIntegracao) {
    push({ code: "cfg.provider", severity: "warning",
      message: "Provider de integração não configurado.",
      hint: "Defina o provider no cadastro do exame para permitir envio automático." });
  }
  if (row.integracao_ativa && !cat?.codigoExameApoio && ctx.hasExamMap === false) {
    push({ code: "cfg.codigo_apoio", severity: "warning",
      message: "Sem código do exame no apoio.",
      hint: "Cadastre o código no catálogo ou em integration_exam_map." });
  }

  // ---------- Fluxo operacional ----------
  if (row.integracao_ativa && row.status_externo === "AGUARDANDO_ENVIO") {
    push({ code: "flow.aguardando_envio", severity: "info",
      message: "Pedido aguardando envio ao apoio.",
      hint: "Use 'Enviar agora' ou aguarde o próximo ciclo do dispatcher." });
  }
  if ((row.status_externo === "ENVIADO" || row.status_externo === "EM_ANALISE_LAB") && !row.protocolo_externo) {
    push({ code: "flow.protocolo", severity: "warning",
      message: "Pedido enviado sem protocolo externo.",
      hint: "Reconsulte o apoio para vincular o protocolo retornado." });
  }
  if (ctx.awaitingMs && ctx.awaitingMs > HOURS_24 && !hasResultReceived) {
    const horas = Math.floor(ctx.awaitingMs / 3_600_000);
    push({ code: "flow.aguardando", severity: "warning",
      message: `Aguardando retorno há ${horas}h.`,
      hint: "Reconsulte o apoio ou registre a recoleta se necessário." });
  }
  if (ctx.hasFailedJob) {
    push({ code: "flow.poll_falhou", severity: "critical",
      message: "Última execução de integração falhou.",
      hint: "Abra a auditoria para inspecionar a timeline e o erro reportado." });
  }
  if ((ctx.maxRetryCount ?? 0) >= RETRY_THRESHOLD) {
    push({ code: "flow.retry", severity: "warning",
      message: `Retry excessivo (${ctx.maxRetryCount} tentativas).`,
      hint: "Verifique credenciais e disponibilidade do apoio." });
  }

  // ---------- Resultado / PDF ----------
  if (isFinalState && !row.arquivo_resultado_path && !row.pdf_override_url) {
    push({ code: "pdf.ausente", severity: "info",
      message: "Resultado importado sem PDF anexado.",
      hint: "Anexe o PDF original do apoio para preservar o laudo." });
  }

  // ---------- Override manual ----------
  if (row.pdf_override_url) {
    if (!row.pdf_override_motivo) {
      push({ code: "override.motivo", severity: "warning",
        message: "PDF substituído manualmente sem motivo.",
        hint: "Registre o motivo do override para auditoria regulatória." });
    } else {
      push({ code: "override.ok", severity: "info",
        message: "PDF do laudo substituído manualmente.",
        hint: "Override registrado em auditoria." });
    }
  }

  // ---------- Integridade ----------
  if (isFinalState && row.integracao_ativa && !row.protocolo_externo && !row.pdf_override_url) {
    push({ code: "integ.protocolo", severity: "warning",
      message: "Status final sem protocolo externo.",
      hint: "Verifique se o exame foi realmente processado pelo apoio." });
  }

  return prioritizeWarnings(out);
}

// ---------- Priorização & dedupe ----------

const SEVERITY_RANK: Record<WarningSeverity, number> = { critical: 0, warning: 1, info: 2 };

/** Ordena por severidade (critical → warning → info), preservando ordem de inserção
 *  dentro do mesmo nível, e remove códigos duplicados. */
export function prioritizeWarnings(list: IntegrationWarning[]): IntegrationWarning[] {
  const seen = new Set<string>();
  const dedup: IntegrationWarning[] = [];
  for (const w of list) {
    if (seen.has(w.code)) continue;
    seen.add(w.code);
    dedup.push(w);
  }
  return dedup
    .map((w, i) => ({ w, i }))
    .sort((a, b) => {
      const sa = SEVERITY_RANK[a.w.severity] ?? 9;
      const sb = SEVERITY_RANK[b.w.severity] ?? 9;
      return sa !== sb ? sa - sb : a.i - b.i;
    })
    .map((x) => x.w);
}

// ---------- Timeline operacional ----------

export type TimelineEventKind =
  | "ENQUEUED"
  | "SENT"
  | "ACK"
  | "POLLING"
  | "RESULT_RECEIVED"
  | "PDF_IMPORTED"
  | "OVERRIDE_MANUAL"
  | "FAILED"
  | "RETRY"
  | "CANCELLED"
  | "TIMEOUT";

export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  timestamp: string;
  title: string;
  detail?: string;
  jobId?: string | null;
  requestId?: string | null;
  protocoloExterno?: string | null;
  provider?: string | null;
  tone: IntegrationTone;
  /** Payload bruto opcional (mantido escondido em <details>). */
  raw?: Record<string, unknown> | null;
}

interface TimelineJob {
  id: string;
  kind: string;
  status: string;
  created_at: string;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  retry_count: number;
  last_error: string | null;
  result: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
}

interface TimelineLog {
  id: string;
  level: string;
  message: string;
  created_at: string;
  job_id: string | null;
  context: Record<string, unknown> | null;
}

interface TimelineRequest {
  id: string;
  method: string;
  status_code: number | null;
  duration_ms: number | null;
  created_at: string;
  job_id: string | null;
}

interface TimelineOverride {
  id: string;
  acao: string;
  motivo: string | null;
  protocolo_externo: string | null;
  created_at: string;
  uploaded_by: string | null;
}

interface ResolveTimelineInput {
  jobs: TimelineJob[];
  logs: TimelineLog[];
  requests: TimelineRequest[];
  overrides?: TimelineOverride[];
  provider?: string | null;
  protocoloExterno?: string | null;
}

const JOB_KIND_TO_EVENT: Record<string, { kind: TimelineEventKind; title: string; tone: IntegrationTone }> = {
  SEND_ORDER:    { kind: "SENT",     title: "Pedido enviado ao apoio",     tone: "info"    },
  POLL_RESULT:   { kind: "POLLING",  title: "Consulta de resultado",       tone: "info"    },
  FETCH_PDF:     { kind: "PDF_IMPORTED", title: "PDF do laudo importado",  tone: "success" },
  FETCH_PENDING: { kind: "POLLING",  title: "Verificação de pendências",   tone: "info"    },
  FETCH_TRACE:   { kind: "POLLING",  title: "Trace de integração",         tone: "muted"   },
};

export function resolveIntegrationTimeline(input: ResolveTimelineInput): TimelineEvent[] {
  const { jobs, logs, requests, overrides = [], provider, protocoloExterno } = input;
  const events: TimelineEvent[] = [];

  for (const job of jobs) {
    const def = JOB_KIND_TO_EVENT[job.kind] ?? { kind: "ENQUEUED" as TimelineEventKind, title: job.kind, tone: "muted" as IntegrationTone };

    // 1. ENQUEUED — sempre que o job foi criado.
    events.push({
      id: `${job.id}.enqueued`,
      kind: "ENQUEUED",
      timestamp: job.created_at,
      title: `Job enfileirado · ${def.title}`,
      jobId: job.id,
      provider,
      protocoloExterno,
      tone: "muted",
    });

    // 2. SENT/POLLING/PDF_IMPORTED — quando começou a processar.
    if (job.started_at) {
      events.push({
        id: `${job.id}.started`,
        kind: def.kind,
        timestamp: job.started_at,
        title: def.title,
        jobId: job.id,
        provider,
        protocoloExterno,
        tone: def.tone,
      });
    }

    // 3. RETRY — se houve mais de uma tentativa.
    if (job.retry_count > 0) {
      events.push({
        id: `${job.id}.retry`,
        kind: "RETRY",
        timestamp: job.started_at ?? job.created_at,
        title: `Retry (${job.retry_count} tentativa${job.retry_count > 1 ? "s" : ""})`,
        jobId: job.id,
        tone: "warning",
      });
    }

    // 4. ACK / RESULT_RECEIVED / FAILED / CANCELLED — terminal.
    if (job.completed_at) {
      if (job.status === "FAILED") {
        events.push({
          id: `${job.id}.failed`,
          kind: "FAILED",
          timestamp: job.completed_at,
          title: "Falha de integração",
          detail: job.last_error ?? undefined,
          jobId: job.id,
          tone: "danger",
          raw: job.result,
        });
      } else if (job.status === "CANCELLED") {
        events.push({
          id: `${job.id}.cancelled`,
          kind: "CANCELLED",
          timestamp: job.completed_at,
          title: "Job cancelado",
          jobId: job.id,
          tone: "muted",
        });
      } else if (job.status === "COMPLETED") {
        const isResult = job.kind === "POLL_RESULT" || job.kind === "FETCH_PENDING";
        events.push({
          id: `${job.id}.done`,
          kind: isResult ? "RESULT_RECEIVED" : "ACK",
          timestamp: job.completed_at,
          title: isResult ? "Resultado recebido do apoio" : `${def.title} concluído`,
          jobId: job.id,
          tone: "success",
          raw: job.result,
        });
      }
    }
  }

  // 5. Override manual — sempre alta prioridade visual.
  for (const ov of overrides) {
    events.push({
      id: `ov.${ov.id}`,
      kind: "OVERRIDE_MANUAL",
      timestamp: ov.created_at,
      title: ov.acao === "REPLACE" ? "PDF substituído manualmente" : `Override manual · ${ov.acao}`,
      detail: ov.motivo ?? undefined,
      protocoloExterno: ov.protocolo_externo,
      tone: "warning",
    });
  }

  // 6. Logs ERROR/WARN sem job vinculado — eventos avulsos relevantes.
  for (const log of logs) {
    if (log.level !== "ERROR" && log.level !== "WARN" && log.level !== "CRITICAL") continue;
    if (log.job_id && jobs.some((j) => j.id === log.job_id)) continue; // já coberto pelo job
    events.push({
      id: `log.${log.id}`,
      kind: log.level === "WARN" ? "RETRY" : "FAILED",
      timestamp: log.created_at,
      title: log.message,
      jobId: log.job_id ?? undefined,
      tone: log.level === "WARN" ? "warning" : "danger",
      raw: log.context,
    });
  }

  // Ordem cronológica DESC (mais recente em cima).
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events;
}

export const TONE_BG_CLASS: Record<IntegrationTone, string> = {
  muted:   "bg-muted text-muted-foreground",
  warning: "bg-status-warning/10 text-status-warning",
  info:    "bg-status-info/10 text-status-info",
  success: "bg-status-success/10 text-status-success",
  danger:  "bg-destructive/10 text-destructive",
  primary: "bg-primary/10 text-primary",
};

export const TONE_DOT_CLASS: Record<IntegrationTone, string> = {
  muted:   "bg-muted-foreground/40",
  warning: "bg-status-warning",
  info:    "bg-status-info",
  success: "bg-status-success",
  danger:  "bg-destructive",
  primary: "bg-primary",
};

/** Type-only re-exports (helpers fora deste arquivo podem precisar). */
export type { TimelineJob, TimelineLog, TimelineRequest, TimelineOverride };