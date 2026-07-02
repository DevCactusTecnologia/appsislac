// Onda 2 — Layout do /super-admin redesenhado do zero.
// Inspiração: Linear / Vercel / Stripe Dashboard.
// Princípios:
//  • sidebar enxuta (232px expandida · 56px colapsada)
//  • ativo = bg sutil + barra primária à esquerda (sem brilho/sombra)
//  • seções nomeadas, tipografia tabular, cantos rounded-md
//  • topbar do main contém apenas breadcrumb + ações contextuais
//  • user menu via popover compacto (sem painel expandido na sidebar)
//  • dark/light com contraste calibrado, sem mudanças em tokens core
//  • preferência menuMode (sidebar|topbar) preservada para compat

import { ReactNode, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Building2, LayoutDashboard, LogOut, Shield, Menu, ChevronsLeft, ChevronsRight,
  Settings, Inbox, PanelLeft, LayoutGrid, CreditCard, MessageSquare,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsCompact } from "@/hooks/use-mobile";
import { SuperAdminPrefsProvider, useSuperAdminPrefs } from "@/contexts/SuperAdminPrefsContext";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────────────────────────
// Nav
// ──────────────────────────────────────────────────────────────────

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  end?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    label: "Control plane",
    items: [
      { to: "/super-admin", icon: LayoutDashboard, label: "Visão geral", end: true },
      { to: "/super-admin/laboratorios", icon: Building2, label: "Laboratórios" },
      { to: "/super-admin/planos", icon: CreditCard, label: "Planos & Preços" },
      { to: "/super-admin/inscricoes", icon: Inbox, label: "Inscrições" },
    ],
  },
  {
    label: "Plataforma",
    items: [
      { to: "/super-admin/notificacoes", icon: MessageSquare, label: "Notificações" },
      { to: "/super-admin/configuracoes", icon: Settings, label: "Configurações" },
    ],
  },
];

// Flat list para topbar mode
const FLAT_ITEMS: NavItem[] = SECTIONS.flatMap((s) => s.items);

// ──────────────────────────────────────────────────────────────────
// Sidebar (Linear-style)
// ──────────────────────────────────────────────────────────────────

interface SidebarInnerProps {
  collapsed: boolean;
  isMobile?: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  onLogout: () => void;
  userEmail?: string;
}

