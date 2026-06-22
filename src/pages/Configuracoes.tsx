import { PageHeader } from "@/components/shared/PageHeader";
import { useState, useEffect, useRef } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import {
  Building2,
  UserCog,
  FlaskConical,
  CreditCard,
  MonitorPlay,
  Crown,
  DollarSign,
  Building,
  MapPin,
  ChevronDown,
  FileText,
  Globe,
  Search,
  X,
  
  Plug,
} from "lucide-react";
import AdminTab from "@/components/configuracoes/AdminTab";
import ExamesTab from "@/components/configuracoes/ExamesTab";
import ConveniosTab from "@/components/configuracoes/ConveniosTab";
import TabelasPrecoTab from "@/components/configuracoes/TabelasPrecoTab";
import LabsApoioTab from "@/components/configuracoes/LabsApoioTab";
import UnidadesTab from "@/components/configuracoes/UnidadesTab";
import LaboratorioTab from "@/components/configuracoes/LaboratorioTab";
import MapasTrabalhoTab from "@/components/configuracoes/MapasTrabalhoTab";
import DocumentosTab from "@/components/configuracoes/DocumentosTab";
import SiteTab from "@/components/configuracoes/SiteTab";

import GatewayPagamentoTab from "@/components/configuracoes/GatewayPagamentoTab";
import IntegracoesApoioTab from "@/components/configuracoes/IntegracoesApoioTab";
import FornecedoresTab from "@/components/configuracoes/FornecedoresTab";
import FormasPagamentoTab from "@/components/configuracoes/FormasPagamentoTab";
import NotificacoesTab from "@/components/configuracoes/NotificacoesTab";
// OnboardingChecklist removido por solicitação do usuário

/**
 * IDs internos NUNCA mudam (preservam ?tab=, deep links e o switch do renderTab).
 * Apenas labels/desc são visuais.
 * `keywords` alimentam a busca (sinônimos comuns que o usuário digita).
 * `hidden: true` esconde a aba do menu mas mantém o componente acessível por deep link.
 */
const menuItems: Array<{
  id: string;
  label: string;
  icon: typeof Building2;
  desc: string;
  keywords?: string[];
  hidden?: boolean;
  group?: string;
}> = [
  // IDENTIDADE
  { group: "Identidade", id: "laboratorio", label: "Laboratório", icon: Building2, desc: "Dados gerais do lab", keywords: ["logo", "logotipo", "cnpj", "razão social", "endereço", "marca"] },
  { group: "Identidade", id: "documentos", label: "Documentos", icon: FileText, desc: "Comprovantes, declarações, cabeçalho e rodapé", keywords: ["documento", "comprovante", "declaração", "cabeçalho", "rodapé", "template", "laudo", "modelos de impressão"] },
  { group: "Identidade", id: "site", label: "Site público", icon: Globe, desc: "Landing page e domínio", keywords: ["site", "landing", "domínio", "dominio", "página", "vitrine"] },
  // CATÁLOGO & COMERCIAL
  { group: "Catálogo & Comercial", id: "exames", label: "Exames", icon: FlaskConical, desc: "Catálogo de exames", keywords: ["catálogo", "exame", "parâmetros", "valores de referência", "layout"] },
  { group: "Catálogo & Comercial", id: "tabelas", label: "Tabelas de Preço", icon: DollarSign, desc: "CBHPM, TUSS, Própria", keywords: ["preço", "valor", "cbhpm", "tuss", "tabela", "porte"] },
  { group: "Catálogo & Comercial", id: "convenios", label: "Convênios", icon: CreditCard, desc: "Planos aceitos", keywords: ["convênio", "plano", "particular", "operadora"] },
  { group: "Catálogo & Comercial", id: "formas-pagamento", label: "Formas de Pagamento", icon: CreditCard, desc: "PIX, dinheiro, cartões e mais", keywords: ["forma", "pagamento", "pix", "dinheiro", "cartão", "crédito", "débito", "boleto", "transferência"] },
  { group: "Catálogo & Comercial", id: "labs-apoio", label: "Apoio Laboratorial", icon: Building, desc: "Cadastro de laboratórios parceiros", keywords: ["apoio", "terceirizado", "laboratorial", "envio", "external lab"] },
  { group: "Catálogo & Comercial", id: "integracoes-apoio", label: "Integrações de Apoio", icon: Plug, desc: "Hermes Pardini, DB, Álvaro, DASA, HL7/FHIR", keywords: ["integração", "integracao", "soap", "xml", "hermes", "pardini", "hl7", "fhir", "apoio", "api"] },
  { group: "Catálogo & Comercial", id: "fornecedores", label: "Fornecedores", icon: Building2, desc: "Cadastro de fornecedores de insumos e materiais", keywords: ["fornecedor", "supplier", "estoque", "insumo", "cnpj", "compra"] },
  // OPERACIONAL
  { group: "Operacional", id: "unidades", label: "Unidades / Filiais", icon: MapPin, desc: "Sedes, filiais e postos", keywords: ["filial", "sede", "posto", "coleta", "endereço"] },
  { group: "Operacional", id: "mapas-trabalho", label: "Mapas de Trabalho", icon: FileText, desc: "Workflow operacional de bancada (não controla VR, metodologia ou cálculo)", keywords: ["mapa", "trabalho", "impressão", "operacional", "bancada", "workflow", "fila"] },
  // GOVERNANÇA
  { group: "Governança", id: "admin", label: "Meu acesso", icon: UserCog, desc: "Perfil, email e senha", keywords: ["admin", "perfil", "senha", "password", "email", "conta"] },
  // Fase 3E.1 — política de envio de notificações WhatsApp por laboratório.
  // Token/número/webhook/Meta continuam exclusivos do Super Admin
  // (`/super-admin/notificacoes`). Esta aba só define automático × manual.
  { group: "Governança", id: "notificacoes", label: "Notificações", icon: Bell, desc: "Automático ou manual por tipo de aviso WhatsApp", keywords: ["whatsapp", "notificação", "notificacao", "aviso", "mensagem", "automático", "manual", "resultado", "recoleta", "orçamento", "comprovante"] },
  { group: "Governança", id: "gateway-pagamento", label: "Gateway de pagamento", icon: CreditCard, desc: "Mercado Pago, Pix e cartões", keywords: ["gateway", "pagamento", "mercado pago", "mercadopago", "pix", "cartão", "boleto", "checkout"] },
  // Placeholders ocultos do menu — comportamento e código preservados.
  { group: "Conta", id: "painel", label: "Painel de chamada", icon: MonitorPlay, desc: "Tela de espera", hidden: true },
  { group: "Conta", id: "plano", label: "Plano", icon: Crown, desc: "Assinatura", hidden: true },
];

