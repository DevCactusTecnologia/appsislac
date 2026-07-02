// Wizard de migração Shared → Dedicated (Fase 3).
// Layout dashboard: timeline lateral + painel ativo com contexto operacional.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, CheckCircle2, Circle, Loader2, XCircle, AlertTriangle,
  Cable, Database, Users, Boxes, HardDrive, ShieldCheck, Zap, History,
  Lock, ArrowRight, RefreshCw, Info, Undo2,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type StepKey = "prep" | "schema" | "auth" | "data" | "storage" | "smoke" | "flip" | "post";
type StepState = "idle" | "running" | "ok" | "failed";

interface StepDef {
  key: StepKey;
  index: number;
  title: string;
  short: string;
  description: string;
  icon: typeof Cable;
  bullets: string[];
  turno: "T1" | "T2" | "T3";
}

const STEPS: StepDef[] = [
  { key: "prep", index: 1, turno: "T1", icon: Cable, title: "Preparação", short: "Handshake",
    description: "Confere se o projeto dedicado está acessível e todos os secrets/URLs foram cadastrados.",
    bullets: [
      "Testa a URL e a anon key do projeto dedicado",
      "Valida se o secret da service role está presente",
      "Bloqueia as próximas etapas em caso de config incompleta",
    ]},
  { key: "schema", index: 2, turno: "T1", icon: Database, title: "Provisionar schema", short: "DDL",
    description: "Aplica no banco dedicado toda a estrutura do SISLAC — tabelas, funções, triggers, RLS.",
    bullets: [
      "Executa o dump DDL do shared no dedicado",
      "Recria funções SECURITY DEFINER e policies",
      "Idempotente: pode ser reexecutado com segurança",
    ]},
  { key: "auth", index: 3, turno: "T1", icon: Users, title: "Migrar identidades", short: "Auth",
    description: "Copia os usuários do tenant preservando UUIDs, e-mails e hashes de senha.",
    bullets: [
      "Preserva auth.uid() → RLS continua funcionando após o flip",
      "Copia profiles e user_roles com foreign keys íntegras",
      "Sessões existentes seguem válidas no dedicado",
    ]},
  { key: "data", index: 4, turno: "T2", icon: Boxes, title: "Migrar dados", short: "Payload",
    description: "Copia todo o payload operacional do tenant na ordem correta de dependência.",
    bullets: [
      "Rode primeiro em Dry-run para conferir volumes",
      "Só depois execute a carga real",
      "Respeita FKs, sequences e integridade referencial",
    ]},
  { key: "storage", index: 5, turno: "T2", icon: HardDrive, title: "Migrar arquivos", short: "Storage",
    description: "Espelha os buckets do Storage do tenant (laudos, assinaturas, anexos) para o dedicado.",
    bullets: [
      "Copia buckets preservando paths e metadata",
      "Requer o secret SB_SERVICE_ROLE_ do projeto dedicado",
      "Reexecutável — só copia o que ainda não existe no destino",
    ]},
  { key: "smoke", index: 6, turno: "T2", icon: ShieldCheck, title: "Smoke test", short: "QA",
    description: "Compara contagens críticas entre shared e dedicado. Portão de qualidade obrigatório.",
    bullets: [
      "Compara contagens por tabela e por schema",
      "Precisa ficar 100% verde para liberar o Flip",
      "Sucesso parcial → investigue antes de virar o runtime",
    ]},
  { key: "flip", index: 7, turno: "T3", icon: Zap, title: "Flip para dedicado", short: "Cutover",
    description: "Vira o runtime do tenant. A partir daqui todo tráfego opera no banco dedicado.",
    bullets: [
      "Só habilita após smoke test 100% verde",
      "Grava frozen_at e inicia janela de quarentena de 30 dias",
      "Operação atômica e auditada em tenant_migration_runs",
    ]},
  { key: "post", index: 8, turno: "T3", icon: History, title: "Pós-migração", short: "Quarentena",
    description: "Rollback disponível por 30 dias. Após a quarentena, o purge remove o tenant do shared.",
    bullets: [
      "Rollback devolve o runtime para shared_db imediatamente",
      "Purge é definitivo — só disponível após 30 dias",
      "Confirme a limpeza rodando Purge dry-run antes",
    ]},
];