function SidebarInner({ collapsed, isMobile, onToggle, onNavigate, onLogout, userEmail }: SidebarInnerProps) {
  const compact = collapsed && !isMobile;

  return (
    <aside
      className={cn(
        "relative flex flex-col h-screen bg-card text-foreground border-r border-border/50 sticky top-0 z-30 transition-[width] duration-200 ease-out",
        isMobile ? "w-[240px]" : (compact ? "w-[68px]" : "w-[240px]"),
      )}
    >
      {/* Brand */}
      <div className={cn("flex items-center h-12 border-b border-border", compact ? "justify-center px-0" : "gap-2.5 px-3")}>
        <NavLink to="/super-admin" onClick={onNavigate} className="flex items-center gap-3 min-w-0 flex-1">
          <div className={cn(
            "relative rounded-xl bg-foreground flex items-center justify-center shrink-0 shadow-lg shadow-foreground/10",
            compact ? "h-10 w-10" : "h-8 w-8",
          )}>
            <Shield className="h-4 w-4 text-background" strokeWidth={2.5} />
            <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          </div>
          {!compact && (
            <div className="min-w-0 leading-none">
              <div className="text-[14px] font-bold text-foreground tracking-tight">SISLAC</div>
              <p className="text-[9px] text-muted-foreground font-bold leading-none mt-1 tracking-[0.15em] uppercase opacity-70">Control Plane</p>
            </div>
          )}
        </NavLink>
      </div>

      {/* Toggle flutuante na borda direita — sempre visível, fora do footer */}
      {!isMobile && (
        <button
          onClick={onToggle}
          aria-label={compact ? "Expandir menu" : "Recolher menu"}
          title={compact ? "Expandir menu" : "Recolher menu"}
          className={cn(
            "absolute top-3.5 -right-3 z-40 h-6 w-6 rounded-full bg-card border border-border",
            "flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent",
            "shadow-sm transition-colors",
          )}
        >
          {compact
            ? <ChevronsRight className="w-3.5 h-3.5" strokeWidth={2} />
            : <ChevronsLeft className="w-3.5 h-3.5" strokeWidth={2} />}
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto no-scrollbar">
        {SECTIONS.map((section, idx) => (
          <div key={section.label} className={cn(idx > 0 && "mt-5")}>
            {!compact && (
              <p className="px-2 mb-1.5 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.1em]">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.end}
                  onClick={onNavigate}
                  title={compact ? it.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex items-center transition-all duration-200",
                      compact ? "h-10 w-10 mx-auto justify-center rounded-xl" : "gap-3 px-3 h-10 rounded-xl",
                      isActive
                        ? "bg-primary/10 text-primary font-bold shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/80",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && !compact && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary" />
                      )}
                      <it.icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                      {!compact && (
                        <span className="text-[13px] font-medium tracking-tight">{it.label}</span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: user + toggle */}
      {/* Footer: user (toggle agora flutua na borda) */}
      <div className="border-t border-border p-2">
        <UserPopover collapsed={compact} userEmail={userEmail} onLogout={onLogout} />
      </div>
    </aside>
  );
}

// ──────────────────────────────────────────────────────────────────
// User popover (compacto)
// ──────────────────────────────────────────────────────────────────

function UserPopover({
  collapsed,
  userEmail,
  onLogout,
  align = "top",
}: {
  collapsed: boolean;
  userEmail?: string;
  onLogout: () => void;
  align?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = (userEmail ?? "S").slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center w-full rounded-md transition-colors",
          collapsed ? "h-8 w-8 mx-auto justify-center hover:bg-accent/60" : "gap-2 px-1.5 h-9 hover:bg-accent/60",
        )}
      >
        <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
          {initials}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1 text-left">
            <p className="text-[12px] font-medium text-foreground truncate leading-tight">Super Admin</p>
            <p className="text-[10px] text-muted-foreground truncate leading-tight">{userEmail}</p>
          </div>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg py-1 min-w-[240px] animate-in fade-in-0 zoom-in-95 duration-100",
            collapsed ? "left-full bottom-0 ml-2" : (align === "bottom" ? "top-full right-0 mt-1.5" : "bottom-full left-0 mb-1.5 w-full"),
          )}
        >
          <div className="px-3 py-2 border-b border-border/60 mb-1">
            <p className="text-[12px] font-semibold text-foreground">Super Admin</p>
            <p className="text-[11px] text-muted-foreground truncate">{userEmail}</p>
          </div>
          <MenuModeChooser onSelect={() => setOpen(false)} />
          <div className="h-px bg-border/60 my-1" />
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Segmented controls (menu mode)
// ──────────────────────────────────────────────────────────────────


function MenuModeChooser({ onSelect }: { onSelect?: () => void }) {
  const { menuMode, setMenuMode } = useSuperAdminPrefs();
  return (
    <div className="px-2 py-1">
      <p className="px-1 pb-1 text-[9px] font-semibold text-muted-foreground/70 uppercase tracking-[0.1em]">Posição</p>
      <div className="flex gap-0.5 p-0.5 bg-muted/60 rounded-md">
        <SegBtn active={menuMode === "sidebar"} onClick={() => { setMenuMode("sidebar"); onSelect?.(); }}>
          <PanelLeft className="w-3 h-3" /> Lateral
        </SegBtn>
        <SegBtn active={menuMode === "topbar"} onClick={() => { setMenuMode("topbar"); onSelect?.(); }}>
          <LayoutGrid className="w-3 h-3" /> Superior
        </SegBtn>
      </div>
    </div>
  );
}

function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1 h-6 rounded text-[11px] font-medium transition-colors",
        active ? "bg-card text-foreground shadow-elevation-xs" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────
// Topbar horizontal (modo "topbar")
// ──────────────────────────────────────────────────────────────────

function TopbarInner({ onLogout, userEmail }: { onLogout: () => void; userEmail?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (to: string, end?: boolean) =>
    end ? location.pathname === to : location.pathname.startsWith(to);

  return (
    <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border">
      <div className="flex items-center gap-3 px-4 lg:px-6 h-12">
        <button onClick={() => navigate("/super-admin")} className="flex items-center gap-2 shrink-0">
          <div className="relative w-7 h-7 rounded-md bg-foreground flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-background" strokeWidth={2.5} />
            <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="text-[13px] font-semibold text-foreground tracking-tight">SISLAC</span>
            <span className="text-[9px] text-muted-foreground tracking-[0.1em] uppercase mt-0.5">Console</span>
          </div>
        </button>

        <div className="h-5 w-px bg-border mx-1 hidden sm:block" />

        <nav className="flex-1 flex items-center gap-0.5 overflow-x-auto no-scrollbar">
          {FLAT_ITEMS.map((it) => {
            const active = isActive(it.to, it.end);
            return (
              <button
                key={it.to}
                onClick={() => navigate(it.to)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 h-8 rounded-md text-[12px] font-medium transition-colors shrink-0",
                  active ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                )}
              >
                <it.icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>{it.label}</span>
              </button>
            );
          })}
        </nav>

        <UserPopover collapsed={false} userEmail={userEmail} onLogout={onLogout} align="bottom" />
      </div>
    </header>
  );
}

// ──────────────────────────────────────────────────────────────────
// Layout principal
// ──────────────────────────────────────────────────────────────────

function SuperAdminLayoutInner({ children }: { children?: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isCompact = useIsCompact();
  const { menuMode } = useSuperAdminPrefs();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem("sislac-superadmin-collapsed") === "1"; }
    catch { return false; }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const showSidebar = isCompact || menuMode === "sidebar";

  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);
  useEffect(() => { if (isCompact) setCollapsed(true); }, [isCompact]);
  useEffect(() => {
    if (isCompact) return;
    try { window.localStorage.setItem("sislac-superadmin-collapsed", collapsed ? "1" : "0"); }
    catch { /* ignore */ }
  }, [collapsed, isCompact]);

  const handleLogout = async () => {
    await logout();
    navigate("/super-admin/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background">
      {isCompact && drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[2px]"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {!isCompact && showSidebar && (
        <SidebarInner
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
          onLogout={handleLogout}
          userEmail={user?.email}
        />
      )}

      {isCompact && drawerOpen && (
        <div className="fixed inset-y-0 left-0 z-50 animate-in slide-in-from-left duration-150">
          <SidebarInner
            collapsed={false}
            isMobile
            onToggle={() => setDrawerOpen(false)}
            onNavigate={() => setDrawerOpen(false)}
            onLogout={handleLogout}
            userEmail={user?.email}
          />
        </div>
      )}

      <main className="flex-1 min-w-0 overflow-auto flex flex-col">
        {isCompact && (
          <div className="sticky top-0 z-30 h-12 flex items-center justify-between px-3 bg-card/95 backdrop-blur-md border-b border-border">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDrawerOpen(true)}
                className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-accent/60 transition-colors"
                aria-label="Abrir menu"
              >
                <Menu className="h-4 w-4 text-foreground" />
              </button>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-md bg-foreground flex items-center justify-center">
                  <Shield className="w-3 h-3 text-background" strokeWidth={2.5} />
                </div>
                <span className="text-[12px] font-semibold text-foreground tracking-tight">SISLAC · Console</span>
              </div>
            </div>
          </div>
        )}

        {!isCompact && !showSidebar && (
          <TopbarInner onLogout={handleLogout} userEmail={user?.email} />
        )}

        <div className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 xl:px-10 py-6 lg:py-8">
          <div className="max-w-[1440px] mx-auto">
            {children ?? <Outlet />}
          </div>
        </div>

        <footer className="border-t border-border px-4 sm:px-6 lg:px-8 py-3 mt-4 flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] text-muted-foreground/70">
          <span>
            Suporte:{" "}
            <a href="mailto:suporte@sislac.com.br" className="text-muted-foreground hover:text-foreground transition-colors">
              suporte@sislac.com.br
            </a>
          </span>
          <a href="/privacidade" className="hover:text-foreground transition-colors">
            Política de Privacidade
          </a>
        </footer>
      </main>
    </div>
  );
}

export default function SuperAdminLayout({ children }: { children?: ReactNode }) {
  return (
    <SuperAdminPrefsProvider>
      <SuperAdminLayoutInner>{children}</SuperAdminLayoutInner>
    </SuperAdminPrefsProvider>
  );
}
