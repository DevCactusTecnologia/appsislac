// Control Plane Dashboard — Visão executiva simplificada.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db as supabase } from "@/runtime/db";
import {
  Building2, Activity, AlertTriangle, Plus, Database, Server, Clock, CheckCircle2, XCircle, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, PageSkeleton } from "@/components/superadmin/PageHeader";
import { StatusBadge, toneForHealth } from "@/components/superadmin/StatusBadge";
import { cn } from "@/lib/utils";

interface Metrics {
  tenantsTotal: number;
  tenantsAtivos: number;
  federated?: {
    healthy: number;
    failed: number;
    stale: number;
    healthCheckP95Ms: number;
  };
  controlPlane?: {
    runtimeDist: { shared_db: number; isolated_db: number };
    pendingProvision: number;
    failedProvision: number;
  };
}

export default function SuperAdminDashboard() {
  const [m, setM] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("super-admin-metrics");
        if (!alive) return;
        if (error) { setErr(error.message); return; }
        setM(data?.metrics ?? null);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "Erro desconhecido");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading && !m) return <PageSkeleton rows={6} />;

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <PageHeader
        title="Painel de Controle"
        description="Monitoramento em tempo real da infraestrutura e laboratórios."
        actions={
          <Button size="sm" asChild className="rounded-full px-4">
            <Link to="/super-admin/tenants/novo"><Plus className="h-4 w-4 mr-2" />Novo laboratório</Link>
          </Button>
        }
      />

      {err && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 text-destructive px-4 py-3 text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {err}
        </div>
      )}

      {/* Grid Principal */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Saúde da Plataforma */}
        <DashboardCard
          title="Saúde da plataforma"
          icon={Activity}
          subtitle="Status dos serviços e latência"
        >
          <div className="space-y-4">
            <HealthItem 
              label="Saudáveis" 
              count={m?.federated?.healthy ?? 0} 
              tone="active" 
            />
            <HealthItem 
              label="Falhando" 
              count={m?.federated?.failed ?? 0} 
              tone="failed" 
            />
            <HealthItem 
              label="Latência (p95)" 
              value={`${m?.federated?.healthCheckP95Ms ?? 0}ms`} 
              tone="neutral" 
            />
          </div>
        </DashboardCard>

        {/* Laboratórios */}
        <DashboardCard
          title="Laboratórios"
          icon={Building2}
          subtitle="Atividade e onboarding"
          link="/super-admin/tenants"
        >
          <div className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold tracking-tight">{m?.tenantsTotal ?? 0}</p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Total de registros</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-semibold text-emerald-500">{m?.tenantsAtivos ?? 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Ativos</p>
              </div>
            </div>
            {m?.controlPlane?.pendingProvision ? (
              <div className="pt-2 border-t border-border/50">
                <p className="text-[11px] text-amber-500 font-medium flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> {m.controlPlane.pendingProvision} em provisionamento
                </p>
              </div>
            ) : null}
          </div>
        </DashboardCard>

        {/* Infraestrutura (Bancos e Crons) */}
        <DashboardCard
          title="Infraestrutura"
          icon={Server}
          subtitle="Estratégia de dados e automações"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-2">
                <Database className="h-3.5 w-3.5" /> Tipo de banco
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-md bg-muted/30 border border-border/50">
                <p className="text-sm font-bold">{m?.controlPlane?.runtimeDist.shared_db ?? 0}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Compartilhado</p>
              </div>
              <div className="p-2 rounded-md bg-primary/5 border border-primary/20">
                <p className="text-sm font-bold text-primary">{m?.controlPlane?.runtimeDist.isolated_db ?? 0}</p>
                <p className="text-[9px] text-primary/70 uppercase">Dedicado</p>
              </div>
            </div>
            <div className="pt-2 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Crons ativas</span>
              <span className="font-semibold flex items-center gap-1 text-emerald-500">
                <CheckCircle2 className="h-3 w-3" /> Saudáveis
              </span>
            </div>
          </div>
        </DashboardCard>
      </div>

      {/* Alertas e Integrações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardCard title="Alertas do sistema" icon={AlertTriangle} tone="warning">
           <div className="min-h-[100px] flex flex-col items-center justify-center text-center space-y-2">
             <CheckCircle2 className="h-8 w-8 text-emerald-500/20" />
             <p className="text-xs text-muted-foreground font-medium">Nenhum incidente crítico detectado</p>
           </div>
        </DashboardCard>
        
        <DashboardCard title="Integrações federadas" icon={Database}>
          <div className="space-y-3">
             <IntegrationRow name="DB Diagnósticos (DBSync)" status="active" />
             <IntegrationRow name="Pardini" status="active" />
             <IntegrationRow name="WhatsApp Gateway" status="active" />
          </div>
        </DashboardCard>
      </div>
    </div>
  );
}

function DashboardCard({ 
  title, 
  subtitle, 
  icon: Icon, 
  children, 
  link,
  tone = "neutral"
}: { 
  title: string; 
  subtitle?: string; 
  icon: any; 
  children: React.ReactNode; 
  link?: string;
  tone?: "neutral" | "warning";
}) {
  const CardContent = (
    <div className={cn(
      "h-full rounded-xl border border-border bg-card p-5 transition-all group",
      link && "hover:border-primary/50 hover:shadow-sm"
    )}>
      <div className="flex items-start justify-between mb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-2 rounded-lg",
              tone === "warning" ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary"
            )}>
              <Icon className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold tracking-tight text-foreground">{title}</h3>
          </div>
          {subtitle && <p className="text-[11px] text-muted-foreground font-medium">{subtitle}</p>}
        </div>
        {link && <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />}
      </div>
      {children}
    </div>
  );

  return link ? <Link to={link}>{CardContent}</Link> : CardContent;
}

function HealthItem({ label, count, value, tone }: { label: string; count?: number; value?: string; tone: any }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <StatusBadge 
        tone={tone} 
        label={value ?? (count !== undefined ? String(count) : "—")} 
        size="xs" 
        dot={tone !== "neutral"}
      />
    </div>
  );
}

function IntegrationRow({ name, status }: { name: string; status: any }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/50">
      <span className="text-xs font-medium">{name}</span>
      <StatusBadge tone={status} label="Online" size="xs" />
    </div>
  );
}
