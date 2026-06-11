import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { useIsCompact } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useMenuLayout } from "@/contexts/MenuLayoutContext";
import AppSidebar from "./AppSidebar";
import AppTopbar, { MenuLayoutToggle, ThemeToggle } from "./AppTopbar";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  // Sidebar agora abre no modo tile (estreita) por padrão — combina com o novo dashboard.
  const [collapsed, setCollapsed] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuKey, setUserMenuKey] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const isCompact = useIsCompact();
  const { logout } = useAuth();
  const { mode } = useMenuLayout();
  const showSidebar = isCompact || mode === "sidebar";
  // Closing the popover after a toggle gives the user clear feedback that the action took effect.
  const closeUserMenu = () => setUserMenuKey((k) => k + 1);
  const userMenuControls = (
    <>
      <ThemeToggle onSelect={closeUserMenu} />
      <MenuLayoutToggle onSelect={closeUserMenu} />
    </>
  );

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);
  useEffect(() => { if (isCompact) setCollapsed(true); }, [isCompact]);


  return (
    <div className="flex min-h-screen bg-background">
      {isCompact && drawerOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/15 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
      )}

      {!isCompact && showSidebar && (
        <AppSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          onNavigate={() => {}}
          onLogout={handleLogout}
          extraUserMenu={userMenuControls}
          closeUserMenuSignal={userMenuKey}
        />
      )}

      {isCompact && drawerOpen && (
        <div className="fixed inset-y-0 left-0 z-50">
          <AppSidebar
            collapsed={false}
            isMobile
            onToggle={() => setDrawerOpen(false)}
            onNavigate={() => setDrawerOpen(false)}
            onLogout={handleLogout}
            extraUserMenu={userMenuControls}
            closeUserMenuSignal={userMenuKey}
          />
        </div>
      )}


      <main className="flex-1 overflow-auto">
        {!isCompact && !showSidebar && <AppTopbar onLogout={handleLogout} />}
        {isCompact && (
          <div className="sticky top-0 z-30 h-14 flex items-center justify-between px-4 bg-card/95 backdrop-blur-md border-b border-border/60">
            <div className="flex items-center gap-3">
              <button onClick={() => setDrawerOpen(true)} className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-accent/60 transition-colors">
                <Menu className="h-5 w-5 text-foreground" />
              </button>
              <span className="text-sm font-bold text-foreground tracking-tight">SISLAC</span>
            </div>
          </div>
        )}
        {children}
        <footer className="border-t border-border/40 px-6 py-3 mt-4 flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] text-muted-foreground/80">
          <span>
            Suporte:{" "}
            <a
              href="mailto:suporte@sislac.com.br"
              className="text-primary/80 hover:text-primary transition-colors"
            >
              suporte@sislac.com.br
            </a>
          </span>
          <a
            href="/privacidade"
            className="hover:text-foreground transition-colors"
          >
            Política de Privacidade
          </a>
        </footer>
      </main>
    </div>
  );
};

export default AppLayout;
