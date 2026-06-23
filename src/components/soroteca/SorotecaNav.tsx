/**
 * Soroteca — navegação compartilhada entre módulos.
 *
 * Responsivo:
 *  • Mobile (<sm): Select compacto com o módulo atual.
 *  • Tablet/Desktop (≥sm): tabs com underline, scroll horizontal se necessário.
 */

import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  FlaskConical,
  Layers,
  ScanLine,
  Boxes,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ITEMS: { to: string; label: string; icon: typeof FlaskConical; end?: boolean }[] = [
  { to: "/soroteca", label: "Amostras", icon: FlaskConical, end: true },
  { to: "/soroteca/estrutura", label: "Estrutura & Galerias", icon: Layers },
  { to: "/soroteca/triagem", label: "Triagem", icon: ScanLine },
  { to: "/soroteca/materiais", label: "Materiais", icon: Boxes },
  { to: "/soroteca/expurgo", label: "Expurgo", icon: Trash2 },
];

function matchActive(pathname: string, to: string, end?: boolean) {
  return end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
}

export function SorotecaNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = ITEMS.find((it) => matchActive(pathname, it.to, it.end)) ?? ITEMS[0];

  return (
    <>
      {/* Mobile: dropdown */}
      <div className="sm:hidden border-b border-border pb-3">
        <Select value={active.to} onValueChange={(v) => navigate(v)}>
          <SelectTrigger className="w-full h-11 rounded-lg">
            <SelectValue>
              <span className="inline-flex items-center gap-2">
                <active.icon className="h-4 w-4 text-primary" />
                <span className="font-medium">{active.label}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ITEMS.map(({ to, label, icon: Icon }) => (
              <SelectItem key={to} value={to}>
                <span className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tablet / Desktop: tabs */}
      <nav
        aria-label="Módulos da Soroteca"
        className="hidden sm:flex items-center gap-1 border-b border-border overflow-x-auto whitespace-nowrap no-scrollbar -mx-1 px-1"
      >
        {ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "inline-flex items-center gap-2 px-3 md:px-4 py-2.5 text-sm font-medium shrink-0",
                "border-b-2 -mb-px transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

export default SorotecaNav;
