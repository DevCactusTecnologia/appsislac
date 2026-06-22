/**
 * SorotecaShell — wrapper visual unificado das 6 páginas da Soroteca 2.0.
 *
 * Direção "Cloud Clinical" (paleta Cloud White, Space Grotesk + DM Sans):
 *   • fundo #fafbfc, conteúdo em max-w-7xl
 *   • header com title (Space Grotesk, tracking-tight), description discreta
 *     e ações alinhadas à direita
 *   • nav de módulos como tabs com underline (border-b)
 *
 * Escopo: aplica `font-soroteca-body` no shell e libera `font-soroteca-display`
 * via .soroteca-scope para todos os títulos/h1-h3 internos.
 *
 * Substitui o par PageHeader + SorotecaNav nas páginas /soroteca/*.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SorotecaNav } from "./SorotecaNav";

interface SorotecaShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Largura máxima do conteúdo. Default `max-w-7xl`. */
  maxWidth?: "max-w-3xl" | "max-w-5xl" | "max-w-6xl" | "max-w-7xl";
  className?: string;
  children: ReactNode;
}

export function SorotecaShell({
  title,
  description,
  actions,
  maxWidth = "max-w-7xl",
  className,
  children,
}: SorotecaShellProps) {
  return (
    <div className="soroteca-scope min-h-[calc(100vh-4rem)] bg-[#fafbfc] font-soroteca-body text-[#1e293b]">
      <div className={cn("mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6", maxWidth, className)}>
        <SorotecaNav />

        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-soroteca-display text-2xl sm:text-3xl font-bold tracking-tight text-[#1e293b]">
              {title}
            </h1>
            {description && (
              <p className="mt-1 text-sm text-[#94a3b8] max-w-2xl leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>

        {children}
      </div>
    </div>
  );
}

export default SorotecaShell;
