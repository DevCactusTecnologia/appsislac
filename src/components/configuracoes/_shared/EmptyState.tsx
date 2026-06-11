import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/** Estado vazio padrão: ícone leve + título + descrição + ação opcional. */
const EmptyState = ({ icon: Icon, title, description, action }: EmptyStateProps) => (
  <div className="py-14 text-center">
    <div className="inline-flex p-3 rounded-2xl bg-muted/40 mb-3">
      <Icon className="h-6 w-6 text-muted-foreground/60" />
    </div>
    <p className="text-sm font-semibold text-foreground">{title}</p>
    {description && (
      <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
        {description}
      </p>
    )}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);

export default EmptyState;
