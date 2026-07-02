import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, ClipboardList, Inbox, FileCheck2, Search,
  Network, FlaskConical, Droplet, Microscope, ClipboardCheck,
  BarChart3, Printer, TrendingUp, AlertOctagon, RefreshCcw, Receipt,
  Map, ShieldCheck, UserRound, Stethoscope, Wallet, Snowflake, Boxes,
  Users2, UserCog, Settings, ChevronDown, LogOut,
  Building2, ChevronsLeft, ChevronsRight,
  CreditCard, MapPin, FileText, DollarSign, BookOpen,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { preloadLazyStore, type LazyStoreKey } from "@/data/lazyStores";
import { preloadRoute } from "@/lib/routePreload";
import { useSolicitacoesNaoLidas } from "@/hooks/useSolicitacoesNaoLidas";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRotinaColetaAnaliseEnabled } from "@/hooks/useRotinaConfig";

// Tamanho e espessura padronizados — espelha SuperAdminLayout (Linear-style).
const ICON_STROKE = 1.75;
const ICON_SIZE = "w-4 h-4";
const ICON_SIZE_CHILD = "w-4 h-4";

// (perfil-based filter removido — visibilidade agora deriva de permissões reais)

// Mapeia rotas → store lazy correspondente para preload no hover (Fase F).
const PRELOAD_BY_PATH: Record<string, LazyStoreKey> = {
  "/orcamentos": "orcamentos",
  "/mapa": "mapasTrabalho",
  "/financeiro": "financeiro",
};

function preloadForPath(path?: string) {
  if (!path) return;
  // 1) Pré-aquece o chunk JS da rota (React.lazy) — abre página em ms.
  preloadRoute(path);
  // 2) Pré-aquece o store lazy correspondente, se houver.
  const key = PRELOAD_BY_PATH[path];
  if (key) preloadLazyStore(key);
}

/* ─── Nav Data ─── */
interface NavChild { label: string; icon: LucideIcon; path: string }
interface NavItem { label: string; icon: LucideIcon; path?: string; children?: NavChild[] }

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Atendimentos", icon: ClipboardList, path: "/atendimentos" },
  { label: "Pedidos do site", icon: Inbox, path: "/pedidos-site" },
  {
    label: "Resultados", icon: FileCheck2,
    children: [
      { label: "Consultar", icon: Search, path: "/resultados/consulta" },
      { label: "Apoio Laboratorial", icon: Network, path: "/lab-apoio" },
    ],
  },
  {
    label: "Rotina", icon: FlaskConical,
    children: [
      { label: "Coletas", icon: Droplet, path: "/registrar-coleta" },
      { label: "Análise", icon: Microscope, path: "/analisar-amostra" },
      { label: "Resultados", icon: ClipboardCheck, path: "/resultados" },
    ],
  },
  {
    label: "Relatórios", icon: BarChart3,
    children: [
      { label: "Impressão", icon: Printer, path: "/relatorios/impressao" },
      { label: "Produção", icon: TrendingUp, path: "/relatorios/producao" },
      { label: "Ocorrências", icon: AlertOctagon, path: "/relatorios/ocorrencias" },
      { label: "Recoletas", icon: RefreshCcw, path: "/relatorios/recoletas" },
      { label: "Orçamentos", icon: Receipt, path: "/orcamentos" },
      { label: "Mapa", icon: Map, path: "/mapa" },
      { label: "Auditoria", icon: ShieldCheck, path: "/auditoria" },
    ],
  },
  { label: "Pacientes", icon: UserRound, path: "/pacientes" },
  { label: "Especialistas", icon: Stethoscope, path: "/especialistas" },
  { label: "Financeiro", icon: Wallet, path: "/financeiro" },
  { label: "Soroteca", icon: Snowflake, path: "/soroteca" },
  { label: "Estoque", icon: Boxes, path: "/estoque" },
  { label: "Equipe", icon: Users2, path: "/equipe" },
  {
    label: "Cadastros", icon: BookOpen,
    children: [
      { label: "Exames", icon: FlaskConical, path: "/exames" },
      { label: "Convênios", icon: CreditCard, path: "/convenios" },
      { label: "Unidades", icon: MapPin, path: "/unidades" },
      { label: "Documentos", icon: FileText, path: "/documentos" },
      { label: "Tabelas de Preço", icon: DollarSign, path: "/tabelas-preco" },
    ],
  },
];