/** Ordem fixa dos grupos para render. */
const GROUP_ORDER = [
  "Identidade",
  "Catálogo & Comercial",
  "Operacional",
  "Governança",
  "Conta",
] as const;

/** Normaliza para busca: minúsculas + remove acentos. */
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const Configuracoes = () => {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") || "laboratorio";
  // Fase B — redirect de compatibilidade: tabs promovidas a rotas próprias.
  const TAB_REDIRECT: Record<string, string> = {
    exames: "/exames",
    convenios: "/convenios",
    unidades: "/unidades",
    documentos: "/documentos",
    tabelas: "/tabelas-preco",
  };
  const initialTab = tabParam;
  const [activeTab, setActiveTab] = useState(initialTab);
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && t !== activeTab) setActiveTab(t);
  }, [searchParams]);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const redirectTo = TAB_REDIRECT[tabParam];

  // Auto-scroll the active pill into the center on mobile/tablet
  useEffect(() => {
    const container = pillsRef.current;
    const pill = pillRefs.current[activeTab];
    if (!container || !pill) return;
    const containerRect = container.getBoundingClientRect();
    const pillRect = pill.getBoundingClientRect();
    const offset =
      pillRect.left - containerRect.left - containerRect.width / 2 + pillRect.width / 2;
    container.scrollTo({ left: container.scrollLeft + offset, behavior: "smooth" });
  }, [activeTab]);

  // Atalhos: Ctrl/Cmd+K e "/" focam a busca. Esc limpa/desfoca.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        if (search) {
          setSearch("");
        } else {
          searchInputRef.current?.blur();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [search]);

  // Itens visíveis (sem placeholders) e itens filtrados pela busca.
  const visibleItems = menuItems.filter((m) => !m.hidden);
  const q = normalize(search.trim());
  const filteredItems = q
    ? visibleItems.filter((m) => {
        const haystack = normalize(
          [m.label, m.desc, ...(m.keywords ?? [])].join(" "),
        );
        return haystack.includes(q);
      })
    : visibleItems;

  // Agrupa preservando a ordem definida em GROUP_ORDER.
  const groupedItems = GROUP_ORDER.map((g) => ({
    group: g,
    items: filteredItems.filter((m) => m.group === g),
  })).filter((g) => g.items.length > 0);

  // Navegação a partir do checklist: troca aba e rola ao topo.
  const goToTab = (tabId: string) => {
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const renderTab = () => {
    switch (activeTab) {
      case "laboratorio":
        return <LaboratorioTab />;
      case "admin":
        return <AdminTab />;
      case "exames":
        return <ExamesTab />;
      case "convenios":
        return <ConveniosTab />;
      case "tabelas":
        return <TabelasPrecoTab />;
      case "labs-apoio":
        return <LabsApoioTab />;
      case "unidades":
        return <UnidadesTab />;
      case "mapas-trabalho":
        return <MapasTrabalhoTab />;
      case "documentos":
        return <DocumentosTab />;
      case "site":
        return <SiteTab />;
      case "gateway-pagamento":
        return <GatewayPagamentoTab />;
      case "integracoes-apoio":
        return <IntegracoesApoioTab />;
      case "fornecedores":
        return <FornecedoresTab />;
      case "formas-pagamento":
        return <FormasPagamentoTab />;
      default: {
        const item = menuItems.find((m) => m.id === activeTab);
        const Icon = item?.icon || Building2;
        return (
          <div className="bg-card border border-border rounded-xl flex items-center justify-center py-24">
            <div className="text-center">
              <div className="p-4 rounded-2xl bg-muted/50 inline-block mb-4">
                <Icon className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <p className="text-lg font-bold text-foreground">{item?.label}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Esta seção estará disponível em breve
              </p>
            </div>
          </div>
        );
      }
    }
  };

  if (redirectTo) return <Navigate to={redirectTo} replace />;

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-6">
        <PageHeader
          eyebrow="Administração"
          title="Configurações"
          description="Gerencie as configurações do laboratório."
          actions={
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar configuração..."
                aria-label="Buscar configuração"
                className="w-full h-10 pl-9 pr-16 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border border-border bg-muted/40 text-[10px] font-medium text-muted-foreground">
                  Ctrl K
                </kbd>
              )}
            </div>
          }
        />

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <div className="lg:w-[240px] shrink-0">
            {/* Mobile + Tablet pills */}
            <div
              ref={pillsRef}
              className="lg:hidden flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar scroll-smooth"
            >
              {filteredItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    ref={(el) => {
                      pillRefs.current[item.id] = el;
                    }}
                    onClick={() => setActiveTab(item.id)}
                    className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-card border border-border text-muted-foreground hover:text-foreground"
                    }`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <item.icon className="h-4 w-4" /> {item.label}
                    {isActive && (
                      <ChevronDown
                        className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 h-3 w-3 text-primary"
                        strokeWidth={3}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
              {filteredItems.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Nenhum resultado para “{search}”.
                </div>
              )}
            </div>

            {/* Desktop nav */}
            <nav className="hidden lg:block bg-card border border-border rounded-xl overflow-hidden sticky top-6">
              {filteredItems.length === 0 && (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm font-medium text-foreground">Nada encontrado</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tente outro termo ou{" "}
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="text-primary hover:underline"
                    >
                      limpar a busca
                    </button>
                    .
                  </p>
                </div>
              )}
              {groupedItems.map((groupBlock, gIdx) => (
                <div
                  key={groupBlock.group}
                  className={gIdx > 0 ? "border-t border-border/60" : ""}
                >
                  <div className="px-4 pt-3 pb-1.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {groupBlock.group}
                    </p>
                  </div>
                  {groupBlock.items.map((item, idx) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all group ${
                        idx < groupBlock.items.length - 1 ? "border-b border-border/30" : ""
                      } ${activeTab === item.id ? "bg-primary/5" : "hover:bg-muted/30"}`}
                    >
                      <div
                        className={`p-2 rounded-lg transition-colors ${
                          activeTab === item.id
                            ? "bg-primary/10"
                            : "bg-muted group-hover:bg-primary/5"
                        }`}
                      >
                        <item.icon
                          className={`h-4 w-4 transition-colors ${
                            activeTab === item.id
                              ? "text-primary"
                              : "text-muted-foreground group-hover:text-primary/70"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium transition-colors ${
                            activeTab === item.id ? "text-primary" : "text-foreground"
                          }`}
                        >
                          {item.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{item.desc}</p>
                      </div>
                      {activeTab === item.id && (
                        <div className="w-1 h-6 rounded-full bg-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 overflow-x-hidden">{renderTab()}</div>
        </div>
      </div>
    </div>
  );
};

export default Configuracoes;
