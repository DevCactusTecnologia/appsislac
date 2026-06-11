// Onda 2 — Cabeçalho unificado das páginas do /super-admin.
// Inspiração: Linear / Vercel — título tight, sublabel discreta,
// ações alinhadas à direita, eyebrow opcional para contexto.
//
// Uso:
//   <PageHeader
//     eyebrow="Control plane"
//     title="Laboratórios"
//     description="Gerencie tenants, runtime e provisionamento."
//     actions={<Button>Novo laboratório</Button>}
//   />

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  /** Conteúdo extra colado abaixo (filtros, abas, etc.) */
  children?: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("mb-8", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[9px] font-bold text-primary/80 uppercase tracking-[0.2em] mb-2">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 text-sm text-muted-foreground/80 max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-3 shrink-0">{actions}</div>
        )}
      </div>
      {children && <div className="mt-8">{children}</div>}
    </header>
  );
}

/**
 * Skeleton genérico para placeholders de página (loading states).
 * Usa --muted via skeleton-shimmer definido em index.css.
 */
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-fade-in">
      <div className="skeleton-shimmer h-7 w-48 rounded-md" />
      <div className="skeleton-shimmer h-4 w-72 rounded" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton-shimmer h-14 rounded-lg" />
        ))}
      </div>
    </div>
  );
}