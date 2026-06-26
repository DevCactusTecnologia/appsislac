// Configurações globais do SaaS (Super Admin).
// - Status do Lovable AI Gateway (informativo, gerenciado pela plataforma)
// - Integrações Externas (SMTP, Gemini/OpenAI, AWS S3, WhatsApp)

import { useEffect, useState } from "react";
import {
  Settings, Sparkles, Mail, Info, Save, Loader2, Eye, EyeOff,
  Plug, Lock, Brain, Cloud, MessageCircle, PlugZap, CheckCircle2, XCircle, Mic2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type SmtpSecurity = "none" | "starttls" | "ssl";

const AWS_REGIONS: { value: string; label: string }[] = [
  { value: "us-east-1", label: "US East (N. Virginia) — us-east-1" },
  { value: "us-east-2", label: "US East (Ohio) — us-east-2" },
  { value: "us-west-1", label: "US West (N. California) — us-west-1" },
  { value: "us-west-2", label: "US West (Oregon) — us-west-2" },
  { value: "af-south-1", label: "Africa (Cape Town) — af-south-1" },
  { value: "ap-east-1", label: "Asia Pacific (Hong Kong) — ap-east-1" },
  { value: "ap-south-1", label: "Asia Pacific (Mumbai) — ap-south-1" },
  { value: "ap-south-2", label: "Asia Pacific (Hyderabad) — ap-south-2" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore) — ap-southeast-1" },
  { value: "ap-southeast-2", label: "Asia Pacific (Sydney) — ap-southeast-2" },
  { value: "ap-southeast-3", label: "Asia Pacific (Jakarta) — ap-southeast-3" },
  { value: "ap-southeast-4", label: "Asia Pacific (Melbourne) — ap-southeast-4" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo) — ap-northeast-1" },
  { value: "ap-northeast-2", label: "Asia Pacific (Seoul) — ap-northeast-2" },
  { value: "ap-northeast-3", label: "Asia Pacific (Osaka) — ap-northeast-3" },
  { value: "ca-central-1", label: "Canada (Central) — ca-central-1" },
  { value: "ca-west-1", label: "Canada West (Calgary) — ca-west-1" },
  { value: "eu-central-1", label: "Europe (Frankfurt) — eu-central-1" },
  { value: "eu-central-2", label: "Europe (Zurich) — eu-central-2" },
  { value: "eu-west-1", label: "Europe (Ireland) — eu-west-1" },
  { value: "eu-west-2", label: "Europe (London) — eu-west-2" },
  { value: "eu-west-3", label: "Europe (Paris) — eu-west-3" },
  { value: "eu-north-1", label: "Europe (Stockholm) — eu-north-1" },
  { value: "eu-south-1", label: "Europe (Milan) — eu-south-1" },
  { value: "eu-south-2", label: "Europe (Spain) — eu-south-2" },
  { value: "il-central-1", label: "Israel (Tel Aviv) — il-central-1" },
  { value: "me-south-1", label: "Middle East (Bahrain) — me-south-1" },
  { value: "me-central-1", label: "Middle East (UAE) — me-central-1" },
  { value: "sa-east-1", label: "South America (São Paulo) — sa-east-1" },
];

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  security: SmtpSecurity;
  /** Mantido por compat: derivado de security === "ssl" */
  secure: boolean;
}

interface AiConfig {
  geminiApiKey: string;
  openaiApiKey: string;
  openaiOrgId: string;
}

interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  endpoint: string;
}

interface WhatsappConfig {
  provider: "meta";
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
  businessAccountId: string;
}

interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string;
  modelId: string;
}

const EMPTY_SMTP: SmtpConfig = {
  host: "", port: 587, user: "", password: "",
  fromEmail: "", fromName: "", security: "starttls", secure: false,
};
const EMPTY_AI: AiConfig = { geminiApiKey: "", openaiApiKey: "", openaiOrgId: "" };
const EMPTY_S3: S3Config = { accessKeyId: "", secretAccessKey: "", region: "us-east-1", bucket: "", endpoint: "" };
const EMPTY_WPP: WhatsappConfig = { provider: "meta", phoneNumberId: "", accessToken: "", verifyToken: "", businessAccountId: "" };
const EMPTY_ELEVEN: ElevenLabsConfig = { apiKey: "", voiceId: "7iqXtOF3wl3pomwXFY7G", modelId: "eleven_multilingual_v2" };

