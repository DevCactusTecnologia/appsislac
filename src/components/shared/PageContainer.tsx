// Shared design system — wrapper de página padrão.
// Mesmo respiro/densidade usado nas páginas do /super-admin:
// max-w-7xl centrado, padding generoso, animação leve de entrada.

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageContainerProps {
  children: ReactNode;
  /** Largura máxima. Default: 7xl */
  size?: "5xl" | "6xl" | "7xl" | "full";
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<PageContainerProps["size"]>, string> = {
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  full: "max-w-none",
};

export function PageContainer({ children, size = "7xl", className }: PageContainerProps) {
  return (
    <div className={cn("w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-fade-in", SIZE_CLASS[size], className)}>
      {children}
    </div>
  );
}
