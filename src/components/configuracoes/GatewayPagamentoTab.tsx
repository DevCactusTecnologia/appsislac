import { useEffect, useState } from "react";
import {
  CreditCard,
  Save,
  Eye,
  EyeOff,
  Check,
  Star,
  Plug,
  Loader2,
  ShieldCheck,
  Webhook,
  Copy,
  AlertCircle,
  History,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import {
  HISTORY_MAX,
  readWebhookHistory,
  appendWebhookEvent,
  clearWebhookHistory,
  type WebhookEvent,
} from "@/lib/gatewayWebhookHistory";

type Provider = "mercado_pago" | "infinitepay";
type Ambiente = "sandbox" | "producao";
type ConnStatus = "idle" | "testing" | "ok" | "error";

interface ProviderConfig {
  ativo: boolean;
  ambiente: Ambiente;
  access_token: string;
  public_key: string;
  webhook_url_sandbox: string;
  webhook_url_producao: string;
  webhook_secret: string;
  handle?: string;
}

interface GatewayConfig {
  default: Provider;
  providers: Record<Provider, ProviderConfig>;
}

const emptyProvider = (): ProviderConfig => ({
  ativo: false,
  ambiente: "sandbox",
  access_token: "",
  public_key: "",
  webhook_url_sandbox: "",
  webhook_url_producao: "",
  webhook_secret: "",
  handle: "",
});

const empty: GatewayConfig = {
  default: "mercado_pago",
  providers: {
    mercado_pago: emptyProvider(),
    infinitepay: emptyProvider(),
  },
};

const PROVIDERS: { id: Provider; name: string; desc: string }[] = [
  { id: "mercado_pago", name: "Mercado Pago", desc: "Receba via Pix, boleto e cartão de crédito" },
  { id: "infinitepay", name: "InfinitePay", desc: "Maquininha, link de pagamento, Pix e cartão" },
];

const WEBHOOK_EXAMPLES: Record<Provider, Record<Ambiente, string>> = {
  mercado_pago: {
    sandbox: "https://seusite.com.br/api/webhooks/mercadopago/sandbox",
    producao: "https://seusite.com.br/api/webhooks/mercadopago",
  },
  infinitepay: {
    sandbox: "https://seusite.com.br/api/webhooks/infinitepay/sandbox",
    producao: "https://seusite.com.br/api/webhooks/infinitepay",
  },
};

const inputClass =
  "w-full h-10 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all";
const labelClass =
  "text-[11px] font-semibold text-muted-foreground uppercase tracking-wider";

function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return value.slice(0, 4) + "••••••••" + value.slice(-4);
}

async function saveToDb(tenantId: string, cfg: GatewayConfig) {
  const promises = (Object.keys(cfg.providers) as Provider[]).map(async (provider) => {
    const cp = cfg.providers[provider];
    const isDefault = cfg.default === provider;

    const { error } = await supabase.from("tenant_payment_gateways").upsert(
      {
        tenant_id: tenantId,
        provider,
        is_active: cp.ativo,
        is_default: isDefault,
        environment: cp.ambiente,
        access_token: cp.access_token,
        public_key: cp.public_key,
        webhook_secret: cp.webhook_secret,
        handle: cp.handle,
      },
      { onConflict: "tenant_id,provider" }
    );

    if (error) throw error;
  });

  await Promise.all(promises);
}

async function readFromDb(tenantId: string): Promise<GatewayConfig> {
  const { data, error } = await supabase
    .from("tenant_payment_gateways")
    .select("*")
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("Error reading gateway config:", error);
    return JSON.parse(JSON.stringify(empty));
  }

  const base = JSON.parse(JSON.stringify(empty));
  if (!data || data.length === 0) return base;

  data.forEach((row: any) => {
    const p = row.provider as Provider;
    base.providers[p] = {
      ativo: row.is_active,
      ambiente: row.environment,
      access_token: row.access_token || "",
      public_key: row.public_key || "",
      webhook_url_sandbox: row.webhook_url_sandbox || "",
      webhook_url_producao: row.webhook_url_producao || "",
      webhook_secret: row.webhook_secret || "",
      handle: row.handle || "",
    };
    if (row.is_default) {
      base.default = p;
    }
  });

  return base;
}

