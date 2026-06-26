import { lazy, Suspense, useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, installQueryClientTenantReset } from "@/lib/queryClient";
import { BrowserRouter, Route, Routes, Navigate, useLocation, useParams } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { MenuLayoutProvider } from "@/contexts/MenuLayoutContext";

import ChunkErrorBoundary from "@/components/ChunkErrorBoundary";


// Lazy-loaded pages
const LoginV2 = lazy(() => import("./pages/LoginV2"));
const SuperAdminLogin = lazy(() => import("./pages/SuperAdminLogin"));
const Index = lazy(() => import("./pages/Index"));
const NovoAtendimento = lazy(() => import("./pages/NovoAtendimento"));
const RegistrarColeta = lazy(() => import("./pages/RegistrarColeta"));
const AnalisarAmostra = lazy(() => import("./pages/AnalisarAmostra"));
const Resultados = lazy(() => import("./pages/Resultados"));
const ResultadoDetalhe = lazy(() => import("./pages/ResultadoDetalhe"));
const LaudoPrintPage = lazy(() => import("./pages/LaudoPrintPage"));
const ConsultarResultados = lazy(() => import("./pages/ConsultarResultados"));
const LabApoio = lazy(() => import("./pages/LabApoio"));
const Pacientes = lazy(() => import("./pages/Pacientes"));
const Especialistas = lazy(() => import("./pages/Especialistas"));
const Auditoria = lazy(() => import("./pages/Auditoria"));
const Orcamentos = lazy(() => import("./pages/Orcamentos"));
const RelatorioOcorrencias = lazy(() => import("./pages/RelatorioOcorrencias"));
const RelatorioRecoletas = lazy(() => import("./pages/RelatorioRecoletas"));
const ImpressaoGeral = lazy(() => import("./pages/ImpressaoGeral"));
const Producao = lazy(() => import("./pages/Producao"));
const Mapa = lazy(() => import("./pages/Mapa"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Soroteca = lazy(() => import("./pages/Soroteca"));
const SorotecaEstrutura = lazy(() => import("./pages/SorotecaEstrutura"));
const SorotecaTriagem = lazy(() => import("./pages/SorotecaTriagem"));
const SorotecaMateriais = lazy(() => import("./pages/SorotecaMateriais"));

const SorotecaExpurgo = lazy(() => import("./pages/SorotecaExpurgo"));
const Estoque = lazy(() => import("./pages/Estoque"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
// Fase B — Domain Driven Routes (entidades promovidas)
const ExamesPage = lazy(() => import("./pages/Exames"));
const ConveniosPage = lazy(() => import("./pages/Convenios"));
const UnidadesPage = lazy(() => import("./pages/Unidades"));
const DocumentosPage = lazy(() => import("./pages/Documentos"));
const TabelasPrecoPage = lazy(() => import("./pages/TabelasPreco"));
const SolicitacoesSite = lazy(() => import("./pages/SolicitacoesSite"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const Perfil = lazy(() => import("./pages/Perfil"));

const CKEditorTest = lazy(() => import("./pages/admin/CKEditorTest"));
const AuditoriaVR = lazy(() => import("./pages/admin/AuditoriaVR"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Landing = lazy(() => import("./pages/Landing"));
const Inscricao = lazy(() => import("./pages/Inscricao"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const VerificarComprovante = lazy(() => import("./pages/VerificarComprovante"));
const RedirectShortlink = lazy(() => import("./pages/RedirectShortlink"));
const Privacidade = lazy(() => import("./pages/Privacidade"));
const TenantSite = lazy(() => import("./pages/TenantSite"));
const TenantSiteSobre = lazy(() => import("./pages/TenantSiteSobre"));
const TenantSiteContato = lazy(() => import("./pages/TenantSiteContato"));
const AppLayout = lazy(() => import("./components/AppLayout"));
const SuperAdminLayout = lazy(() => import("./components/SuperAdminLayout"));
const RequireSuperAdmin = lazy(() => import("./components/RequireSuperAdmin"));
const SuperAdminDashboard = lazy(() => import("./pages/superadmin/SuperAdminDashboard"));
const SuperAdminTenants = lazy(() => import("./pages/superadmin/SuperAdminTenants"));
const SuperAdminTenantDetalhe = lazy(() => import("./pages/superadmin/SuperAdminTenantDetalhe"));
const SuperAdminNovoLab = lazy(() => import("./pages/superadmin/SuperAdminNovoLab"));
const SuperAdminInscricoes = lazy(() => import("./pages/superadmin/SuperAdminInscricoes"));
const SuperAdminAuditoria = lazy(() => import("./pages/superadmin/SuperAdminAuditoria"));
const SuperAdminConfiguracoes = lazy(() => import("./pages/superadmin/SuperAdminConfiguracoes"));
const SuperAdminPlanos = lazy(() => import("./pages/superadmin/SuperAdminPlanos"));
const SuperAdminNotificacoes = lazy(() => import("./pages/superadmin/SuperAdminNotificacoes"));

// QueryClient é um singleton importado de @/lib/queryClient — ali ficam
// os defaults de cache (staleTime/gcTime, sem refetch em foco, keepPreviousData)
// e a função `resetQueryClient` usada na troca de tenant/logout.

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

// Redirects legados — Fase A (Domain Driven Routes). Preservam o parâmetro.
function LegacyEditarAtendimentoRedirect() {
  const { protocolo } = useParams();
  return <Navigate to={`/atendimentos/${encodeURIComponent(protocolo ?? "")}/editar`} replace />;
}
function LegacyConsultarResultadoRedirect() {
  const { id } = useParams();
  return <Navigate to={`/resultados/${encodeURIComponent(id ?? "")}/consulta`} replace />;
}

function ProtectedRoute({ children, permissao, bloqueadoPontoColeta }: { children: React.ReactNode; permissao?: string; bloqueadoPontoColeta?: boolean }) {
  const { isAuthenticated, hasPermission, user } = useAuth();
  const [isPontoColeta, setIsPontoColeta] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated || !bloqueadoPontoColeta || !user?.unidadeAtiva) {
      setIsPontoColeta(false);
      return;
    }
    void import("@/data/unidadeStore").then(({ getUnidadeById }) => {
      if (cancelled) return;
      const unidade = getUnidadeById(user.unidadeAtiva);
      setIsPontoColeta(unidade?.tipo === "PONTO_DE_COLETA");
    });
    return () => { cancelled = true; };
  }, [isAuthenticated, bloqueadoPontoColeta, user?.unidadeAtiva]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (permissao && !hasPermission(permissao)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-center">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-2">Acesso Negado</h2>
          <p className="text-sm text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }
  if (bloqueadoPontoColeta && isPontoColeta) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-center">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-2">Funcionalidade Indisponível</h2>
          <p className="text-sm text-muted-foreground">Pontos de coleta não possuem acesso a análise e resultados.<br />As amostras são enviadas para a sede/filial de referência.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  // Hidratação dos stores SÓ após autenticação. Páginas públicas
  // (landing, /login, /site/*, /verificar/*, /p/*, /inscricao, /privacidade,
  // /reset-password) não disparam fetch nem abrem canal Realtime,
  // reduzindo drasticamente trabalho no boot e eliminando o
  // "Página sem resposta" causado pelo bootstrap pesado.
  useEffect(() => {
    if (!isAuthenticated) return;
    void import("@/data/storeBoot").then(({ bootDataStores }) => bootDataStores());
  }, [isAuthenticated]);

  // Prefetch inteligente pós-login: apenas Dashboard + próxima rota mais
  // provável (Atendimentos). Reduzido de 7 → 2 rotas para evitar acumular
  // ~80MB de módulos ES no heap (módulos nunca são coletados). Demais rotas
  // carregam sob demanda via Suspense — overhead imperceptível (<200ms).
  useEffect(() => {
    if (!isAuthenticated) return;
    const win = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (h: number) => void;
    };
    const idle = win.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 2500));
    const cancel = win.cancelIdleCallback ?? ((h: number) => window.clearTimeout(h));

    const loaders: Array<() => Promise<unknown>> = [
      () => import("./pages/Dashboard"),
      () => import("./pages/Index"),
    ];
    const handles: number[] = [];
    const schedule = (i: number) => {
      if (i >= loaders.length) return;
      const h = idle(() => {
        void loaders[i]().finally(() => schedule(i + 1));
      }, { timeout: 8000 });
      handles.push(h as number);
    };
    schedule(0);
    return () => { handles.forEach((h) => cancel(h)); };
  }, [isAuthenticated]);

  if (loading) {
    return <PageLoader />;
  }

  // /reset-password é público
  if (location.pathname === "/reset-password") {
    return (
      <ChunkErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <ResetPassword />
        </Suspense>
      </ChunkErrorBoundary>
    );
  }

  // /privacidade é pública (LGPD)
  if (location.pathname === "/privacidade") {
    return (
      <ChunkErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Privacidade />
        </Suspense>
      </ChunkErrorBoundary>
    );
  }

  // /verificar/:codigo é público — usado pelo QR impresso nos comprovantes
  if (location.pathname.startsWith("/verificar/")) {
    return (
      <ChunkErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/verificar/:codigo" element={<VerificarComprovante />} />
          </Routes>
        </Suspense>
      </ChunkErrorBoundary>
    );
  }

  // /p/:codigo é público — shortlink que redireciona para o PDF assinado.
  if (location.pathname.startsWith("/p/")) {
    return (
      <ChunkErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/p/:codigo" element={<RedirectShortlink />} />
          </Routes>
        </Suspense>
      </ChunkErrorBoundary>
    );
  }

  // Landing pública por slug do tenant: /site/:slug
  if (location.pathname.startsWith("/site/")) {
    const parts = location.pathname.split("/").filter(Boolean); // ["site", ":slug", ...]
    const slug = parts[1];
    const sub = parts[2];
    const isApp = sub === "app";
    if (slug && !isApp) {
      return (
        <ChunkErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/site/:slug" element={<TenantSite />} />
              <Route path="/site/:slug/sobre" element={<TenantSiteSobre />} />
              <Route path="/site/:slug/contato" element={<TenantSiteContato />} />
            </Routes>
          </Suspense>
        </ChunkErrorBoundary>
      );
    }
    if (slug && isApp) {
      // /site/:slug/app → entra no fluxo logado normal
      return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
    }
  }

  if (location.pathname === "/") {
    if (isAuthenticated) {
      return <Navigate to={user?.isSuperAdmin ? "/super-admin" : "/dashboard"} replace />;
    }
    return (
      <ChunkErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Landing />
        </Suspense>
      </ChunkErrorBoundary>
    );
  }

  if (location.pathname === "/inscricao") {
    return (
      <ChunkErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Inscricao />
        </Suspense>
      </ChunkErrorBoundary>
    );
  }

  // /auth é alias legado da área operacional do tenant
  if (location.pathname === "/auth") {
    return <Navigate to="/login" replace />;
  }

  // Login do Super Admin do SaaS (área restrita, separada)
  if (location.pathname === "/super-admin/login") {
    if (isAuthenticated && user?.isSuperAdmin) {
      return <Navigate to="/super-admin" replace />;
    }
    return (
      <ChunkErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <SuperAdminLogin />
        </Suspense>
      </ChunkErrorBoundary>
    );
  }

  // Login dos usuários do laboratório (tenants)
  if (location.pathname === "/login") {
    if (isAuthenticated) {
      return <Navigate to={user?.isSuperAdmin ? "/super-admin" : "/dashboard"} replace />;
    }
    return (
      <ChunkErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <LoginV2 />
        </Suspense>
      </ChunkErrorBoundary>
    );
  }

  // Painel Super Admin: layout próprio, sem AppLayout dos tenants
  if (location.pathname.startsWith("/super-admin")) {
    return (
      <ChunkErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <RequireSuperAdmin>
            <SuperAdminLayout>
              <Routes>
                <Route path="/super-admin" element={<SuperAdminDashboard />} />
                <Route path="/super-admin/laboratorios" element={<SuperAdminTenants />} />
                <Route path="/super-admin/laboratorios/novo" element={<SuperAdminNovoLab />} />
                <Route path="/super-admin/laboratorios/:id" element={<SuperAdminTenantDetalhe />} />
                <Route path="/super-admin/tenants" element={<Navigate to="/super-admin/laboratorios" replace />} />
                <Route path="/super-admin/tenants/*" element={<Navigate to="/super-admin/laboratorios" replace />} />
                <Route path="/super-admin/inscricoes" element={<SuperAdminInscricoes />} />
                <Route path="/super-admin/planos" element={<SuperAdminPlanos />} />
                <Route path="/super-admin/auditoria" element={<SuperAdminAuditoria />} />
                <Route path="/super-admin/configuracoes" element={<SuperAdminConfiguracoes />} />
                <Route path="/super-admin/notificacoes" element={<SuperAdminNotificacoes />} />
              </Routes>
            </SuperAdminLayout>
          </RequireSuperAdmin>
        </Suspense>
      </ChunkErrorBoundary>
    );
  }

  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <AppLayout>
          <Routes>
            <Route path="/dashboard" element={<ProtectedRoute permissao="visualizar_dashboard"><Dashboard /></ProtectedRoute>} />
            <Route path="/atendimentos" element={<ProtectedRoute permissao="visualizar_atendimentos"><Index /></ProtectedRoute>} />
            
            {/* Domain Driven Routes — Fase A (canônicas) */}
            <Route path="/atendimentos/novo" element={<ProtectedRoute permissao="criar_atendimento"><NovoAtendimento /></ProtectedRoute>} />
            <Route path="/atendimentos/:protocolo/editar" element={<ProtectedRoute permissao="editar_atendimento"><NovoAtendimento /></ProtectedRoute>} />
            {/* Redirects legados (Fase A — compatibilidade total) */}
            <Route path="/novo-atendimento" element={<Navigate to="/atendimentos/novo" replace />} />
            <Route path="/editar-atendimento/:protocolo" element={<LegacyEditarAtendimentoRedirect />} />
            <Route path="/registrar-coleta" element={<ProtectedRoute permissao="registrar_coleta"><RegistrarColeta /></ProtectedRoute>} />
            <Route path="/analisar-amostra" element={<ProtectedRoute permissao="analisar_amostra" bloqueadoPontoColeta><AnalisarAmostra /></ProtectedRoute>} />
            <Route path="/resultados" element={<ProtectedRoute permissao="liberar_resultado" bloqueadoPontoColeta><Resultados /></ProtectedRoute>} />
            <Route path="/resultado/:id" element={<ProtectedRoute permissao="liberar_resultado" bloqueadoPontoColeta><ResultadoDetalhe /></ProtectedRoute>} />
            {/* Página dedicada de impressão — abre em nova aba via ResultadoDetalhe.
                O HTML do laudo chega via sessionStorage (PrintContext SSOT). */}
            <Route path="/resultado/:id/print" element={<ProtectedRoute permissao="liberar_resultado" bloqueadoPontoColeta><LaudoPrintPage /></ProtectedRoute>} />

            {/* Domain Driven Routes — Fase A (canônicas) */}
            <Route path="/resultados/consulta" element={<ProtectedRoute permissao="consultar_resultados"><ConsultarResultados /></ProtectedRoute>} />
            <Route path="/resultados/:id/consulta" element={<ProtectedRoute permissao="consultar_resultados"><ResultadoDetalhe /></ProtectedRoute>} />
            {/* Redirects legados (Fase A — compatibilidade total) */}
            <Route path="/consultar-resultados" element={<Navigate to="/resultados/consulta" replace />} />
            <Route path="/consultar-resultado/:id" element={<LegacyConsultarResultadoRedirect />} />
            <Route path="/lab-apoio" element={<ProtectedRoute permissao="lab_apoio_acesso"><LabApoio /></ProtectedRoute>} />
            <Route path="/pacientes" element={<ProtectedRoute permissao="visualizar_pacientes"><Pacientes /></ProtectedRoute>} />
            <Route path="/especialistas" element={<ProtectedRoute permissao="visualizar_pacientes"><Especialistas /></ProtectedRoute>} />
            <Route path="/auditoria" element={<ProtectedRoute permissao="auditoria"><Auditoria /></ProtectedRoute>} />
            <Route path="/orcamentos" element={<ProtectedRoute permissao="visualizar_orcamentos"><Orcamentos /></ProtectedRoute>} />
            <Route path="/relatorios/impressao" element={<ProtectedRoute permissao="impressao_geral"><ImpressaoGeral /></ProtectedRoute>} />
            <Route path="/relatorios/producao" element={<ProtectedRoute permissao="relatorios_producao"><Producao /></ProtectedRoute>} />
            <Route path="/relatorios/ocorrencias" element={<ProtectedRoute permissao="relatorios_ocorrencias"><RelatorioOcorrencias /></ProtectedRoute>} />
            <Route path="/relatorios/recoletas" element={<ProtectedRoute permissao="relatorios_recoletas"><RelatorioRecoletas /></ProtectedRoute>} />
            <Route path="/mapa" element={<ProtectedRoute permissao="mapa_trabalho_acesso"><Mapa /></ProtectedRoute>} />
            <Route path="/financeiro" element={<ProtectedRoute permissao="visualizar_financeiro"><Financeiro /></ProtectedRoute>} />
            <Route path="/soroteca" element={<ProtectedRoute permissao="registrar_coleta"><Soroteca /></ProtectedRoute>} />
            <Route path="/soroteca/estrutura" element={<ProtectedRoute permissao="registrar_coleta"><SorotecaEstrutura /></ProtectedRoute>} />
            <Route path="/soroteca/triagem" element={<ProtectedRoute permissao="registrar_coleta"><SorotecaTriagem /></ProtectedRoute>} />
            <Route path="/soroteca/materiais" element={<ProtectedRoute permissao="registrar_coleta"><SorotecaMateriais /></ProtectedRoute>} />
            
            <Route path="/soroteca/expurgo" element={<ProtectedRoute permissao="registrar_coleta"><SorotecaExpurgo /></ProtectedRoute>} />


            <Route path="/estoque" element={<ProtectedRoute permissao="configuracoes_sistema"><Estoque /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute permissao="configuracoes_sistema"><Configuracoes /></ProtectedRoute>} />
            {/* Domain Driven Routes — Fase B (entidades de domínio promovidas) */}
            <Route path="/exames" element={<ProtectedRoute permissao="configuracoes_sistema"><ExamesPage /></ProtectedRoute>} />
            <Route path="/exames/novo" element={<ProtectedRoute permissao="configuracoes_sistema"><ExamesPage /></ProtectedRoute>} />
            <Route path="/exames/:id" element={<ProtectedRoute permissao="configuracoes_sistema"><ExamesPage /></ProtectedRoute>} />
            <Route path="/exames/:id/editar" element={<ProtectedRoute permissao="configuracoes_sistema"><ExamesPage /></ProtectedRoute>} />
            <Route path="/exames/:id/modelos" element={<ProtectedRoute permissao="configuracoes_sistema"><ExamesPage /></ProtectedRoute>} />
            <Route path="/exames/:id/modelos/novo" element={<ProtectedRoute permissao="configuracoes_sistema"><ExamesPage /></ProtectedRoute>} />
            <Route path="/exames/:id/modelos/:modelId" element={<ProtectedRoute permissao="configuracoes_sistema"><ExamesPage /></ProtectedRoute>} />
            <Route path="/exames/:id/modelos/:modelId/editar" element={<ProtectedRoute permissao="configuracoes_sistema"><ExamesPage /></ProtectedRoute>} />
            <Route path="/convenios" element={<ProtectedRoute permissao="configuracoes_sistema"><ConveniosPage /></ProtectedRoute>} />
            <Route path="/convenios/novo" element={<ProtectedRoute permissao="configuracoes_sistema"><ConveniosPage /></ProtectedRoute>} />
            <Route path="/convenios/:id" element={<ProtectedRoute permissao="configuracoes_sistema"><ConveniosPage /></ProtectedRoute>} />
            <Route path="/convenios/:id/editar" element={<ProtectedRoute permissao="configuracoes_sistema"><ConveniosPage /></ProtectedRoute>} />
            <Route path="/unidades" element={<ProtectedRoute permissao="configuracoes_sistema"><UnidadesPage /></ProtectedRoute>} />
            <Route path="/unidades/novo" element={<ProtectedRoute permissao="configuracoes_sistema"><UnidadesPage /></ProtectedRoute>} />
            <Route path="/unidades/:id" element={<ProtectedRoute permissao="configuracoes_sistema"><UnidadesPage /></ProtectedRoute>} />
            <Route path="/unidades/:id/editar" element={<ProtectedRoute permissao="configuracoes_sistema"><UnidadesPage /></ProtectedRoute>} />
            <Route path="/documentos" element={<ProtectedRoute permissao="configuracoes_sistema"><DocumentosPage /></ProtectedRoute>} />
            <Route path="/documentos/novo" element={<ProtectedRoute permissao="configuracoes_sistema"><DocumentosPage /></ProtectedRoute>} />
            <Route path="/documentos/:id" element={<ProtectedRoute permissao="configuracoes_sistema"><DocumentosPage /></ProtectedRoute>} />
            <Route path="/documentos/:id/editar" element={<ProtectedRoute permissao="configuracoes_sistema"><DocumentosPage /></ProtectedRoute>} />
            <Route path="/tabelas-preco" element={<ProtectedRoute permissao="configuracoes_sistema"><TabelasPrecoPage /></ProtectedRoute>} />
            <Route path="/tabelas-preco/:id" element={<ProtectedRoute permissao="configuracoes_sistema"><TabelasPrecoPage /></ProtectedRoute>} />
            <Route path="/tabelas-preco/:id/editar" element={<ProtectedRoute permissao="configuracoes_sistema"><TabelasPrecoPage /></ProtectedRoute>} />
            <Route path="/pedidos-site" element={<ProtectedRoute permissao="solicitacoes_site_acesso"><SolicitacoesSite /></ProtectedRoute>} />
            {/* Backwards-compat: rota antiga `/solicitacoes-site` redireciona */}
            <Route path="/solicitacoes-site" element={<Navigate to="/pedidos-site" replace />} />
            <Route path="/equipe" element={<ProtectedRoute permissao="gestao_usuarios"><Usuarios /></ProtectedRoute>} />
            <Route path="/usuarios" element={<Navigate to="/equipe" replace />} />
            <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
            <Route path="/admin/ckeditor-test" element={<ProtectedRoute><CKEditorTest /></ProtectedRoute>} />
            <Route path="/admin/auditoria-vr" element={<ProtectedRoute><AuditoriaVR /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </Suspense>
    </ChunkErrorBoundary>
  );
}

const App = () => {
  // Limpa o cache do React Query (e do tenant) sempre que a identidade
  // do usuário muda — protege contra vazamento entre laboratórios.
  useEffect(() => {
    installQueryClientTenantReset();
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <MenuLayoutProvider>
              <AppRoutes />
            </MenuLayoutProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider>
  );
};

export default App;