interface RunResult { ok: boolean; error?: string; data?: unknown }
interface MigrationRunRow {
  status?: string | null;
  error?: string | null;
  stats?: { failures?: Array<{ stage?: string; name?: string; error?: string }>; warnings?: unknown[]; ms?: number } | null;
  created_at?: string | null;
  finished_at?: string | null;
}
interface StructuredFailure { message: string; code?: string; hint?: string; stage?: string }

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function readInvokeFailure(data: unknown): StructuredFailure | null {
  if (!data || typeof data !== "object") return null;
  const payload = data as { ok?: boolean; error?: unknown; code?: unknown; hint?: unknown; stage?: unknown; errors?: unknown; failures?: unknown };
  if (payload.ok !== false) return null;
  const code = typeof payload.code === "string" ? payload.code : undefined;
  const hint = typeof payload.hint === "string" ? payload.hint : undefined;
  const stage = typeof payload.stage === "string" ? payload.stage : undefined;
  if (typeof payload.error === "string") return { message: payload.error, code, hint, stage };
  if (Array.isArray(payload.errors) && payload.errors.length) return { message: payload.errors.slice(0, 3).join(" | "), code, hint, stage };
  if (Array.isArray(payload.failures) && payload.failures.length) return { message: JSON.stringify(payload.failures.slice(0, 3)), code, hint, stage };
  return { message: "A etapa retornou falha lógica. Veja os detalhes no log.", code, hint, stage };
}

function StatusDot({ state }: { state: StepState }) {
  if (state === "running") return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
  if (state === "ok") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
  if (state === "failed") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground/60" />;
}

function stateLabel(s: StepState) {
  return s === "running" ? "Executando" : s === "ok" ? "Concluído" : s === "failed" ? "Falhou" : "Pendente";
}

