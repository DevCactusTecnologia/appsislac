// Drawer lateral — Timeline operacional da integração com apoio.
// Lê integration_jobs, integration_logs, integration_requests e
// pdf_override_audit, e renderiza uma timeline cronológica usando
// `resolveIntegrationTimeline`, garantindo padronização visual entre
// telas (sem badges/lógica duplicada).

import { useEffect, useMemo, useState } from "react";
import {
  X, Activity, AlertCircle, AlertTriangle, CheckCircle2, Loader2, RefreshCw,
  Send, Inbox, FileDigit, FileCheck2, Clock, Repeat, XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { db as supabase } from "@/runtime/db";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import {
  resolveIntegrationTimeline,
  TONE_BG_CLASS,
  type TimelineEvent,
  type TimelineEventKind,
} from "@/lib/integration/integrationStatus";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  atendimentoExameId: number | null;
  nomeExame?: string;
  protocoloExterno?: string | null;
  labNome?: string;
  provider?: string | null;
}

interface JobRow {
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
  payload: Record<string, unknown> | null;
}

interface LogRow {
  id: string;
  level: string;
  message: string;
  created_at: string;
  job_id: string | null;
  context: Record<string, unknown> | null;
}

interface RequestRow {
  id: string;
  method: string;
  status_code: number | null;
  duration_ms: number | null;
  created_at: string;
  job_id: string | null;
}

interface OverrideRow {
  id: string;
  acao: string;
  motivo: string | null;
  protocolo_externo: string | null;
  created_at: string;
  uploaded_by: string | null;
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

const EVENT_ICON: Record<TimelineEventKind, React.ComponentType<{ className?: string }>> = {
  ENQUEUED:        Clock,
  SENT:            Send,
  ACK:             CheckCircle2,
  POLLING:         Inbox,
  RESULT_RECEIVED: Inbox,
  PDF_IMPORTED:    FileDigit,
  OVERRIDE_MANUAL: FileCheck2,
  FAILED:          AlertTriangle,
  RETRY:           Repeat,
  CANCELLED:       XCircle,
  TIMEOUT:         AlertCircle,
};

const AuditoriaIntegracaoDrawer = ({
  open, onOpenChange, atendimentoExameId, nomeExame, protocoloExterno, labNome, provider,
}: Props) => {
  useBodyScrollLock(open);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);

  const load = async () => {
    if (!atendimentoExameId) return;
    setLoading(true);
    try {
      const { data: jobsData } = await supabase
        .from("integration_jobs")
        .select("id, kind, status, created_at, scheduled_at, started_at, completed_at, retry_count, last_error, result, payload")
        .filter("payload->>atendimento_exame_id", "eq", String(atendimentoExameId))
        .order("created_at", { ascending: false })
        .limit(50);
      const jobList = (jobsData ?? []) as unknown as JobRow[];
      setJobs(jobList);

      const jobIds = jobList.map((j) => j.id);
      if (jobIds.length > 0) {
        const [{ data: logsData }, { data: reqData }] = await Promise.all([
          supabase
            .from("integration_logs")
            .select("id, level, message, created_at, job_id, context")
            .in("job_id", jobIds)
            .order("created_at", { ascending: false })
            .limit(100),
          supabase
            .from("integration_requests")
            .select("id, method, status_code, duration_ms, created_at, job_id")
            .in("job_id", jobIds)
            .order("created_at", { ascending: false })
            .limit(50),
        ]);
        setLogs((logsData ?? []) as unknown as LogRow[]);
        setRequests((reqData ?? []) as unknown as RequestRow[]);
      } else {
        setLogs([]);
        setRequests([]);
      }

      const { data: ovData } = await supabase
        .from("pdf_override_audit")
        .select("id, acao, motivo, protocolo_externo, created_at, uploaded_by")
        .eq("atendimento_exame_id", atendimentoExameId)
        .order("created_at", { ascending: false })
        .limit(20);
      setOverrides((ovData ?? []) as unknown as OverrideRow[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && atendimentoExameId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, atendimentoExameId]);

  const timeline: TimelineEvent[] = useMemo(
    () => resolveIntegrationTimeline({ jobs, logs, requests, overrides, provider, protocoloExterno }),
    [jobs, logs, requests, overrides, provider, protocoloExterno],
  );

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <motion.div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-[6px]"
            onClick={() => onOpenChange(false)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <motion.aside
            className="ml-auto relative w-full max-w-xl h-full bg-card border-l border-border flex flex-col shadow-[0_24px_80px_-12px_hsl(var(--foreground)/0.22)]"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className="px-6 py-5 border-b border-border flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-foreground truncate">Timeline de integração</h2>
                <p className="text-xs text-muted-foreground truncate">
                  {nomeExame || "Exame"}{labNome ? ` · ${labNome}` : ""}
                  {protocoloExterno ? ` · ${protocoloExterno}` : ""}
                </p>
                {(provider || atendimentoExameId) && (
                  <p className="text-[10px] text-muted-foreground/80 truncate mt-0.5">
                    {provider ? `Provider: ${provider}` : ""}
                    {atendimentoExameId ? `${provider ? " · " : ""}exame #${atendimentoExameId}` : ""}
                  </p>
                )}
              </div>
              <button
                type="button" onClick={() => load()} disabled={loading}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80"
                aria-label="Recarregar"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </button>
              <button
                type="button" onClick={() => onOpenChange(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto">
              {loading && timeline.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
              ) : timeline.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  Nenhum evento de integração para este exame.
                </div>
              ) : (
                <ol className="relative px-6 py-5">
                  <div className="absolute left-[34px] top-6 bottom-6 w-px bg-border" aria-hidden />
                  {timeline.map((ev) => {
                    const Icon = EVENT_ICON[ev.kind] ?? Activity;
                    return (
                      <li key={ev.id} className="relative pl-10 pb-5 last:pb-0">
                        <span
                          className={`absolute left-0 top-1 h-7 w-7 rounded-full flex items-center justify-center ${TONE_BG_CLASS[ev.tone]}`}
                          aria-hidden
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[12px] font-semibold text-foreground">{ev.title}</span>
                          <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${TONE_BG_CLASS[ev.tone]}`}>
                            {ev.kind.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {fmt(ev.timestamp)}
                          {ev.protocoloExterno ? ` · protocolo ${ev.protocoloExterno}` : ""}
                          {ev.jobId ? ` · job ${ev.jobId.slice(0, 8)}` : ""}
                        </p>
                        {ev.detail && (
                          <p className="mt-1 text-[11px] text-foreground/80 break-words">{ev.detail}</p>
                        )}
                        {ev.raw && (
                          <details className="mt-1">
                            <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">Payload</summary>
                            <pre className="mt-1 p-2 rounded-md bg-muted/40 text-[10px] text-foreground overflow-auto max-h-28">
                              {JSON.stringify(ev.raw, null, 2)}
                            </pre>
                          </details>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}

              {requests.length > 0 && (
                <details className="px-6 py-3 border-t border-border">
                  <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                    Requisições HTTP ({requests.length})
                  </summary>
                  <div className="mt-2 space-y-1">
                    {requests.map((r) => (
                      <div key={r.id} className="text-[10px] text-muted-foreground flex items-center gap-2">
                        <code className="px-1 py-0.5 rounded bg-muted text-foreground">{r.method}</code>
                        <span>{r.status_code ?? "?"} · {r.duration_ms ?? 0}ms</span>
                        <span>{fmt(r.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AuditoriaIntegracaoDrawer;