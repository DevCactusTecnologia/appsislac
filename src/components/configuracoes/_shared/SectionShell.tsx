import { ReactNode } from "react";

/**
 * Shell compartilhado por todas as abas de /configuracoes.
 *
 * Padroniza:
 *  - Header (ícone + título + descrição + ações primárias).
 *  - Toolbar opcional (busca, filtros, contadores).
 *  - Corpo (densidade controlada pelo padding).
 *  - Footer opcional (ações destrutivas/secundárias).
 *
 * Mantém a estética flat do design system: rounded-xl, border simples,
 * sem gradientes/sombras pesadas. Responsivo por padrão.
 */

interface SectionShellProps {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  /** Conteúdo extra ao lado do título (ex.: contador `12 itens`). */
  meta?: ReactNode;
  /** Ações primárias renderizadas no canto direito do header (botões). */
  actions?: ReactNode;
  /** Toolbar opcional logo abaixo do header (busca, filtros, abas internas). */
  toolbar?: ReactNode;
  /** Faixa informativa fina abaixo do toolbar (ex.: descrição da tabela ativa). */
  banner?: ReactNode;
  /** Conteúdo principal (lista/tabela/cards). */
  children: ReactNode;
  /** Footer opcional (informativos, ações). */
  footer?: ReactNode;
  /** Remove o padding do corpo (útil para tabelas full-bleed). */
  bodyless?: boolean;
}

const SectionShell = ({
  icon,
  title,
  description,
  meta,
  actions,
  toolbar,
  banner,
  children,
  footer,
  bodyless,
}: SectionShellProps) => {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">{icon}</div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-foreground leading-tight">
                  {title}
                </h2>
                {meta}
              </div>
              {description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {description}
                </p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {actions}
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      {toolbar && (
        <div className="px-5 sm:px-6 py-3 border-b border-border bg-muted/10">
          {toolbar}
        </div>
      )}

      {/* Banner informativo */}
      {banner && (
        <div className="px-5 sm:px-6 py-2.5 border-b border-border bg-muted/20">
          {banner}
        </div>
      )}

      {/* Body */}
      <div className={bodyless ? "" : "p-5 sm:p-6"}>{children}</div>

      {/* Footer */}
      {footer && (
        <div className="px-5 sm:px-6 py-4 border-t border-border bg-muted/10">
          {footer}
        </div>
      )}
    </div>
  );
};

export default SectionShell;
