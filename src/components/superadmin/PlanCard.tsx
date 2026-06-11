// Card de plano reutilizável (catálogo e seleção).
// Estilo Stripe Billing: preço grande, lista de features, badges discretas.

import { Check, Star, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface SubscriptionPlan {
  id: string;
  code: string;
  nome: string;
  descricao: string | null;
  preco_mensal_cents: number;
  preco_anual_cents: number | null;
  moeda: string;
  limite_atendimentos_mes: number | null;
  limite_usuarios: number | null;
  limite_unidades: number | null;
  features: string[];
  is_active: boolean;
  is_public: boolean;
  is_default: boolean;
  sort_order: number;
}

const fmtPrice = (cents: number, moeda = "BRL") => {
  if (cents === 0) return "Grátis";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: moeda, minimumFractionDigits: 0, maximumFractionDigits: 0 });
};
const fmtLimit = (n: number | null, suffix: string) =>
  n == null ? "Ilimitado" : `${n.toLocaleString("pt-BR")} ${suffix}`;

interface Props {
  plan: SubscriptionPlan;
  selected?: boolean;
  highlight?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onToggleActive?: () => void;
  onSetDefault?: () => void;
  onDelete?: () => void;
  compact?: boolean;
}

export function PlanCard({ plan, selected, highlight, onSelect, onEdit, onToggleActive, onSetDefault, onDelete, compact }: Props) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "relative rounded-lg border bg-card p-5 transition-colors",
        selected ? "border-primary ring-1 ring-primary" : "border-border",
        onSelect && "cursor-pointer hover:border-primary/50",
        !plan.is_active && "opacity-60",
        highlight && !selected && "border-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground truncate">{plan.nome}</h3>
            {plan.is_default && (
              <span className="inline-flex items-center gap-1 h-4 px-1.5 rounded bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-wider">
                <Star className="h-2.5 w-2.5" /> Padrão
              </span>
            )}
            {!plan.is_public && (
              <span className="inline-flex items-center gap-1 h-4 px-1.5 rounded bg-muted text-muted-foreground text-[9px] font-bold uppercase tracking-wider">
                <EyeOff className="h-2.5 w-2.5" /> Oculto
              </span>
            )}
            {!plan.is_active && (
              <span className="inline-flex h-4 px-1.5 rounded bg-muted text-muted-foreground text-[9px] font-bold uppercase tracking-wider">
                Inativo
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{plan.code}</p>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground tracking-tight">{fmtPrice(plan.preco_mensal_cents, plan.moeda)}</span>
          {plan.preco_mensal_cents > 0 && (
            <span className="text-xs text-muted-foreground">/ mês</span>
          )}
        </div>
        {plan.preco_anual_cents != null && plan.preco_anual_cents > 0 && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            ou {fmtPrice(plan.preco_anual_cents, plan.moeda)} / ano
          </p>
        )}
      </div>

      {plan.descricao && !compact && (
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{plan.descricao}</p>
      )}

      <div className="space-y-1.5 text-xs">
        <Feature label={fmtLimit(plan.limite_atendimentos_mes, "atendimentos/mês")} />
        <Feature label={fmtLimit(plan.limite_usuarios, "usuários")} />
        <Feature label={fmtLimit(plan.limite_unidades, "unidades")} />
        {plan.features.slice(0, compact ? 2 : 6).map((f, i) => (
          <Feature key={i} label={f} />
        ))}
      </div>

      {(onEdit || onToggleActive || onSetDefault || onDelete) && (
        <div className="mt-4 pt-3 border-t border-border flex items-center gap-1.5 flex-wrap">
          {onEdit && <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={(e) => { e.stopPropagation(); onEdit(); }}>Editar</Button>}
          {onSetDefault && !plan.is_default && (
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={(e) => { e.stopPropagation(); onSetDefault(); }}>Tornar padrão</Button>
          )}
          {onToggleActive && (
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={(e) => { e.stopPropagation(); onToggleActive(); }}>
              {plan.is_active ? "Desativar" : "Ativar"}
            </Button>
          )}
          {onDelete && !plan.is_default && (
            <Button size="sm" variant="ghost" className="h-7 text-[11px] text-destructive hover:text-destructive ml-auto" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              Excluir
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function Feature({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-1.5 text-foreground">
      <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-px" strokeWidth={2.5} />
      <span className="leading-snug">{label}</span>
    </div>
  );
}

export const fmtPlanPrice = fmtPrice;