const SECURITY_OPTIONS: { value: SmtpSecurity; label: string; hint: string; defaultPort: number }[] = [
  { value: "none", label: "Nenhuma", hint: "Sem criptografia (não recomendado)", defaultPort: 25 },
  { value: "starttls", label: "STARTTLS", hint: "Criptografia oportunista (porta 587)", defaultPort: 587 },
  { value: "ssl", label: "SSL/TLS", hint: "Criptografia direta (porta 465)", defaultPort: 465 },
];

type IntegrationTab = "smtp" | "gemini" | "openai" | "s3" | "whatsapp" | "elevenlabs";

const INTEGRATION_TABS: { id: IntegrationTab; label: string; icon: typeof Mail }[] = [
  { id: "smtp", label: "Servidor SMTP", icon: Mail },
  { id: "gemini", label: "Google Gemini", icon: Sparkles },
  { id: "openai", label: "OpenAI", icon: Brain },
  { id: "s3", label: "AWS S3", icon: Cloud },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "elevenlabs", label: "ElevenLabs", icon: Mic2 },
];

async function loadSetting<T>(key: string, fallback: T): Promise<T> {
  const { data, error } = await supabase
    .from("saas_settings" as any)
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error && (error as any).code !== "PGRST116") {
    toast.error(error.message);
    return fallback;
  }
  const value = (data as any)?.value;
  return value ? { ...fallback, ...value } : fallback;
}

async function saveSetting(key: string, value: unknown) {
  return supabase.from("saas_settings" as any).upsert(
    { key, value },
    { onConflict: "key" },
  );
}

