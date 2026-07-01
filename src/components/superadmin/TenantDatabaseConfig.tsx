// Onda B — Cadastro manual de banco de dados por tenant.
// Persiste apenas METADADOS em tenant_registry. A senha vive como secret
// no Lovable Cloud; aqui o super admin informa apenas o NOME do secret.

import { useEffect, useMemo, useState } from "react";
import { db as supabase } from "@/runtime/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Database, Save, ShieldAlert, KeyRound, Server, MapPin, User, Hash, Plug, CheckCircle2, XCircle, Loader2, Globe, Rocket } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type RuntimeMode = "shared_db" | "isolated_db";

interface DbConfig {
  runtime_mode: RuntimeMode;
  db_provider: string | null;
  db_host: string | null;
  db_port: number | null;
  db_name: string | null;
  db_user: string | null;
  db_region: string | null;
  db_secret_ref: string | null;
  db_project_url: string | null;
  db_anon_key_secret_ref: string | null;
  schema_provisioned_at: string | null;
}


const PROVIDERS = [
  { value: "shared_supabase", label: "Shared Supabase" },
  { value: "neon", label: "Neon" },
  { value: "supabase_project", label: "Supabase (dedicado)" },
  { value: "external_postgres", label: "Postgres externo" },
];

const SUPABASE_REGIONS: { value: string; label: string }[] = [
  { value: "us-east-1", label: "us-east-1 — Norte da Virgínia (EUA)" },
  { value: "us-east-2", label: "us-east-2 — Ohio (EUA)" },
  { value: "us-west-1", label: "us-west-1 — Norte da Califórnia (EUA)" },
  { value: "us-west-2", label: "us-west-2 — Oregon (EUA)" },
  { value: "ca-central-1", label: "ca-central-1 — Montreal (Canadá)" },
  { value: "sa-east-1", label: "sa-east-1 — São Paulo (Brasil)" },
  { value: "eu-west-1", label: "eu-west-1 — Dublin (Irlanda)" },
  { value: "eu-west-2", label: "eu-west-2 — Londres (Reino Unido)" },
  { value: "eu-west-3", label: "eu-west-3 — Paris (França)" },
  { value: "eu-central-1", label: "eu-central-1 — Frankfurt (Alemanha)" },
  { value: "eu-central-2", label: "eu-central-2 — Zurique (Suíça)" },
  { value: "eu-north-1", label: "eu-north-1 — Estocolmo (Suécia)" },
  { value: "ap-south-1", label: "ap-south-1 — Mumbai (Índia)" },
  { value: "ap-southeast-1", label: "ap-southeast-1 — Singapura" },
  { value: "ap-southeast-2", label: "ap-southeast-2 — Sydney (Austrália)" },
  { value: "ap-northeast-1", label: "ap-northeast-1 — Tóquio (Japão)" },
  { value: "ap-northeast-2", label: "ap-northeast-2 — Seul (Coreia do Sul)" },
];

const NEON_REGIONS: { value: string; label: string }[] = [
  { value: "aws-us-east-1", label: "aws-us-east-1 — Norte da Virgínia (EUA)" },
  { value: "aws-us-east-2", label: "aws-us-east-2 — Ohio (EUA)" },
  { value: "aws-us-west-2", label: "aws-us-west-2 — Oregon (EUA)" },
  { value: "aws-eu-central-1", label: "aws-eu-central-1 — Frankfurt (Alemanha)" },
  { value: "aws-eu-west-2", label: "aws-eu-west-2 — Londres (Reino Unido)" },
  { value: "aws-ap-southeast-1", label: "aws-ap-southeast-1 — Singapura" },
  { value: "aws-ap-southeast-2", label: "aws-ap-southeast-2 — Sydney (Austrália)" },
  { value: "aws-sa-east-1", label: "aws-sa-east-1 — São Paulo (Brasil)" },
  { value: "azure-eastus2", label: "azure-eastus2 — Virgínia (EUA)" },
];

const PROVIDER_REGIONS: Record<string, { value: string; label: string }[]> = {
  shared_supabase: SUPABASE_REGIONS,
  supabase_project: SUPABASE_REGIONS,
  neon: NEON_REGIONS,
  external_postgres: [],
};

const MODES: { value: RuntimeMode; label: string; hint: string }[] = [
  { value: "shared_db", label: "Compartilhado", hint: "Instância multi-tenant" },
  { value: "isolated_db", label: "Dedicado", hint: "Database-per-tenant" },
];

const SECRET_REF_RE = /^[A-Z][A-Z0-9_]{2,63}$/;

const empty: DbConfig = {
  runtime_mode: "shared_db",
  db_provider: null,
  db_host: null,
  db_port: null,
  db_name: null,
  db_user: null,
  db_region: null,
  db_secret_ref: null,
};