export { navItems };
export type { NavItem, NavChild };

/* ─────────────────────────────────────────────────────────────────────────
 * RBAC visibility — derivada de permissões REAIS do usuário (has_permission).
 * Cada rota mapeia para uma permissão fina; se o usuário não tem a permissão,
 * o item some. Grupos somem automaticamente quando nenhum filho sobra.
 * Admin (perfil/role) tem wildcard "*" e enxerga tudo.
 * Bloqueio efetivo continua no backend (RLS + has_permission no DB).
 * ──────────────────────────────────────────────────────────────────────── */
const PERMISSION_BY_PATH: Record<string, string> = {
  "/dashboard": "visualizar_dashboard",
  "/atendimentos": "visualizar_atendimentos",
  "/pedidos-site": "solicitacoes_site_acesso",
  "/resultados/consulta": "consultar_resultados",
  "/lab-apoio": "lab_apoio_acesso",
  "/registrar-coleta": "registrar_coleta",
  "/analisar-amostra": "analisar_amostra",
  "/resultados": "liberar_resultado",
  "/relatorios/impressao": "impressao_geral",
  "/relatorios/producao": "relatorios_producao",
  "/relatorios/ocorrencias": "relatorios_ocorrencias",
  "/relatorios/recoletas": "relatorios_recoletas",
  "/orcamentos": "visualizar_orcamentos",
  "/mapa": "mapa_trabalho_acesso",
  "/auditoria": "auditoria",
  "/pacientes": "visualizar_pacientes",
  "/especialistas": "visualizar_pacientes",
  "/financeiro": "visualizar_financeiro",
  "/soroteca": "registrar_coleta",
  "/estoque": "configuracoes_sistema",
  "/equipe": "gestao_usuarios",
  "/exames": "configuracoes_sistema",
  "/convenios": "configuracoes_sistema",
  "/unidades": "configuracoes_sistema",
  "/documentos": "configuracoes_sistema",
  "/tabelas-preco": "configuracoes_sistema",
};

export function filterNavByPermissions(
  items: NavItem[],
  hasPermission: (perm: string) => boolean,
): NavItem[] {
  const canSee = (path?: string) => {
    if (!path) return false;
    const perm = PERMISSION_BY_PATH[path];
    if (!perm) return true; // sem mapeamento → sempre visível
    return hasPermission(perm);
  };
  const out: NavItem[] = [];
  for (const item of items) {
    if (item.children) {
      const kids = item.children.filter(c => canSee(c.path));
      if (kids.length) out.push({ ...item, children: kids });
    } else if (canSee(item.path)) {
      out.push(item);
    }
  }
  return out;
}

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  onLogout?: () => void;
  isMobile?: boolean;
  extraUserMenu?: React.ReactNode;
  /** Aumenta a cada vez que o pai pede para fechar o popover do usuário. */
  closeUserMenuSignal?: number;
}