export default function SuperAdminConfiguracoes() {
  const [smtp, setSmtp] = useState<SmtpConfig>(EMPTY_SMTP);
  const [smtpOriginal, setSmtpOriginal] = useState<SmtpConfig>(EMPTY_SMTP);
  const [ai, setAi] = useState<AiConfig>(EMPTY_AI);
  const [aiOriginal, setAiOriginal] = useState<AiConfig>(EMPTY_AI);
  const [s3, setS3] = useState<S3Config>(EMPTY_S3);
  const [s3Original, setS3Original] = useState<S3Config>(EMPTY_S3);
  const [wpp, setWpp] = useState<WhatsappConfig>(EMPTY_WPP);
  const [wppOriginal, setWppOriginal] = useState<WhatsappConfig>(EMPTY_WPP);
  const [eleven, setEleven] = useState<ElevenLabsConfig>(EMPTY_ELEVEN);
  const [elevenOriginal, setElevenOriginal] = useState<ElevenLabsConfig>(EMPTY_ELEVEN);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<IntegrationTab | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [revealKeys, setRevealKeys] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<IntegrationTab>("smtp");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [smtpV, aiV, s3V, wppV, elevenV] = await Promise.all([
        loadSetting<SmtpConfig>("smtp_config", EMPTY_SMTP),
        loadSetting<AiConfig>("ai_config", EMPTY_AI),
        loadSetting<S3Config>("s3_config", EMPTY_S3),
        loadSetting<WhatsappConfig>("whatsapp_config", EMPTY_WPP),
        loadSetting<ElevenLabsConfig>("elevenlabs_config", EMPTY_ELEVEN),
      ]);
      if (!alive) return;
      // Compat SMTP legado
      const legacyFrom: string = (smtpV as any).from ?? "";
      const m = legacyFrom.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
      const security: SmtpSecurity = smtpV.security ?? ((smtpV as any).secure ? "ssl" : "starttls");
      const smtpNorm: SmtpConfig = {
        host: smtpV.host ?? "",
        port: smtpV.port ?? 587,
        user: smtpV.user ?? "",
        password: smtpV.password ?? "",
        fromEmail: smtpV.fromEmail ?? (m ? m[2].trim() : legacyFrom.trim()),
        fromName: smtpV.fromName ?? (m ? m[1].trim() : ""),
        security,
        secure: security === "ssl",
      };
      setSmtp(smtpNorm); setSmtpOriginal(smtpNorm);
      setAi(aiV); setAiOriginal(aiV);
      setS3(s3V); setS3Original(s3V);
      setWpp(wppV); setWppOriginal(wppV);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const isSmtpDirty = JSON.stringify(smtp) !== JSON.stringify(smtpOriginal);
  const isGeminiDirty = ai.geminiApiKey !== aiOriginal.geminiApiKey;
  const isOpenaiDirty =
    ai.openaiApiKey !== aiOriginal.openaiApiKey ||
    ai.openaiOrgId !== aiOriginal.openaiOrgId;
  const isS3Dirty = JSON.stringify(s3) !== JSON.stringify(s3Original);
  const isWppDirty = JSON.stringify(wpp) !== JSON.stringify(wppOriginal);

  const updSmtp = <K extends keyof SmtpConfig>(k: K, v: SmtpConfig[K]) => setSmtp((p) => ({ ...p, [k]: v }));
  const updAi = <K extends keyof AiConfig>(k: K, v: AiConfig[K]) => setAi((p) => ({ ...p, [k]: v }));
  const updS3 = <K extends keyof S3Config>(k: K, v: S3Config[K]) => setS3((p) => ({ ...p, [k]: v }));
  const updWpp = <K extends keyof WhatsappConfig>(k: K, v: WhatsappConfig[K]) => setWpp((p) => ({ ...p, [k]: v }));

  const onSecurityChange = (sec: SmtpSecurity) => {
    const opt = SECURITY_OPTIONS.find((o) => o.value === sec)!;
    const wasDefault = SECURITY_OPTIONS.some((o) => o.defaultPort === smtp.port);
    setSmtp((p) => ({ ...p, security: sec, secure: sec === "ssl", port: wasDefault ? opt.defaultPort : p.port }));
  };

  const saveSmtp = async () => {
    if (!smtp.host.trim() || !smtp.user.trim() || !smtp.fromEmail.trim()) {
      toast.error("Host, usuário e e-mail remetente são obrigatórios.");
      return;
    }
    setSaving(true);
    const { error } = await saveSetting("smtp_config", smtp);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setSmtpOriginal(smtp);
    toast.success("Configuração SMTP salva.");
  };
  // Salva apenas os campos do provider indicado, mesclando com o ai_config
  // mais recente do banco para evitar sobrescrever credenciais do outro provider.
  const saveAiProvider = async (provider: "gemini" | "openai") => {
    setSaving(true);
    const remote = await loadSetting<AiConfig>("ai_config", EMPTY_AI);
    const merged: AiConfig =
      provider === "gemini"
        ? { ...remote, geminiApiKey: ai.geminiApiKey }
        : { ...remote, openaiApiKey: ai.openaiApiKey, openaiOrgId: ai.openaiOrgId };
    const { error } = await saveSetting("ai_config", merged);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    // Sincroniza estado local com o que está realmente persistido,
    // preservando edições não salvas do outro provider.
    setAi((p) =>
      provider === "gemini"
        ? { ...p, geminiApiKey: merged.geminiApiKey }
        : { ...p, openaiApiKey: merged.openaiApiKey, openaiOrgId: merged.openaiOrgId },
    );
    setAiOriginal(merged);
    toast.success(
      provider === "gemini" ? "Credenciais do Gemini salvas." : "Credenciais da OpenAI salvas.",
    );
  };
  const saveS3 = async () => {
    if (!s3.bucket.trim() || !s3.accessKeyId.trim()) {
      toast.error("Bucket e Access Key ID são obrigatórios.");
      return;
    }
    setSaving(true);
    const { error } = await saveSetting("s3_config", s3);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setS3Original(s3);
    toast.success("Configuração AWS S3 salva.");
  };
  const saveWpp = async () => {
    setSaving(true);
    const { error } = await saveSetting("whatsapp_config", wpp);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setWppOriginal(wpp);
    toast.success("Configuração WhatsApp salva.");
  };

  /** Validação client-side dos campos antes de testar a conexão de fato. */
  const testConnection = async (tab: IntegrationTab) => {
    setTesting(tab);
    let integration: "smtp" | "ai" | "s3" | "whatsapp";
    let config: unknown;
    if (tab === "smtp") { integration = "smtp"; config = smtp; }
    else if (tab === "gemini") { integration = "ai"; config = { geminiApiKey: ai.geminiApiKey }; }
    else if (tab === "openai") { integration = "ai"; config = { openaiApiKey: ai.openaiApiKey, openaiOrgId: ai.openaiOrgId }; }
    else if (tab === "s3") { integration = "s3"; config = s3; }
    else { integration = "whatsapp"; config = wpp; }
    try {
      const { data, error } = await supabase.functions.invoke("super-admin-test-integration", {
        body: { integration, config },
      });
      if (error) {
        toast.error(`Teste de conexão: ${error.message}`);
        return;
      }
      const res = data as { ok: boolean; message: string };
      if (res?.ok) toast.success(`Teste de conexão: ${res.message}`);
      else toast.error(`Teste de conexão: ${res?.message ?? "falha desconhecida"}`);
    } catch (e) {
      toast.error(`Teste de conexão: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTesting(null);
    }
  };

  const toggleReveal = (k: string) => setRevealKeys((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div className="pb-10 space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 sm:p-8">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4 sm:gap-5 min-w-0">
            <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0 shadow-[0_12px_32px_-8px_hsl(var(--primary)/0.6)]">
              <Settings className="h-7 w-7 sm:h-8 sm:w-8 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                Configurações do sistema
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                Configurações globais do SaaS — disponíveis apenas para o Super Admin.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card/70 backdrop-blur-sm border border-border/60 text-[11px] font-semibold text-muted-foreground shrink-0">
            <Lock className="h-3.5 w-3.5" /> Criptografia AES-256
          </span>
        </div>

        {/* Status overview */}
        <div className="relative mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatusTile
            icon={Sparkles}
            label="IA Gateway"
            value="Ativo"
            tone="emerald"
            hint="Lovable AI"
          />
          <StatusTile
            icon={Mail}
            label="SMTP"
            value={smtpOriginal.host && smtpOriginal.password ? "Configurado" : "Pendente"}
            tone={smtpOriginal.host && smtpOriginal.password ? "emerald" : "amber"}
            hint={smtpOriginal.host || "—"}
          />
          <StatusTile
            icon={Cloud}
            label="AWS S3"
            value={s3Original.accessKeyId && s3Original.bucket ? "Configurado" : "Pendente"}
            tone={s3Original.accessKeyId && s3Original.bucket ? "emerald" : "amber"}
            hint={s3Original.bucket || "—"}
          />
          <StatusTile
            icon={MessageCircle}
            label="WhatsApp"
            value={wppOriginal.phoneNumberId && wppOriginal.accessToken ? "Configurado" : "Pendente"}
            tone={wppOriginal.phoneNumberId && wppOriginal.accessToken ? "emerald" : "amber"}
            hint={wppOriginal.provider || "—"}
          />
        </div>
      </div>

      {/* Card: Status IA Gateway */}
      <section className="bg-card border border-border rounded-2xl overflow-hidden">
        <header className="px-5 py-4 border-b border-border flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[hsl(var(--status-purple))]/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-[hsl(var(--status-purple))]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Inteligência Artificial</h2>
            <p className="text-[11px] text-muted-foreground">Lovable AI Gateway — gerenciado pela plataforma</p>
          </div>
          <span
            className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{
              backgroundColor: "hsl(var(--status-success) / 0.12)",
              color: "hsl(var(--status-success))",
              border: "1px solid hsl(var(--status-success) / 0.25)",
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: "hsl(var(--status-success))" }} /> Ativo
          </span>
        </header>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="px-4 py-3 rounded-xl bg-muted/30 border border-border/40">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Modelo padrão</p>
              <p className="text-sm font-semibold text-foreground mt-1">google/gemini-2.5-flash</p>
            </div>
            <div className="px-4 py-3 rounded-xl bg-muted/30 border border-border/40">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Provedor</p>
              <p className="text-sm font-semibold text-foreground mt-1">Lovable AI Gateway</p>
            </div>
          </div>
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-muted/20 border border-border/40">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Não é necessário configurar credenciais de OpenAI ou Gemini. Todas as chamadas de IA do sistema
              já passam pelo gateway gerenciado.
            </p>
          </div>
        </div>
      </section>

      {/* Card: Integrações Externas */}
      <section className="bg-card border border-border rounded-2xl overflow-hidden">
        <header className="px-5 py-4 border-b border-border flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Plug className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">Integrações Externas</h2>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Gerencie as credenciais de serviços externos. Chaves sensíveis são armazenadas com criptografia AES-256.
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/40 border border-border/40 text-[10px] font-semibold text-muted-foreground">
            <Lock className="h-3 w-3" /> AES-256
          </span>
        </header>

        {/* Tabs */}
        <div className="px-3 sm:px-5 pt-3 border-b border-border bg-muted/10">
          <div className="flex gap-1 overflow-x-auto -mb-px">
            {INTEGRATION_TABS.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium whitespace-nowrap border-b-2 transition-colors ${
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="p-5"><div className="h-40 bg-muted/30 rounded-xl animate-pulse" /></div>
        ) : (
          <>
            {/* SMTP */}
            {activeTab === "smtp" && (
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">Servidor SMTP</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Credenciais globais para envio de e-mails transacionais
                    </p>
                  </div>
                  <StatusBadge configured={!!smtpOriginal.host && !!smtpOriginal.password} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <FieldLabel>Host SMTP</FieldLabel>
                    <Input value={smtp.host} onChange={(e) => updSmtp("host", e.target.value)} placeholder="smtp.exemplo.com" />
                  </div>
                  <div>
                    <FieldLabel>Porta</FieldLabel>
                    <Input type="number" value={smtp.port} onChange={(e) => updSmtp("port", Number(e.target.value) || 0)} placeholder="587" />
                  </div>
                  <div>
                    <FieldLabel>Segurança</FieldLabel>
                    <select
                      value={smtp.security}
                      onChange={(e) => onSecurityChange(e.target.value as SmtpSecurity)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {SECURITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label} — {o.hint}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Usuário</FieldLabel>
                    <Input value={smtp.user} onChange={(e) => updSmtp("user", e.target.value)} placeholder="usuario@exemplo.com" />
                  </div>
                  <div>
                    <FieldLabel>Senha</FieldLabel>
                    <SecretInput
                      value={smtp.password}
                      onChange={(v) => updSmtp("password", v)}
                      placeholder="Digite a senha do SMTP"
                      visible={showPassword}
                      onToggle={() => setShowPassword((s) => !s)}
                    />
                  </div>
                  <div>
                    <FieldLabel>E-mail remetente</FieldLabel>
                    <Input type="email" value={smtp.fromEmail} onChange={(e) => updSmtp("fromEmail", e.target.value)} placeholder="no-reply@exemplo.com" />
                  </div>
                  <div>
                    <FieldLabel>Nome remetente</FieldLabel>
                    <Input value={smtp.fromName} onChange={(e) => updSmtp("fromName", e.target.value)} placeholder="SISLAC" />
                  </div>
                </div>

                <InfoNote>
                  Estas credenciais serão utilizadas pelo sistema de autenticação para enviar
                  os e-mails de <strong>confirmação de cadastro</strong> e <strong>redefinição de senha</strong>.
                </InfoNote>

                <ActionsBar
                  onTest={() => testConnection("smtp")}
                  testing={testing === "smtp"}
                  onSave={saveSmtp}
                  saving={saving}
                  dirty={isSmtpDirty}
                />
              </div>
            )}

            {/* Google Gemini */}
            {activeTab === "gemini" && (
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">Google Gemini</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Chave de API para uso direto do Google Gemini
                    </p>
                  </div>
                  <StatusBadge configured={!!aiOriginal.geminiApiKey} />
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <FieldLabel>Google Gemini API Key</FieldLabel>
                    <SecretInput
                      value={ai.geminiApiKey}
                      onChange={(v) => updAi("geminiApiKey", v)}
                      placeholder="AIza..."
                      visible={!!revealKeys.gemini}
                      onToggle={() => toggleReveal("gemini")}
                    />
                  </div>
                </div>

                <InfoNote>
                  Obtenha sua chave em <strong>Google AI Studio</strong> (aistudio.google.com).
                  As chamadas internas de IA usam o <strong>Lovable AI Gateway</strong> e não exigem chave —
                  configure aqui apenas para acesso direto ao Gemini fora do gateway.
                </InfoNote>

                <ActionsBar
                  onTest={() => testConnection("gemini")}
                  testing={testing === "gemini"}
                  onSave={() => saveAiProvider("gemini")}
                  saving={saving}
                  dirty={isGeminiDirty}
                />
              </div>
            )}

            {/* OpenAI */}
            {activeTab === "openai" && (
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">OpenAI</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Credenciais para uso direto da API da OpenAI
                    </p>
                  </div>
                  <StatusBadge configured={!!aiOriginal.openaiApiKey} />
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <FieldLabel>OpenAI API Key</FieldLabel>
                    <SecretInput
                      value={ai.openaiApiKey}
                      onChange={(v) => updAi("openaiApiKey", v)}
                      placeholder="sk-..."
                      visible={!!revealKeys.openai}
                      onToggle={() => toggleReveal("openai")}
                    />
                  </div>
                  <div>
                    <FieldLabel>OpenAI Organization ID (opcional)</FieldLabel>
                    <Input value={ai.openaiOrgId} onChange={(e) => updAi("openaiOrgId", e.target.value)} placeholder="org-..." />
                  </div>
                </div>

                <InfoNote>
                  Obtenha sua chave em <strong>platform.openai.com/api-keys</strong>. O <em>Organization ID</em>
                  é opcional e útil quando sua conta pertence a múltiplas organizações.
                </InfoNote>

                <ActionsBar
                  onTest={() => testConnection("openai")}
                  testing={testing === "openai"}
                  onSave={() => saveAiProvider("openai")}
                  saving={saving}
                  dirty={isOpenaiDirty}
                />
              </div>
            )}

            {/* AWS S3 */}
            {activeTab === "s3" && (
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">AWS S3</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Armazenamento de laudos, anexos e backups em buckets S3
                    </p>
                  </div>
                  <StatusBadge configured={!!(s3Original.accessKeyId && s3Original.bucket)} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Access Key ID</FieldLabel>
                    <Input value={s3.accessKeyId} onChange={(e) => updS3("accessKeyId", e.target.value)} placeholder="AKIA..." />
                  </div>
                  <div>
                    <FieldLabel>Secret Access Key</FieldLabel>
                    <SecretInput
                      value={s3.secretAccessKey}
                      onChange={(v) => updS3("secretAccessKey", v)}
                      placeholder="••••••••••••••••"
                      visible={!!revealKeys.s3secret}
                      onToggle={() => toggleReveal("s3secret")}
                    />
                  </div>
                  <div>
                    <FieldLabel>Região</FieldLabel>
                    <Select value={s3.region} onValueChange={(v) => updS3("region", v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a região" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {AWS_REGIONS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <FieldLabel>Bucket</FieldLabel>
                    <Input value={s3.bucket} onChange={(e) => updS3("bucket", e.target.value.trim())} placeholder="meu-bucket" />
                  </div>
                  <div className="sm:col-span-2">
                    <FieldLabel>Endpoint customizado (opcional)</FieldLabel>
                    <Input value={s3.endpoint} onChange={(e) => updS3("endpoint", e.target.value)} placeholder="https://s3.exemplo.com (compatível S3)" />
                  </div>
                </div>

                <InfoNote>
                  Use endpoint customizado para serviços compatíveis com S3 (MinIO, Wasabi, R2 etc.).
                  Caso contrário, deixe em branco para usar a AWS oficial.
                </InfoNote>

                <ActionsBar
                  onTest={() => testConnection("s3")}
                  testing={testing === "s3"}
                  onSave={saveS3}
                  saving={saving}
                  dirty={isS3Dirty}
                />
              </div>
            )}

            {/* WhatsApp */}
            {activeTab === "whatsapp" && (
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">WhatsApp</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Envio de notificações e laudos via WhatsApp Business
                    </p>
                  </div>
                  <StatusBadge configured={!!(wppOriginal.phoneNumberId && wppOriginal.accessToken)} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Provedor</FieldLabel>
                    <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-foreground">
                      Meta Cloud API (oficial) — centralizado
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Phone Number ID</FieldLabel>
                    <Input value={wpp.phoneNumberId} onChange={(e) => updWpp("phoneNumberId", e.target.value)} placeholder="1234567890" />
                  </div>
                  <div className="sm:col-span-2">
                    <FieldLabel>Access Token</FieldLabel>
                    <SecretInput
                      value={wpp.accessToken}
                      onChange={(v) => updWpp("accessToken", v)}
                      placeholder="EAA..."
                      visible={!!revealKeys.wppToken}
                      onToggle={() => toggleReveal("wppToken")}
                    />
                  </div>
                  <div>
                    <FieldLabel>Verify Token (webhook)</FieldLabel>
                    <Input value={wpp.verifyToken} onChange={(e) => updWpp("verifyToken", e.target.value)} placeholder="token-de-verificacao" />
                  </div>
                  <div>
                    <FieldLabel>Business Account ID</FieldLabel>
                    <Input value={wpp.businessAccountId} onChange={(e) => updWpp("businessAccountId", e.target.value)} placeholder="987654321" />
                  </div>
                </div>

                <InfoNote>
                  As credenciais são geradas em Meta for Developers (única conta corporativa do SISLAC).
                </InfoNote>

                <ActionsBar
                  onTest={() => testConnection("whatsapp")}
                  testing={testing === "whatsapp"}
                  onSave={saveWpp}
                  saving={saving}
                  dirty={isWppDirty}
                />
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function StatusTile({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone: "emerald" | "amber" | "primary";
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-status-success-bg text-status-success",
    amber: "bg-status-warning-bg text-status-warning",
  };
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-3 flex items-center gap-3">
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", toneMap[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{label}</div>
        <div className="text-sm font-bold text-foreground leading-tight truncate">{value}</div>
        {hint && (
          <div className="text-[10px] text-muted-foreground truncate">{hint}</div>
        )}
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{children}</label>;
}

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-muted/20 border border-border/40">
      <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <p className="text-[12px] text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}

function SecretInput({
  value, onChange, placeholder, visible, onToggle,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
        className="pr-10"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
        title={visible ? "Ocultar" : "Mostrar"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function ActionsBar({
  onTest, testing, onSave, saving, dirty,
}: {
  onTest: () => void;
  testing: boolean;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2 pt-1">
      <Button variant="outline" onClick={onTest} disabled={testing || saving}>
        {testing ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <PlugZap className="h-4 w-4 mr-2" />
        )}
        {testing ? "Testando..." : "Testar conexão"}
      </Button>
      <Button onClick={onSave} disabled={!dirty || saving}>
        {saving ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Save className="h-4 w-4 mr-2" />
        )}
        {saving ? "Salvando..." : "Salvar configuração"}
      </Button>
    </div>
  );
}

function StatusBadge({ configured }: { configured: boolean }) {
  if (configured) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
        style={{
          backgroundColor: "hsl(var(--status-success) / 0.12)",
          color: "hsl(var(--status-success))",
          border: "1px solid hsl(var(--status-success) / 0.25)",
        }}
      >
        <CheckCircle2 className="h-3 w-3" />
        Configurado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/40 border border-border/40 text-[11px] font-semibold text-muted-foreground">
      <XCircle className="h-3 w-3" />
      Não configurado
    </span>
  );
}
