// Fachada pública do atendimentoStore (Fase 4 split — Architectural Split Program).
//
// API IDÊNTICA ao arquivo monolítico anterior (`src/data/atendimentoStore.ts`).
// Nenhum consumidor precisa alterar imports: `@/data/atendimentoStore` continua
// resolvendo aqui (Node/TS escolhe `atendimentoStore/index.ts` quando o `.ts`
// homônimo não existe).
//
// Estrutura interna:
//   _internal.ts    → cache singleton, helpers de formatação, buildAtendimento
//   queries.ts      → boot, paginação, reload, fetchs sem cache, getNextProtocolo, subscribe
//   realtime.ts     → canal Postgres Changes filtrado por tenant
//   mutations.ts    → addAtendimento, updateAtendimento (edge functions transacionais)
//   exames.ts       → CRUD por exame, operacional por status
//   terceirizados.ts→ fluxo lab apoio (envio, fetch, paginação)
//   types.ts        → tipos públicos

// ── Queries / boot / cache / paginação ──
export {
  _initAtendimentosStore,
  stopProgressiveHydration,
  getAtendimentos,
  fetchAtendimentosPage,
  subscribe,
  reloadAtendimentoById,
  getNextProtocolo,
  fetchAtendimentoByProtocolo,
  fetchAtendimentosByPacienteCpf,
} from "./queries";

// ── Realtime ──
export {
  installAtendimentosRealtime,
  stopAtendimentosRealtime,
} from "./realtime";

// ── Mutations ──
export {
  addAtendimento,
  updateAtendimento,
} from "./mutations";

// ── Exames / operacional ──
export {
  getAtendimentoExamesDB,
  updateAtendimentoExame,
  setAnalistaParaExames,
  getExamesOperacionaisByStatus,
} from "./exames";

// ── Terceirizados ──
export {
  updateExameTerceirizado,
  callLabApoioAdapter,
  getTerceirizadosOperacional,
  getTerceirizadosOperacionalPaged,
} from "./terceirizados";

// ── Tipos públicos ──
export type {
  StatusExterno,
  AtendimentoExameRow,
  AtendimentoExamePatch,
  TerceirizadoActionResult,
  ExameOperacionalRow,
  TerceirizadoOperacionalRow,
} from "./types";
