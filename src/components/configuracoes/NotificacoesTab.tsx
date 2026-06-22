// WhatsApp 2.0 — Fase 3E.1 — Configurações de notificações por laboratório
// ------------------------------------------------------------------------
// Permite ao admin do laboratório escolher, para cada tipo de notificação
// WhatsApp, se o envio é Automático ou Manual.
//
// IMPORTANTE: esta aba NÃO mostra token, número, webhook, provider ou
// credencial Meta — essas continuam exclusivas do Super Admin
// (`/super-admin/notificacoes`). Aqui é apenas política de envio.
import { useEffect, useState } from "react";
import { Bell, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  getNotificationSettings,
  saveNotificationSettings,
  type NotificationMode,
  type NotificationSettings,
  type NotificationType,
} from "@/lib/whatsapp/notificationPolicy";

type Row = {
  key: NotificationType;
  label: string;
  desc: string;
  default: NotificationMode;
};

const ROWS: Row[] = [
  { key: "resultado_pronto", label: "Resultado pronto", desc: "Aviso ao paciente quando todos os exames forem liberados.", default: "automatic" },
  { key: "recoleta",         label: "Recoleta",         desc: "Aviso ao paciente quando for solicitada nova coleta.",     default: "manual" },
  { key: "orcamento",        label: "Orçamento",        desc: "Envio do orçamento gerado em PDF.",                          default: "manual" },
  { key: "atendimento",      label: "Comprovante de atendimento", desc: "Envio do comprovante após registrar o atendimento.", default: "automatic" },
  { key: "agendamento",      label: "Comprovante de agendamento", desc: "Envio do comprovante após registrar o agendamento.", default: "automatic" },
  { key: "consulta",         label: "Confirmação de consulta",    desc: "Lembrete de consulta marcada.",                       default: "automatic" },
];

function ModeToggle({
  value,
  onChange,
  disabled,
}: {
  value: NotificationMode;
  onChange: (v: NotificationMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-card overflow-hidden" role="radiogroup">
      {(["automatic", "manual"] as const).map((m) => {
        const active = value === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(m)}
            className={
              "px-3 h-9 text-xs font-semibold transition-colors " +
              (active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent")
            }
          >
            {m === "automatic" ? "Automático" : "Manual"}
          </button>
        );
      })}
    </div>
  );
}

export default function NotificacoesTab() {
  const { user, hasPermission } = useAuth();
  const tenantId = user?.tenantId ?? "";
  const canEdit = hasPermission("configurar_lab");
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getNotificationSettings(tenantId)
      .then((s) => alive && setSettings(s))
      .catch(() => alive && setSettings(DEFAULT_NOTIFICATION_SETTINGS))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [tenantId]);

  const set = (k: NotificationType, v: NotificationMode) =>
    setSettings((prev) => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      await saveNotificationSettings(tenantId, settings);
      toast.success("Política de notificações atualizada.");
    } catch (e) {
      toast.error("Falha ao salvar", {
        description: e instanceof Error ? e.message : "Erro desconhecido",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Notificações WhatsApp</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Defina, para cada tipo de aviso, se o sistema envia automaticamente quando o evento
            acontece ou se deixa pendente para envio manual com um clique. Token, número e
            credenciais permanecem centralizados no Super Admin.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canEdit || saving || loading}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </button>
      </div>

      <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4 px-4 py-4 bg-background">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">{row.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {row.desc}{" "}
                <span className="text-muted-foreground/70">· padrão: {row.default === "automatic" ? "Automático" : "Manual"}</span>
              </div>
            </div>
            <ModeToggle
              value={settings[row.key]}
              onChange={(v) => set(row.key, v)}
              disabled={!canEdit || loading}
            />
          </div>
        ))}
      </div>

      {!canEdit && (
        <p className="mt-4 text-xs text-muted-foreground">
          Você não tem permissão para alterar a política de notificações deste laboratório.
        </p>
      )}
    </div>
  );
}