export function TenantDatabaseConfig({
  tenantId,
  initial,
  onSaved,
}: {
  tenantId: string;
  initial: Partial<DbConfig> | null;
  onSaved?: (next: DbConfig) => void;
}) {
  const baseline = useMemo<DbConfig>(() => ({ ...empty, ...(initial ?? {}) }), [initial]);
  const [cfg, setCfg] = useState<DbConfig>(baseline);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    | { ok: true; latencyMs: number; serverVersion: string | null; database: string; user: string }
    | { ok: false; error: string; stage?: string }
    | null
  >(null);

  useEffect(() => { setCfg(baseline); setTestResult(null); }, [baseline]);

  const isDirty = useMemo(
    () => (Object.keys(empty) as (keyof DbConfig)[]).some((k) => cfg[k] !== baseline[k]),
    [cfg, baseline]
  );

  const isolated = cfg.runtime_mode === "isolated_db";

  const set = <K extends keyof DbConfig>(k: K, v: DbConfig[K]) =>
    setCfg((p) => ({ ...p, [k]: v }));

  const validate = (): string | null => {
    if (!isolated) return null;
    if (!cfg.db_provider) return "Selecione um provedor de banco.";
    if (!cfg.db_host) return "Informe o host do banco.";
    if (!cfg.db_port) return "Informe a porta do banco.";
    if (!cfg.db_name) return "Informe o nome do banco.";
    if (!cfg.db_user) return "Informe o usuário do banco.";
    if (!cfg.db_secret_ref) return "Informe o nome do secret com a senha (db_secret_ref).";
    if (!SECRET_REF_RE.test(cfg.db_secret_ref)) return "Secret deve estar em UPPER_SNAKE_CASE (3–64 chars).";
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("super-admin-update-tenant-db-config", {
      body: {
        tenantId,
        runtimeMode: cfg.runtime_mode,
        dbProvider: cfg.db_provider,
        dbHost: cfg.db_host,
        dbPort: cfg.db_port,
        dbName: cfg.db_name,
        dbUser: cfg.db_user,
        dbRegion: cfg.db_region,
        dbSecretRef: cfg.db_secret_ref,
      },
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    const next = (data as { registry?: Partial<DbConfig> } | null)?.registry;
    if (next) {
      const merged: DbConfig = { ...empty, ...next };
      setCfg(merged);
      onSaved?.(merged);
    }
    toast.success("Configuração de banco salva");
  };

  const reset = () => { setCfg(baseline); setTestResult(null); };

  const testConnection = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setTesting(true);
    setTestResult(null);
    const { data, error } = await supabase.functions.invoke("super-admin-test-tenant-db", {
      body: {
        tenantId,
        dbHost: cfg.db_host,
        dbPort: cfg.db_port,
        dbName: cfg.db_name,
        dbUser: cfg.db_user,
        dbSecretRef: cfg.db_secret_ref,
      },
    });
    setTesting(false);
    if (error) { setTestResult({ ok: false, error: error.message }); toast.error(error.message); return; }
    const r = data as any;
    if (r?.ok) {
      setTestResult({ ok: true, latencyMs: r.latencyMs, serverVersion: r.serverVersion, database: r.database, user: r.user });
      toast.success(`Conexão OK em ${r.latencyMs}ms`);
    } else {
      setTestResult({ ok: false, error: r?.error ?? "Falha desconhecida", stage: r?.stage });
      toast.error(r?.error ?? "Falha na conexão");
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <header className="flex items-start gap-4 mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Database className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-foreground tracking-tight">
              Estratégia de dados
            </h2>
            <span className={cn(
              "text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-widest",
              isolated
                ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                : "bg-muted text-muted-foreground border-border"
            )}>
              {isolated ? "Dedicado" : "Compartilhado"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 font-medium">
            Control plane: define como este laboratório armazena seus dados.
          </p>
        </div>
      </header>

      {/* Runtime mode */}
      <div className="mb-6">
        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
          Tipo de banco
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => set("runtime_mode", m.value)}
              className={cn(
                "text-left h-auto px-4 py-3 rounded-xl border text-sm transition-all duration-200",
                cfg.runtime_mode === m.value
                  ? "bg-primary/10 text-primary border-primary/30 shadow-sm"
                  : "bg-card border-border/50 text-muted-foreground hover:border-border hover:bg-muted/50"
              )}
            >
              <div className="font-semibold">{m.label}</div>
              <div className={cn(
                "text-[11px] mt-0.5",
                cfg.runtime_mode === m.value ? "text-primary/70" : "text-muted-foreground"
              )}>{m.hint}</div>
            </button>
          ))}
        </div>
      </div>

      {isolated && (
        <>
          <div className="rounded-md border border-status-warning/30 bg-status-warning-bg/40 p-3 mb-5 flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 text-status-warning shrink-0 mt-0.5" />
            <p className="text-[12px] text-foreground/80 leading-relaxed">
              Alterar para <strong>Isolated DB</strong> apenas registra os metadados
              de conexão. A migração de dados <strong>não</strong> é executada aqui —
              deve ser realizada por processo de provisionamento dedicado.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DbField label="Provedor" icon={Server}>
              <select
                value={cfg.db_provider ?? ""}
                onChange={(e) => set("db_provider", e.target.value || null)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Selecione…</option>
                {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </DbField>

            <DbField label="Região" icon={MapPin} hint={cfg.db_provider ? "Selecione a região do provedor" : "Selecione um provedor para listar as regiões"}>
              {(() => {
                const regions = cfg.db_provider ? (PROVIDER_REGIONS[cfg.db_provider] ?? []) : [];
                if (regions.length === 0) {
                  return (
                    <Input
                      value={cfg.db_region ?? ""}
                      onChange={(e) => set("db_region", e.target.value || null)}
                      placeholder="sa-east-1"
                    />
                  );
                }
                return (
                  <select
                    value={cfg.db_region ?? ""}
                    onChange={(e) => set("db_region", e.target.value || null)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Selecione…</option>
                    {regions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                );
              })()}
            </DbField>

            <DbField label="Host" icon={Server}>
              <Input
                value={cfg.db_host ?? ""}
                onChange={(e) => set("db_host", e.target.value || null)}
                placeholder="db.exemplo.com"
              />
            </DbField>

            <DbField label="Porta" icon={Hash}>
              <Input
                type="number"
                min={1}
                max={65535}
                value={cfg.db_port ?? ""}
                onChange={(e) => set("db_port", e.target.value ? Number(e.target.value) : null)}
                placeholder="5432"
              />
            </DbField>

            <DbField label="Database" icon={Database}>
              <Input
                value={cfg.db_name ?? ""}
                onChange={(e) => set("db_name", e.target.value || null)}
                placeholder="sislac_tenant_xyz"
              />
            </DbField>

            <DbField label="Usuário" icon={User}>
              <Input
                value={cfg.db_user ?? ""}
                onChange={(e) => set("db_user", e.target.value || null)}
                placeholder="sislac_app"
              />
            </DbField>

            <DbField
              label="Secret (senha)"
              icon={KeyRound}
              hint="Nome do secret no Lovable Cloud (UPPER_SNAKE_CASE). A senha NUNCA é salva no banco."
              className="md:col-span-2"
            >
              <Input
                value={cfg.db_secret_ref ?? ""}
                onChange={(e) => set("db_secret_ref", e.target.value.toUpperCase() || null)}
                placeholder="TENANT_XYZ_DB_PASSWORD"
                className="font-mono"
              />
            </DbField>
          </div>
        </>
      )}

      {isolated && testResult && (
        <div className={cn(
          "mt-5 rounded-md border p-3 text-[12px] flex items-start gap-2",
          testResult.ok
            ? "border-status-success/30 bg-status-success-bg/40 text-foreground"
            : "border-status-danger/30 bg-status-danger-bg/40 text-foreground"
        )}>
          {testResult.ok
            ? <CheckCircle2 className="h-4 w-4 text-status-success shrink-0 mt-0.5" />
            : <XCircle className="h-4 w-4 text-status-danger shrink-0 mt-0.5" />}
          <div className="min-w-0 flex-1">
            {testResult.ok ? (
              <>
                <div className="font-semibold">Conexão estabelecida em {testResult.latencyMs}ms</div>
                <div className="text-muted-foreground mt-0.5 font-mono text-[11px] truncate">
                  {testResult.user}@{testResult.database} · {testResult.serverVersion ?? "Postgres"}
                </div>
              </>
            ) : (
              <>
                <div className="font-semibold">Falha {testResult.stage ? `(${testResult.stage})` : ""}</div>
                <div className="text-muted-foreground mt-0.5 break-words">{testResult.error}</div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-border/60">
        <Button variant="ghost" onClick={reset} disabled={!isDirty || saving}>Descartar</Button>
        {isolated && (
          <Button variant="outline" onClick={testConnection} disabled={testing || saving}>
            {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plug className="h-4 w-4 mr-2" />}
            {testing ? "Testando…" : "Testar conexão"}
          </Button>
        )}
        <Button onClick={save} disabled={!isDirty || saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvando…" : "Salvar configuração"}
        </Button>
      </div>
    </section>
  );
}

function DbField({
  label, hint, icon: Icon, className, children,
}: {
  label: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}