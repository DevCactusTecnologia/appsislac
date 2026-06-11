// Onda A — Timeline READ-ONLY do ciclo de vida do tenant no control-plane.
// Mostra os estados de provisioning_status e runtime_status conforme registrados
// em `tenant_registry`. Não dispara ações — só visualização.

import { Check, Circle, Loader2, AlertTriangle, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ProvisioningStatus =
  | "pending"
  | "provisioning"
  | "validating"
  | "active"
  | "suspended"
  | "failed";

const STEPS: { key: ProvisioningStatus; label: string; description: string }[] = [
  { key: "pending", label: "Pendente", description: "Tenant criado, aguardando provisionamento" },
  { key: "provisioning", label: "Provisionando", description: "Schema e recursos sendo criados" },
  { key: "validating", label: "Validando", description: "Health-check e seed inicial" },
  { key: "active", label: "Ativo", description: "Em produção, recebendo tráfego" },
];

export function TenantLifecycleTimeline({
  provisioningStatus,
  runtimeStatus,
  schemaVersion,
  lastHealthAt,
}: {
  provisioningStatus: string | null | undefined;
  runtimeStatus: string | null | undefined;
  schemaVersion?: string | null;
  lastHealthAt?: string | null;
}) {
  const provStatus = (provisioningStatus ?? "active") as ProvisioningStatus;
  const isFailed = provStatus === "failed";
  const isSuspended = runtimeStatus === "suspended" || provStatus === "suspended";

  const currentIndex = STEPS.findIndex((s) => s.key === provStatus);
  const activeIndex = currentIndex === -1 ? STEPS.length - 1 : currentIndex;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Ciclo de vida (control-plane)
        </div>
        <div className="flex items-center gap-1.5">
          {schemaVersion && (
            <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
              schema {schemaVersion}
            </span>
          )}
        </div>
      </div>

      <ol className="relative space-y-3">
        {STEPS.map((step, idx) => {
          const done = idx < activeIndex;
          const current = idx === activeIndex && !isFailed && !isSuspended;
          const pending = idx > activeIndex;

          return (
            <li key={step.key} className="flex items-start gap-3">
              <div
                className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center shrink-0 border",
                  done && "bg-status-success-bg border-status-success/40 text-status-success",
                  current && "bg-primary/10 border-primary/40 text-primary",
                  pending && "bg-muted/30 border-border text-muted-foreground",
                )}
              >
                {done ? (
                  <Check className="h-3 w-3" />
                ) : current ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Circle className="h-2 w-2" />
                )}
              </div>
              <div className="min-w-0 flex-1 -mt-0.5">
                <div
                  className={cn(
                    "text-xs font-semibold",
                    pending ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {step.label}
                </div>
                <div className="text-[11px] text-muted-foreground leading-tight">
                  {step.description}
                </div>
              </div>
            </li>
          );
        })}

        {isFailed && (
          <li className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border bg-status-danger-bg border-status-danger/40 text-status-danger">
              <AlertTriangle className="h-3 w-3" />
            </div>
            <div className="min-w-0 flex-1 -mt-0.5">
              <div className="text-xs font-semibold text-status-danger">Falhou</div>
              <div className="text-[11px] text-muted-foreground">
                Provisionamento interrompido — investigar logs
              </div>
            </div>
          </li>
        )}

        {isSuspended && !isFailed && (
          <li className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border bg-status-warning-bg border-status-warning/40 text-status-warning">
              <PauseCircle className="h-3 w-3" />
            </div>
            <div className="min-w-0 flex-1 -mt-0.5">
              <div className="text-xs font-semibold text-status-warning">Suspenso</div>
              <div className="text-[11px] text-muted-foreground">
                Runtime bloqueado — reative para retomar
              </div>
            </div>
          </li>
        )}
      </ol>

      {lastHealthAt && (
        <div className="pt-2 border-t border-border/60 text-[10px] text-muted-foreground">
          Último health-check:{" "}
          <span className="font-mono text-foreground/80">
            {new Date(lastHealthAt).toLocaleString("pt-BR")}
          </span>
        </div>
      )}
    </div>
  );
}