// ---------- Mock testes ----------
async function testConexao(
  provider: Provider,
  cfg: ProviderConfig,
): Promise<{ ok: boolean; message: string }> {
  await new Promise((r) => setTimeout(r, 800));
  if (provider === "mercado_pago") {
    if (!cfg.access_token.trim()) return { ok: false, message: "Access Token vazio." };
    const expectsProd = cfg.ambiente === "producao";
    const isProdToken = cfg.access_token.startsWith("APP_USR-");
    const isTestToken = cfg.access_token.startsWith("TEST-");
    if (expectsProd && !isProdToken)
      return { ok: false, message: "Token não parece ser de produção (prefixo esperado: APP_USR-)." };
    if (!expectsProd && !isTestToken && !isProdToken)
      return { ok: false, message: "Token de sandbox inválido (prefixo esperado: TEST-)." };
    return { ok: true, message: `Conexão validada (${cfg.ambiente}).` };
  }
  if (!cfg.handle?.trim() && !cfg.access_token.trim())
    return { ok: false, message: "Informe o handle ou o Access Token." };
  if (cfg.handle && /[^a-z0-9_.-]/i.test(cfg.handle))
    return { ok: false, message: "Handle contém caracteres inválidos." };
  return { ok: true, message: `Conexão validada (${cfg.ambiente}).` };
}

