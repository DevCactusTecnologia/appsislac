// Wizard de migração Shared → Dedicated (Fase 3).
// 7 etapas em cards verticais, com invocação das edges do turno T1/T2.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, Circle, Loader2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type StepKey = "prep" | "schema" | "auth" | "data" | "storage" | "smoke" | "flip" | "post";

interface StepDef {
  key: StepKey;
  index: number;
  title: string;
  description: string;
}

const STEPS: StepDef[] = [
  { key: "prep", index: 1, title: "Preparação", description: "Verifica se o banco dedicado responde e os secrets estão cadastrados." },
  { key: "schema", index: 2, title: "Provisionar schema", description: "Cria tabelas, funções e triggers no banco dedicado." },
  { key: "auth", index: 3, title: "Migrar identidades", description: "Copia usuários preservando IDs e senhas." },
  { key: "data", index: 4, title: "Migrar dados", description: "Executa dry-run e, em seguida, a carga na ordem correta." },
  { key: "storage", index: 5, title: "Migrar arquivos", description: "Copia buckets do Storage do tenant." },
  { key: "smoke", index: 6, title: "Smoke test", description: "Compara contagens críticas entre shared e dedicado." },
  { key: "flip", index: 7, title: "Flip para dedicado", description: "Vira o runtime do tenant. Somente com smoke 100%." },
  { key: "post", index: 8, title: "Pós-migração", description: "Rollback disponível por 30 dias. Purge após a quarentena." },
];

interface RunResult { ok: boolean; error?: string; data?: unknown }

