import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ChevronDown, LogOut, UserCog, Settings, Building2, LayoutGrid, PanelLeft,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMenuLayout } from "@/contexts/MenuLayoutContext";
import { cn } from "@/lib/utils";
import { navItems, filterNavByPermissions, type NavItem } from "./AppSidebar";

interface AppTopbarProps {
  onLogout?: () => void;
}

const AppTopbar = ({ onLogout }: AppTopbarProps) => {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) setOpenMenu(null);
      if (userMenuRef.current && !userMenuRef.current.contains(target)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => { setOpenMenu(null); }, [location.pathname]);

  const isActive = (path: string) => location.pathname === path;
  const isGroupActive = (item: NavItem) => !!item.children?.some(c => isActive(c.path));

  const visibleNav = filterNavByPermissions(navItems, hasPermission);

  // No layout superior, exibir rótulos mais curtos para itens específicos
  const topbarLabel = (label: string) =>
    label === "Consultar Resultados" ? "Resultados" : label;

  const renderItem = (item: NavItem) => {
    if (item.children) {
      const groupActive = isGroupActive(item);
      const open = openMenu === item.label;
      return (
        <div key={item.label} className="relative">
          <button
            onClick={() => setOpenMenu(open ? null : item.label)}
            className={cn(
              "flex items-center gap-1.5 px-3 h-9 rounded-xl text-[13px] font-medium transition-colors",
              groupActive || open
                ? "text-primary bg-primary/8"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            )}
          >
            <item.icon className="w-4 h-4" />
            <span>{topbarLabel(item.label)}</span>
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <div className="absolute left-0 top-full mt-1.5 z-50 bg-card border border-border/60 rounded-2xl shadow-[0_16px_48px_-12px_hsl(var(--foreground)/0.12)] py-2 min-w-[200px]">
              <p className="px-4 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{item.label}</p>
              {item.children.map(child => (
                <button
                  key={child.path}
                  onClick={() => { navigate(child.path); setOpenMenu(null); }}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-4 py-2.5 text-[13px] font-medium transition-colors",
                    isActive(child.path)
                      ? "bg-primary/8 text-primary"
                      : "text-foreground hover:bg-accent/60"
                  )}
                >
                  <child.icon className="w-4 h-4 shrink-0" />
                  {child.label}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={item.label}
        onClick={() => navigate(item.path!)}
        className={cn(
          "flex items-center gap-1.5 px-3 h-9 rounded-xl text-[13px] font-medium transition-colors",
          isActive(item.path!)
            ? "bg-primary text-primary-foreground shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
        )}
      >
        <item.icon className="w-4 h-4" />
        <span>{topbarLabel(item.label)}</span>
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border/60">
      <div className="flex items-center gap-4 px-4 lg:px-6 h-14">
        {/* Logo */}
        <button onClick={() => navigate("/atendimentos")} className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]">
            <Building2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-base font-extrabold text-foreground tracking-tight hidden sm:inline">SISLAC</span>
        </button>

        {/* Nav */}
        <nav ref={containerRef} className="flex-1 flex items-center gap-0.5 flex-wrap">
          {visibleNav.map(renderItem)}
        </nav>

        {/* User */}
        <div className="relative shrink-0" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(v => !v)}
            className="flex items-center gap-2 h-9 px-2 rounded-xl bg-accent/50 border border-border/40 hover:bg-accent/80 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-[11px]">
              {user?.nome?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "U"}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-[12px] font-semibold text-foreground leading-tight truncate max-w-[120px]">{user?.nome || "Usuário"}</p>
              <p className="text-[10px] text-muted-foreground capitalize leading-tight">{user?.perfil || "Perfil"}</p>
            </div>
            <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", userMenuOpen && "rotate-180")} />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-50 bg-popover border border-border/60 rounded-2xl shadow-xl py-1.5 min-w-[200px]">
              <div className="px-3.5 py-2.5 border-b border-border/30 mb-1">
                <p className="text-[13px] font-semibold text-foreground">{user?.nome || "Usuário"}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{user?.perfil || "Perfil"}</p>
              </div>
              
              <MenuLayoutToggle onSelect={() => setUserMenuOpen(false)} />
              <div className="h-px bg-border/40 mx-3 my-1" />
              <button
                onClick={() => { setUserMenuOpen(false); navigate("/perfil"); }}
                className="flex items-center gap-3 w-full px-3.5 py-2.5 text-[13px] font-medium text-foreground hover:bg-accent/60 rounded-xl mx-1 transition-colors"
                style={{ width: "calc(100% - 8px)" }}
              >
                <UserCog className="w-4 h-4 text-muted-foreground" />
                Meu Perfil
              </button>
              {user?.perfil === "admin" && (
                <button
                  onClick={() => { setUserMenuOpen(false); navigate("/configuracoes"); }}
                  className="flex items-center gap-3 w-full px-3.5 py-2.5 text-[13px] font-medium text-foreground hover:bg-accent/60 rounded-xl mx-1 transition-colors"
                  style={{ width: "calc(100% - 8px)" }}
                >
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  Configurações
                </button>
              )}
              <div className="h-px bg-border/40 mx-3 my-1" />
              {onLogout && (
                <button
                  onClick={() => { setUserMenuOpen(false); onLogout(); }}
                  className="flex items-center gap-3 w-full px-3.5 py-2.5 text-[13px] font-medium text-destructive hover:bg-destructive/10 rounded-xl mx-1 transition-colors"
                  style={{ width: "calc(100% - 8px)" }}
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export function ThemeToggle({ onSelect }: { onSelect?: () => void }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className="px-2 pt-1 pb-1">
      <p className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tema</p>
      <div className="flex gap-1 p-1 bg-accent/40 rounded-xl">
        <button
          onClick={() => { setTheme("light"); onSelect?.(); }}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-[12px] font-semibold transition-colors",
            theme === "light" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Sun className="w-3.5 h-3.5" /> Claro
        </button>
        <button
          onClick={() => { setTheme("dark"); onSelect?.(); }}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-[12px] font-semibold transition-colors",
            theme === "dark" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Moon className="w-3.5 h-3.5" /> Escuro
        </button>
      </div>
    </div>
  );
}

export function MenuLayoutToggle({ onSelect }: { onSelect?: () => void }) {
  const { mode, setMode } = useMenuLayout();
  return (
    <div className="px-2 pb-1">
      <p className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Layout do menu</p>
      <div className="flex gap-1 p-1 bg-accent/40 rounded-xl">
        <button
          onClick={() => { setMode("sidebar"); onSelect?.(); }}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-[12px] font-semibold transition-colors",
            mode === "sidebar" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <PanelLeft className="w-3.5 h-3.5" /> Lateral
        </button>
        <button
          onClick={() => { setMode("topbar"); onSelect?.(); }}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-[12px] font-semibold transition-colors",
            mode === "topbar" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <LayoutGrid className="w-3.5 h-3.5" /> Superior
        </button>
      </div>
    </div>
  );
}

export default AppTopbar;