export default function SuperAdminMigration() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<{ id: string; slug: string; name: string; runtime_mode: string | null; migration_state: string | null; frozen_at: string | null } | null>(null);
  const [states, setStates] = useState<Record<StepKey, StepState>>({
    prep: "idle", schema: "idle", auth: "idle", data: "idle", storage: "idle", smoke: "idle", flip: "idle", post: "idle",
  });
  const [logs, setLogs] = useState<Record<StepKey, string>>({
    prep: "", schema: "", auth: "", data: "", storage: "", smoke: "", flip: "", post: "",
  });
  const [failures, setFailures] = useState<Record<StepKey, StructuredFailure | null>>({
    prep: null, schema: null, auth: null, data: null, storage: null, smoke: null, flip: null, post: null,
  });
  const [purgeType, setPurgeType] = useState("");
  const [activeKey, setActiveKey] = useState<StepKey>("prep");
  const [flipOpen, setFlipOpen] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);

  const setState = (k: StepKey, s: StepState) => setStates((p) => ({ ...p, [k]: s }));
  const appendLog = (k: StepKey, line: string) => setLogs((p) => ({ ...p, [k]: `${p[k]}${p[k] ? "\n" : ""}${line}` }));
  const setFailure = (k: StepKey, f: StructuredFailure | null) => setFailures((p) => ({ ...p, [k]: f }));

  const loadTenant = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase.from("tenants").select("id, slug, nome").eq("id", id).maybeSingle();
    if (error || !data) { toast.error("Laboratório não encontrado"); return; }
    const { data: reg } = await supabase.from("tenant_registry").select("runtime_mode, migration_state, frozen_at").eq("tenant_id", id).maybeSingle();
    setTenant({
      id: data.id, slug: data.slug, name: data.nome,
      runtime_mode: reg?.runtime_mode ?? null,
      migration_state: (reg as { migration_state?: string } | null)?.migration_state ?? null,
      frozen_at: (reg as { frozen_at?: string } | null)?.frozen_at ?? null,
    });
  }, [id]);

  useEffect(() => { void loadTenant(); }, [loadTenant]);

  // Hidrata estado das etapas a partir do histórico do backend (evita perder progresso ao recarregar a página).
  useEffect(() => {
    if (!id) return;
    (async () => {
      const phases: StepKey[] = ["prep", "schema", "auth", "data", "storage", "smoke"];
      const { data } = await supabase
        .from("tenant_migration_runs")
        .select("phase, status, finished_at")
        .eq("tenant_id", id)
        .in("phase", phases)
        .order("finished_at", { ascending: false });
      if (!data) return;
      const seen = new Set<string>();
      const next: Partial<Record<StepKey, StepState>> = {};
      for (const row of data as Array<{ phase: string; status: string; finished_at: string | null }>) {
        if (seen.has(row.phase)) continue;
        seen.add(row.phase);
        if (row.status === "ok") next[row.phase as StepKey] = "ok";
        else if (row.status === "failed") next[row.phase as StepKey] = "failed";
      }
      if (Object.keys(next).length) setStates((p) => ({ ...p, ...next }));
    })();
  }, [id]);

  const loadLastRunError = useCallback(async (phase: StepKey): Promise<string | null> => {
    if (!id) return null;
    const { data } = await supabase
      .from("tenant_migration_runs")
      .select("stats, error, status")
      .eq("tenant_id", id).eq("phase", phase)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const row = data as { stats?: { failures?: Array<{ stage?: string; name?: string; error?: string }> }; error?: string | null; status?: string } | null;
    if (!row) return null;
    const firstFailure = row.stats?.failures?.[0];
    if (firstFailure?.error) return `${firstFailure.stage ?? "etapa"}: ${firstFailure.error}`;
    if (row.error) return row.error;
    if (row.status === "running") return "A execução ainda está em andamento no backend. Aguarde alguns segundos e atualize.";
    return null;
  }, [id]);

  const waitPhaseCompletion = useCallback(async (phase: StepKey, startedAt?: string): Promise<MigrationRunRow | null> => {
    if (!id) return null;
    const since = startedAt ?? new Date(Date.now() - 5_000).toISOString();
    for (let attempt = 0; attempt < 90; attempt++) {
      const { data } = await supabase
        .from("tenant_migration_runs")
        .select("status, stats, error, created_at, finished_at")
        .eq("tenant_id", id).eq("phase", phase)
        .gte("created_at", since)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      const row = data as MigrationRunRow | null;
      if (row && row.status && row.status !== "running") return row;
      await delay(attempt < 10 ? 1_000 : 2_000);
    }
    return null;
  }, [id]);

  const invoke = useCallback(async (fn: string, body: Record<string, unknown>, key: StepKey): Promise<RunResult> => {
    setState(key, "running"); setFailure(key, null);
    appendLog(key, `→ ${fn} ${JSON.stringify(body).slice(0, 120)}`);
    const { data, error } = await supabase.functions.invoke(fn, { body });
    if (error) {
      const runMsg = await loadLastRunError(key);
      const msg = runMsg ?? (data as { error?: string } | null)?.error ?? error.message;
      appendLog(key, `✗ ${msg}`); setFailure(key, { message: msg }); setState(key, "failed");
      return { ok: false, error: msg };
    }
    const logicalFailure = readInvokeFailure(data);
    if (logicalFailure) {
      const prefix = logicalFailure.code ? `[${logicalFailure.code}] ` : "";
      appendLog(key, `✗ ${prefix}${logicalFailure.message}`);
      if (logicalFailure.hint) appendLog(key, `↳ ${logicalFailure.hint}`);
      appendLog(key, JSON.stringify(data).slice(0, 800));
      setFailure(key, logicalFailure); setState(key, "failed");
      return { ok: false, error: logicalFailure.message, data };
    }
    const asyncPayload = data as { async?: boolean; status?: string; startedAt?: string } | null;
    if (asyncPayload?.async && asyncPayload.status === "running") {
      appendLog(key, "↻ Execução iniciada em segundo plano; acompanhando conclusão...");
      const run = await waitPhaseCompletion(key, asyncPayload.startedAt);
      if (!run) {
        const msg = "Tempo limite aguardando conclusão da etapa. Atualize a página e consulte o último run.";
        appendLog(key, `✗ ${msg}`); setFailure(key, { message: msg }); setState(key, "failed");
        return { ok: false, error: msg, data };
      }
      if (run.status !== "ok") {
        const firstFailure = run.stats?.failures?.[0];
        const msg = firstFailure?.error ? `${firstFailure.stage ?? "etapa"}: ${firstFailure.error}` : run.error ?? `Etapa finalizou como ${run.status}`;
        appendLog(key, `✗ ${msg}`); appendLog(key, JSON.stringify(run).slice(0, 800));
        setFailure(key, { message: msg, stage: firstFailure?.stage }); setState(key, "failed");
        return { ok: false, error: msg, data: run };
      }
      appendLog(key, `✓ ${JSON.stringify(run).slice(0, 400)}`);
      setState(key, "ok"); void loadTenant();
      return { ok: true, data: run };
    }
    appendLog(key, `✓ ${JSON.stringify(data).slice(0, 400)}`);
    setState(key, "ok");
    return { ok: true, data };
  }, [loadLastRunError, loadTenant, waitPhaseCompletion]);

  const runPrep = () => invoke("super-admin-test-tenant-anon-key", { tenantId: id }, "prep");
  const runSchema = () => invoke("super-admin-provision-tenant-schema-full", { tenantId: id }, "schema");
  const runAuth = () => invoke("super-admin-migrate-tenant-auth", { tenantId: id }, "auth");
  const runDataDry = () => invoke("super-admin-migrate-tenant-data", { tenantId: id, dryRun: true }, "data");
  const runData = () => invoke("super-admin-migrate-tenant-data", { tenantId: id }, "data");
  const runStorage = () => invoke("super-admin-migrate-tenant-storage", { tenantId: id }, "storage");
  const runSmoke = () => invoke("super-admin-migration-smoke-test", { tenantId: id }, "smoke");
  const runFlip = async () => {
    setFlipOpen(false);
    const r = await invoke("super-admin-migration-flip", { tenantId: id, confirm: "FLIP" }, "flip");
    if (r.ok) await loadTenant();
  };
  const runRollback = async () => {
    setRollbackOpen(false);
    const r = await invoke("super-admin-migration-rollback", { tenantId: id, confirm: "ROLLBACK" }, "post");
    if (r.ok) await loadTenant();
  };
  const runPurgeDry = () => invoke("super-admin-purge-tenant-from-shared", { tenantId: id, dryRun: true }, "post");
  const runPurge = async () => {
    if (purgeType !== id) { toast.error("Digite o ID do tenant para confirmar"); return; }
    if (!confirm("Purge é IRREVERSÍVEL. Confirmar?")) return;
    const r = await invoke("super-admin-purge-tenant-from-shared", { tenantId: id, confirm: "PURGE", typedTenantId: id }, "post");
    if (r.ok) await loadTenant();
  };

  const isDedicated = tenant?.runtime_mode === "isolated_db";
  const quarantineDaysLeft = useMemo(() => {
    if (!tenant?.frozen_at) return null;
    const days = 30 - Math.floor((Date.now() - new Date(tenant.frozen_at).getTime()) / 86400000);
    return Math.max(0, days);
  }, [tenant?.frozen_at]);

  const completedCount = useMemo(() => STEPS.filter((s) => states[s.key] === "ok").length, [states]);
  const progressPct = Math.round((completedCount / STEPS.length) * 100);

  if (!tenant) {
    return <div className="p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const active = STEPS.find((s) => s.key === activeKey)!;
  const activeState = states[active.key];
  const activeFailure = failures[active.key];
  const activeLog = logs[active.key];

  const canFlip = states.smoke === "ok" && !isDedicated;

  const renderActionButtons = () => {
    const running = activeState === "running";
    if (active.key === "prep")    return <Button size="sm" onClick={runPrep} disabled={running}><Cable className="h-3.5 w-3.5 mr-1.5" />Testar conexão</Button>;
    if (active.key === "schema")  return <Button size="sm" onClick={runSchema} disabled={running}><Database className="h-3.5 w-3.5 mr-1.5" />Provisionar schema</Button>;
    if (active.key === "auth")    return <Button size="sm" onClick={runAuth} disabled={running}><Users className="h-3.5 w-3.5 mr-1.5" />Migrar identidades</Button>;
    if (active.key === "data")    return <>
      <Button size="sm" variant="outline" onClick={runDataDry} disabled={running}>Dry-run</Button>
      <Button size="sm" onClick={runData} disabled={running}><Boxes className="h-3.5 w-3.5 mr-1.5" />Migrar dados</Button>
    </>;
    if (active.key === "storage") return <Button size="sm" onClick={runStorage} disabled={running}><HardDrive className="h-3.5 w-3.5 mr-1.5" />Migrar arquivos</Button>;
    if (active.key === "smoke")   return <Button size="sm" onClick={runSmoke} disabled={running}><ShieldCheck className="h-3.5 w-3.5 mr-1.5" />Executar smoke</Button>;
    if (active.key === "flip")    return <Button size="sm" onClick={() => setFlipOpen(true)} disabled={!canFlip || running}><Zap className="h-3.5 w-3.5 mr-1.5" />Flip para dedicado</Button>;
    if (active.key === "post" && isDedicated) return <>
      <Button size="sm" variant="outline" onClick={runRollback}><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Rollback</Button>
      <Button size="sm" variant="outline" onClick={runPurgeDry}>Purge dry-run</Button>
    </>;
    return null;
  };

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/super-admin/laboratorios/${id}`)} className="h-8 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <div className="h-6 w-px bg-border" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold truncate">Migração Shared → Dedicated</h1>
                <Badge variant={isDedicated ? "default" : "secondary"} className="h-5 text-[10px]">
                  {isDedicated ? "Dedicado" : "Compartilhado"}
                </Badge>
                {tenant.migration_state && <Badge variant="outline" className="h-5 text-[10px]">{tenant.migration_state}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground truncate">{tenant.name} · <code>{tenant.slug}</code></p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Progresso</div>
              <div className="text-sm font-medium">{completedCount}/{STEPS.length} etapas · {progressPct}%</div>
            </div>
            <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Sidebar timeline */}
        <aside className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Roteiro da migração</div>
              <button onClick={() => void loadTenant()} className="text-muted-foreground hover:text-foreground transition-colors">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            <ol className="space-y-1">
              {STEPS.map((step, i) => {
                const s = states[step.key];
                const isActive = step.key === activeKey;
                const Icon = step.icon;
                const isLast = i === STEPS.length - 1;
                return (
                  <li key={step.key} className="relative">
                    {!isLast && <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />}
                    <button
                      type="button"
                      onClick={() => setActiveKey(step.key)}
                      className={`w-full flex items-start gap-3 rounded-md px-2 py-2 text-left transition-colors ${
                        isActive ? "bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted/60"
                      }`}
                    >
                      <div className={`relative flex h-8 w-8 items-center justify-center rounded-full border ${
                        s === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                        s === "failed" ? "bg-destructive/10 border-destructive/30 text-destructive" :
                        s === "running" ? "bg-primary/10 border-primary/30 text-primary" :
                        isActive ? "bg-background border-primary/40 text-primary" :
                        "bg-background border-border text-muted-foreground"
                      }`}>
                        {s === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
                         s === "ok" ? <CheckCircle2 className="h-4 w-4" /> :
                         s === "failed" ? <XCircle className="h-4 w-4" /> :
                         <Icon className="h-3.5 w-3.5" />}
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-muted-foreground">{String(step.index).padStart(2, "0")}</span>
                          <span className={`text-sm truncate ${isActive ? "font-medium" : ""}`}>{step.title}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] px-1.5 py-0 rounded bg-muted text-muted-foreground font-mono">{step.turno}</span>
                          <span className="text-[11px] text-muted-foreground">{stateLabel(s)}</span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card className="p-3 bg-amber-50 border-amber-200">
            <div className="flex gap-2">
              <Info className="h-3.5 w-3.5 text-amber-700 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 leading-relaxed">
                Execute na ordem. Cada etapa é <strong>idempotente</strong> — pode reexecutar em caso de falha.
                O Flip só libera com smoke test 100% verde.
              </p>
            </div>
          </Card>
        </aside>

        {/* Active panel */}
        <main className="min-w-0">
          <Card className="p-6 space-y-6">
            {/* Panel header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-10 w-10 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                  <active.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">Etapa {String(active.index).padStart(2, "0")} · Turno {active.turno}</span>
                    <Badge variant="outline" className="h-4 text-[9px] px-1.5">{active.short}</Badge>
                  </div>
                  <h2 className="text-lg font-semibold mt-0.5">{active.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{active.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 text-xs text-muted-foreground">
                <StatusDot state={activeState} />
                <span>{stateLabel(activeState)}</span>
              </div>
            </div>

            {/* Bullets */}
            <div className="grid sm:grid-cols-3 gap-3">
              {active.bullets.map((b, i) => (
                <div key={i} className="rounded-md border bg-muted/30 p-3">
                  <div className="text-[10px] font-mono text-muted-foreground mb-1">0{i + 1}</div>
                  <p className="text-xs text-foreground/80 leading-relaxed">{b}</p>
                </div>
              ))}
            </div>

            {/* Gate warnings */}
            {active.key === "flip" && !canFlip && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
                <Lock className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <div className="font-medium">Flip bloqueado</div>
                  <div>
                    {isDedicated
                      ? "O tenant já opera em banco dedicado. Use a etapa 8 para rollback."
                      : "Execute e finalize o Smoke test com sucesso total antes de virar o runtime."}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-4 pt-2 border-t">
              <div className="flex gap-2 flex-wrap">{renderActionButtons()}</div>
              <div className="flex items-center gap-2">
                {active.index > 1 && (
                  <Button size="sm" variant="ghost" onClick={() => setActiveKey(STEPS[active.index - 2].key)}>
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Anterior
                  </Button>
                )}
                {active.index < STEPS.length && (
                  <Button size="sm" variant="ghost" onClick={() => setActiveKey(STEPS[active.index].key)}>
                    Próxima <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                )}
              </div>
            </div>

            {/* Post-migration extras */}
            {active.key === "post" && isDedicated && (
              <div className="rounded-md border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-medium">Janela de quarentena</div>
                    <div className="text-[11px] text-muted-foreground">
                      {tenant.frozen_at
                        ? <>Congelado em {new Date(tenant.frozen_at).toLocaleString("pt-BR")}</>
                        : "Ainda não congelado"}
                    </div>
                  </div>
                  <Badge variant={quarantineDaysLeft === 0 ? "destructive" : "outline"} className="h-6">
                    {quarantineDaysLeft ?? 30} dias restantes
                  </Badge>
                </div>
                <div className="h-px bg-border" />
                <div>
                  <div className="text-xs font-medium mb-1">Purge definitivo</div>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Remove o tenant do banco compartilhado. Só disponível após a quarentena. Digite o ID abaixo para habilitar.
                  </p>
                  <div className="flex gap-2 items-center">
                    <Input
                      value={purgeType}
                      onChange={(e) => setPurgeType(e.target.value)}
                      placeholder={`Digite ${id} para confirmar`}
                      className="h-8 text-xs font-mono"
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={runPurge}
                      disabled={purgeType !== id || (quarantineDaysLeft ?? 30) > 0}
                    >
                      Purge
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Failure card */}
            {activeFailure && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-destructive">Falha na etapa</span>
                      {activeFailure.code && (
                        <code className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-mono">{activeFailure.code}</code>
                      )}
                      {activeFailure.stage && (
                        <span className="text-[10px] text-muted-foreground">estágio: {activeFailure.stage}</span>
                      )}
                    </div>
                    <div className="text-foreground">{activeFailure.message}</div>
                    {activeFailure.hint && (
                      <div className="text-muted-foreground flex gap-1"><span>💡</span><span>{activeFailure.hint}</span></div>
                    )}
                    {activeFailure.code?.startsWith("DEDICATED_") && (
                      <Button size="sm" variant="outline" className="h-7 mt-2" onClick={() => navigate(`/super-admin/laboratorios/${id}?tab=database`)}>
                        Abrir configuração do banco dedicado
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Log terminal */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Console de execução</div>
                {activeLog && (
                  <button
                    onClick={() => setLogs((p) => ({ ...p, [active.key]: "" }))}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div className="h-56 rounded-md border bg-foreground/[0.03] overflow-auto">
                <pre className="text-[11px] font-mono p-3 whitespace-pre-wrap leading-relaxed text-foreground/80">
                  {activeLog || <span className="text-muted-foreground">Aguardando execução…</span>}
                </pre>
              </div>
            </div>
          </Card>
        </main>
      </div>

      <AlertDialog open={flipOpen} onOpenChange={setFlipOpen}>
        <AlertDialogContent className="max-w-md p-0 overflow-hidden gap-0">
          <div className="relative border-b bg-gradient-to-br from-amber-500/10 via-background to-background px-6 pt-6 pb-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Zap className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <AlertDialogHeader className="space-y-1 text-left">
                  <AlertDialogTitle className="text-base font-semibold tracking-tight">
                    Confirmar cutover para banco dedicado
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-xs text-muted-foreground">
                    Ação de alto impacto — leia antes de prosseguir.
                  </AlertDialogDescription>
                </AlertDialogHeader>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-3 text-sm">
            <p className="text-foreground/90 leading-relaxed">
              O tenant <span className="font-medium text-foreground">{tenant?.name ?? "—"}</span> passará a operar
              <span className="font-medium text-foreground"> imediatamente</span> no projeto dedicado. O banco compartilhado
              será marcado como <span className="font-medium">somente-leitura lógico</span> (frozen).
            </p>
            <ul className="space-y-1.5 rounded-md border bg-muted/40 p-3 text-xs">
              <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500" /><span>Smoke test verde nos últimos 60 min é obrigatório.</span></li>
              <li className="flex gap-2"><History className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" /><span>Janela de rollback: 30 dias após o flip.</span></li>
              <li className="flex gap-2"><Lock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" /><span>Sessões ativas do tenant precisarão reautenticar.</span></li>
            </ul>
          </div>

          <AlertDialogFooter className="border-t bg-muted/30 px-6 py-3">
            <AlertDialogCancel className="mt-0">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={runFlip}
              className="bg-amber-600 hover:bg-amber-600/90 text-white focus-visible:ring-amber-500"
            >
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              Executar flip
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