interface MigrationRunRow {
  status?: string | null;
  error?: string | null;
  stats?: {
    failures?: Array<{ stage?: string; name?: string; error?: string }>;
    warnings?: unknown[];
    ms?: number;
  } | null;
  created_at?: string | null;
  finished_at?: string | null;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function readInvokeFailure(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const payload = data as { ok?: boolean; error?: unknown; errors?: unknown; failures?: unknown };
  if (payload.ok !== false) return null;
  if (typeof payload.error === "string") return payload.error;
  if (Array.isArray(payload.errors) && payload.errors.length) return payload.errors.slice(0, 3).join(" | ");
  if (Array.isArray(payload.failures) && payload.failures.length) return JSON.stringify(payload.failures.slice(0, 3));
  return "A etapa retornou falha lógica. Veja os detalhes no log.";
}

function StatusIcon({ state }: { state: "idle" | "running" | "ok" | "failed" }) {
  if (state === "running") return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  if (state === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (state === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
}

export default function SuperAdminMigration() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<{ id: string; slug: string; name: string; runtime_mode: string | null; migration_state: string | null; frozen_at: string | null } | null>(null);
  const [states, setStates] = useState<Record<StepKey, "idle" | "running" | "ok" | "failed">>({
    prep: "idle", schema: "idle", auth: "idle", data: "idle", storage: "idle", smoke: "idle", flip: "idle", post: "idle",
  });
  const [logs, setLogs] = useState<Record<StepKey, string>>({
    prep: "", schema: "", auth: "", data: "", storage: "", smoke: "", flip: "", post: "",
  });
  const [purgeType, setPurgeType] = useState("");

  const setState = (k: StepKey, s: "idle" | "running" | "ok" | "failed") => setStates((p) => ({ ...p, [k]: s }));
  const appendLog = (k: StepKey, line: string) => setLogs((p) => ({ ...p, [k]: `${p[k]}${p[k] ? "\n" : ""}${line}` }));

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

  const loadLastRunError = useCallback(async (phase: StepKey): Promise<string | null> => {
    if (!id) return null;
    const { data } = await supabase
      .from("tenant_migration_runs")
      .select("stats, error, status")
      .eq("tenant_id", id)
      .eq("phase", phase)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
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
        .eq("tenant_id", id)
        .eq("phase", phase)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const row = data as MigrationRunRow | null;
      if (row && row.status && row.status !== "running") return row;
      await delay(attempt < 10 ? 1_000 : 2_000);
    }
    return null;
  }, [id]);

  const invoke = useCallback(async (fn: string, body: Record<string, unknown>, key: StepKey): Promise<RunResult> => {
    setState(key, "running");
    appendLog(key, `→ ${fn} ${JSON.stringify(body).slice(0, 120)}`);
    const { data, error } = await supabase.functions.invoke(fn, { body });
    if (error) {
      const runMsg = await loadLastRunError(key);
      const msg = runMsg ?? (data as { error?: string } | null)?.error ?? error.message;
      appendLog(key, `✗ ${msg}`);
      setState(key, "failed");
      return { ok: false, error: msg };
    }
    const logicalFailure = readInvokeFailure(data);
    if (logicalFailure) {
      appendLog(key, `✗ ${logicalFailure}`);
      appendLog(key, JSON.stringify(data).slice(0, 800));
      setState(key, "failed");
      return { ok: false, error: logicalFailure, data };
    }

    const asyncPayload = data as { async?: boolean; status?: string; startedAt?: string } | null;
    if (asyncPayload?.async && asyncPayload.status === "running") {
      appendLog(key, "↻ Execução iniciada em segundo plano; acompanhando conclusão...");
      const run = await waitPhaseCompletion(key, asyncPayload.startedAt);
      if (!run) {
        const msg = "Tempo limite aguardando conclusão da etapa. Atualize a página e consulte o último run.";
        appendLog(key, `✗ ${msg}`);
        setState(key, "failed");
        return { ok: false, error: msg, data };
      }
      if (run.status !== "ok") {
        const firstFailure = run.stats?.failures?.[0];
        const msg = firstFailure?.error ? `${firstFailure.stage ?? "etapa"}: ${firstFailure.error}` : run.error ?? `Etapa finalizou como ${run.status}`;
        appendLog(key, `✗ ${msg}`);
        appendLog(key, JSON.stringify(run).slice(0, 800));
        setState(key, "failed");
        return { ok: false, error: msg, data: run };
      }
      appendLog(key, `✓ ${JSON.stringify(run).slice(0, 400)}`);
      setState(key, "ok");
      void loadTenant();
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
    if (!confirm("Confirmar FLIP para banco dedicado? O tenant passará a operar no projeto dedicado imediatamente.")) return;
    const r = await invoke("super-admin-migration-flip", { tenantId: id, confirm: "FLIP" }, "flip");
    if (r.ok) await loadTenant();
  };
  const runRollback = async () => {
    if (!confirm("Reverter para o banco compartilhado?")) return;
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

  if (!tenant) {
    return <div className="p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/super-admin/laboratorios/${id}`)} className="mb-2 h-8 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="text-2xl font-semibold">Migração Shared → Dedicated</h1>
          <p className="text-sm text-muted-foreground">{tenant.name} · <code className="text-xs">{tenant.slug}</code></p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isDedicated ? "default" : "secondary"}>{isDedicated ? "Dedicado" : "Compartilhado"}</Badge>
          {tenant.migration_state && <Badge variant="outline">{tenant.migration_state}</Badge>}
        </div>
      </div>

      <Card className="p-4 bg-amber-50 border-amber-200">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            Execute os passos em ordem. Cada etapa é idempotente e pode ser reexecutada em caso de falha.
            O flip só é permitido após o smoke test passar 100%. Rollback disponível por 30 dias após o flip.
          </div>
        </div>
      </Card>

      {STEPS.map((step) => (
        <Card key={step.key} className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <StatusIcon state={states[step.key]} />
              <div>
                <div className="text-sm font-medium">{step.index}. {step.title}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {step.key === "prep" && <Button size="sm" onClick={runPrep} disabled={states.prep === "running"}>Testar conexão</Button>}
              {step.key === "schema" && <Button size="sm" onClick={runSchema} disabled={states.schema === "running"}>Provisionar</Button>}
              {step.key === "auth" && <Button size="sm" onClick={runAuth} disabled={states.auth === "running"}>Migrar identidades</Button>}
              {step.key === "data" && <>
                <Button size="sm" variant="outline" onClick={runDataDry} disabled={states.data === "running"}>Dry-run</Button>
                <Button size="sm" onClick={runData} disabled={states.data === "running"}>Migrar dados</Button>
              </>}
              {step.key === "storage" && <Button size="sm" onClick={runStorage} disabled={states.storage === "running"}>Migrar arquivos</Button>}
              {step.key === "smoke" && <Button size="sm" onClick={runSmoke} disabled={states.smoke === "running"}>Executar smoke</Button>}
              {step.key === "flip" && <Button size="sm" onClick={runFlip} disabled={states.smoke !== "ok" || isDedicated}>Flip para dedicado</Button>}
              {step.key === "post" && isDedicated && <>
                <Button size="sm" variant="outline" onClick={runRollback}>Rollback</Button>
                <Button size="sm" variant="outline" onClick={runPurgeDry}>Purge dry-run</Button>
              </>}
            </div>
          </div>

          {step.key === "post" && isDedicated && (
            <div className="pt-2 border-t space-y-3">
              <div className="text-xs text-muted-foreground">
                {tenant.frozen_at && <>Congelado em {new Date(tenant.frozen_at).toLocaleString("pt-BR")} · Quarentena: {quarantineDaysLeft} dias restantes</>}
              </div>
              <div className="flex gap-2 items-center">
                <Input value={purgeType} onChange={(e) => setPurgeType(e.target.value)} placeholder={`Digite ${id} para habilitar purge`} className="h-8 text-xs font-mono" />
                <Button size="sm" variant="destructive" onClick={runPurge} disabled={purgeType !== id || (quarantineDaysLeft ?? 30) > 0}>Purge definitivo</Button>
              </div>
            </div>
          )}

          {logs[step.key] && (
            <pre className="text-[11px] bg-muted/40 border rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-48">{logs[step.key]}</pre>
          )}
        </Card>
      ))}
    </div>
  );
}
