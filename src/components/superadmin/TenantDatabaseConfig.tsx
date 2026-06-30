// Onda B — Cadastro manual de banco de dados por tenant.
// Persiste apenas METADADOS em tenant_registry. A senha vive como secret
// no Lovable Cloud; aqui o super admin informa apenas o NOME do secret.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Database, Save, ShieldAlert, KeyRound, Server, MapPin, User, Hash } from "lucide-react";
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
}

const PROVIDERS = [
  { value: "shared_supabase", label: "Shared Supabase" },
  { value: "neon", label: "Neon" },
  { value: "supabase_project", label: "Supabase (dedicado)" },
  { value: "external_postgres", label: "Postgres externo" },
];

const SUPABASE_REGIONS = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "ca-central-1", "sa-east-1",
  "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-central-2", "eu-north-1",
  "ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2",
];

const NEON_REGIONS = [
  "aws-us-east-1", "aws-us-east-2", "aws-us-west-2",
  "aws-eu-central-1", "aws-eu-west-2",
  "aws-ap-southeast-1", "aws-ap-southeast-2", "aws-sa-east-1",
  "azure-eastus2",
];

const PROVIDER_REGIONS: Record<string, string[]> = {
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

  useEffect(() => { setCfg(baseline); }, [baseline]);

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

  const reset = () => setCfg(baseline);

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
                    {regions.map((r) => <option key={r} value={r}>{r}</option>)}
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

      <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-border/60">
        <Button variant="ghost" onClick={reset} disabled={!isDirty || saving}>Descartar</Button>
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