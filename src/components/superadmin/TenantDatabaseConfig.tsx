// Onda B — Cadastro manual de banco de dados por tenant.
// Persiste apenas METADADOS em tenant_registry. A senha vive como secret
// no Lovable Cloud; aqui o super admin informa apenas o NOME do secret.

import { useEffect, useMemo, useState } from "react";
import { db as supabase } from "@/runtime/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Database, Save, ShieldAlert, ShieldCheck, KeyRound, Server, MapPin, User, Hash, Plug, CheckCircle2, XCircle, Loader2, Globe, Rocket } from "lucide-react";
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
  runtime_dedicated_enabled: boolean;
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
  db_project_url: null,
  db_anon_key_secret_ref: null,
  schema_provisioned_at: null,
  runtime_dedicated_enabled: false,
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
  const [provisioning, setProvisioning] = useState(false);
  const [testResult, setTestResult] = useState<
    | { ok: true; latencyMs: number; serverVersion: string | null; database: string; user: string }
    | { ok: false; error: string; stage?: string }
    | null
  >(null);
  const [testingAnon, setTestingAnon] = useState(false);
  const [anonResult, setAnonResult] = useState<
    | { ok: true; latencyMs: number; status: number; schemaReady: boolean; healthStatus: number; hint?: string }
    | { ok: false; error: string; stage?: string; status?: number }
    | null
  >(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<
    | {
        ok: boolean;
        tables_expected?: string[];
        tables_found?: string[];
        tables_missing?: string[];
        counts?: Record<string, number | null>;
        last_health?: { schema_version: string; provisioned_at: string; note: string | null } | null;
        stage?: string;
        error?: string;
      }
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
    if (!SECRET_REF_RE.test(cfg.db_secret_ref)) return "Secret (senha) deve estar em UPPER_SNAKE_CASE (3–64 chars).";
    if (cfg.db_provider === "supabase_project") {
      if (!cfg.db_project_url) return "Informe a URL do projeto Supabase dedicado (necessária para o roteamento do runtime).";
      if (!cfg.db_anon_key_secret_ref) return "Informe o nome do secret com a anon key do projeto dedicado.";
      if (!SECRET_REF_RE.test(cfg.db_anon_key_secret_ref)) return "Secret (anon key) deve estar em UPPER_SNAKE_CASE (3–64 chars).";
    }
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("super-admin-update-tenant-db-config", {
      body: {
        tenantId,
        // runtimeMode NÃO é enviado aqui: só muda via super-admin-migration-flip/rollback.
        // databaseStrategy persiste a INTENÇÃO (shared/dedicated) sem flipar o runtime efetivo.
        databaseStrategy: isolated ? "dedicated" : "shared",
        dbProvider: cfg.db_provider,
        dbHost: cfg.db_host,
        dbPort: cfg.db_port,
        dbName: cfg.db_name,
        dbUser: cfg.db_user,
        dbRegion: cfg.db_region,
        dbSecretRef: cfg.db_secret_ref,
        dbProjectUrl: cfg.db_project_url,
        dbAnonKeySecretRef: cfg.db_anon_key_secret_ref,
        runtimeDedicatedEnabled: cfg.runtime_dedicated_enabled,
      },
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    const next = (data as { registry?: Partial<DbConfig> & { database_strategy?: string } } | null)?.registry;
    if (next) {
      // Preserva a intenção local do toggle (runtime_mode efetivo só muda no Flip).
      const intendedMode: RuntimeMode = isolated ? "isolated_db" : "shared_db";
      const merged: DbConfig = { ...empty, ...next, runtime_mode: intendedMode };
      setCfg(merged);
      onSaved?.(merged);
    }
    toast.success(isolated
      ? "Configuração salva como Dedicado (intenção). O runtime efetivo só muda após o Flip."
      : "Configuração de banco salva");
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

  const testAnonKey = async () => {
    if (cfg.db_provider !== "supabase_project") {
      toast.error("Teste de anon key disponível apenas para provedor Supabase dedicado.");
      return;
    }
    if (!cfg.db_project_url || !cfg.db_anon_key_secret_ref) {
      toast.error("Preencha a URL do projeto dedicado e o nome do secret da anon key.");
      return;
    }
    setTestingAnon(true);
    setAnonResult(null);
    const { data, error } = await supabase.functions.invoke("super-admin-test-tenant-anon-key", {
      body: {
        tenantId,
        dbProjectUrl: cfg.db_project_url,
        dbAnonKeySecretRef: cfg.db_anon_key_secret_ref,
      },
    });
    setTestingAnon(false);
    if (error) { setAnonResult({ ok: false, error: error.message }); toast.error(error.message); return; }
    const r = data as any;
    if (r?.ok) {
      setAnonResult({
        ok: true,
        latencyMs: r.latencyMs,
        status: r.status,
        schemaReady: !!r.schemaReady,
        healthStatus: r.healthStatus ?? 0,
        hint: r.hint,
      });
      toast.success(
        r.schemaReady
          ? `Anon key OK em ${r.latencyMs}ms — schema exposto`
          : `Anon key OK em ${r.latencyMs}ms (schema ainda pendente)`,
      );
    } else {
      setAnonResult({ ok: false, error: r?.error ?? "Falha desconhecida", stage: r?.stage, status: r?.status });
      toast.error(r?.error ?? "Falha ao validar anon key");
    }
  };

  const provisionSchema = async () => {
    if (cfg.schema_provisioned_at) {
      const confirmReprovision = window.confirm(
        "O schema já foi provisionado neste banco. Reprovisionar pode falhar se objetos já existirem. Continuar?"
      );
      if (!confirmReprovision) return;
    }
    setProvisioning(true);
    const { data, error } = await supabase.functions.invoke("super-admin-provision-tenant-schema", {
      body: { tenantId },
    });
    setProvisioning(false);
    if (error) { toast.error(error.message); return; }
    const r = data as { ok?: boolean; error?: string; schema_provisioned_at?: string; statements?: number };
    if (r?.ok && r.schema_provisioned_at) {
      setCfg((p) => ({ ...p, schema_provisioned_at: r.schema_provisioned_at! }));
      toast.success(`Schema provisionado (${r.statements ?? 0} statements)`);
      onSaved?.({ ...cfg, schema_provisioned_at: r.schema_provisioned_at! });
    } else {
      toast.error(r?.error ?? "Falha ao provisionar schema");
    }
  };

  const checkSchema = async () => {
    setChecking(true);
    setCheckResult(null);
    const { data, error } = await supabase.functions.invoke("super-admin-check-tenant-schema", {
      body: { tenantId },
    });
    setChecking(false);
    if (error) {
      setCheckResult({ ok: false, error: error.message });
      toast.error(error.message);
      return;
    }
    const r = data as NonNullable<typeof checkResult>;
    setCheckResult(r);
    if (r.ok) {
      toast.success(`Schema íntegro (${r.tables_found?.length ?? 0} tabelas)`);
    } else if (r.tables_missing?.length) {
      toast.error(`Faltam ${r.tables_missing.length} tabela(s): ${r.tables_missing.join(", ")}`);
    } else {
      toast.error(r.error ?? "Verificação falhou");
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
              label="Secret (senha do banco)"
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

            {cfg.db_provider === "supabase_project" && (
              <>
                <DbField
                  label="URL do projeto Supabase dedicado"
                  icon={Globe}
                  hint="Necessária para o runtime rotear queries deste laboratório para o banco dedicado."
                  className="md:col-span-2"
                >
                  <Input
                    value={cfg.db_project_url ?? ""}
                    onChange={(e) => set("db_project_url", e.target.value || null)}
                    placeholder="https://xbmzftoefldmcfyrgsdm.supabase.co"
                    className="font-mono"
                  />
                </DbField>

                <DbField
                  label="Secret (anon key do projeto dedicado)"
                  icon={KeyRound}
                  hint="Nome do secret com a chave anônima (publishable) do projeto dedicado."
                  className="md:col-span-2"
                >
                  <Input
                    value={cfg.db_anon_key_secret_ref ?? ""}
                    onChange={(e) => set("db_anon_key_secret_ref", e.target.value.toUpperCase() || null)}
                    placeholder="TENANT_XYZ_ANON_KEY"
                    className="font-mono"
                  />
                </DbField>
              </>
            )}
          </div>

          {/* Estado do schema no banco dedicado */}
          <div className={cn(
            "mt-5 rounded-md border p-3 text-[12px] flex items-start gap-2",
            cfg.schema_provisioned_at
              ? "border-status-success/30 bg-status-success-bg/40"
              : "border-status-warning/30 bg-status-warning-bg/40"
          )}>
            {cfg.schema_provisioned_at
              ? <CheckCircle2 className="h-4 w-4 text-status-success shrink-0 mt-0.5" />
              : <ShieldAlert className="h-4 w-4 text-status-warning shrink-0 mt-0.5" />}
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-foreground">
                {cfg.schema_provisioned_at
                  ? `Schema provisionado em ${new Date(cfg.schema_provisioned_at).toLocaleString("pt-BR")}`
                  : "Schema ainda não provisionado no banco dedicado"}
              </div>
              <div className="text-muted-foreground mt-0.5">
                {cfg.schema_provisioned_at
                  ? "A DedicatedStrategy (Fase 2) pode rotear queries deste tenant com segurança."
                  : "Enquanto pendente, o runtime continua usando o banco compartilhado (fail-safe)."}
              </div>
            </div>
          </div>

          {/* Toggle: roteamento dedicado do runtime (Fase 2) */}
          <div className={cn(
            "mt-3 rounded-md border p-3",
            cfg.runtime_dedicated_enabled
              ? "border-primary/30 bg-primary/5"
              : "border-border bg-muted/30"
          )}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={cfg.runtime_dedicated_enabled}
                disabled={!cfg.schema_provisioned_at}
                onChange={(e) => set("runtime_dedicated_enabled", e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border accent-primary shrink-0 disabled:opacity-40"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-foreground">
                  Ativar roteamento dedicado (runtime)
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  {cfg.schema_provisioned_at
                    ? "Ao ativar, este laboratório passa a ler/gravar pacientes, atendimentos, exames e pagamentos no banco dedicado. Demais tabelas (dicionários, financeiro, VR, storage, auth) continuam no compartilhado. Requer salvar após marcar."
                    : "Disponível somente após provisionar o schema no banco dedicado."}
                </div>
                {cfg.runtime_dedicated_enabled && !cfg.schema_provisioned_at && (
                  <div className="text-[11px] text-status-danger mt-1 font-medium">
                    Atenção: flag marcada sem schema provisionado — o runtime vai continuar no compartilhado (fail-safe).
                  </div>
                )}
                {cfg.runtime_dedicated_enabled && cfg.schema_provisioned_at && (
                  <div className="text-[11px] text-status-warning mt-1 font-medium">
                    Banco dedicado começa vazio — os dados existentes ficarão no compartilhado até a Fase 3 (migração).
                  </div>
                )}
              </div>
            </label>
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

      {isolated && checkResult && (
        <div className={cn(
          "mt-3 rounded-md border p-3 text-[12px]",
          checkResult.ok
            ? "border-status-success/30 bg-status-success-bg/40"
            : "border-status-warning/30 bg-status-warning-bg/40"
        )}>
          <div className="flex items-start gap-2">
            {checkResult.ok
              ? <CheckCircle2 className="h-4 w-4 text-status-success shrink-0 mt-0.5" />
              : <ShieldAlert className="h-4 w-4 text-status-warning shrink-0 mt-0.5" />}
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-foreground">
                {checkResult.ok
                  ? "Schema íntegro no banco dedicado"
                  : checkResult.tables_missing?.length
                    ? `Faltam ${checkResult.tables_missing.length} tabela(s)`
                    : `Falha ${checkResult.stage ? `(${checkResult.stage})` : ""}`}
              </div>
              {checkResult.error && (
                <div className="text-muted-foreground mt-0.5 break-words">{checkResult.error}</div>
              )}
              {checkResult.last_health && (
                <div className="text-muted-foreground mt-0.5 font-mono text-[11px]">
                  {checkResult.last_health.schema_version} · {new Date(checkResult.last_health.provisioned_at).toLocaleString("pt-BR")}
                </div>
              )}
              {checkResult.counts && (
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-1.5">
                  {Object.entries(checkResult.counts).map(([t, n]) => (
                    <div key={t} className="rounded border border-border/60 bg-background/40 px-2 py-1 flex items-center justify-between gap-2">
                      <span className="font-mono text-[10.5px] truncate text-muted-foreground">{t}</span>
                      <span className="font-mono text-[11px] text-foreground">
                        {n === null ? "—" : n.toLocaleString("pt-BR")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isolated && anonResult && (
        <div className={cn(
          "mt-3 rounded-md border p-3 text-[12px] flex items-start gap-2",
          anonResult.ok
            ? (anonResult.schemaReady
                ? "border-status-success/30 bg-status-success-bg/40"
                : "border-status-warning/30 bg-status-warning-bg/40")
            : "border-status-danger/30 bg-status-danger-bg/40"
        )}>
          {anonResult.ok
            ? (anonResult.schemaReady
                ? <CheckCircle2 className="h-4 w-4 text-status-success shrink-0 mt-0.5" />
                : <ShieldAlert className="h-4 w-4 text-status-warning shrink-0 mt-0.5" />)
            : <XCircle className="h-4 w-4 text-status-danger shrink-0 mt-0.5" />}
          <div className="min-w-0 flex-1">
            {anonResult.ok ? (
              <>
                <div className="font-semibold text-foreground">
                  Anon key validada em {anonResult.latencyMs}ms (HTTP {anonResult.status})
                </div>
                <div className="text-muted-foreground mt-0.5">
                  {anonResult.schemaReady
                    ? "Data API responde e o schema health dedicado está exposto — pronto para roteamento dedicado."
                    : (anonResult.hint ?? "Anon key aceita, mas o schema dedicado ainda não está exposto pela Data API.")}
                </div>
              </>
            ) : (
              <>
                <div className="font-semibold text-foreground">
                  Falha ao validar anon key{anonResult.stage ? ` (${anonResult.stage})` : ""}
                </div>
                <div className="text-muted-foreground mt-0.5 break-words">{anonResult.error}</div>
              </>
            )}
          </div>
        </div>
      )}

      {isolated && cfg.db_provider === "supabase_project" && (
        <ReadinessChecklist
          hasConn={!!(cfg.db_host && cfg.db_port && cfg.db_name && cfg.db_user && cfg.db_secret_ref)}
          hasProjectUrl={!!cfg.db_project_url}
          hasAnonSecret={!!cfg.db_anon_key_secret_ref}
          connectionOk={testResult?.ok === true}
          anonOk={anonResult?.ok === true}
          schemaReady={!!cfg.schema_provisioned_at}
          routingOn={!!cfg.runtime_dedicated_enabled}
        />
      )}

      <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-border/60 flex-wrap">
        <Button variant="ghost" onClick={reset} disabled={!isDirty || saving}>Descartar</Button>
        {isolated && (
          <Button variant="outline" onClick={testConnection} disabled={testing || saving || provisioning || checking || testingAnon}>
            {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plug className="h-4 w-4 mr-2" />}
            {testing ? "Testando…" : "Testar conexão"}
          </Button>
        )}
        {isolated && cfg.db_provider === "supabase_project" && (
          <Button
            variant="outline"
            onClick={testAnonKey}
            disabled={testingAnon || testing || saving || provisioning || checking || !cfg.db_project_url || !cfg.db_anon_key_secret_ref}
            title="Verifica se a anon key do projeto dedicado responde via PostgREST"
          >
            {testingAnon ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
            {testingAnon ? "Testando…" : "Testar anon key"}
          </Button>
        )}
        {isolated && !isDirty && cfg.schema_provisioned_at && (
          <Button
            variant="outline"
            onClick={checkSchema}
            disabled={checking || saving || testing || provisioning}
            title="Verifica se as tabelas do SISLAC existem no banco dedicado"
          >
            {checking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
            {checking ? "Verificando…" : "Verificar schema"}
          </Button>
        )}
        {isolated && !isDirty && (
          <Button
            variant="outline"
            onClick={provisionSchema}
            disabled={provisioning || saving || testing || checking || !cfg.db_secret_ref}
            title={cfg.schema_provisioned_at ? "Reprovisionar schema (avançado)" : "Cria as tabelas do SISLAC no banco dedicado"}
          >
            {provisioning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
            {provisioning
              ? "Provisionando…"
              : cfg.schema_provisioned_at ? "Reprovisionar schema" : "Provisionar schema"}
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

function ReadinessChecklist({
  hasConn, hasProjectUrl, hasAnonSecret, connectionOk, anonOk, schemaReady, routingOn,
}: {
  hasConn: boolean;
  hasProjectUrl: boolean;
  hasAnonSecret: boolean;
  connectionOk: boolean;
  anonOk: boolean;
  schemaReady: boolean;
  routingOn: boolean;
}) {
  const items: { label: string; done: boolean; hint?: string }[] = [
    { label: "Metadados de conexão Postgres preenchidos", done: hasConn },
    { label: "URL do projeto Supabase dedicado informada", done: hasProjectUrl },
    { label: "Secret da anon key informado", done: hasAnonSecret },
    { label: "Teste de conexão Postgres bem-sucedido", done: connectionOk, hint: "Clique em “Testar conexão”." },
    { label: "Teste de anon key bem-sucedido", done: anonOk, hint: "Clique em “Testar anon key”." },
    { label: "Schema provisionado no banco dedicado", done: schemaReady, hint: "Use “Provisionar schema”." },
    { label: "Roteamento dedicado ativado e salvo", done: routingOn, hint: "Marque a caixa e salve a configuração." },
  ];
  const doneCount = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = Math.round((doneCount / total) * 100);
  const allDone = doneCount === total;

  return (
    <div className={cn(
      "mt-4 rounded-md border p-3",
      allDone ? "border-status-success/30 bg-status-success-bg/30" : "border-border bg-muted/30"
    )}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Prontidão do laboratório dedicado
        </div>
        <div className={cn(
          "text-[10.5px] font-semibold px-2 py-0.5 rounded-full border",
          allDone
            ? "bg-status-success/10 text-status-success border-status-success/30"
            : "bg-background text-muted-foreground border-border"
        )}>
          {doneCount}/{total} · {pct}%
        </div>
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.label} className="flex items-start gap-2 text-[12px]">
            {it.done
              ? <CheckCircle2 className="h-3.5 w-3.5 text-status-success shrink-0 mt-0.5" />
              : <XCircle className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />}
            <div className="min-w-0 flex-1">
              <div className={cn(it.done ? "text-foreground" : "text-muted-foreground")}>{it.label}</div>
              {!it.done && it.hint && (
                <div className="text-[10.5px] text-muted-foreground/80 mt-0.5">{it.hint}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}