/**
 * ProviderConfigCard — card compacto e contextual.
 *
 * Filosofia (Fase 2–5):
 *  • Header compacto sempre visível: status, ambiente, conexão, última sync.
 *  • Configuração escondida por padrão se já existir (progressive disclosure).
 *  • Avançado colapsado (switches/configs opcionais).
 *  • Erros traduzidos para linguagem humana, sem stacktrace/SOAP cru.
 */

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Loader2,
  PlugZap,
  Settings2,
  XCircle,
  Circle,
} from "lucide-react";
import { db as supabase } from "@/runtime/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import type { IntegrationProvider } from "@/integrations/contracts/providers";
import type { ProviderField, ProviderUIConfig, ProviderUIStatus } from "@/integrations/contracts/providerUI";
import { getCapabilities } from "@/integrations/contracts/capabilities";

type ModeT = "MOCK" | "HOMOLOG" | "PROD";

export interface ProviderConfigCardProps {
  ui: ProviderUIConfig;
  existing: {
    id: string;
    provider: IntegrationProvider;
    ativo: boolean;
    mode: ModeT;
    endpoint_url: string | null;
    client_code: string | null;
    config: Record<string, unknown> | null;
  } | null;
  /** ISO timestamp da última atividade conhecida (job concluído). */
  lastSyncAt?: string | null;
  onSaved: () => Promise<void> | void;
}

/** Tradução amigável dos nomes técnicos de capabilities. */
const CAP_LABEL: Record<string, string> = {
  send_order: "Envio de pedido",
  polling: "Atualização de resultados",
  fetch_pdf: "Download de PDF",
  fetch_pending: "Pendências técnicas",
  fetch_trace: "Rastreio logístico",
  fetch_label: "Reimpressão de etiqueta",
  cancel_exam: "Cancelamento de exame",
  cancel_sample: "Cancelamento de amostra",
  webhook: "Webhooks",
};

/** Tradução de erros técnicos em mensagens operacionais com hint. */
function humanizeError(raw: unknown): { title: string; hint?: string } {
  const msg = String((raw as { message?: string })?.message ?? raw ?? "").toLowerCase();
  if (!msg) return { title: "Falha na conexão", hint: "Tente novamente em alguns instantes." };
  if (msg.includes("transport_not_available")) {
    return {
      title: "Transporte real ainda não habilitado",
      hint: "Mantenha o ambiente em MOCK até a homologação concluir.",
    };
  }
  if (msg.includes("preview_mode") || msg.includes("modo preview")) {
    return {
      title: "Provider em modo Preview",
      hint: "A homologação real será ativada após validação do laboratório.",
    };
  }
  if (msg.includes("credential_decrypt_failed")) {
    return { title: "Credenciais corrompidas", hint: "Reinforme usuário e senha e salve novamente." };
  }
  if (msg.includes("unauthorized") || msg.includes("401")) {
    return { title: "Acesso negado pelo apoio", hint: "Verifique usuário e senha." };
  }
  if (msg.includes("timeout") || msg.includes("timed out")) {
    return { title: "Apoio não respondeu a tempo", hint: "O servidor do apoio pode estar lento. Tente novamente." };
  }
  if (msg.includes("network") || msg.includes("fetch failed") || msg.includes("enotfound")) {
    return { title: "Sem comunicação com o apoio", hint: "Confira o endpoint SOAP e a internet." };
  }
  if (msg.includes("forbidden")) {
    return { title: "Acesso negado", hint: "Esta integração não pertence ao tenant atual." };
  }
  return { title: "Falha na conexão", hint: "Tente novamente; persistindo, verifique credenciais." };
}

function getValue(state: Record<string, unknown>, key: string): unknown {
  if (!key.includes(".")) return state[key];
  const [head, ...rest] = key.split(".");
  let cur: unknown = (state[head] as Record<string, unknown> | undefined) ?? {};
  for (const seg of rest) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function setValue(state: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  if (!key.includes(".")) return { ...state, [key]: value };
  const [head, ...rest] = key.split(".");
  const headObj = { ...((state[head] as Record<string, unknown> | undefined) ?? {}) };
  let cur: Record<string, unknown> = headObj;
  for (let i = 0; i < rest.length - 1; i++) {
    const seg = rest[i];
    cur[seg] = { ...((cur[seg] as Record<string, unknown> | undefined) ?? {}) };
    cur = cur[seg] as Record<string, unknown>;
  }
  cur[rest[rest.length - 1]] = value;
  return { ...state, [head]: headObj };
}

function relativeTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = Date.now() - t;
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `há ${Math.floor(diff / 3_600_000)}h`;
  return new Date(iso).toLocaleDateString();
}

