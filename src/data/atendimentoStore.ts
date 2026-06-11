// Store de atendimentos baseado em Supabase (cache síncrono).
// API pública preservada: getAtendimentos, addAtendimento, updateAtendimento, subscribe, getNextProtocolo.
// As tabelas envolvidas são: atendimentos, atendimento_exames, atendimento_pagamentos.
// Status (atendimento + pagamento) são derivados pelo banco via trigger.

import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "./_tenant";
import type { MockAtendimento, PagamentoRealizado, StatusType } from "./types";
import { logger } from "@/lib/logger";
import { showError } from "@/lib/showError";
import { persistOrThrow, persistOneOrThrow } from "@/lib/persist";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

type AtendimentoRow = Tables<"atendimentos">;
type AtendimentoExameDbRow = Tables<"atendimento_exames">;
type AtendimentoPagamentoRow = Tables<"atendimento_pagamentos">;
type ExamesCatalogoRow = Tables<"exames_catalogo">;

/** Resposta padrão das edge functions de atendimento (create/update). */
interface AtendimentoTxResponse {
  ok: boolean;
  error?: string;
  protocolo?: string;
  atendimento_id?: number;
}

// ── Cache em memória ──
let _atendimentos: MockAtendimento[] = [];
let _listeners: Array<() => void> = [];

// Mapa interno: protocolo → row.id (para mutações)
const _idByProtocolo = new Map<string, number>();

// Mapa interno: row.id → protocolo (para dedup rápida na hidratação progressiva)
const _protocoloById = new Map<number, string>();

function notify() { _listeners.forEach(fn => fn()); }

// ── Helpers de formatação ──
const STATUS_AT_TYPES: Record<string, { type: StatusType; showIcon?: boolean }> = {
  "Pedido Realizado":   { type: "neutral" },
  "Amostra Coletada":   { type: "purple", showIcon: true },
  "Em Análise":         { type: "warning", showIcon: true },
  "Amostra Analisada":  { type: "teal", showIcon: true },
  "Resultado Salvo":    { type: "info", showIcon: true },
  "Em Retificação":     { type: "warning", showIcon: true },
  "Retificado":         { type: "info", showIcon: true },
  "Resultado Liberado": { type: "success", showIcon: true },
  "Cancelado":          { type: "danger" },
  "Pedido cancelado":   { type: "danger" },
};

const STATUS_PG_TYPES: Record<string, StatusType> = {
  "Pagamento efetuado":  "success",
  "Pagamento parcial":   "info",
  "Pagamento pendente":  "warning",
  "Pagamento cancelado": "danger",
};

