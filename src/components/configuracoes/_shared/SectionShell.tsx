import { ReactNode } from "react";

/**
 * Shell compartilhado por todas as abas de /configuracoes.
 *
 * Padroniza a estética da aba "Laboratório":
 *  - Hero header com gradiente sutil + ícone em pill grande + eyebrow
 *    uppercase tracking-widest + título destacado + descrição leve.
 *  - Toolbar / banner / corpo / footer mantêm a mesma API antiga.
 *
 * API 100% retrocompatível: todas as props existentes continuam funcionando,
 * de modo que cada aba de /configuracoes herda o novo visual automaticamente.
 */

interface SectionShellProps {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  /** Eyebrow opcional (linha pequena uppercase acima do título). Default: "Configurações". */
  eyebrow?: string;
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
  eyebrow = "Configurações",
  meta,
  actions,
  toolbar,
  banner,
  children,
  footer,
  bodyless,
}: SectionShellProps) => {
  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden animate-in fade-in duration-300">
      {/* ─── Hero header ─────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-card to-transparent border-b border-border/60">
        <div className="px-5 sm:px-7 py-5 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4 min-w-0">
              <div className="p-3 rounded-xl bg-primary/10 ring-1 ring-primary/20 text-primary shrink-0">
                {icon}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">
                  {eyebrow}
                </p>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight leading-tight">
                    {title}
                  </h2>
                  {meta}
                </div>
                {description && (
                  <p className="text-xs text-muted-foreground mt-1.5 max-w-2xl line-clamp-2">
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
      </div>

      {/* Toolbar */}
      {toolbar && (
        <div className="px-5 sm:px-7 py-3 border-b border-border/60 bg-muted/10">
          {toolbar}
        </div>
      )}

      {/* Banner informativo */}
      {banner && (
        <div className="px-5 sm:px-7 py-2.5 border-b border-border/60 bg-muted/20">
          {banner}
        </div>
      )}

      {/* Body */}
      <div className={bodyless ? "" : "p-5 sm:p-7"}>{children}</div>

      {/* Footer */}
      {footer && (
        <div className="px-5 sm:px-7 py-4 border-t border-border/60 bg-card/95 backdrop-blur">
          {footer}
        </div>
      )}
    </div>
  );
};

export default SectionShell;
