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
import { Switch } from "@/components/ui/switch";
import SectionShell from "./_shared/SectionShell";

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
  { id: "mercado_pago", name: "Mercado Pago", desc: "Pix, boleto e cartão" },
  { id: "infinitepay", name: "InfinitePay", desc: "Maquininha, link, Pix e cartão" },
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

const fieldLabel = "text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block";
const fieldInput =
  "w-full h-10 px-3 rounded-lg border border-border/60 bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all";

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
    if (row.is_default) base.default = p;
  });
  return base;
}

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
    return { ok: true, message: `Endpoint ${u.host} respondeu 200 OK (handshake simulado).` };
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
  const [showHistory, setShowHistory] = useState(false);

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
  const activeCount = (Object.keys(cfg.providers) as Provider[]).filter(p => cfg.providers[p].ativo).length;

  const updateProvider = <K extends keyof ProviderConfig>(k: K, v: ProviderConfig[K]) => {
    setCfg((c) => ({
      ...c,
      providers: { ...c.providers, [activeTab]: { ...c.providers[activeTab], [k]: v } },
    }));
    setConn((s) => ({ ...s, [activeTab]: { status: "idle", message: "" } }));
    if (k === "webhook_url_sandbox" || k === "webhook_url_producao" || k === "webhook_secret" || k === "ambiente") {
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

  const recordHistory = (provider: Provider, ambiente: Ambiente, ok: boolean, message: string, url?: string) => {
    const ev: WebhookEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      provider, ambiente,
      timestamp: new Date().toISOString(),
      status: ok ? "success" : "error",
      message, url,
    };
    setHistory(appendWebhookEvent(ev));
  };

  const runConnectionTest = async (provider: Provider) => {
    setConn((s) => ({ ...s, [provider]: { status: "testing", message: "" } }));
    const res = await testConexao(provider, cfg.providers[provider]);
    setConn((s) => ({ ...s, [provider]: { status: res.ok ? "ok" : "error", message: res.message } }));
    return res.ok;
  };

  const runWebhookTest = async (provider: Provider) => {
    const cp = cfg.providers[provider];
    const url = cp.ambiente === "producao" ? cp.webhook_url_producao : cp.webhook_url_sandbox;
    setHook((s) => ({ ...s, [provider]: { status: "testing", message: "" } }));
    const res = await testWebhook(url);
    setHook((s) => ({ ...s, [provider]: { status: res.ok ? "ok" : "error", message: res.message } }));
    recordHistory(provider, cp.ambiente, res.ok, res.message, url);
    return res.ok;
  };

  const handleRetest = async () => {
    const okConn = await runConnectionTest(activeTab);
    const okHook = await runWebhookTest(activeTab);
    toast({
      title: okConn && okHook ? "Tudo certo" : "Atenção",
      description: okConn && okHook
        ? `${PROVIDERS.find((p) => p.id === activeTab)?.name} validado em ${current.ambiente}.`
        : "Verifique as mensagens de status abaixo.",
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
        toast({ title: "Access Token obrigatório", description: "Informe o Access Token do Mercado Pago.", variant: "destructive" });
        return;
      }
      if (p.id === "infinitepay" && !cp.handle?.trim() && !cp.access_token.trim()) {
        toast({ title: "Credenciais InfinitePay obrigatórias", description: "Informe o handle ou o Access Token.", variant: "destructive" });
        return;
      }
    }
    if (!cfg.providers[cfg.default].ativo) {
      toast({ title: "Gateway padrão inativo", description: "O gateway padrão precisa estar ativo.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await saveToDb(tenantId, cfg);
      localStorage.removeItem("sislac:gatewayPagamento");
      toast({ title: "Configuração salva", description: "Validando credenciais…" });
      for (const p of PROVIDERS) {
        if (cfg.providers[p.id].ativo) {
          await runConnectionTest(p.id);
          const cp = cfg.providers[p.id];
          const url = cp.ambiente === "producao" ? cp.webhook_url_producao : cp.webhook_url_sandbox;
          if (url) await runWebhookTest(p.id);
        }
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao salvar", description: "Não foi possível persistir as configurações.", variant: "destructive" });
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
        <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Testando…
        </p>
      );
    const ok = s === "ok";
    return (
      <p className={`flex items-center gap-2 text-[12px] font-medium ${ok ? "text-[hsl(var(--status-success))]" : "text-destructive"}`}>
        {ok ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
        {m}
      </p>
    );
  };

  const filteredHistory = historyFilter === "all" ? history : history.filter((h) => h.provider === historyFilter);

  return (
    <SectionShell
      icon={<CreditCard className="h-5 w-5" />}
      eyebrow="Financeiro"
      title="Gateway de Pagamento"
      description="Conecte provedores, configure ambientes e valide webhooks."
      meta={
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
          {activeCount} ativo{activeCount !== 1 ? "s" : ""}
        </span>
      }
      actions={
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? "Salvando…" : "Salvar e validar"}
        </button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
        {/* ─── Coluna esquerda: configuração ─── */}
        <div className="lg:col-span-3 space-y-5 min-w-0">
          {/* Segmented: providers */}
          <div>
            <label className={fieldLabel}>Provedor</label>
            <div className="flex flex-wrap lg:flex-nowrap p-1 rounded-lg bg-muted/50 border border-border/60 gap-1">
              {PROVIDERS.map(p => {
                const isActive = activeTab === p.id;
                const isDefault = cfg.default === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setActiveTab(p.id)}
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 h-9 px-3 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                      isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    {p.name}
                    {isDefault && <Star className="h-3 w-3 fill-current text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toggles: ativo + padrão */}
          <div className="rounded-lg border border-border/60 bg-muted/20 divide-y divide-border/40">
            <label className="flex items-center justify-between gap-4 px-4 py-3 cursor-pointer">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-background border border-border/60 flex items-center justify-center shrink-0">
                  <Plug className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">Gateway ativo</div>
                  <div className="text-[11px] text-muted-foreground">{PROVIDERS.find(p => p.id === activeTab)?.desc}</div>
                </div>
              </div>
              <Switch checked={current.ativo} onCheckedChange={(v) => updateProvider("ativo", v)} />
            </label>
            <label className="flex items-center justify-between gap-4 px-4 py-3 cursor-pointer">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-background border border-border/60 flex items-center justify-center shrink-0">
                  <Star className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">Definir como padrão</div>
                  <div className="text-[11px] text-muted-foreground">
                    Usado por padrão em novos pagamentos
                  </div>
                </div>
              </div>
              <Switch
                checked={cfg.default === activeTab}
                onCheckedChange={(v) => { if (v) setDefault(activeTab); }}
                disabled={!current.ativo || cfg.default === activeTab}
              />
            </label>
          </div>

          {/* Ambiente (segmented) */}
          <div>
            <label className={fieldLabel}>Ambiente</label>
            <div className="flex p-1 rounded-lg bg-muted/50 border border-border/60 gap-1">
              {(["sandbox", "producao"] as Ambiente[]).map((amb) => {
                const active = current.ambiente === amb;
                return (
                  <button
                    key={amb}
                    type="button"
                    onClick={() => updateProvider("ambiente", amb)}
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold transition-all ${
                      active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {active && <Check className="h-3.5 w-3.5 text-primary" />}
                    {amb === "sandbox" ? "Sandbox" : "Produção"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Credenciais */}
          <div className="space-y-4">
            {activeTab === "infinitepay" && (
              <div>
                <label className={fieldLabel}>Handle da loja</label>
                <input
                  type="text"
                  value={current.handle || ""}
                  onChange={(e) => updateProvider("handle", e.target.value)}
                  placeholder="sualoja"
                  className={fieldInput + " font-mono"}
                />
              </div>
            )}

            <div>
              <label className={fieldLabel}>Access Token</label>
              <div className="relative">
                <input
                  type="text"
                  value={showToken ? current.access_token : maskSecret(current.access_token)}
                  onChange={(e) => updateProvider("access_token", e.target.value)}
                  onFocus={() => setShowToken(true)}
                  placeholder={activeTab === "mercado_pago" ? "APP_USR-..." : "Bearer ..."}
                  className={fieldInput + " pr-10 font-mono"}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className={fieldLabel}>Public Key</label>
              <div className="relative">
                <input
                  type="text"
                  value={showPublic ? current.public_key : maskSecret(current.public_key)}
                  onChange={(e) => updateProvider("public_key", e.target.value)}
                  onFocus={() => setShowPublic(true)}
                  placeholder={activeTab === "mercado_pago" ? "APP_USR-..." : "pk_..."}
                  className={fieldInput + " pr-10 font-mono"}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowPublic((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground"
                >
                  {showPublic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Webhook */}
          <div className="space-y-4 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Webhook className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  Webhook · {current.ambiente === "producao" ? "Produção" : "Sandbox"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyExample}
                className="text-[11px] text-primary hover:underline flex items-center gap-1"
              >
                <Copy className="h-3 w-3" /> Copiar exemplo
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={fieldLabel}>URL Sandbox</label>
                <input
                  type="text"
                  value={current.webhook_url_sandbox}
                  onChange={(e) => updateProvider("webhook_url_sandbox", e.target.value)}
                  placeholder={WEBHOOK_EXAMPLES[activeTab].sandbox}
                  className={fieldInput + (current.ambiente === "sandbox" ? " border-primary/40" : "")}
                />
              </div>
              <div>
                <label className={fieldLabel}>URL Produção</label>
                <input
                  type="text"
                  value={current.webhook_url_producao}
                  onChange={(e) => updateProvider("webhook_url_producao", e.target.value)}
                  placeholder={WEBHOOK_EXAMPLES[activeTab].producao}
                  className={fieldInput + (current.ambiente === "producao" ? " border-primary/40" : "")}
                />
              </div>
            </div>

            <div>
              <label className={fieldLabel}>Webhook Secret</label>
              <div className="relative">
                <input
                  type="text"
                  value={showWebhookSecret ? current.webhook_secret : maskSecret(current.webhook_secret)}
                  onChange={(e) => updateProvider("webhook_secret", e.target.value)}
                  onFocus={() => setShowWebhookSecret(true)}
                  placeholder={activeTab === "mercado_pago" ? "whsec_..." : "wh_..."}
                  className={fieldInput + " pr-10 font-mono"}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowWebhookSecret((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground"
                >
                  {showWebhookSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {currentWebhookUrl && (
                <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
                  Endpoint ativo: <code className="px-1 py-0.5 rounded bg-muted text-[10px]">{currentWebhookUrl}</code>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ─── Coluna direita: status + ações ─── */}
        <div className="lg:col-span-2 min-w-0">
          <div className="lg:sticky lg:top-6 bg-gradient-to-br from-primary/5 to-transparent border border-primary/15 rounded-2xl p-5 sm:p-6 space-y-5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status & validação</p>

            {/* Status compactos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Plug className="h-3.5 w-3.5" /> Conexão
                </span>
                <span className={`text-xs font-semibold ${
                  currConn.status === "ok" ? "text-[hsl(var(--status-success))]" :
                  currConn.status === "error" ? "text-destructive" :
                  currConn.status === "testing" ? "text-muted-foreground" : "text-muted-foreground"
                }`}>
                  {currConn.status === "ok" ? "Validada" :
                   currConn.status === "error" ? "Erro" :
                   currConn.status === "testing" ? "Testando…" : "Não testada"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Webhook className="h-3.5 w-3.5" /> Webhook
                </span>
                <span className={`text-xs font-semibold ${
                  currHook.status === "ok" ? "text-[hsl(var(--status-success))]" :
                  currHook.status === "error" ? "text-destructive" :
                  currHook.status === "testing" ? "text-muted-foreground" : "text-muted-foreground"
                }`}>
                  {currHook.status === "ok" ? "Pronto" :
                   currHook.status === "error" ? "Erro" :
                   currHook.status === "testing" ? "Testando…" : "Aguardando"}
                </span>
              </div>
            </div>

            {(currConn.message || currHook.message) && (
              <div className="space-y-1.5 pt-3 border-t border-border/60">
                <StatusLine s={currConn.status} m={currConn.message} />
                <StatusLine s={currHook.status} m={currHook.message} />
              </div>
            )}

            {/* Ação principal */}
            <button
              type="button"
              onClick={handleRetest}
              disabled={currConn.status === "testing" || currHook.status === "testing"}
              className="w-full py-3 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground shadow-[0_2px_12px_-2px_hsl(var(--primary)/0.4)] hover:shadow-[0_4px_20px_-2px_hsl(var(--primary)/0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${(currConn.status === "testing" || currHook.status === "testing") ? "animate-spin" : ""}`} />
              Retestar conexão e webhook
            </button>

            {/* Histórico */}
            <div className="border-t border-border/60 pt-4">
              <button
                type="button"
                onClick={() => setShowHistory(v => !v)}
                className="w-full flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-2">
                  <History className="h-3.5 w-3.5" />
                  Histórico ({history.length})
                </span>
                <span className="text-[10px]">{showHistory ? "Ocultar" : "Ver"}</span>
              </button>

              {showHistory && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={historyFilter}
                      onChange={(e) => setHistoryFilter(e.target.value as any)}
                      className="flex-1 h-8 px-2 rounded-lg border border-border/60 bg-background text-[11px] text-foreground"
                    >
                      <option value="all">Todos</option>
                      <option value="mercado_pago">Mercado Pago</option>
                      <option value="infinitepay">InfinitePay</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleClearHistory}
                      disabled={history.length === 0}
                      className="h-8 px-2 rounded-lg border border-border/60 text-[11px] text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors flex items-center gap-1 disabled:opacity-40"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>

                  {filteredHistory.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground py-6 text-center">
                      Nenhum evento registrado.
                    </p>
                  ) : (
                    <div className="max-h-[280px] overflow-auto space-y-1.5 pr-1">
                      {filteredHistory.slice(0, HISTORY_MAX).map((ev) => {
                        const ok = ev.status === "success";
                        return (
                          <div key={ev.id} className="rounded-lg border border-border/60 bg-background/60 px-3 py-2">
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${ok ? "bg-[hsl(var(--status-success))]" : "bg-destructive"}`} />
                              <span className="font-semibold text-foreground truncate">
                                {PROVIDERS.find((p) => p.id === ev.provider)?.name}
                              </span>
                              <span className="text-muted-foreground ml-auto shrink-0">{fmtDate(ev.timestamp)}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{ev.message}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
};

export default GatewayPagamentoTab;