function formatCPF(digits: string): string {
  const d = (digits || "").replace(/\D/g, "").padStart(11, "0").slice(0, 11);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatDateTimeBR(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDateBR(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

function calcIdade(nascimentoIso: string | null): string {
  if (!nascimentoIso) return "";
  const nasc = new Date(nascimentoIso);
  const hoje = new Date();
  let anos = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) anos--;
  return `${anos} anos`;
}

// ── Conversão DB row → MockAtendimento (preserva API legacy) ──
function buildAtendimento(
  atRow: AtendimentoRow,
  exames: AtendimentoExameDbRow[],
  pagamentos: AtendimentoPagamentoRow[],
): MockAtendimento {
  const cfgAt = STATUS_AT_TYPES[atRow.status_atendimento] ?? { type: "neutral" };
  const cfgPg: StatusType = STATUS_PG_TYPES[atRow.status_pagamento] ?? "warning";

  const examesOrdenados = [...exames].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const pagamentosFmt: PagamentoRealizado[] = pagamentos.map(p => ({
    tipo: p.tipo,
    valor: Number(p.valor),
    data: formatDateBR(p.data),
  }));

  return {
    protocolo: atRow.protocolo,
    data: formatDateTimeBR(atRow.data),
    nome: atRow.paciente_nome,
    cpf: formatCPF(atRow.paciente_cpf),
    nascimento: formatDateBR(atRow.paciente_nascimento),
    idade: calcIdade(atRow.paciente_nascimento),
    statusAtendimento: { label: atRow.status_atendimento, type: cfgAt.type, showIcon: cfgAt.showIcon },
    statusPagamento: { label: atRow.status_pagamento, type: cfgPg },
    motivoCancelamento: atRow.motivo_cancelamento ?? undefined,
    solicitante: atRow.solicitante,
    convenio: atRow.convenio_nome,
    exames: examesOrdenados.map(e => e.nome_exame),
    examesCobranca: examesOrdenados.map(e => ({
      nome: e.nome_exame,
      cobrancaDestino: (e.cobranca_destino === "convenio" ? "convenio" : "paciente") as "paciente" | "convenio",
      convenioCobrancaId: e.convenio_cobranca_id ?? null,
      valor: Number(e.valor) || 0,
      analista: e.analista || "",
      exameId: e.exame_id ?? null,
      status: e.status ?? "pendente",
      dataLiberacaoISO: e.data_liberacao ?? null,
      atendimentoExameId: e.id,
      amostraSeq: typeof e.amostra_seq === "number" ? e.amostra_seq : 1,
      grupoExameId: e.grupo_exame_id ?? null,
      isReutilizacao: !!e.is_reutilizacao,
      material: e.material ?? "",
      amostraId: e.amostra_id ?? null,
      tipoProcesso: (e.tipo_processo === "TERCEIRIZADO" ? "TERCEIRIZADO" : "INTERNO"),
      labApoioId: e.lab_apoio_id ?? null,
      solicitante: (e as { solicitante?: string }).solicitante ?? "",
    })),
    unidadeId: atRow.unidade_id,
    pagamentosRealizados: pagamentosFmt.length > 0 ? pagamentosFmt : undefined,
    updatedAt: atRow.updated_at ? formatDateTimeBR(atRow.updated_at) : undefined,
    origem: ((atRow as { origem_atendimento?: string }).origem_atendimento ?? "INTERNO") as MockAtendimento["origem"],
  };
}

// ── Boot: hidrata cache do banco ──
export async function _initAtendimentosStore(): Promise<void> {
  // Fase D — selects explícitos (sem `*`) e LIMIT no boot.
  // Estratégia: carregamos os N atendimentos mais recentes (por data desc)
  // e filtramos exames/pagamentos pelos IDs desses atendimentos. Isso evita
  // trazer histórico inteiro (anos de dados) de tabelas filhas pesadas.
  // Mutações pontuais continuam usando `reloadAtendimentoById`, então o
  // contrato síncrono dos consumidores permanece idêntico.
  // C-1 — Boot adaptativo:
  //  - Modo legado (USE_LEGACY_STORE ON OU paginated_atendimentos OFF): 1000 (comportamento antigo)
  //  - Modo paginado (paginated_atendimentos ON e legacy OFF): 100 (mínimo seguro p/
  //    manter telas legadas ainda não migradas funcionando parcialmente).
  // Leitura via localStorage para evitar dependência circular com loadTenantFeatureFlags
  // (essa função roda dentro do bootDataStores, antes do React montar).
  let ATENDIMENTOS_BOOT_LIMIT = 1000;
  try {
    if (typeof window !== "undefined") {
      const legacy = window.localStorage.getItem("ff:USE_LEGACY_STORE");
      const paginated = window.localStorage.getItem("ff:paginated_atendimentos");
      const legacyOn = legacy === "1" || legacy === "true";
      const paginatedOn = paginated === "1" || paginated === "true";
      if (paginatedOn && !legacyOn) ATENDIMENTOS_BOOT_LIMIT = 100;
    }
  } catch { /* fail-safe: mantém 1000 */ }

  const ATENDIMENTO_COLS =
    "id,protocolo,data,paciente_nome,paciente_cpf,paciente_nascimento," +
    "solicitante,convenio_nome,unidade_id,status_atendimento,status_pagamento," +
    "motivo_cancelamento,updated_at,origem_atendimento";
  const EXAME_COLS =
    "id,atendimento_id,nome_exame,exame_id,ordem,valor,analista,status," +
    "cobranca_destino,convenio_cobranca_id,amostra_seq,grupo_exame_id," +
    "is_reutilizacao,material,amostra_id,tipo_processo,lab_apoio_id,solicitante,data_liberacao";
  const PAGAMENTO_COLS = "id,atendimento_id,tipo,valor,data";

  const { data: atRows, error: e1 } = await supabase
    .from("atendimentos")
    .select(ATENDIMENTO_COLS)
    .order("data", { ascending: false })
    .limit(ATENDIMENTOS_BOOT_LIMIT);

  if (e1) {
    showError(e1, { scope: "atendimentoStore.init.atendimentos", silent: true });
    return;
  }

  const atRowsTyped = (atRows ?? []) as unknown as AtendimentoRow[];
  const ids = atRowsTyped.map((r) => r.id);
  let exRows: AtendimentoExameDbRow[] = [];
  let pgRows: AtendimentoPagamentoRow[] = [];

  if (ids.length > 0) {
    const [{ data: ex, error: e2 }, { data: pg, error: e3 }] = await Promise.all([
      supabase.from("atendimento_exames").select(EXAME_COLS).in("atendimento_id", ids),
      supabase.from("atendimento_pagamentos").select(PAGAMENTO_COLS).in("atendimento_id", ids),
    ]);
    if (e2 || e3) {
      showError(e2 || e3, { scope: "atendimentoStore.init.filhas", silent: true, meta: { e2, e3 } });
      return;
    }
    exRows = (ex ?? []) as unknown as AtendimentoExameDbRow[];
    pgRows = (pg ?? []) as unknown as AtendimentoPagamentoRow[];
  }

  const exMap = new Map<number, AtendimentoExameDbRow[]>();
  exRows.forEach((e) => {
    const arr = exMap.get(e.atendimento_id) ?? [];
    arr.push(e);
    exMap.set(e.atendimento_id, arr);
  });

  const pgMap = new Map<number, AtendimentoPagamentoRow[]>();
  pgRows.forEach((p) => {
    const arr = pgMap.get(p.atendimento_id) ?? [];
    arr.push(p);
    pgMap.set(p.atendimento_id, arr);
  });

  _idByProtocolo.clear();
  _protocoloById.clear();
  _atendimentos = atRowsTyped.map((at) => {
    _idByProtocolo.set(at.protocolo, at.id);
    _protocoloById.set(at.id, at.protocolo);
    return buildAtendimento(at, exMap.get(at.id) ?? [], pgMap.get(at.id) ?? []);
  });
  notify();

  if (atRowsTyped.length === ATENDIMENTOS_BOOT_LIMIT) {
    logger.info("atendimentoStore", "boot atingiu limite", { limit: ATENDIMENTOS_BOOT_LIMIT });
    // C1 — Hidratação progressiva (até 9k extras) está DESLIGADA por padrão.
    // Ativar somente em ambientes pequenos via flag explícita: localStorage.USE_PROGRESSIVE_HYDRATION = "1".
    // Para tenants grandes ela causa OOM no navegador. Para crescer além
    // dos 1000 mais recentes, use `fetchAtendimentosPage(cursor)` (paginado).
    let useLegacy = false;
    try {
      useLegacy = typeof localStorage !== "undefined"
        && localStorage.getItem("USE_PROGRESSIVE_HYDRATION") === "1";
    } catch { /* SSR / privacy mode */ }
    if (useLegacy) {
      setTimeout(() => { void startProgressiveHydration(); }, 1500);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Fase D — Bloco 4: Hidratação progressiva em background.
// Carrega atendimentos além do boot limit (1000) em lotes, usando cursor
// baseado em `data` (não OFFSET — evita drift e duplicação se houver INSERT
// concorrente). Mantém contrato síncrono: apenas append ao cache + 1 notify
// por lote. Nunca remove dados existentes. Fail-safe: erro interrompe loop
// silenciosamente sem degradar UX.
// ──────────────────────────────────────────────────────────────────────────
const HYDRATION_BATCH = 500;
const HYDRATION_MAX_TOTAL = 10000; // teto absoluto (boot 1000 + ~9000 progressivo)
const HYDRATION_INTERVAL_MS = 400;

let _hydrationRunning = false;
let _hydrationStop = false;

/** Permite abortar a hidratação (ex.: logout). Idempotente. */
export function stopProgressiveHydration(): void {
  _hydrationStop = true;
}

async function startProgressiveHydration(): Promise<void> {
  if (_hydrationRunning) return;
  _hydrationRunning = true;
  _hydrationStop = false;

  const ATENDIMENTO_COLS =
    "id,protocolo,data,paciente_nome,paciente_cpf,paciente_nascimento," +
    "solicitante,convenio_nome,unidade_id,status_atendimento,status_pagamento," +
    "motivo_cancelamento,updated_at,origem_atendimento";
  const EXAME_COLS =
    "id,atendimento_id,nome_exame,exame_id,ordem,valor,analista,status," +
    "cobranca_destino,convenio_cobranca_id,amostra_seq,grupo_exame_id," +
    "is_reutilizacao,material,amostra_id,tipo_processo,lab_apoio_id,solicitante,data_liberacao";
  const PAGAMENTO_COLS = "id,atendimento_id,tipo,valor,data";

  const t0 = performance.now();
  let totalAppended = 0;

  try {
    while (!_hydrationStop && _atendimentos.length < HYDRATION_MAX_TOTAL) {
      // Cursor: o atendimento mais antigo do cache (último, pois ordem DESC).
      // Busca registros estritamente anteriores para evitar duplicar a borda.
      const last = _atendimentos[_atendimentos.length - 1];
      if (!last) break;
      const cursorIso = brToIso(last.data);
      if (!cursorIso) break;

      const { data: atRows, error: e1 } = await supabase
        .from("atendimentos")
        .select(ATENDIMENTO_COLS)
        .lt("data", cursorIso)
        .order("data", { ascending: false })
        .limit(HYDRATION_BATCH);

      if (e1) {
        logger.warn("atendimentoStore", "hidratação progressiva: erro no fetch base", {
          error: e1.message,
        });
        break;
      }

      const rows = (atRows ?? []) as unknown as AtendimentoRow[];
      if (rows.length === 0) break;

      // Dedup por id (defensivo — caso boot e hidratação se sobreponham).
      const novosRows = rows.filter((r) => !_protocoloById.has(r.id));
      if (novosRows.length === 0) {
        // Nada de novo neste lote; avança o cursor para evitar loop infinito.
        // Como usamos `lt(cursor)` baseado no último item do cache e o cache
        // não cresceu, não há mais o que buscar — sai.
        break;
      }

      const ids = novosRows.map((r) => r.id);
      const [{ data: ex, error: e2 }, { data: pg, error: e3 }] = await Promise.all([
        supabase.from("atendimento_exames").select(EXAME_COLS).in("atendimento_id", ids),
        supabase.from("atendimento_pagamentos").select(PAGAMENTO_COLS).in("atendimento_id", ids),
      ]);
      if (e2 || e3) {
        logger.warn("atendimentoStore", "hidratação progressiva: erro nas filhas", {
          e2: e2?.message, e3: e3?.message,
        });
        break;
      }

      const exRows = (ex ?? []) as unknown as AtendimentoExameDbRow[];
      const pgRows = (pg ?? []) as unknown as AtendimentoPagamentoRow[];

      const exMap = new Map<number, AtendimentoExameDbRow[]>();
      exRows.forEach((e) => {
        const arr = exMap.get(e.atendimento_id) ?? [];
        arr.push(e);
        exMap.set(e.atendimento_id, arr);
      });
      const pgMap = new Map<number, AtendimentoPagamentoRow[]>();
      pgRows.forEach((p) => {
        const arr = pgMap.get(p.atendimento_id) ?? [];
        arr.push(p);
        pgMap.set(p.atendimento_id, arr);
      });

      // Merge: como `novosRows` já vem ordenado DESC e contém apenas dados
      // estritamente anteriores ao último item do cache, podemos apenas
      // appendar — ordenação DESC é preservada naturalmente.
      const built: MockAtendimento[] = [];
      for (const at of novosRows) {
        _idByProtocolo.set(at.protocolo, at.id);
        _protocoloById.set(at.id, at.protocolo);
        built.push(buildAtendimento(at, exMap.get(at.id) ?? [], pgMap.get(at.id) ?? []));
      }

      // FIX OOM: push in-place evita o pico transitório de 2x heap que o
      // spread `[..._atendimentos, ...built]` causava em arrays grandes
      // (~60MB para 10k registros). Subscribers usam contador externo
      // (forceUpdate(n=>n+1)), portanto não dependem de identidade de array.
      for (let i = 0; i < built.length; i++) _atendimentos.push(built[i]);
      totalAppended += built.length;
      notify();

      // Se este lote veio incompleto, acabou.
      if (rows.length < HYDRATION_BATCH) break;

      // Cede a thread principal entre lotes.
      await new Promise((res) => setTimeout(res, HYDRATION_INTERVAL_MS));
    }
  } catch (err) {
    logger.warn("atendimentoStore", "hidratação progressiva abortada", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    _hydrationRunning = false;
    const dt = performance.now() - t0;
    logger.info("atendimentoStore", "hidratação progressiva concluída", {
      appended: totalAppended,
      total: _atendimentos.length,
      ms: Math.round(dt),
      stopped: _hydrationStop,
    });
  }
}

// ── API pública ──
export function getAtendimentos(): MockAtendimento[] {
  return _atendimentos;
}

/**
 * C1 — Paginação por cursor (id desc) para tabelas grandes em /atendimentos.
 * NÃO afeta o cache global. Use quando precisar carregar além dos ~1000 do boot.
 * `cursorId`: id do último atendimento exibido (ou null para a primeira página).
 */
export async function fetchAtendimentosPage(opts?: {
  cursorId?: number | null;
  pageSize?: number;
}): Promise<{ items: MockAtendimento[]; nextCursorId: number | null }> {
  const pageSize = Math.min(Math.max(opts?.pageSize ?? 50, 10), 200);
  const ATENDIMENTO_COLS =
    "id,protocolo,data,paciente_nome,paciente_cpf,paciente_nascimento," +
    "solicitante,convenio_nome,unidade_id,status_atendimento,status_pagamento," +
    "motivo_cancelamento,updated_at,origem_atendimento";
  const EXAME_COLS =
    "id,atendimento_id,nome_exame,exame_id,ordem,valor,analista,status," +
    "cobranca_destino,convenio_cobranca_id,amostra_seq,grupo_exame_id," +
    "is_reutilizacao,material,amostra_id,tipo_processo,lab_apoio_id,solicitante,data_liberacao";
  const PAGAMENTO_COLS = "id,atendimento_id,tipo,valor,data";

  let q = supabase
    .from("atendimentos")
    .select(ATENDIMENTO_COLS)
    .order("id", { ascending: false })
    .limit(pageSize);
  if (opts?.cursorId) q = q.lt("id", opts.cursorId);

  const { data: atRows, error: e1 } = await q;
  if (e1) {
    logger.warn("atendimentoStore", "fetchAtendimentosPage falhou", { error: e1.message });
    throw e1;
  }
  const rows = (atRows ?? []) as unknown as AtendimentoRow[];
  if (rows.length === 0) return { items: [], nextCursorId: null };

  const ids = rows.map(r => r.id);
  const [{ data: ex }, { data: pg }] = await Promise.all([
    supabase.from("atendimento_exames").select(EXAME_COLS).in("atendimento_id", ids),
    supabase.from("atendimento_pagamentos").select(PAGAMENTO_COLS).in("atendimento_id", ids),
  ]);
  const exMap = new Map<number, AtendimentoExameDbRow[]>();
  ((ex ?? []) as unknown as AtendimentoExameDbRow[]).forEach(e => {
    const arr = exMap.get(e.atendimento_id) ?? [];
    arr.push(e); exMap.set(e.atendimento_id, arr);
  });
  const pgMap = new Map<number, AtendimentoPagamentoRow[]>();
  ((pg ?? []) as unknown as AtendimentoPagamentoRow[]).forEach(p => {
    const arr = pgMap.get(p.atendimento_id) ?? [];
    arr.push(p); pgMap.set(p.atendimento_id, arr);
  });

  const items = rows.map(at => buildAtendimento(at, exMap.get(at.id) ?? [], pgMap.get(at.id) ?? []));
  const nextCursorId = rows.length === pageSize ? rows[rows.length - 1].id : null;
  return { items, nextCursorId };
}

export function subscribe(listener: () => void) {
  _listeners.push(listener);
  return () => { _listeners = _listeners.filter(l => l !== listener); };
}

/**
 * Recarrega um único atendimento (com seus exames e pagamentos) e atualiza
 * o cache local. Usado pelo realtime e como fallback após mutações remotas.
 */
export async function reloadAtendimentoById(id: number): Promise<void> {
  try {
    const [{ data: at }, { data: exames }, { data: pgs }] = await Promise.all([
      supabase.from("atendimentos").select("*").eq("id", id).maybeSingle(),
      supabase.from("atendimento_exames").select("*").eq("atendimento_id", id),
      supabase.from("atendimento_pagamentos").select("*").eq("atendimento_id", id),
    ]);

    if (!at) {
      // Removido remotamente — limpa do cache
      _atendimentos = _atendimentos.filter(a => _idByProtocolo.get(a.protocolo) !== id);
      for (const [proto, rid] of _idByProtocolo.entries()) {
        if (rid === id) _idByProtocolo.delete(proto);
      }
      _protocoloById.delete(id);
      notify();
      return;
    }

    const built = buildAtendimento(at, exames ?? [], pgs ?? []);
    _idByProtocolo.set(at.protocolo, at.id);
    _protocoloById.set(at.id, at.protocolo);

    const idx = _atendimentos.findIndex(a => a.protocolo === at.protocolo);
    if (idx >= 0) {
      _atendimentos = [
        ..._atendimentos.slice(0, idx),
        built,
        ..._atendimentos.slice(idx + 1),
      ];
    } else {
      _atendimentos = [built, ..._atendimentos];
    }
    notify();
  } catch (err) {
    logger.warn("atendimentoStore", "reloadAtendimentoById falhou", {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Realtime: escuta mudanças nas tabelas de atendimento e sincroniza o cache.
// O canal é tenant-safe via RLS — Supabase só entrega payloads que o JWT
// atual pode SELECT, então não há vazamento entre tenants.
// ──────────────────────────────────────────────────────────────────────────
let _realtimeInstalled = false;
let _pendingReloads = new Set<number>();
let _reloadTimer: ReturnType<typeof setTimeout> | null = null;
let _realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let _realtimeTenantId: string | null = null;
// Dedupe simples por (id, evento) dentro da janela de coalescing — evita
// processar o mesmo payload duas vezes quando Postgres emite eventos
// idênticos consecutivos.
const _lastSeen = new Map<string, number>();
const _DEDUPE_MS = 200;

function shouldSkip(key: string): boolean {
  const now = Date.now();
  const prev = _lastSeen.get(key);
  if (prev && now - prev < _DEDUPE_MS) return true;
  _lastSeen.set(key, now);
  // garbage collect ocasional
  if (_lastSeen.size > 256) {
    for (const [k, t] of _lastSeen) {
      if (now - t > _DEDUPE_MS * 4) _lastSeen.delete(k);
    }
  }
  return false;
}

function scheduleReload(id: number) {
  _pendingReloads.add(id);
  if (_reloadTimer) return;
  _reloadTimer = setTimeout(() => {
    const ids = Array.from(_pendingReloads);
    _pendingReloads.clear();
    _reloadTimer = null;
    void Promise.all(ids.map(reloadAtendimentoById));
  }, 250); // coalesce bursts (delete+insert do update tx)
}

/**
 * Instala o canal realtime de atendimentos com filtro server-side por tenant.
 * - Se `tenantId` for fornecido, o filtro é aplicado nas três tabelas (escala
 *   multi-tenant: cada cliente WS recebe apenas seu próprio tráfego).
 * - Se ausente, resolve via getCurrentTenantId() e adia a abertura do canal
 *   até ter o id (não abre canal sem filtro — evita broadcast cross-tenant).
 * Idempotente: chamadas repetidas são ignoradas.
 */
export function installAtendimentosRealtime(tenantId?: string | null): void {
  if (_realtimeInstalled) return;

  const open = (tid: string) => {
    if (_realtimeInstalled) return;
    _realtimeInstalled = true;
    _realtimeTenantId = tid;

    const channel = supabase.channel(`atendimentos-store:${tid}`, {
      config: { private: true },
    });
    _realtimeChannel = channel;

    const handle = (table: string, idKey: "id" | "atendimento_id") =>
      (payload: { new?: Record<string, unknown> | null; old?: Record<string, unknown> | null; eventType?: string }) => {
        const row = (payload.new ?? payload.old) as Record<string, unknown> | null;
        if (!row) return;
        // Defense-in-depth: o filtro server-side já bloqueia, mas validamos
        // novamente caso o cliente esteja em transição de identidade.
        const rowTenant = (row as { tenant_id?: string }).tenant_id;
        if (rowTenant && rowTenant !== _realtimeTenantId) return;
        const id = row[idKey] as number | undefined;
        if (!id) return;
        const dedupeKey = `${table}:${id}:${payload.eventType ?? ""}`;
        if (shouldSkip(dedupeKey)) return;
        scheduleReload(id);
      };

    const filter = `tenant_id=eq.${tid}`;
    channel.on("postgres_changes", { event: "*", schema: "public", table: "atendimentos",          filter }, handle("atendimentos", "id"));
    channel.on("postgres_changes", { event: "*", schema: "public", table: "atendimento_exames",    filter }, handle("atendimento_exames", "atendimento_id"));
    channel.on("postgres_changes", { event: "*", schema: "public", table: "atendimento_pagamentos", filter }, handle("atendimento_pagamentos", "atendimento_id"));

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        logger.info("atendimentoStore", `realtime subscribed (tenant=${tid.slice(0, 8)}…)`);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        logger.warn("atendimentoStore", `realtime status=${status}`);
      }
    });
  };

  if (tenantId) {
    open(tenantId);
    return;
  }
  // Sem tenant explícito: resolve antes de abrir (não abre canal sem filtro).
  void getCurrentTenantId()
    .then((tid) => { if (tid) open(tid); })
    .catch((err) => logger.warn("atendimentoStore", "realtime: falha ao resolver tenant", { error: (err as Error)?.message }));
}

/**
 * Para o canal realtime e libera o WebSocket. Idempotente.
 * Chamado em logout / troca de usuário pelo storeBoot.
 */
export function stopAtendimentosRealtime(): void {
  if (!_realtimeInstalled) return;
  _realtimeInstalled = false;
  _realtimeTenantId = null;
  _pendingReloads.clear();
  if (_reloadTimer) { clearTimeout(_reloadTimer); _reloadTimer = null; }
  _lastSeen.clear();
  const ch = _realtimeChannel;
  _realtimeChannel = null;
  if (ch) {
    try { void supabase.removeChannel(ch); } catch { /* noop */ }
  }
  logger.info("atendimentoStore", "realtime stopped");
}

export function getNextProtocolo(): string {
  const year = new Date().getFullYear();
  const prefix = `ATD-${year}-`;
  const nums = _atendimentos
    .map(a => {
      const m = a.protocolo.match(new RegExp(`^ATD-\\d+-(\\d+)$`));
      return m ? parseInt(m[1], 10) : 0;
    });
  const next = Math.max(0, ...nums) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

// ============================================================
// C-2 — Fetchs server-side SEM tocar no cache global.
// Usados pelas telas migradas (Pacientes/NovoAtendimento) para
// hidratar dados pontualmente sob demanda. Nunca alteram listas.
// ============================================================

/**
 * Busca um único atendimento (com exames + pagamentos) por protocolo,
 * direto no banco. Não lê nem escreve no cache global. Retorna
 * `MockAtendimento` ou `null` quando não encontrado / erro.
 */
export async function fetchAtendimentoByProtocolo(
  protocolo: string,
): Promise<MockAtendimento | null> {
  try {
    const { data: at, error: e1 } = await supabase
      .from("atendimentos")
      .select("*")
      .eq("protocolo", protocolo)
      .maybeSingle();
    if (e1 || !at) return null;
    const [{ data: exames }, { data: pgs }] = await Promise.all([
      supabase.from("atendimento_exames").select("*").eq("atendimento_id", at.id),
      supabase.from("atendimento_pagamentos").select("*").eq("atendimento_id", at.id),
    ]);
    // Atualiza o índice de protocolo→id (oportunístico — útil para mutações
    // que ainda dependem desse mapa). Não toca em `_atendimentos`.
    _idByProtocolo.set(at.protocolo, at.id);
    _protocoloById.set(at.id, at.protocolo);
    return buildAtendimento(at, exames ?? [], pgs ?? []);
  } catch (err) {
    logger.warn("atendimentoStore", "fetchAtendimentoByProtocolo falhou", {
      protocolo,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Busca atendimentos de um paciente (por CPF) direto do banco. Retorna
 * lista ordenada por data DESC. Não toca no cache global. Limita por
 * segurança (default 50 — suficiente para histórico/IA/débitos).
 */
export async function fetchAtendimentosByPacienteCpf(
  cpf: string,
  opts?: { limit?: number },
): Promise<MockAtendimento[]> {
  const cpfDigits = (cpf || "").replace(/\D/g, "");
  if (cpfDigits.length !== 11) return [];
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
  try {
    const { data: atRows, error: e1 } = await supabase
      .from("atendimentos")
      .select("*")
      .eq("paciente_cpf", cpfDigits)
      .order("data", { ascending: false })
      .limit(limit);
    if (e1 || !atRows || atRows.length === 0) return [];
    const ids = atRows.map((r) => r.id);
    const [{ data: ex }, { data: pg }] = await Promise.all([
      supabase.from("atendimento_exames").select("*").in("atendimento_id", ids),
      supabase.from("atendimento_pagamentos").select("*").in("atendimento_id", ids),
    ]);
    const exMap = new Map<number, AtendimentoExameDbRow[]>();
    ((ex ?? []) as AtendimentoExameDbRow[]).forEach((e) => {
      const arr = exMap.get(e.atendimento_id) ?? [];
      arr.push(e); exMap.set(e.atendimento_id, arr);
    });
    const pgMap = new Map<number, AtendimentoPagamentoRow[]>();
    ((pg ?? []) as AtendimentoPagamentoRow[]).forEach((p) => {
      const arr = pgMap.get(p.atendimento_id) ?? [];
      arr.push(p); pgMap.set(p.atendimento_id, arr);
    });
    return atRows.map((at) => {
      _idByProtocolo.set(at.protocolo, at.id);
      _protocoloById.set(at.id, at.protocolo);
      return buildAtendimento(at, exMap.get(at.id) ?? [], pgMap.get(at.id) ?? []);
    });
  } catch (err) {
    logger.warn("atendimentoStore", "fetchAtendimentosByPacienteCpf falhou", {
      cpf: cpfDigits.slice(0, 3) + "***",
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// Mapeia label "Pendente" → status DB
function mapExameStatus(label: string | undefined): "pendente" | "coletado" | "em_analise" | "finalizado" | "cancelado" {
  if (!label) return "pendente";
  const l = label.toLowerCase();
  if (l.includes("cancel")) return "cancelado";
  if (l.includes("liber") || l.includes("finaliz")) return "finalizado";
  if (l.includes("anali")) return "em_analise";
  if (l.includes("colet")) return "coletado";
  return "pendente";
}

// Converte data brasileira "dd/MM/yyyy [HH:mm[:ss]]" para ISO
function brToIso(br: string | undefined): string | null {
  if (!br) return null;
  const [datePart, timePart] = br.split(" ");
  const dParts = datePart.split("/");
  if (dParts.length !== 3) return null;
  const iso = `${dParts[2]}-${dParts[1].padStart(2, "0")}-${dParts[0].padStart(2, "0")}`;
  if (!timePart) return iso;
  return `${iso}T${timePart.length === 5 ? timePart + ":00" : timePart}`;
}

/**
 * Insere atendimento + exames + pagamentos atomicamente via edge function
 * `create-atendimento` (que executa `create_atendimento_tx` no Postgres).
 *
 * Garantias:
 *  - Toda a operação roda dentro de uma única transação SQL. Se QUALQUER
 *    parte falhar, ROLLBACK automático: nada fica persistido parcialmente.
 *  - Otimista no cache local; em caso de falha, rollback do cache + throw.
 *  - Sucesso só é retornado após o banco confirmar a inserção.
 */
export async function addAtendimento(at: MockAtendimento): Promise<void> {
  // Otimista
  const prev = _atendimentos;
  _atendimentos = [at, ..._atendimentos];
  notify();

  try {
    const dataIso = brToIso(at.data) ?? new Date().toISOString();
    const nascIso = brToIso(at.nascimento);
    const cpfDigits = at.cpf.replace(/\D/g, "");

    // Resolve paciente_id pelo CPF (não-crítico; falha silenciosa apenas aqui)
    let pacienteId: number | null = null;
    if (cpfDigits.length === 11) {
      const { data: pacRow } = await supabase
        .from("pacientes").select("id").eq("cpf", cpfDigits).maybeSingle();
      if (pacRow) pacienteId = Number(pacRow.id);
    }

    // Resolve convenio_id pelo nome (Particular = 0)
    let convenioIdResolved = 0;
    if (at.convenio && at.convenio !== "Particular") {
      const { data: convRow } = await supabase
        .from("convenios").select("id").eq("nome", at.convenio).maybeSingle();
      if (convRow) convenioIdResolved = Number(convRow.id);
    }

    // Resolve catálogo de exames (id, material, tipo_processo, lab_apoio)
    let catMap = new Map<string, { id: string; material: string; tipo_processo: string; lab_apoio_id: string | null }>();
    if (at.exames.length > 0) {
      const nomesUnicos = Array.from(new Set(at.exames));
      const { data: catRows } = await supabase
        .from("exames_catalogo")
        .select("id, nome, material, tipo_processo, lab_apoio_id")
        .in("nome", nomesUnicos);
      type CatLite = Pick<ExamesCatalogoRow, "id" | "nome" | "material" | "tipo_processo" | "lab_apoio_id">;
      catMap = new Map((catRows ?? []).map((c: CatLite) => [c.nome, {
        id: c.id,
        material: c.material || "",
        tipo_processo: c.tipo_processo || "INTERNO",
        lab_apoio_id: c.lab_apoio_id ?? null,
      }]));
    }

    const seqCount = new Map<string, number>();
    const grupoMap = new Map<string, string>();
    const examesPayload = at.exames.map((nome, idx) => {
      const meta = at.examesCobranca?.[idx];
      const cat = catMap.get(nome);
      const chave = cat?.id ?? nome.toLowerCase();
      const seq = (seqCount.get(chave) ?? 0) + 1;
      seqCount.set(chave, seq);
      if (!grupoMap.has(chave)) {
        grupoMap.set(chave, meta?.grupoExameId || crypto.randomUUID());
      }
      const tipoProcesso = (meta?.tipoProcesso as string) || cat?.tipo_processo || "INTERNO";
      const labApoioId = tipoProcesso === "TERCEIRIZADO"
        ? (meta?.labApoioId !== undefined ? meta?.labApoioId : (cat?.lab_apoio_id ?? null))
        : null;
      return {
        nome_exame: nome,
        exame_id: cat?.id ?? null,
        material: cat?.material ?? "",
        status: "pendente",
        valor: Number(meta?.valor) || 0,
        ordem: idx + 1,
        cobranca_destino: meta?.cobrancaDestino ?? "paciente",
        convenio_cobranca_id: meta?.convenioCobrancaId ?? null,
        amostra_seq: seq,
        grupo_exame_id: grupoMap.get(chave),
        tipo_processo: tipoProcesso,
        lab_apoio_id: labApoioId,
        solicitante: meta?.solicitante ?? "",
      };
    });

    const pagamentosPayload = (at.pagamentosRealizados ?? []).map(p => ({
      tipo: p.tipo,
      valor: p.valor,
      data: brToIso(p.data) ?? new Date().toISOString(),
    }));

    // Invoca edge function transacional
    const { data, error } = await supabase.functions.invoke("create-atendimento", {
      body: {
        atendimento: {
          protocolo: at.protocolo,
          data: dataIso,
          paciente_id: pacienteId,
          paciente_nome: at.nome,
          paciente_cpf: cpfDigits,
          paciente_nascimento: nascIso,
          solicitante: at.solicitante,
          convenio_id: convenioIdResolved,
          convenio_nome: at.convenio,
          unidade_id: at.unidadeId ?? "und-001",
          motivo_cancelamento: at.motivoCancelamento ?? null,
        },
        exames: examesPayload,
        pagamentos: pagamentosPayload,
      },
    });

    const resp = data as AtendimentoTxResponse | null;
    if (error || !resp || resp.ok === false) {
      // ROLLBACK do cache local + propaga erro
      _atendimentos = prev;
      notify();
      throw new Error(
        resp?.error || error?.message || "Falha ao criar atendimento",
      );
    }

    // Sincroniza protocolo oficial gerado server-side
    const protocoloOficial = resp.protocolo ?? "";
    const atendimentoId = resp.atendimento_id ?? 0;
    if (protocoloOficial && protocoloOficial !== at.protocolo) {
      _atendimentos = _atendimentos.map(a =>
        a.protocolo === at.protocolo ? { ...a, protocolo: protocoloOficial } : a,
      );
      at.protocolo = protocoloOficial;
      notify();
    }
    if (protocoloOficial && atendimentoId) {
      _idByProtocolo.set(protocoloOficial, atendimentoId);
    }

    // Persiste origem operacional (ex.: WEB_APROVADO, WEB_AUTO, AGENDAMENTO).
    // Follow-up update isolado para não quebrar a RPC transacional existente.
    // RLS permite UPDATE para usuários do tenant; falha silenciosa não bloqueia o fluxo.
    if (atendimentoId && at.origem && at.origem !== "INTERNO") {
      const { error: origemErr } = await supabase
        .from("atendimentos")
        .update({ origem_atendimento: at.origem })
        .eq("id", atendimentoId);
      if (origemErr) {
        logger.warn("atendimentoStore", "falha ao persistir origem_atendimento", {
          atendimentoId, origem: at.origem, error: origemErr.message,
        });
      } else {
        // Reflete no cache local
        _atendimentos = _atendimentos.map(a =>
          a.protocolo === at.protocolo ? { ...a, origem: at.origem } : a,
        );
        notify();
      }
    }
  } catch (e) {
    // Em qualquer falha, garante rollback do cache.
    _atendimentos = prev;
    notify();
    throw e;
  }
}

/**
 * Atualiza campos do atendimento.
 * Aceita os mesmos campos parciais da API legacy. Ignora campos derivados (statusAtendimento/statusPagamento)
 * porque são calculados pelo banco via trigger.
 */
export async function updateAtendimento(
  protocolo: string,
  updates: Partial<MockAtendimento>,
  justificativa?: string,
): Promise<void> {
  // Snapshot para rollback otimista
  const prev = _atendimentos;
  _atendimentos = _atendimentos.map(a => a.protocolo === protocolo ? { ...a, ...updates } : a);
  notify();

  const id = _idByProtocolo.get(protocolo);
  if (!id) {
    _atendimentos = prev;
    notify();
    throw new Error(`Atendimento ${protocolo} não encontrado no cache local`);
  }

  await persistUpdateAtendimentoTx(id, protocolo, updates, prev, justificativa);
}

/**
 * Persiste a atualização de forma TRANSACIONAL via edge function `update-atendimento`.
 *
 * Garantias:
 *  - Toda a operação (update + delete/insert exames + delete/insert pagamentos)
 *    roda dentro de uma única transação PL/pgSQL no Postgres.
 *  - Em caso de qualquer falha, ROLLBACK automático (nenhum efeito persistido).
 *  - Em falha, o cache local é revertido para o snapshot anterior.
 */
async function persistUpdateAtendimentoTx(
  id: number,
  protocolo: string,
  updates: Partial<MockAtendimento>,
  prev: MockAtendimento[],
  justificativa?: string,
): Promise<void> {
  // 1) Resolve convenio_id quando o convênio mudou (precisa do nome → id)
  let convenioIdResolved: number | undefined;
  if (updates.convenio !== undefined) {
    if (!updates.convenio || updates.convenio === "Particular") {
      convenioIdResolved = 0;
    } else {
      const { data: convRow } = await supabase
        .from("convenios").select("id").eq("nome", updates.convenio).maybeSingle();
      convenioIdResolved = convRow ? Number(convRow.id) : 0;
    }
  }

  // 2) Patch (colunas escalares de atendimentos)
  const patch: Record<string, unknown> = {};
  if (updates.nome !== undefined) patch.paciente_nome = updates.nome;
  if (updates.cpf !== undefined) patch.paciente_cpf = updates.cpf.replace(/\D/g, "");
  if (updates.nascimento !== undefined) patch.paciente_nascimento = brToIso(updates.nascimento) ?? "";
  if (updates.solicitante !== undefined) patch.solicitante = updates.solicitante;
  if (updates.convenio !== undefined) {
    patch.convenio_nome = updates.convenio;
    patch.convenio_id = String(convenioIdResolved ?? 0);
  }
  if (updates.unidadeId !== undefined) patch.unidade_id = updates.unidadeId;
  if (updates.motivoCancelamento !== undefined) patch.motivo_cancelamento = updates.motivoCancelamento ?? "";

  // 3) Monta payload de exames (somente se substituição explícita)
  let examesPayload: Array<Record<string, unknown>> | null = null;
  if (updates.exames !== undefined) {
    if (updates.exames.length === 0) {
      examesPayload = [];
    } else {
      const nomesUnicos = Array.from(new Set(updates.exames));
      const { data: catRows } = await supabase
        .from("exames_catalogo")
        .select("id, nome, material, tipo_processo, lab_apoio_id")
        .in("nome", nomesUnicos);
      type CatLite = Pick<ExamesCatalogoRow, "id" | "nome" | "material" | "tipo_processo" | "lab_apoio_id">;
      const catMap = new Map<string, { id: string; material: string; tipo_processo: string; lab_apoio_id: string | null }>(
        (catRows ?? []).map((c: CatLite) => [c.nome, {
          id: c.id,
          material: c.material || "",
          tipo_processo: c.tipo_processo || "INTERNO",
          lab_apoio_id: c.lab_apoio_id ?? null,
        }]),
      );

      const seqCount = new Map<string, number>();
      const grupoMap = new Map<string, string>();
      const cancelarTudoFlag = updates.statusAtendimento?.label?.toLowerCase().includes("cancel");

      examesPayload = updates.exames.map((nome, idx) => {
        const meta = updates.examesCobranca?.[idx];
        const cat = catMap.get(nome);
        const chave = cat?.id ?? nome.toLowerCase();
        const seq = (seqCount.get(chave) ?? 0) + 1;
        seqCount.set(chave, seq);
        if (!grupoMap.has(chave)) {
          grupoMap.set(chave, meta?.grupoExameId || crypto.randomUUID());
        }
        const tipoProcesso = (meta?.tipoProcesso as string) || cat?.tipo_processo || "INTERNO";
        const labApoioId = tipoProcesso === "TERCEIRIZADO"
          ? (meta?.labApoioId !== undefined ? meta?.labApoioId : (cat?.lab_apoio_id ?? null))
          : null;
        return {
          nome_exame: nome,
          exame_id: cat?.id ?? null,
          material: cat?.material ?? "",
          status: cancelarTudoFlag ? "cancelado" : "pendente",
          valor: Number(meta?.valor) || 0,
          ordem: idx + 1,
          motivo_cancelamento: updates.motivoCancelamento ?? null,
          cobranca_destino: meta?.cobrancaDestino ?? "paciente",
          convenio_cobranca_id: meta?.convenioCobrancaId ?? null,
          amostra_seq: seq,
          grupo_exame_id: grupoMap.get(chave),
          tipo_processo: tipoProcesso,
          lab_apoio_id: labApoioId,
        solicitante: meta?.solicitante ?? "",
        };
      });
    }
  }

  // 4) Pagamentos
  let pagamentosPayload: Array<Record<string, unknown>> | null = null;
  if (updates.pagamentosRealizados !== undefined) {
    pagamentosPayload = updates.pagamentosRealizados.map(p => ({
      tipo: p.tipo,
      valor: p.valor,
      data: brToIso(p.data) ?? new Date().toISOString(),
    }));
  }

  const cancelarTudo = updates.statusAtendimento?.label === "Cancelado";

  // Justificativa de auditoria — sempre enviada. O trigger
  // `require_justificativa_pos_finalizacao` exige texto (≥5 chars) para
  // alterar atendimentos finalizados/cancelados. Quando o caller não passa
  // uma justificativa específica, derivamos uma sensata para o tipo de op.
  let just = (justificativa ?? "").trim();
  if (just.length < 5) {
    if (cancelarTudo) just = `Cancelamento de atendimento${updates.motivoCancelamento ? `: ${updates.motivoCancelamento}` : ""}`;
    else if (pagamentosPayload && !examesPayload && Object.keys(patch).length === 0) just = "Registro de pagamento";
    else just = "Edição de atendimento";
  }

  // 5) Invoca edge function transacional
  try {
    const { data, error } = await supabase.functions.invoke("update-atendimento", {
      body: {
        atendimento_id: id,
        patch: Object.keys(patch).length ? patch : null,
        exames: examesPayload,
        pagamentos: pagamentosPayload,
        cancelar_tudo: cancelarTudo,
        motivo_cancel: updates.motivoCancelamento ?? null,
        justificativa: just,
      },
    });

    const resp = data as AtendimentoTxResponse | null;
    if (error || !resp || resp.ok === false) {
      // ROLLBACK do cache local
      _atendimentos = prev;
      notify();
      throw new Error(
        resp?.error || error?.message || "Falha ao atualizar atendimento",
      );
    }

    // Se cancelou e pagamentos não foram explicitamente reenviados, limpa cache local
    if (cancelarTudo && updates.pagamentosRealizados === undefined) {
      _atendimentos = _atendimentos.map(a =>
        a.protocolo === protocolo ? { ...a, pagamentosRealizados: undefined } : a,
      );
    }
    notify();
  } catch (e) {
    _atendimentos = prev;
    notify();
    throw e;
  }
}

// ============================================================
// Bloco 5a.5 — helpers de RESULTADOS (atendimento_exames.resultados jsonb)
// ============================================================

export type StatusExterno =
  | "NAO_APLICAVEL"
  | "AGUARDANDO_ENVIO"
  | "ENVIADO"
  | "EM_ANALISE_LAB"
  | "RESULTADO_RECEBIDO"
  | "IMPORTADO"
  | "FINALIZADO"
  | "ERRO_INTEGRACAO";

export interface AtendimentoExameRow {
  id: number;
  atendimento_id: number;
  /** UUID do exame no catálogo. Pode ser nulo em rows muito antigas. */
  exame_id: string | null;
  nome_exame: string;
  material: string;
  status: "pendente" | "coletado" | "em_bancada" | "analisado" | "em_analise" | "finalizado" | "cancelado";
  data_coleta: string | null;
  data_analise: string | null;
  data_liberacao: string | null;
  motivo_cancelamento: string | null;
  resultados: Record<string, unknown>;
  ordem: number;
  analista: string;
  /** Solicitante específico deste exame (vazio = todos os solicitantes do atendimento). */
  solicitante: string;
  // Snapshot terceirizado
  tipo_processo: "INTERNO" | "TERCEIRIZADO";
  lab_apoio_id: string | null;
  integracao_ativa: boolean;
  status_externo: StatusExterno;
  protocolo_externo: string | null;
  data_envio: string | null;
  data_retorno: string | null;
  resultado_importado: boolean;
  arquivo_resultado_path: string | null;
  /** Override manual de PDF (laudo do apoio anexado pelo operador). */
  pdf_override_url: string | null;
  pdf_override_uploaded_at?: string | null;
  pdf_override_uploaded_by?: string | null;
  pdf_override_motivo?: string | null;
  /** Snapshot regulatório (RDC 786/2023) — congelado pelo trigger ao salvar/finalizar. */
  metodologia_snapshot?: string | null;
  unidade_snapshot?: string | null;
  /** True quando o exame teve resultado liberado e foi reaberto/editado. */
  retificado?: boolean;
  /** Timestamp ISO da última retificação. */
  retificado_at?: string | null;
}

/**
 * Busca, direto do Supabase, os exames de um atendimento (incluindo a coluna jsonb `resultados`).
 * Use para carregar a tela de resultado/detalhe.
 */
export async function getAtendimentoExamesDB(protocolo: string): Promise<AtendimentoExameRow[]> {
  const id = _idByProtocolo.get(protocolo);
  if (!id) return [];
  const { data, error } = await supabase
    .from("atendimento_exames")
    .select("*")
    .eq("atendimento_id", id)
    .order("ordem", { ascending: true });
  if (error) {
    showError(error, { scope: "atendimentoStore.getAtendimentoExamesDB", silent: true });
    return [];
  }
  // A view sobre atendimento_exames retorna campos compatíveis; assertion
  // necessária porque AtendimentoExameRow é o tipo de domínio (mais estreito
  // em alguns enums) que o tipo gerado do banco.
  return (data ?? []) as unknown as AtendimentoExameRow[];
}

export interface AtendimentoExamePatch {
  status?: "pendente" | "coletado" | "em_bancada" | "analisado" | "em_analise" | "finalizado" | "cancelado";
  resultados?: Record<string, unknown>;
  motivo_cancelamento?: string | null;
  data_coleta?: string | null;
  data_analise?: string | null;
  data_liberacao?: string | null;
  analista?: string;
  retificado?: boolean;
}

/**
 * Atualiza um exame específico (por id da row em atendimento_exames).
 * O trigger no banco recalcula o status do atendimento automaticamente.
 * Após sucesso, refaz a hidratação do cache para refletir o novo status_atendimento.
 */
export async function updateAtendimentoExame(
  exameId: number,
  patch: AtendimentoExamePatch,
  justificativa?: string,
): Promise<{ ok: boolean; error?: string }> {
  // Reaproveita o tipo Update gerado pelo Supabase (jsonb → unknown ok).
  const payload = patch as TablesUpdate<"atendimento_exames">;
  try {
    if (justificativa?.trim()) {
      const { data, error } = await supabase.rpc("update_atendimento_exame_tx" as never, {
        _exame_id: exameId,
        _patch: payload,
        _justificativa: justificativa.trim(),
      } as never);
      if (error) throw error;
      if (!data) throw new Error("exame não encontrado");
    } else {
      await persistOrThrow<AtendimentoExameDbRow>(
        supabase.from("atendimento_exames").update(payload).eq("id", exameId),
        "atendimentos.atualizarExame",
      );
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  // Recarrega o cache para que listas (Resultados, Atendimentos) reflitam novo status_atendimento.
  await _initAtendimentosStore();
  return { ok: true };
}

/**
 * Atribui um mesmo analista a vários exames (linhas em atendimento_exames) de uma vez.
 * Usado pela página /mapa (aba Exame) para registrar quem irá analisar cada exame
 * antes da impressão do mapa de trabalho.
 */
export async function setAnalistaParaExames(
  exameIds: number[],
  analista: string,
): Promise<{ ok: boolean; error?: string }> {
  if (exameIds.length === 0) return { ok: true };
  try {
    await persistOrThrow<AtendimentoExameDbRow>(
      supabase.from("atendimento_exames").update({ analista }).in("id", exameIds),
      "atendimentos.setAnalistaParaExames",
      { expectAtLeast: exameIds.length },
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  await _initAtendimentosStore();
  return { ok: true };
}

// ============================================================
// Bloco 5a.5b — Exames TERCEIRIZADOS (envio/importação)
// ============================================================

export interface TerceirizadoActionResult {
  ok: boolean;
  error?: string;
  protocolo_externo?: string;
  status_externo?: StatusExterno;
}

/** Atualiza diretamente os campos de fluxo terceirizado (status_externo, protocolo, datas, arquivo). */
export async function updateExameTerceirizado(
  exameId: number,
  patch: Partial<{
    status_externo: StatusExterno;
    protocolo_externo: string | null;
    data_envio: string | null;
    data_retorno: string | null;
    data_liberacao: string | null;
    resultado_importado: boolean;
    arquivo_resultado_path: string | null;
    status: "pendente" | "coletado" | "em_analise" | "finalizado" | "cancelado";
  }>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await persistOrThrow<AtendimentoExameDbRow>(
      supabase.from("atendimento_exames").update(patch as TablesUpdate<"atendimento_exames">).eq("id", exameId),
      "atendimentos.updateExameTerceirizado",
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  await _initAtendimentosStore();
  return { ok: true };
}

/** Aciona a edge function `lab-apoio-adapter` para enviar/consultar terceirizados. */
export async function callLabApoioAdapter(
  action: "send" | "fetch",
  exameId: number,
): Promise<TerceirizadoActionResult> {
  const { data, error } = await supabase.functions.invoke("lab-apoio-adapter", {
    body: { action, exame_id: exameId },
  });
  if (error) {
    showError(error, { scope: "atendimentoStore.callLabApoioAdapter" });
    return { ok: false, error: error.message };
  }
  await _initAtendimentosStore();
  return data as TerceirizadoActionResult;
}

// ============================================================
// Bloco 5a.6 — helpers para Coleta + Análise (agrupados por paciente)
// ============================================================

export interface ExameOperacionalRow {
  id: number;                  // id da linha em atendimento_exames
  atendimento_id: number;
  protocolo: string;
  paciente_id: number | null;
  paciente_nome: string;
  paciente_cpf: string;        // CPF (somente dígitos) — usado para resolver telefone
  paciente_sexo: string;       // não persistido; default "M" (não usado nas telas operacionais hoje)
  paciente_nascimento: string; // ISO yyyy-mm-dd
  unidade_id: string;
  responsavel: string;         // analista (vazio se não definido)
  exames: Array<{
    id: number;
    nome: string;
    exame_id: string | null;
    amostra_id: string | null;
    material: string;
    status: "pendente" | "coletado" | "em_bancada" | "analisado" | "em_analise" | "finalizado" | "cancelado";
    data_coleta: string | null;
    data_analise: string | null;
    motivo_cancelamento: string | null;
    updated_at: string | null;
    tipo_processo: "INTERNO" | "TERCEIRIZADO";
    lab_apoio_id: string | null;
  }>;
}

/**
 * Carrega exames de atendimentos cujos exames possuem algum dos statuses dados,
 * agrupando por atendimento (paciente). Usado pelas telas Registrar Coleta / Analisar Amostra.
 */
export async function getExamesOperacionaisByStatus(
  statuses: Array<"pendente" | "coletado" | "em_bancada" | "analisado" | "em_analise" | "finalizado" | "cancelado">,
): Promise<ExameOperacionalRow[]> {
  // Busca todos os exames cujo status esteja nos statuses requeridos
  const { data: exRows, error: exErr } = await supabase
    .from("atendimento_exames")
    .select("*")
    .in("status", statuses)
    .order("ordem", { ascending: true });
  if (exErr) {
    showError(exErr, { scope: "atendimentoStore.getExamesOperacionais.exames", silent: true });
    return [];
  }

  const examesByAt = new Map<number, typeof exRows>();
  (exRows ?? []).forEach(e => {
    const arr = examesByAt.get(e.atendimento_id) ?? [];
    arr.push(e);
    examesByAt.set(e.atendimento_id, arr);
  });

  const atIds = Array.from(examesByAt.keys());
  if (atIds.length === 0) return [];

  const { data: atRows, error: atErr } = await supabase
    .from("atendimentos")
    .select("id, protocolo, paciente_id, paciente_nome, paciente_cpf, paciente_nascimento, unidade_id")
    .in("id", atIds);
  if (atErr) {
    showError(atErr, { scope: "atendimentoStore.getExamesOperacionais.atendimentos", silent: true });
    return [];
  }

  return (atRows ?? []).map(at => {
    const exs = examesByAt.get(at.id) ?? [];
    const responsavel = exs.find(e => e.analista)?.analista ?? "";
    return {
      id: at.id,
      atendimento_id: at.id,
      protocolo: at.protocolo,
      paciente_id: at.paciente_id ?? null,
      paciente_nome: at.paciente_nome,
      paciente_cpf: (at.paciente_cpf ?? "").replace(/\D/g, ""),
      paciente_sexo: "M",
      paciente_nascimento: at.paciente_nascimento ?? "",
      unidade_id: at.unidade_id,
      responsavel,
      exames: exs.map(e => ({
        id: e.id,
        nome: e.nome_exame,
        exame_id: e.exame_id ?? null,
        amostra_id: e.amostra_id ?? null,
        material: e.material || "—",
        status: e.status as "pendente" | "coletado" | "em_bancada" | "analisado" | "em_analise" | "finalizado" | "cancelado",
        data_coleta: e.data_coleta,
        data_analise: e.data_analise,
        motivo_cancelamento: e.motivo_cancelamento,
        updated_at: e.updated_at ?? null,
        tipo_processo: (e.tipo_processo === "TERCEIRIZADO" ? "TERCEIRIZADO" : "INTERNO") as "INTERNO" | "TERCEIRIZADO",
        lab_apoio_id: e.lab_apoio_id ?? null,
      })),
    };
  });
}

// ============================================================
// Bloco 5a.7 — listagem global de exames terceirizados (Lab Apoio)
// ============================================================

export interface TerceirizadoOperacionalRow extends AtendimentoExameRow {
  protocolo: string;
  paciente_nome: string;
  paciente_cpf: string;
  paciente_nascimento: string | null;
  unidade_id: string | null;
}

/**
 * Carrega todos os exames terceirizados do tenant para a página
 * "Laboratórios de Apoio". Faz join leve com atendimento para mostrar
 * paciente/protocolo. Limitado pelos statuses informados (defaults
 * cobrem todo o ciclo, exceto cancelados).
 */
export async function getTerceirizadosOperacional(
  statusExternos?: StatusExterno[],
): Promise<TerceirizadoOperacionalRow[]> {
  let q = supabase
    .from("atendimento_exames")
    .select("*")
    .eq("tipo_processo", "TERCEIRIZADO")
    .neq("status", "cancelado")
    .order("data_envio", { ascending: false, nullsFirst: false });
  if (statusExternos && statusExternos.length > 0) {
    q = q.in("status_externo", statusExternos);
  }
  const { data: exRows, error } = await q;
  if (error) {
    showError(error, { scope: "atendimentoStore.getTerceirizadosOperacional", silent: true });
    return [];
  }
  const rows = (exRows ?? []) as unknown as AtendimentoExameRow[];
  if (rows.length === 0) return [];

  const atIds = Array.from(new Set(rows.map(r => r.atendimento_id)));
  const { data: atRows } = await supabase
    .from("atendimentos")
    .select("id, protocolo, paciente_nome, paciente_cpf, paciente_nascimento, unidade_id")
    .in("id", atIds);

  const atMap = new Map<number, { protocolo: string; paciente_nome: string; paciente_cpf: string; paciente_nascimento: string | null; unidade_id: string | null }>();
  (atRows ?? []).forEach(a => {
    atMap.set(a.id, {
      protocolo: a.protocolo,
      paciente_nome: a.paciente_nome,
      paciente_cpf: (a.paciente_cpf ?? "").replace(/\D/g, ""),
      paciente_nascimento: a.paciente_nascimento ?? null,
      unidade_id: a.unidade_id ?? null,
    });
  });

  return rows.map(r => {
    const at = atMap.get(r.atendimento_id);
    return {
      ...r,
      protocolo: at?.protocolo ?? "—",
      paciente_nome: at?.paciente_nome ?? "—",
      paciente_cpf: at?.paciente_cpf ?? "",
      paciente_nascimento: at?.paciente_nascimento ?? null,
      unidade_id: at?.unidade_id ?? null,
    } as TerceirizadoOperacionalRow;
  });
}

/**
 * Versão paginada de {@link getTerceirizadosOperacional}. Retorna a página
 * solicitada e o total geral (para suportar "Carregar mais" e contadores).
 */
export async function getTerceirizadosOperacionalPaged(opts: {
  limit: number;
  offset: number;
  statusExternos?: StatusExterno[];
}): Promise<{ rows: TerceirizadoOperacionalRow[]; total: number }> {
  const { limit, offset, statusExternos } = opts;
  let q = supabase
    .from("atendimento_exames")
    .select("*", { count: "estimated" })
    .eq("tipo_processo", "TERCEIRIZADO")
    .neq("status", "cancelado")
    .order("data_envio", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);
  if (statusExternos && statusExternos.length > 0) {
    q = q.in("status_externo", statusExternos);
  }
  const { data: exRows, count, error } = await q;
  if (error) {
    showError(error, { scope: "atendimentoStore.getTerceirizadosOperacionalPaged", silent: true });
    return { rows: [], total: 0 };
  }
  const rows = (exRows ?? []) as unknown as AtendimentoExameRow[];
  if (rows.length === 0) return { rows: [], total: count ?? 0 };

  const atIds = Array.from(new Set(rows.map(r => r.atendimento_id)));
  const { data: atRows } = await supabase
    .from("atendimentos")
    .select("id, protocolo, paciente_nome, paciente_cpf, paciente_nascimento, unidade_id")
    .in("id", atIds);

  const atMap = new Map<number, { protocolo: string; paciente_nome: string; paciente_cpf: string; paciente_nascimento: string | null; unidade_id: string | null }>();
  (atRows ?? []).forEach(a => {
    atMap.set(a.id, {
      protocolo: a.protocolo,
      paciente_nome: a.paciente_nome,
      paciente_cpf: (a.paciente_cpf ?? "").replace(/\D/g, ""),
      paciente_nascimento: a.paciente_nascimento ?? null,
      unidade_id: a.unidade_id ?? null,
    });
  });

  return {
    rows: rows.map(r => {
      const at = atMap.get(r.atendimento_id);
      return {
        ...r,
        protocolo: at?.protocolo ?? "—",
        paciente_nome: at?.paciente_nome ?? "—",
        paciente_cpf: at?.paciente_cpf ?? "",
        paciente_nascimento: at?.paciente_nascimento ?? null,
        unidade_id: at?.unidade_id ?? null,
      } as TerceirizadoOperacionalRow;
    }),
    total: count ?? rows.length,
  };
}
