/**
 * Soroteca — navegação compartilhada entre módulos.
 *
 * Direção "Cloud Clinical": tabs com underline (border-b-2 primary),
 * tipografia Space Grotesk, scroll horizontal em telas pequenas.
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
      className="flex items-center gap-1 border-b border-[#e8ecf1] overflow-x-auto whitespace-nowrap no-scrollbar -mx-1 px-1"
    >
      {ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              "inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium font-soroteca-display",
              "border-b-2 -mb-px transition-colors",
              isActive
                ? "border-[#3b82f6] text-[#3b82f6]"
                : "border-transparent text-[#94a3b8] hover:text-[#1e293b]",
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
