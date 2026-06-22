/**
 * Soroteca — navegação compartilhada entre módulos (Fase 9).
 *
 * Renderiza uma barra horizontal de links que dá visibilidade a TODOS os
 * módulos da Soroteca em qualquer página interna. Sem dropdown, sem mistério.
 */

import { NavLink } from "react-router-dom";
import {
  FlaskConical,
  Layers,
  ScanLine,
  Boxes,
  HandHelping,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS: { to: string; label: string; icon: typeof FlaskConical; end?: boolean }[] = [
  { to: "/soroteca", label: "Amostras", icon: FlaskConical, end: true },
  { to: "/soroteca/estrutura", label: "Estrutura & Galerias", icon: Layers },
  { to: "/soroteca/triagem", label: "Triagem", icon: ScanLine },
  { to: "/soroteca/materiais", label: "Materiais", icon: Boxes },
  { to: "/soroteca/emprestimos", label: "Empréstimos", icon: HandHelping },
  { to: "/soroteca/expurgo", label: "Expurgo", icon: Trash2 },
];


export function SorotecaNav() {
  return (
    <nav
      aria-label="Módulos da Soroteca"
      className="flex flex-wrap gap-1.5 border-b border-border pb-3 mb-4"
    >
      {ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              "inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm border transition-colors",
              isActive
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border hover:bg-muted text-foreground",
            )
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default SorotecaNav;
