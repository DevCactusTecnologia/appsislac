// Prefetch de chunks de rota no hover/focus.
// Cada importador é o MESMO usado em React.lazy() em src/App.tsx, então o
// dynamic import compartilha o cache do bundler — basta disparar antecipado.

type Importer = () => Promise<unknown>;

const ROUTE_IMPORTERS: Record<string, Importer> = {
  "/dashboard":            () => import("@/pages/Index"),
  "/atendimentos":         () => import("@/pages/Index"),
  "/novo-atendimento":     () => import("@/pages/NovoAtendimento"),
  "/registrar-coleta":     () => import("@/pages/RegistrarColeta"),
  "/analisar-amostra":     () => import("@/pages/AnalisarAmostra"),
  "/resultados":           () => import("@/pages/Resultados"),
  "/resultados/consulta":  () => import("@/pages/ConsultarResultados"),
  "/lab-apoio":            () => import("@/pages/LabApoio"),
  "/pacientes":            () => import("@/pages/Pacientes"),
  "/especialistas":        () => import("@/pages/Especialistas"),
  "/auditoria":            () => import("@/pages/Auditoria"),
  "/orcamentos":           () => import("@/pages/Orcamentos"),
  "/relatorios/ocorrencias": () => import("@/pages/RelatorioOcorrencias"),
  "/relatorios/recoletas":   () => import("@/pages/RelatorioRecoletas"),
  "/relatorios/impressao":   () => import("@/pages/ImpressaoGeral"),
  "/relatorios/producao":    () => import("@/pages/Producao"),
  "/mapa":                 () => import("@/pages/Mapa"),
  "/financeiro":           () => import("@/pages/Financeiro"),
  "/soroteca":             () => import("@/pages/Soroteca"),
  "/soroteca/estrutura":   () => import("@/pages/SorotecaEstrutura"),
  "/soroteca/triagem":     () => import("@/pages/SorotecaTriagem"),
  "/soroteca/materiais":   () => import("@/pages/SorotecaMateriais"),
  "/soroteca/expurgo":     () => import("@/pages/SorotecaExpurgo"),
  "/estoque":              () => import("@/pages/Estoque"),
  "/configuracoes":        () => import("@/pages/Configuracoes"),
  "/exames":               () => import("@/pages/Exames"),
  "/convenios":            () => import("@/pages/Convenios"),
  "/unidades":             () => import("@/pages/Unidades"),
  "/documentos":           () => import("@/pages/Documentos"),
  "/tabelas-preco":        () => import("@/pages/TabelasPreco"),
  "/pedidos-site":         () => import("@/pages/SolicitacoesSite"),
  "/equipe":               () => import("@/pages/Usuarios"),
  "/perfil":               () => import("@/pages/Perfil"),
};

const started = new Set<string>();

/** Dispara o import do chunk da rota (best-effort, idempotente). */
export function preloadRoute(path?: string): void {
  if (!path) return;
  if (started.has(path)) return;
  const importer = ROUTE_IMPORTERS[path];
  if (!importer) return;
  started.add(path);
  importer().catch(() => { started.delete(path); /* deixa tentar de novo */ });
}