const AppSidebar = ({ collapsed, onToggle, onNavigate, onLogout, isMobile, extraUserMenu, closeUserMenuSignal }: AppSidebarProps) => {

  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Notifica via toast quando chega solicitação nova; badge derivado disso.
  const { count: solicNaoLidas } = useSolicitacoesNaoLidas({ notify: true });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [collapsedFlyout, setCollapsedFlyout] = useState<string | null>(null);
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const flyoutRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const flyoutTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInsideFlyout = Object.values(flyoutRefs.current).some(ref => ref?.contains(target));
      if (!isInsideFlyout) { setCollapsedFlyout(null); setFlyoutPos(null); }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) setUserMenuOpen(false);
    };
    const closeFlyout = () => { setCollapsedFlyout(null); setFlyoutPos(null); };
    document.addEventListener("mousedown", handler);
    window.addEventListener("resize", closeFlyout);
    window.addEventListener("scroll", closeFlyout, true);
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("resize", closeFlyout);
      window.removeEventListener("scroll", closeFlyout, true);
    };
  }, []);

  // Close flyout when sidebar expands or route changes
  useEffect(() => { setCollapsedFlyout(null); setFlyoutPos(null); }, [collapsed, location.pathname]);

  // Close user popover when parent requests (e.g. after toggling theme/layout).
  useEffect(() => {
    if (closeUserMenuSignal === undefined) return;
    setUserMenuOpen(false);
  }, [closeUserMenuSignal]);


  const isActive = (path: string) => location.pathname === path;
  const toggleGroup = (label: string) => setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  const isGroupActive = (children: NavChild[]) => children.some(c => isActive(c.path));

  const rotinaColetaAnalise = useRotinaColetaAnaliseEnabled();
  const visibleNav = filterNavByPermissions(navItems, hasPermission).map((item) => {
    // Quando o admin desativa Coleta + Análise, o grupo "Rotina" vira um
    // atalho direto para "Inserir Resultado" — sem submenu.
    if (!rotinaColetaAnalise && item.label === "Rotina" && item.children) {
      return { label: item.label, icon: item.icon, path: "/resultados" } as NavItem;
    }
    return item;
  });

  const renderItem = (item: NavItem) => {
    if (item.children) {
      const groupActive = isGroupActive(item.children);
      const isOpen = openGroups[item.label] ?? groupActive;
      const isFlyoutOpen = collapsed && collapsedFlyout === item.label;
      return (
        <div key={item.label} ref={el => { flyoutRefs.current[item.label] = el; }} className="relative group">
          <Tooltip delayDuration={collapsed ? 100 : 500}>
          <TooltipTrigger asChild>
          <button
            ref={el => { flyoutTriggerRefs.current[item.label] = el; }}
            onClick={(e) => {
              if (collapsed) {
                if (isFlyoutOpen) {
                  setCollapsedFlyout(null);
                  setFlyoutPos(null);
                } else {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const itemCount = item.children?.length ?? 0;
                  const estimatedFlyoutHeight = 30 + itemCount * 34;
                  const viewportHeight = window.innerHeight;
                  let top = rect.top;
                  if (top + estimatedFlyoutHeight > viewportHeight - 16) {
                    top = Math.max(16, viewportHeight - estimatedFlyoutHeight - 16);
                  }
                  setFlyoutPos({ top, left: rect.right + 8 });
                  setCollapsedFlyout(item.label);
                }
              } else {
                toggleGroup(item.label);
              }
            }}
            className={cn(
              "group relative flex items-center w-full transition-all duration-200",
              collapsed
                ? "h-10 w-10 mx-auto justify-center rounded-xl"
                : "gap-3 px-3 h-10 rounded-xl",
              groupActive || isFlyoutOpen
                ? "bg-primary/10 text-primary font-bold shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/80",
            )}
          >
            {(groupActive || isFlyoutOpen) && !collapsed && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary" />
            )}
            <item.icon strokeWidth={ICON_STROKE} className={cn("shrink-0", ICON_SIZE)} />
            {!collapsed && (
              <>
                <span className="text-[13px] font-medium tracking-tight flex-1 text-left">{item.label}</span>
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isOpen && "rotate-180")} />
              </>
            )}
          </button>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>}
          </Tooltip>

          {/* Collapsed flyout submenu — fixed positioning to escape overflow clipping */}
          {collapsed && isFlyoutOpen && flyoutPos && (
            <div
              className="fixed z-[70]"
              style={{ top: flyoutPos.top, left: flyoutPos.left }}
            >
              <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-lg py-1.5 min-w-[200px] max-h-[calc(100vh-80px)] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-100">
                <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.1em] sticky top-0 bg-popover z-10">{item.label}</p>
                {item.children.map(child => (
                  <button
                    key={child.path}
                    onClick={() => { navigate(child.path); setCollapsedFlyout(null); setFlyoutPos(null); onNavigate?.(); }}
                    onMouseEnter={() => preloadForPath(child.path)}
                    className={cn(
                      "flex items-center gap-2.5 w-full px-3 py-2 text-[12px] font-medium transition-colors",
                      isActive(child.path)
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-accent/60"
                    )}
                  >
                    <child.icon strokeWidth={ICON_STROKE} className={cn("shrink-0", ICON_SIZE_CHILD)} />
                    {child.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Expanded submenu */}
          {!collapsed && isOpen && (
            <div className="ml-3 mt-0.5 space-y-0.5 pl-3 border-l border-border/50">
              {item.children.map(child => {
                const active = isActive(child.path);
                return (
                  <button
                    key={child.path}
                    onClick={() => { navigate(child.path); onNavigate?.(); }}
                    onMouseEnter={() => preloadForPath(child.path)}
                    className={cn(
                      "group relative flex items-center gap-3 w-full px-3 h-9 rounded-xl text-[12.5px] font-medium transition-all duration-200",
                      active
                        ? "bg-primary/10 text-primary font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                    )}
                  >
                    {active && (
                      <span className="absolute -left-[14px] top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary" />
                    )}
                    <child.icon strokeWidth={ICON_STROKE} className={cn("shrink-0", ICON_SIZE_CHILD)} />
                    <span>{child.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    const active = isActive(item.path!);
    return (
      <Tooltip key={item.label} delayDuration={collapsed ? 100 : 500}>
        <TooltipTrigger asChild>
      <button
        key={item.label}
        onClick={() => { navigate(item.path!); onNavigate?.(); }}
        onMouseEnter={() => preloadForPath(item.path)}
        className={cn(
          "group relative flex items-center w-full transition-all duration-200",
          collapsed
            ? "h-10 w-10 mx-auto justify-center rounded-xl"
            : "gap-3 px-3 h-10 rounded-xl",
          active
            ? "bg-primary/10 text-primary font-bold shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/80",
        )}
      >
        {active && !collapsed && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary" />
        )}
        <span className="relative shrink-0">
          <item.icon strokeWidth={ICON_STROKE} className={cn(ICON_SIZE)} />
          {item.path === "/pedidos-site" && solicNaoLidas > 0 && collapsed && (
            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-1">
              {solicNaoLidas > 9 ? "9+" : solicNaoLidas}
            </span>
          )}
        </span>
        {!collapsed && (
          <span className="text-[13px] font-medium tracking-tight flex-1 text-left">{item.label}</span>
        )}
        {!collapsed && item.path === "/pedidos-site" && solicNaoLidas > 0 && (
          <span className="ml-auto min-w-[20px] h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1.5">
            {solicNaoLidas > 99 ? "99+" : solicNaoLidas}
          </span>
        )}
      </button>

        </TooltipTrigger>
        {collapsed && <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>}
      </Tooltip>
    );
  };


  return (
    <TooltipProvider delayDuration={300}>
    <aside
      className={cn(
        "relative flex flex-col h-screen bg-card text-foreground border-r border-border/50 sticky top-0 z-30 transition-[width] duration-200 ease-out",
        isMobile ? "w-[240px]" : (collapsed ? "w-[68px]" : "w-[240px]")
      )}
    >
      {/* Brand — espelha SuperAdmin (h-12, ícone preto invertido) */}
      <div className={cn("flex items-center h-12 border-b border-border", collapsed ? "px-2 justify-center" : "gap-2.5 px-3")}>
        <div className={cn("flex items-center gap-3 min-w-0", collapsed ? "h-10 w-10 mx-auto justify-center" : "flex-1")}>
          <div className={cn(
            "relative rounded-xl bg-foreground flex items-center justify-center shrink-0 shadow-lg shadow-foreground/10",
            collapsed ? "h-10 w-10" : "h-8 w-8",
          )}>
            <Building2 className="h-4 w-4 text-background" strokeWidth={2.5} />
            <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-none">
              <div className="text-[14px] font-bold text-foreground tracking-tight">SISLAC</div>
              <p className="text-[9px] text-muted-foreground font-bold leading-none mt-1 tracking-[0.15em] uppercase opacity-70">Lab Management</p>
            </div>
          )}
        </div>
      </div>

      {/* Toggle flutuante na borda direita — sempre visível */}
      {!isMobile && (
        <button
          onClick={onToggle}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          className={cn(
            "absolute top-3.5 -right-3 z-40 h-6 w-6 rounded-full bg-card border border-border",
            "flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent",
            "shadow-sm transition-colors",
          )}
        >
          {collapsed
            ? <ChevronsRight className="w-3.5 h-3.5" strokeWidth={2} />
            : <ChevronsLeft className="w-3.5 h-3.5" strokeWidth={2} />}
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto no-scrollbar">
        {visibleNav.map(item => renderItem(item))}
      </nav>

      {/* Bottom — User card (compacto, estilo SuperAdmin) */}
      <div className="border-t border-border p-2">
        <div className="relative" ref={(el) => { userMenuRef.current = el; }}>
          <button
            onClick={() => setUserMenuOpen(v => !v)}
            className={cn(
              "flex items-center w-full rounded-md transition-colors",
              collapsed ? "h-8 w-8 mx-auto justify-center hover:bg-accent/60" : "gap-2 px-1.5 h-9 hover:bg-accent/60",
            )}
          >
            <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
              {user?.nome?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "U"}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1 text-left">
                <p className="text-[12px] font-medium text-foreground truncate leading-tight">{user?.nome || "Usuário"}</p>
                <p className="text-[10px] text-muted-foreground truncate leading-tight capitalize">{user?.perfil || "Perfil"}</p>
              </div>
            )}
          </button>

          {userMenuOpen && (
            <div className={cn(
              "absolute z-50 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg py-1 min-w-[240px] animate-in fade-in-0 zoom-in-95 duration-100",
              collapsed ? "left-full bottom-0 ml-2" : "bottom-full left-0 mb-1.5 w-full"
            )}>
              <div className="px-3 py-2 border-b border-border/60 mb-1">
                <p className="text-[12px] font-semibold text-foreground">{user?.nome || "Usuário"}</p>
                <p className="text-[11px] text-muted-foreground truncate capitalize">{user?.perfil || "Perfil"}</p>
              </div>
              {extraUserMenu && (
                <>
                  {extraUserMenu}
                  <div className="h-px bg-border/60 my-1" />
                </>
              )}
              <button
                onClick={() => { setUserMenuOpen(false); navigate("/perfil"); onNavigate?.(); }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] font-medium text-foreground hover:bg-accent/60 transition-colors"
              >
                <UserCog className="w-3.5 h-3.5 text-muted-foreground" />
                Meu Perfil
              </button>
              {user?.perfil === "admin" && (
                <button
                  onClick={() => { setUserMenuOpen(false); navigate("/configuracoes"); onNavigate?.(); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] font-medium text-foreground hover:bg-accent/60 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                  Configurações
                </button>
              )}
              <div className="h-px bg-border/60 my-1" />
              {onLogout && (
                <button
                  onClick={() => { setUserMenuOpen(false); onLogout(); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sair
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
    </TooltipProvider>
  );
};

export default AppSidebar;

