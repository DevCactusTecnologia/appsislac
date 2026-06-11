import { ReactNode } from "react";
import { useScrollFade } from "@/hooks/use-scroll-fade";
import { cn } from "@/lib/utils";

/**
 * Wrapper para listas scrolláveis de exames que exibe um gradient fade
 * sutil no topo e na base sempre que há conteúdo oculto fora da viewport,
 * sinalizando ao usuário que existe mais para rolar.
 */
export default function ExameListWithFade({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { ref, showTop, showBottom } = useScrollFade<HTMLDivElement>();

  return (
    <div className={cn("relative min-h-0 flex flex-col", className)}>
      {/* Gradient topo */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-6 z-10 bg-gradient-to-b from-card to-transparent transition-opacity duration-200",
          showTop ? "opacity-100" : "opacity-0",
        )}
      />
      {/* Gradient base */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-6 z-10 bg-gradient-to-t from-card to-transparent transition-opacity duration-200",
          showBottom ? "opacity-100" : "opacity-0",
        )}
      />
      <div ref={ref} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
        {children}
      </div>
    </div>
  );
}
