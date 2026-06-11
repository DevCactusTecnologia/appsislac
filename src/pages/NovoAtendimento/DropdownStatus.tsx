// Extraído de NovoAtendimento.tsx (Sprint 1 — slicing estrutural).
// Painel de status reutilizável para dropdowns de busca:
// loading (skeleton), erro, sem busca (vazio inicial) ou sem resultados.
import React from "react";

export function DropdownStatus({
  loading,
  error,
  query,
  emptyTitle,
  emptyHint,
  noResultsTitle,
  noResultsHint,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  query: string;
  emptyTitle: string;
  emptyHint: string;
  noResultsTitle: string;
  noResultsHint: React.ReactNode;
  onRetry?: () => void;
}): JSX.Element {
  const containerClass =
    "absolute top-full left-0 right-0 mt-2 bg-card border border-border/60 rounded-2xl shadow-[0_16px_48px_-12px_hsl(var(--foreground)/0.12)] z-50 px-4 py-4";

  if (loading) {
    return (
      <div className={containerClass} role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">Carregando opções…</span>
        <ul className="space-y-2">
          {[0, 1, 2].map(i => (
            <li key={i} className="flex items-center gap-2 px-1 py-1.5">
              <div className="h-3.5 w-3.5 rounded bg-muted animate-pulse" />
              <div
                className="h-3 rounded bg-muted animate-pulse"
                style={{ width: `${60 + i * 10}%` }}
              />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${containerClass} text-center`} role="alert" aria-live="assertive">
        <p className="text-sm font-semibold text-destructive">Erro ao carregar</p>
        <p className="text-[11px] text-muted-foreground mt-1">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
          >
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  const hasQuery = query.trim().length > 0;
  return (
    <div className={`${containerClass} text-center`} role="status" aria-live="polite">
      <p className="text-sm font-medium text-foreground">
        {hasQuery ? noResultsTitle : emptyTitle}
      </p>
      <p className="text-[11px] text-muted-foreground mt-1">
        {hasQuery ? noResultsHint : emptyHint}
      </p>
    </div>
  );
}
