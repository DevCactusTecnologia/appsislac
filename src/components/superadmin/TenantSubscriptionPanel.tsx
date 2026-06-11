// Painel de Assinatura para a tela de detalhe do tenant.
// Lê tenant_subscriptions_billing + subscription_plans via edge
// super-admin-billing e permite trocar plano / cancelar / reativar.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { CreditCard, Sparkles, Calendar, RefreshCw, Power, ArrowRight } from "lucide-react";
import { PlanCard, type SubscriptionPlan, fmtPlanPrice } from "./PlanCard";
import { SubscriptionStatusBadge } from "./SubscriptionStatusBadge";

interface BillingState {
  tenant_id: string;
  plan_code: string;
  status: string;
  billing_cycle: string;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  mrr_cents: number;
  canceled_at: string | null;
  notes: string | null;
}

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("pt-BR") : "—";
const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function TenantSubscriptionPanel({ tenantId }: { tenantId: string }) {
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("super-admin-billing", {
      body: { action: "get", tenantId },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setBilling((data?.billing ?? null) as BillingState | null);
    setPlans((data?.plans ?? []) as SubscriptionPlan[]);
  };

  useEffect(() => { void load(); }, [tenantId]);

  const currentPlan = plans.find(p => p.code === billing?.plan_code) ?? null;

  const openChangeDialog = () => {
    setSelectedCode(billing?.plan_code ?? plans.find(p => p.is_default)?.code ?? plans[0]?.code ?? null);
    setCycle((billing?.billing_cycle === "yearly" ? "yearly" : "monthly"));
    setOpen(true);
  };

  const applyPlan = async () => {
    if (!selectedCode) return;
    setBusy(true);
    const { error } = await supabase.functions.invoke("super-admin-billing", {
      body: { action: "assignPlan", tenantId, planCode: selectedCode, billingCycle: cycle },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Plano atualizado");
    setOpen(false);
    void load();
  };

  const cancel = async () => {
    if (!confirm("Cancelar a assinatura deste laboratório?")) return;
    setBusy(true);
    const { error } = await supabase.functions.invoke("super-admin-billing", {
      body: { action: "cancel", tenantId },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Assinatura cancelada");
    void load();
  };

  const reactivate = async () => {
    setBusy(true);
    const { error } = await supabase.functions.invoke("super-admin-billing", {
      body: { action: "reactivate", tenantId },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Assinatura reativada");
    void load();
  };

  return (
    <section className="rounded-lg border border-border/60 bg-card p-5 sm:p-6">
      <header className="flex items-start gap-3 mb-5">
        <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <CreditCard className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground tracking-tight">Assinatura</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Plano vigente, ciclo e próxima renovação.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          </Button>
        </div>
      </header>

      {loading && !billing ? (
        <div className="h-32 rounded-md bg-muted/30 animate-pulse" />
      ) : !billing ? (
        <div className="text-sm text-muted-foreground">
          Nenhuma assinatura encontrada para este laboratório.
          <div className="mt-3">
            <Button size="sm" onClick={openChangeDialog} disabled={plans.length === 0}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Atribuir plano
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
            <Metric label="Plano" value={currentPlan?.nome ?? billing.plan_code} mono />
            <Metric label="Status" value={<SubscriptionStatusBadge status={billing.status} />} />
            <Metric
              label="MRR"
              value={billing.mrr_cents > 0 ? fmtBRL(billing.mrr_cents) : "—"}
            />
            <Metric
              label="Ciclo"
              value={billing.billing_cycle === "yearly" ? "Anual" : billing.billing_cycle === "monthly" ? "Mensal" : "Grátis"}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-4">
            <InfoLine icon={Calendar} label="Período atual" value={`${fmtDate(billing.current_period_start)} → ${fmtDate(billing.current_period_end)}`} />
            <InfoLine icon={Calendar} label="Trial termina" value={fmtDate(billing.trial_ends_at)} />
            <InfoLine icon={Calendar} label="Cancelado em" value={fmtDate(billing.canceled_at)} />
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-border/60">
            <Button size="sm" onClick={openChangeDialog} disabled={busy}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Alterar plano
            </Button>
            {billing.status !== "canceled" ? (
              <Button size="sm" variant="outline" onClick={cancel} disabled={busy}>
                <Power className="h-3.5 w-3.5 mr-1.5" />
                Cancelar assinatura
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={reactivate} disabled={busy}>
                <Power className="h-3.5 w-3.5 mr-1.5" />
                Reativar
              </Button>
            )}
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Alterar plano</DialogTitle>
            <DialogDescription>
              Selecione o novo plano e o ciclo de cobrança. A mudança é aplicada imediatamente.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-1.5 mb-3">
            {(["monthly", "yearly"] as const).map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                className={
                  "h-8 px-3 rounded-md text-xs font-semibold border transition-colors " +
                  (cycle === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground")
                }
              >
                {c === "monthly" ? "Mensal" : "Anual"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {plans.filter(p => p.is_active).map(p => (
              <PlanCard
                key={p.id}
                plan={p}
                compact
                selected={selectedCode === p.code}
                onSelect={() => setSelectedCode(p.code)}
              />
            ))}
          </div>

          <DialogFooter className="mt-3">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
            <Button onClick={applyPlan} disabled={busy || !selectedCode}>
              {busy ? "Aplicando..." : (
                <>Aplicar <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Metric({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className={"mt-1 text-sm font-semibold text-foreground capitalize " + (mono ? "font-mono" : "")}>
        {value}
      </div>
    </div>
  );
}

function InfoLine({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-foreground/80">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

// Re-export para evitar tree-shake do helper se for usado externamente.
export const _fmt = fmtPlanPrice;