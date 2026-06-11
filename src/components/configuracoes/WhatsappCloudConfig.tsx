import { useEffect, useState } from "react";
import {
  Loader2,
  Save,
  MessageCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Check,
  Zap,
  Building2,
  Smartphone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentTenantId } from "@/data/_tenant";

type Modo = "simples" | "cloud_api" | "zapi";

interface WhatsappCfg {
  modo: Modo;
  ativo: boolean;
  // Modo simples
  numero_simples: string;
  // Cloud API (Meta)
  phone_number_id: string;
  waba_id: string;
  access_token: string;
  display_phone: string;
  webhook_verify_token: string;
  // Z-API
  zapi_instance_id: string;
  zapi_token: string;
  zapi_client_token: string;
}

const empty: WhatsappCfg = {
  modo: "simples",
  ativo: false,
  numero_simples: "",
  phone_number_id: "",
  waba_id: "",
  access_token: "",
  display_phone: "",
  webhook_verify_token: "",
  zapi_instance_id: "",
  zapi_token: "",
  zapi_client_token: "",
};

const inputClass =
  "w-full h-10 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all";
const labelClass = "text-[11px] font-semibold text-muted-foreground uppercase tracking-wider";

function gerarTokenAleatorio(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

interface ModoCardProps {
  ativo: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  titulo: string;
  badge: string;
  badgeTone: "muted" | "primary" | "success";
  descricao: string;
}

const ModoCard = ({ ativo, onClick, icon, titulo, badge, badgeTone, descricao }: ModoCardProps) => {
  // Monocromático/flat: badges sem cor de destaque, apenas hierarquia tipográfica.
  const badgeStyle =
    badgeTone === "primary"
      ? "border border-primary/30 text-primary"
      : "border border-border text-muted-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border p-4 transition-colors ${
        ativo
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:border-primary/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border ${
            ativo ? "border-primary/30 text-primary" : "border-border text-muted-foreground"
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-foreground">{titulo}</h4>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeStyle}`}>
              {badge}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{descricao}</p>
        </div>
      </div>
    </button>
  );
};

const WhatsappCloudConfig = () => {
  const { user } = useAuth();
  const [cfg, setCfg] = useState<WhatsappCfg>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showZapiToken, setShowZapiToken] = useState(false);
  const [showZapiClient, setShowZapiClient] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    setWebhookUrl(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`);
    let cancelled = false;
    (async () => {
      let tid = user?.tenantId;
      if (!tid) tid = await getCurrentTenantId();
      
      const { data } = await supabase
        .from("tenant_whatsapp_config")
        .select(
          "modo, ativo, numero_simples, phone_number_id, waba_id, access_token, display_phone, webhook_verify_token, zapi_instance_id, zapi_token, zapi_client_token",
        )
        .eq("tenant_id", tid)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setCfg({
          modo: ((data.modo as Modo) ?? "simples"),
          ativo: !!data.ativo,
          numero_simples: data.numero_simples ?? "",
          phone_number_id: data.phone_number_id ?? "",
          waba_id: data.waba_id ?? "",
          access_token: data.access_token ?? "",
          display_phone: data.display_phone ?? "",
          webhook_verify_token: data.webhook_verify_token ?? "",
          zapi_instance_id: data.zapi_instance_id ?? "",
          zapi_token: data.zapi_token ?? "",
          zapi_client_token: data.zapi_client_token ?? "",
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const validar = (): string | null => {
    if (!cfg.ativo) return null;
    if (cfg.modo === "simples" && !cfg.numero_simples.trim()) {
      return "Informe o número WhatsApp do laboratório.";
    }
    if (cfg.modo === "cloud_api" && (!cfg.phone_number_id.trim() || !cfg.access_token.trim())) {
      return "Phone Number ID e Access Token são obrigatórios para Cloud API.";
    }
    if (cfg.modo === "zapi" && (!cfg.zapi_instance_id.trim() || !cfg.zapi_token.trim())) {
      return "Instance ID e Token são obrigatórios para Z-API.";
    }
    return null;
  };

  const handleSave = async () => {
    const err = validar();
    if (err) {
      toast({ title: "Dados incompletos", description: err, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let tenantId = user?.tenantId;
      if (!tenantId) {
        tenantId = await getCurrentTenantId();
      }
      
      if (!tenantId || tenantId === "demo") {
        throw new Error("Tenant não resolvido.");
      }

      const payload = {
        tenant_id: tenantId,
        modo: cfg.modo,
        ativo: cfg.ativo,
        numero_simples: cfg.numero_simples.trim() || null,
        phone_number_id: cfg.phone_number_id.trim() || null,
        waba_id: cfg.waba_id.trim() || null,
        access_token: cfg.access_token.trim() || null,
        display_phone: cfg.display_phone.trim() || null,
        webhook_verify_token: cfg.webhook_verify_token.trim() || null,
        zapi_instance_id: cfg.zapi_instance_id.trim() || null,
        zapi_token: cfg.zapi_token.trim() || null,
        zapi_client_token: cfg.zapi_client_token.trim() || null,
      };
      const { error } = await supabase
        .from("tenant_whatsapp_config")
        .upsert(payload, { onConflict: "tenant_id" });
      if (error) throw error;
      toast({ title: "Configuração salva", description: "WhatsApp atualizado." });
    } catch (e) {
      toast({
        title: "Erro ao salvar",
        description: (e as Error).message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando configuração...
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg border border-border flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Envio por WhatsApp</h3>
            <p className="text-xs text-muted-foreground">
              Escolha como o laboratório envia comprovantes para o paciente.
            </p>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={cfg.ativo}
            onChange={(e) => setCfg({ ...cfg, ativo: e.target.checked })}
            className="h-4 w-4 accent-primary"
          />
          <span className="text-xs font-medium text-foreground">
            {cfg.ativo ? "Ativo" : "Desativado"}
          </span>
        </label>
      </header>

      {/* Seletor de modo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ModoCard
          ativo={cfg.modo === "simples"}
          onClick={() => setCfg({ ...cfg, modo: "simples" })}
          icon={<Smartphone className="h-4 w-4" />}
          titulo="Simples"
          badge="Pronto em 30s"
          badgeTone="success"
          descricao="O atendente clica em Enviar e abre o WhatsApp Web/App com a mensagem e o link curto do PDF prontos. Sem conta Meta, sem token."
        />
        <ModoCard
          ativo={cfg.modo === "cloud_api"}
          onClick={() => setCfg({ ...cfg, modo: "cloud_api" })}
          icon={<Building2 className="h-4 w-4" />}
          titulo="Cloud API (Meta)"
          badge="Oficial"
          badgeTone="primary"
          descricao="Anexo nativo automático, sem intervenção do atendente. Exige conta Meta Business e token permanente."
        />
        <ModoCard
          ativo={cfg.modo === "zapi"}
          onClick={() => setCfg({ ...cfg, modo: "zapi" })}
          icon={<Zap className="h-4 w-4" />}
          titulo="Z-API"
          badge="Plug & play"
          badgeTone="muted"
          descricao="Anexo nativo via gateway Z-API: faça login com QR Code no painel deles e cole instância + token aqui."
        />
      </div>

      {/* ===== MODO SIMPLES ===== */}
      {cfg.modo === "simples" && (
        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div>
            <label className={labelClass}>Número WhatsApp do laboratório *</label>
            <input
              value={cfg.numero_simples}
              onChange={(e) => setCfg({ ...cfg, numero_simples: e.target.value })}
              className={inputClass}
              placeholder="+55 62 99999-9999"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Esse número é exibido nos comprovantes e usado como remetente padrão. O envio em si
              acontece pelo WhatsApp Web/App do atendente, com a mensagem e o link curto já prontos.
            </p>
          </div>
        </div>
      )}

      {/* ===== CLOUD API ===== */}
      {cfg.modo === "cloud_api" && (
        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={labelClass}>Phone Number ID *</label>
              <input
                value={cfg.phone_number_id}
                onChange={(e) => setCfg({ ...cfg, phone_number_id: e.target.value })}
                className={inputClass}
                placeholder="Ex.: 1234567890"
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>WhatsApp Business Account ID</label>
              <input
                value={cfg.waba_id}
                onChange={(e) => setCfg({ ...cfg, waba_id: e.target.value })}
                className={inputClass}
                placeholder="Ex.: 9876543210"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className={labelClass}>Access Token (System User Token) *</label>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  value={cfg.access_token}
                  onChange={(e) => setCfg({ ...cfg, access_token: e.target.value })}
                  className={`${inputClass} pr-10 font-mono text-xs`}
                  placeholder="EAAGm..."
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={showToken ? "Ocultar token" : "Mostrar token"}
                >
                  {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Use um token permanente de System User. O token fica criptografado no backend.
              </p>
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Telefone exibido</label>
              <input
                value={cfg.display_phone}
                onChange={(e) => setCfg({ ...cfg, display_phone: e.target.value })}
                className={inputClass}
                placeholder="+55 11 91234-5678"
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Webhook Verify Token</label>
              <div className="flex gap-2">
                <input
                  value={cfg.webhook_verify_token}
                  onChange={(e) => setCfg({ ...cfg, webhook_verify_token: e.target.value })}
                  className={`${inputClass} font-mono text-xs`}
                  placeholder="Gere um token aleatório"
                />
                <button
                  type="button"
                  onClick={() => setCfg({ ...cfg, webhook_verify_token: gerarTokenAleatorio() })}
                  className="h-10 px-3 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted/40 flex items-center gap-1"
                  title="Gerar token aleatório"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-3 space-y-2">
            <p className={labelClass}>Webhook URL — cadastre na Meta</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] font-mono text-foreground break-all">
                {webhookUrl}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl).catch(() => {});
                  toast({ title: "Copiado", description: "URL do webhook copiada." });
                }}
                className="h-8 px-3 rounded-lg border border-border bg-card text-xs font-semibold hover:bg-muted/40 flex items-center gap-1"
              >
                <Check className="h-3.5 w-3.5" /> Copiar
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Cole em <strong>Meta for Developers → WhatsApp → Configuration → Webhook</strong> com
              o mesmo Verify Token. Inscreva-se no campo <code>messages</code>.
            </p>
          </div>
        </div>
      )}

      {/* ===== Z-API ===== */}
      {cfg.modo === "zapi" && (
        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={labelClass}>Instance ID *</label>
              <input
                value={cfg.zapi_instance_id}
                onChange={(e) => setCfg({ ...cfg, zapi_instance_id: e.target.value })}
                className={inputClass}
                placeholder="3D... (do painel Z-API)"
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Instance Token *</label>
              <div className="relative">
                <input
                  type={showZapiToken ? "text" : "password"}
                  value={cfg.zapi_token}
                  onChange={(e) => setCfg({ ...cfg, zapi_token: e.target.value })}
                  className={`${inputClass} pr-10 font-mono text-xs`}
                  placeholder="Token da instância"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowZapiToken((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={showZapiToken ? "Ocultar token" : "Mostrar token"}
                >
                  {showZapiToken ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className={labelClass}>Client-Token (segurança da conta)</label>
              <div className="relative">
                <input
                  type={showZapiClient ? "text" : "password"}
                  value={cfg.zapi_client_token}
                  onChange={(e) => setCfg({ ...cfg, zapi_client_token: e.target.value })}
                  className={`${inputClass} pr-10 font-mono text-xs`}
                  placeholder="Opcional — recomendado pela Z-API"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowZapiClient((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={showZapiClient ? "Ocultar" : "Mostrar"}
                >
                  {showZapiClient ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Pegue Instance ID, Token e Client-Token no painel da Z-API após escanear o QR Code
                com o WhatsApp do laboratório.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? "Salvando..." : "Salvar configuração"}
        </button>
      </div>
    </section>
  );
};

export default WhatsappCloudConfig;