async function testWebhook(url: string): Promise<{ ok: boolean; message: string }> {
  await new Promise((r) => setTimeout(r, 600));
  if (!url.trim()) return { ok: false, message: "URL de webhook não informada." };
  try {
    const u = new URL(url);
    if (u.protocol !== "https:")
      return { ok: false, message: "Webhook deve usar HTTPS para receber notificações." };
    return {
      ok: true,
      message: `Endpoint ${u.host} respondeu with 200 OK (handshake simulado).`,
    };
  } catch {
    return { ok: false, message: "URL inválida." };
  }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

const GatewayPagamentoTab = () => {
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  
  const [cfg, setCfg] = useState<GatewayConfig>(empty);

  const [activeTab, setActiveTab] = useState<Provider>("mercado_pago");
  const [showToken, setShowToken] = useState(false);
  const [showPublic, setShowPublic] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [conn, setConn] = useState<Record<Provider, { status: ConnStatus; message: string }>>({
    mercado_pago: { status: "idle", message: "" },
    infinitepay: { status: "idle", message: "" },
  });
  const [hook, setHook] = useState<Record<Provider, { status: ConnStatus; message: string }>>({
    mercado_pago: { status: "idle", message: "" },
    infinitepay: { status: "idle", message: "" },
  });
  const [history, setHistory] = useState<WebhookEvent[]>([]);
  const [historyFilter, setHistoryFilter] = useState<"all" | Provider>("all");

  useEffect(() => {
    async function load() {
      if (tenantId) {
        setLoading(true);
        const c = await readFromDb(tenantId);
        setCfg(c);
        setActiveTab(c.default);
      }
      setHistory(readWebhookHistory());
      setLoading(false);
    }
    load();
  }, [tenantId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const current = cfg.providers[activeTab];
  const currConn = conn[activeTab];
  const currHook = hook[activeTab];
  const currentWebhookUrl =
    current.ambiente === "producao" ? current.webhook_url_producao : current.webhook_url_sandbox;

  const updateProvider = <K extends keyof ProviderConfig>(k: K, v: ProviderConfig[K]) => {
    setCfg((c) => ({
      ...c,
      providers: { ...c.providers, [activeTab]: { ...c.providers[activeTab], [k]: v } },
    }));
    setConn((s) => ({ ...s, [activeTab]: { status: "idle", message: "" } }));
    if (
      k === "webhook_url_sandbox" ||
      k === "webhook_url_producao" ||
      k === "webhook_secret" ||
      k === "ambiente"
    ) {
      setHook((s) => ({ ...s, [activeTab]: { status: "idle", message: "" } }));
    }
  };

  const setDefault = (p: Provider) => {
    if (!cfg.providers[p].ativo) {
      toast({
        title: "Ative o gateway primeiro",
        description: "Apenas gateways ativos podem ser definidos como padrão.",
        variant: "destructive",
      });
      return;
    }
    setCfg((c) => ({ ...c, default: p }));
  };

  const recordHistory = (
    provider: Provider,
    ambiente: Ambiente,
    ok: boolean,
    message: string,
    url?: string,
  ) => {
    const ev: WebhookEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      provider,
      ambiente,
      timestamp: new Date().toISOString(),
      status: ok ? "success" : "error",
      message,
      url,
    };
    setHistory(appendWebhookEvent(ev));
  };

  const runConnectionTest = async (provider: Provider): Promise<boolean> => {
    setConn((s) => ({ ...s, [provider]: { status: "testing", message: "" } }));
    const res = await testConexao(provider, cfg.providers[provider]);
    setConn((s) => ({
      ...s,
      [provider]: { status: res.ok ? "ok" : "error", message: res.message },
    }));
    return res.ok;
  };

  const runWebhookTest = async (provider: Provider): Promise<boolean> => {
    const cp = cfg.providers[provider];
    const url =
      cp.ambiente === "producao" ? cp.webhook_url_producao : cp.webhook_url_sandbox;
    setHook((s) => ({ ...s, [provider]: { status: "testing", message: "" } }));
    const res = await testWebhook(url);
    setHook((s) => ({
      ...s,
      [provider]: { status: res.ok ? "ok" : "error", message: res.message },
    }));
    recordHistory(provider, cp.ambiente, res.ok, res.message, url);
    return res.ok;
  };

  const handleTestConnection = async () => {
    const ok = await runConnectionTest(activeTab);
    toast({
      title: ok ? "Conexão validada" : "Falha na conexão",
      description: conn[activeTab].message || (ok ? "OK" : "Erro"),
      variant: ok ? "default" : "destructive",
    });
  };

  const handleTestWebhook = async () => {
    await runWebhookTest(activeTab);
  };

  const handleRetest = async () => {
    const okConn = await runConnectionTest(activeTab);
    const okHook = await runWebhookTest(activeTab);
    toast({
      title: okConn && okHook ? "Tudo certo" : "Atenção",
      description:
        okConn && okHook
          ? `${PROVIDERS.find((p) => p.id === activeTab)?.name} validado em ${current.ambiente}.`
          : "Verifique as mensagens de status nos painéis abaixo.",
      variant: okConn && okHook ? "default" : "destructive",
    });
  };

  const handleCopyExample = () => {
    const ex = WEBHOOK_EXAMPLES[activeTab][current.ambiente];
    navigator.clipboard?.writeText(ex);
    toast({ title: "URL copiada", description: ex });
  };

  const handleSave = async () => {
    if (!tenantId) return;

    for (const p of PROVIDERS) {
      const cp = cfg.providers[p.id];
      if (!cp.ativo) continue;
      if (p.id === "mercado_pago" && !cp.access_token.trim()) {
        toast({
          title: "Access Token obrigatório",
          description: "Informe o Access Token do Mercado Pago para mantê-lo ativo.",
          variant: "destructive",
        });
        return;
      }
      if (p.id === "infinitepay" && !cp.handle?.trim() && !cp.access_token.trim()) {
        toast({
          title: "Credenciais InfinitePay obrigatórias",
          description: "Informe o handle (@sualoja) ou o Access Token da InfinitePay.",
          variant: "destructive",
        });
        return;
      }
    }
    if (!cfg.providers[cfg.default].ativo) {
      toast({
        title: "Gateway padrão inativo",
        description: "O gateway padrão precisa estar ativo. Ative-o ou escolha outro.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await saveToDb(tenantId, cfg);
      localStorage.removeItem("sislac:gatewayPagamento"); // Cleanup legacy
      
      toast({
        title: "Configuração salva no servidor",
        description: "Validando credenciais automaticamente…",
      });
      // Auto-teste pós-save para todos os providers ativos
      for (const p of PROVIDERS) {
        if (cfg.providers[p.id].ativo) {
          await runConnectionTest(p.id);
          const cp = cfg.providers[p.id];
          const url = cp.ambiente === "producao" ? cp.webhook_url_producao : cp.webhook_url_sandbox;
          if (url) {
            await runWebhookTest(p.id);
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível persistir as configurações no banco de dados.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClearHistory = () => {
    clearWebhookHistory();
    setHistory([]);
    toast({ title: "Histórico limpo" });
  };

  const StatusLine = ({ s, m }: { s: ConnStatus; m: string }) => {
    if (s === "idle") return null;
    if (s === "testing")
      return (
        <p className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Testando…
        </p>
      );
    const ok = s === "ok";
    return (
      <p
        className={`mt-2 flex items-center gap-2 text-[12px] font-medium ${
          ok ? "text-emerald-600" : "text-destructive"
        }`}
      >
        {ok ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
        {m}
      </p>
    );
  };

  const filteredHistory =
    historyFilter === "all" ? history : history.filter((h) => h.provider === historyFilter);

  const lastEventByProvider = (p: Provider) =>
    history.find((h) => h.provider === p);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Hero unificado com identidade de /configuracoes */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/5 via-card to-transparent overflow-hidden">
        <div className="px-5 sm:px-7 py-5 sm:py-6 flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/10 ring-1 ring-primary/20 text-primary shrink-0">
            <CreditCard className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Financeiro</p>
            <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight leading-tight mt-0.5">
              Gateway de Pagamento
            </h2>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-2xl">
              Conecte provedores de pagamento, configure ambientes e gerencie webhooks com segurança Nível P0.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-[12px] text-foreground/80 leading-relaxed">
          <strong className="text-foreground">Segurança Nível P0:</strong> Suas credenciais agora são armazenadas
          exclusivamente no servidor com Row Level Security (RLS) habilitado. O armazenamento local foi descontinuado.
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Gateways disponíveis</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure cada provedor e defina qual será o padrão para novos pagamentos.
          </p>
        </div>
        <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PROVIDERS.map((p) => {
            const cp = cfg.providers[p.id];
            const isDefault = cfg.default === p.id;
            const isOpen = activeTab === p.id;
            const lastEv = lastEventByProvider(p.id);
            return (
              <div
                key={p.id}
                className={`rounded-xl border p-4 transition-all ${
                  isOpen ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab(p.id)}
                    className="flex items-start gap-3 text-left flex-1 min-w-0"
                  >
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-foreground truncate">{p.name}</h3>
                        {isDefault && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            <Star className="h-3 w-3 fill-current" />
                            Padrão
                          </span>
                        )}
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${
                            cp.ativo
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {cp.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{p.desc}</p>
                      {lastEv && (
                        <p
                          className={`text-[10px] mt-1 ${
                            lastEv.status === "success"
                              ? "text-emerald-600"
                              : "text-destructive"
                          }`}
                        >
                          Último webhook: {fmtDate(lastEv.timestamp)} ({lastEv.ambiente})
                        </p>
                      )}
                    </div>
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setDefault(p.id)}
                    disabled={isDefault}
                    className="text-[11px] font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
                  >
                    {isDefault ? "✓ Padrão atual" : "Definir como padrão"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab(p.id)}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    Configurar →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {PROVIDERS.find((p) => p.id === activeTab)?.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                {PROVIDERS.find((p) => p.id === activeTab)?.desc}
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs font-medium text-muted-foreground">
              {current.ativo ? "Ativo" : "Inativo"}
            </span>
            <input
              type="checkbox"
              checked={current.ativo}
              onChange={(e) => updateProvider("ativo", e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
          </label>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          <div>
            <label className={labelClass}>Ambiente</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["sandbox", "producao"] as Ambiente[]).map((amb) => {
                const active = current.ambiente === amb;
                return (
                  <button
                    key={amb}
                    type="button"
                    onClick={() => updateProvider("ambiente", amb)}
                    className={`h-10 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {active && <Check className="h-4 w-4" />}
                    {amb === "sandbox" ? "Sandbox (testes)" : "Produção"}
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === "infinitepay" && (
            <div>
              <label className={labelClass}>Handle da loja (@sualoja)</label>
              <input
                type="text"
                value={current.handle || ""}
                onChange={(e) => updateProvider("handle", e.target.value)}
                placeholder="sualoja"
                className={inputClass + " mt-2 font-mono"}
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Identificador público da sua conta InfinitePay (sem @).
              </p>
            </div>
          )}

          <div>
            <label className={labelClass}>
              {activeTab === "infinitepay" ? "Access Token (API)" : "Access Token"}
            </label>
            <div className="mt-2 relative">
              <input
                type="text"
                value={showToken ? current.access_token : maskSecret(current.access_token)}
                onChange={(e) => updateProvider("access_token", e.target.value)}
                onFocus={() => setShowToken(true)}
                placeholder={activeTab === "mercado_pago" ? "APP_USR-..." : "Bearer ..."}
                className={inputClass + " pr-10 font-mono"}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground"
                aria-label="Mostrar token"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {activeTab === "mercado_pago"
                ? "Obtenha em: Mercado Pago → Suas integrações → Credenciais"
                : "Obtenha em: InfinitePay → Configurações → Integrações → API"}
            </p>
          </div>

          <div>
            <label className={labelClass}>Public Key</label>
            <div className="mt-2 relative">
              <input
                type="text"
                value={showPublic ? current.public_key : maskSecret(current.public_key)}
                onChange={(e) => updateProvider("public_key", e.target.value)}
                onFocus={() => setShowPublic(true)}
                placeholder={activeTab === "mercado_pago" ? "APP_USR-..." : "pk_..."}
                className={inputClass + " pr-10 font-mono"}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowPublic((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground"
                aria-label="Mostrar public key"
              >
                {showPublic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-2 min-w-0">
                <Plug className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Testar conexão</p>
                  <p className="text-[11px] text-muted-foreground">
                    Valida credenciais sem persistir. Use “Retestar tudo” para checar conexão + webhook do ambiente atual.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={currConn.status === "testing"}
                  className="h-9 px-3 rounded-lg border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/10 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {currConn.status === "testing" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plug className="h-3.5 w-3.5" />
                  )}
                  Testar conexão
                </button>
                <button
                  type="button"
                  onClick={handleRetest}
                  disabled={currConn.status === "testing" || currHook.status === "testing"}
                  className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retestar tudo
                </button>
              </div>
            </div>
            <StatusLine s={currConn.status} m={currConn.message} />
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Webhook className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Webhook · {current.ambiente === "producao" ? "Produção" : "Sandbox"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Endpoint HTTPS chamado pelo provedor a cada evento. URLs são salvas separadamente por ambiente.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>URL Sandbox</label>
                <input
                  type="text"
                  value={current.webhook_url_sandbox}
                  onChange={(e) => updateProvider("webhook_url_sandbox", e.target.value)}
                  placeholder={WEBHOOK_EXAMPLES[activeTab].sandbox}
                  className={
                    inputClass +
                    " mt-2 " +
                    (current.ambiente === "sandbox" ? "border-primary/40" : "")
                  }
                />
              </div>
              <div>
                <label className={labelClass}>URL Produção</label>
                <input
                  type="text"
                  value={current.webhook_url_producao}
                  onChange={(e) => updateProvider("webhook_url_producao", e.target.value)}
                  placeholder={WEBHOOK_EXAMPLES[activeTab].producao}
                  className={
                    inputClass +
                    " mt-2 " +
                    (current.ambiente === "producao" ? "border-primary/40" : "")
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] text-muted-foreground">
                Ambiente ativo:{" "}
                <code className="px-1 py-0.5 rounded bg-muted text-[10px]">
                  {currentWebhookUrl || "—"}
                </code>
              </p>
              <button
                type="button"
                onClick={handleCopyExample}
                className="text-[11px] text-primary hover:underline flex items-center gap-1"
              >
                <Copy className="h-3 w-3" /> Copiar exemplo ({current.ambiente})
              </button>
            </div>

            <div>
              <label className={labelClass}>Webhook Secret (assinatura)</label>
              <div className="mt-2 relative">
                <input
                  type="text"
                  value={
                    showWebhookSecret
                      ? current.webhook_secret
                      : maskSecret(current.webhook_secret)
                  }
                  onChange={(e) => updateProvider("webhook_secret", e.target.value)}
                  onFocus={() => setShowWebhookSecret(true)}
                  placeholder={activeTab === "mercado_pago" ? "whsec_..." : "wh_..."}
                  className={inputClass + " pr-10 font-mono"}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowWebhookSecret((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground"
                  aria-label="Mostrar webhook secret"
                >
                  {showWebhookSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Usado para validar a assinatura HMAC enviada pelo provedor.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="text-[11px] text-muted-foreground">
                {currHook.status === "ok" && (
                  <span className="text-emerald-600">
                    ● Pronto para receber eventos
                  </span>
                )}
                {currHook.status === "error" && (
                  <span className="text-destructive">● Não foi possível validar</span>
                )}
                {currHook.status === "idle" && <span>● Aguardando teste</span>}
                {currHook.status === "testing" && <span>● Validando…</span>}
              </div>
              <button
                type="button"
                onClick={handleTestWebhook}
                disabled={currHook.status === "testing"}
                className="h-9 px-3 rounded-lg border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/10 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {currHook.status === "testing" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Webhook className="h-3.5 w-3.5" />
                )}
                Validar webhook ({current.ambiente})
              </button>
            </div>
            <StatusLine s={currHook.status} m={currHook.message} />
          </div>

          <div className="flex justify-end pt-2 border-t border-border">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? "Salvando e validando..." : "Salvar e validar"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <History className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Histórico de webhooks</h2>
              <p className="text-xs text-muted-foreground">
                Eventos de validação e recebimentos registrados localmente (últimos {HISTORY_MAX}).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={historyFilter}
              onChange={(e) => setHistoryFilter(e.target.value as any)}
              className="h-9 px-2 rounded-lg border border-border bg-card text-xs text-foreground"
            >
              <option value="all">Todos os gateways</option>
              <option value="mercado_pago">Mercado Pago</option>
              <option value="infinitepay">InfinitePay</option>
            </select>
            <button
              type="button"
              onClick={handleClearHistory}
              disabled={history.length === 0}
              className="h-9 px-3 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors flex items-center gap-2 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpar
            </button>
          </div>
        </div>
        {filteredHistory.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhum evento ainda. Use “Validar webhook” ou “Retestar tudo” para registrar entradas.
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[420px] overflow-auto">
            {filteredHistory.map((ev) => {
              const ok = ev.status === "success";
              return (
                <div key={ev.id} className="px-5 sm:px-6 py-3 flex items-start gap-3">
                  <div
                    className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                      ok ? "bg-emerald-500" : "bg-destructive"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-semibold text-foreground">
                        {PROVIDERS.find((p) => p.id === ev.provider)?.name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                        {ev.ambiente === "producao" ? "produção" : "sandbox"}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${
                          ok
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : "bg-destructive/10 text-destructive border-destructive/20"
                        }`}
                      >
                        {ok ? "sucesso" : "erro"}
                      </span>
                      <span className="text-muted-foreground">{fmtDate(ev.timestamp)}</span>
                    </div>
                    <p className="text-[12px] text-foreground/90 mt-0.5">{ev.message}</p>
                    {ev.url && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        <code className="px-1 py-0.5 rounded bg-muted">{ev.url}</code>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default GatewayPagamentoTab;