export const ProviderConfigCard = ({ ui, existing, lastSyncAt, onSaved }: ProviderConfigCardProps) => {
  const caps = useMemo(() => getCapabilities(ui.provider), [ui.provider]);
  const enabledCaps = useMemo(
    () => (Object.keys(caps) as Array<keyof typeof caps>).filter((k) => caps[k]),
    [caps],
  );
  const isConfigured = !!existing;
  const isActive = !!existing?.ativo && existing.mode !== "MOCK";

  const sessionKey = `provider-card-expanded:${ui.provider}`;
  const [expanded, setExpanded] = useState<boolean>(() => {
    if (typeof window === "undefined") return !isConfigured;
    const stored = window.sessionStorage.getItem(sessionKey);
    if (stored === "1") return true;
    if (stored === "0") return false;
    return !isConfigured;
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [state, setState] = useState<Record<string, unknown>>(() => ({
    mode: existing?.mode ?? "MOCK",
    endpoint_url: existing?.endpoint_url ?? "",
    client_code: existing?.client_code ?? "",
    username: "",
    password: "",
    config: { ...(existing?.config ?? {}) },
  }));
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; title: string; hint?: string } | null>(null);

  useEffect(() => {
    setState({
      mode: existing?.mode ?? "MOCK",
      endpoint_url: existing?.endpoint_url ?? "",
      client_code: existing?.client_code ?? "",
      username: "",
      password: "",
      config: { ...(existing?.config ?? {}) },
    });
    setTestResult(null);
    if (typeof window !== "undefined") {
      const stored = window.sessionStorage.getItem(sessionKey);
      if (stored === "1") setExpanded(true);
      else if (stored === "0") setExpanded(false);
      else setExpanded(!existing);
    } else {
      setExpanded(!existing);
    }
  }, [existing?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(sessionKey, expanded ? "1" : "0");
  }, [expanded, sessionKey]);

  const update = (key: string, value: unknown) => setState((s) => setValue(s, key, value));

  const save = async () => {
    setSaving(true);
    try {
      const mode = (state.mode as ModeT) ?? "MOCK";
      const endpoint_url = ((state.endpoint_url as string) || "").trim() || null;
      const client_code = ((state.client_code as string) || "").trim() || null;
      const config = (state.config as Record<string, unknown>) ?? {};
      let integration_id = existing?.id ?? null;

      if (existing) {
        const { error } = await supabase
          .from("integrations")
          .update({
            mode, endpoint_url, client_code,
            ativo: mode !== "MOCK" ? true : existing.ativo,
            config: config as never,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("integrations")
          .insert({
            provider: ui.provider, mode, endpoint_url, client_code,
            ativo: mode !== "MOCK", config,
          } as never)
          .select("id")
          .single();
        if (error) throw error;
        integration_id = data?.id ?? null;
      }

      const username = ((state.username as string) || "").trim();
      const password = ((state.password as string) || "").trim();
      if (integration_id && (username || password)) {
        const { error: credErr } = await supabase.functions.invoke("integration-save-credentials", {
          body: { integration_id, username: username || undefined, password: password || undefined },
        });
        if (credErr) throw credErr;
      }

      toast({ title: `${ui.display_name} — configuração salva` });
      setState((s) => ({ ...s, password: "" }));
      await onSaved();
    } catch (e) {
      const h = humanizeError(e);
      toast({ title: h.title, description: h.hint, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!ui.testConnectionEdge) {
      toast({ title: "Teste indisponível", description: `${ui.display_name} ainda sem adapter.` });
      return;
    }
    if (!existing?.id) {
      toast({ title: "Salve antes de testar", description: "Os campos precisam ser persistidos primeiro." });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const username = ((state.username as string) || "").trim() || undefined;
      const password = ((state.password as string) || "").trim() || undefined;
      const { data, error } = await supabase.functions.invoke(ui.testConnectionEdge, {
        body: { integration_id: existing.id, username, password, external_protocol: "TEST-0001" },
      });
      if (error) throw error;
      const ok = !!(data as Record<string, unknown>)?.ok;
      if (ok) {
        const dur = (data as { durationMs?: number })?.durationMs ?? 0;
        const mode = (data as { mode?: string })?.mode ?? "—";
        setTestResult({ ok: true, title: `Conexão OK (${mode}) em ${dur}ms` });
      } else {
        const fault = (data as { fault?: { message?: string } })?.fault?.message
          ?? (data as { error?: string })?.error
          ?? "erro desconhecido";
        const h = humanizeError(fault);
        setTestResult({ ok: false, title: h.title, hint: h.hint });
      }
    } catch (e) {
      const h = humanizeError(e);
      setTestResult({ ok: false, title: h.title, hint: h.hint });
    } finally {
      setTesting(false);
    }
  };

  const renderField = (f: ProviderField) => {
    const value = getValue(state, f.key);
    const colClass = f.colSpan === 2 ? "sm:col-span-2" : "";
    if (f.type === "switch") {
      return (
        <label
          key={f.key}
          className={`${colClass} flex items-start gap-2 text-xs cursor-pointer p-2 rounded-md border border-border hover:bg-muted/30`}
        >
          <input
            type="checkbox"
            className="mt-0.5"
            checked={value === true}
            onChange={(e) => update(f.key, e.target.checked)}
          />
          <span>
            <span className="font-medium text-foreground block">{f.label}</span>
            {f.helpText && <span className="text-muted-foreground">{f.helpText}</span>}
          </span>
        </label>
      );
    }
    if (f.type === "select") {
      return (
        <div key={f.key} className={`${colClass} space-y-1`}>
          <Label className="text-xs">{f.label}</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={(value as string) ?? ""}
            onChange={(e) => update(f.key, e.target.value)}
          >
            {(f.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {f.helpText && <p className="text-[11px] text-muted-foreground">{f.helpText}</p>}
        </div>
      );
    }
    return (
      <div key={f.key} className={`${colClass} space-y-1`}>
        <Label className="text-xs">{f.label}</Label>
        <Input
          type={f.type === "password" ? "password" : "text"}
          value={(value as string) ?? ""}
          placeholder={f.placeholder}
          onChange={(e) => update(f.key, e.target.value)}
        />
        {f.helpText && <p className="text-[11px] text-muted-foreground">{f.helpText}</p>}
      </div>
    );
  };

  const mainFields = ui.fields.filter((f) => f.type !== "switch" && !f.advanced);
  const advancedFields = ui.fields.filter((f) => f.advanced || f.type === "switch");
  const lastSyncLabel = relativeTime(lastSyncAt ?? null);
  const lastSyncDisplay = lastSyncLabel
    ? `Última sincronização ${lastSyncLabel}`
    : isConfigured
      ? "Sem sincronizações recentes"
      : ui.description;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header compacto sempre visível */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
          {ui.short}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground truncate">{ui.display_name}</span>
            <ProviderStatusChip status={ui.status} />
            {isConfigured && <ModeChip mode={existing!.mode} />}
            <ConnectionDot active={isActive} configured={isConfigured} />
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {lastSyncDisplay}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-0" : "-rotate-90"}`}
        />
      </button>

      {/* Capabilities como chips discretos — sempre visíveis */}
      {enabledCaps.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1">
          {enabledCaps.map((c) => (
            <span
              key={c}
              className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground"
            >
              {CAP_LABEL[c] ?? c}
            </span>
          ))}
        </div>
      )}

      {/* Corpo expansível */}
      {expanded && (
        <div className="px-4 pb-4 pt-3 border-t border-border space-y-4 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mainFields.map(renderField)}
          </div>

          {advancedFields.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <Settings2 className="h-3 w-3" />
                {showAdvanced ? "Ocultar avançado" : "Configurações avançadas"}
              </button>
              {showAdvanced && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
                  {advancedFields.map(renderField)}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 justify-end flex-wrap">
            {testResult && (
              <span
                className={
                  "text-xs flex items-center gap-1.5 mr-auto " +
                  (testResult.ok ? "text-emerald-600" : "text-rose-600")
                }
              >
                {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                <span>
                  <span className="font-medium">{testResult.title}</span>
                  {testResult.hint && (
                    <span className="text-muted-foreground"> — {testResult.hint}</span>
                  )}
                </span>
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={testConnection}
              disabled={testing || !existing || !ui.testConnectionEdge}
              title={!ui.testConnectionEdge ? "Provider em preparação — teste indisponível" : undefined}
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
              Testar conexão
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const ProviderStatusChip = ({ status }: { status: ProviderUIStatus }) => {
  const map = {
    disponivel: { label: "Disponível", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    preview:    { label: "Preview / Homologação", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    preparacao: { label: "Em preparação", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    em_breve:   { label: "Em breve", cls: "bg-muted text-muted-foreground border-border" },
  } as const;
  const m = map[status];
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${m.cls}`}>{m.label}</span>;
};

const ModeChip = ({ mode }: { mode: ModeT }) => {
  const cls =
    mode === "PROD" ? "bg-primary/10 text-primary border-primary/30"
    : mode === "HOMOLOG" ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-muted text-muted-foreground border-border";
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cls}`}>{mode}</span>;
};

const ConnectionDot = ({ active, configured }: { active: boolean; configured: boolean }) => {
  if (active) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Conectado
      </span>
    );
  }
  if (configured) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <Circle className="h-2 w-2" /> Em MOCK
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
      <Circle className="h-2 w-2" /> Não configurado
    </span>
  );
};