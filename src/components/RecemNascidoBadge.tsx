import { Baby } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Variante visual: completa exibe "Recém-nascido", compacta exibe "RN". */
  variant?: "full" | "compact";
  className?: string;
}

/**
 * Selo padrão para pacientes recém-nascidos (≤ 365 dias).
 * Usa os tokens `age-newborn-*` definidos em `index.css`.
 */
export default function RecemNascidoBadge({ variant = "full", className }: Props) {
  const label = variant === "compact" ? "RN" : "Recém-nascido";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap",
        "border-[hsl(var(--age-newborn-border))] bg-[hsl(var(--age-newborn-surface))] text-[hsl(var(--age-newborn-foreground))]",
        className,
      )}
      title="Paciente recém-nascido (até 1 ano)"
      aria-label="Paciente recém-nascido"
    >
      <Baby className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}