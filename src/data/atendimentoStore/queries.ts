// Read-paths do atendimentoStore (Fase 4 split).
// Comportamento preservado literalmente do arquivo monolítico anterior.

import { db as supabase } from "@/runtime/db";
import { logger } from "@/lib/logger";
import { showError } from "@/lib/showError";
import type { MockAtendimento } from "../types";
import {
  cache, notify,
  buildAtendimento, brToIso,
  ATENDIMENTO_COLS, EXAME_COLS, PAGAMENTO_COLS,
  type AtendimentoRow, type AtendimentoExameDbRow, type AtendimentoPagamentoRow,
} from "./_internal";

// ── Boot: hidrata cache do banco ──
export async function _initAtendimentosStore(): Promise<void> {
  cache.booting = true;
  notify();
  try {
    await _initAtendimentosStoreImpl();
  } finally {
    cache.booting = false;
    cache.booted = true;
    notify();
  }
}

export function isAtendimentosBooting(): boolean {
  return cache.booting;
}
export function hasAtendimentosBooted(): boolean {
  return cache.booted;
}

async function _initAtendimentosStoreImpl(): Promise<void> {
  // Fase D — selects explícitos (sem `*`) e LIMIT no boot.
  // C-1 — Boot adaptativo (legacy=1000 | paginado=100), via localStorage.
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

  cache.idByProtocolo.clear();
  cache.protocoloById.clear();
  cache.atendimentos = atRowsTyped.map((at) => {
    cache.idByProtocolo.set(at.protocolo, at.id);
    cache.protocoloById.set(at.id, at.protocolo);
    return buildAtendimento(at, exMap.get(at.id) ?? [], pgMap.get(at.id) ?? []);
  });
  notify();

  if (atRowsTyped.length === ATENDIMENTOS_BOOT_LIMIT) {
    logger.info("atendimentoStore", "boot atingiu limite", { limit: ATENDIMENTOS_BOOT_LIMIT });
    // C1 — Hidratação progressiva (até 9k extras) DESLIGADA por padrão.
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
// Hidratação progressiva (cursor-based; legacy flag).
// ──────────────────────────────────────────────────────────────────────────
const HYDRATION_BATCH = 500;
const HYDRATION_MAX_TOTAL = 10000;
const HYDRATION_INTERVAL_MS = 400;

let _hydrationRunning = false;
let _hydrationStop = false;

export function stopProgressiveHydration(): void {
  _hydrationStop = true;
}

async function startProgressiveHydration(): Promise<void> {
  if (_hydrationRunning) return;
  _hydrationRunning = true;
  _hydrationStop = false;

  const t0 = performance.now();
  let totalAppended = 0;

  try {
    while (!_hydrationStop && cache.atendimentos.length < HYDRATION_MAX_TOTAL) {
      const last = cache.atendimentos[cache.atendimentos.length - 1];
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

      const novosRows = rows.filter((r) => !cache.protocoloById.has(r.id));
      if (novosRows.length === 0) break;

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

      const built: MockAtendimento[] = [];
      for (const at of novosRows) {
        cache.idByProtocolo.set(at.protocolo, at.id);
        cache.protocoloById.set(at.id, at.protocolo);
        built.push(buildAtendimento(at, exMap.get(at.id) ?? [], pgMap.get(at.id) ?? []));
      }

      // FIX OOM: push in-place (evita pico transitório 2x heap do spread).
      for (let i = 0; i < built.length; i++) cache.atendimentos.push(built[i]);
      totalAppended += built.length;
      notify();

      if (rows.length < HYDRATION_BATCH) break;
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
      total: cache.atendimentos.length,
      ms: Math.round(dt),
      stopped: _hydrationStop,
    });
  }
}

// ── API pública ──
export function getAtendimentos(): MockAtendimento[] {
  return cache.atendimentos;
}

/**
 * C1 — Paginação por cursor (id desc). NÃO afeta o cache global.
 */
export async function fetchAtendimentosPage(opts?: {
  cursorId?: number | null;
  pageSize?: number;
}): Promise<{ items: MockAtendimento[]; nextCursorId: number | null }> {
  const pageSize = Math.min(Math.max(opts?.pageSize ?? 50, 10), 200);

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

  const ids = rows.map((r) => r.id);
  const [{ data: ex }, { data: pg }] = await Promise.all([
    supabase.from("atendimento_exames").select(EXAME_COLS).in("atendimento_id", ids),
    supabase.from("atendimento_pagamentos").select(PAGAMENTO_COLS).in("atendimento_id", ids),
  ]);
  const exMap = new Map<number, AtendimentoExameDbRow[]>();
  ((ex ?? []) as unknown as AtendimentoExameDbRow[]).forEach((e) => {
    const arr = exMap.get(e.atendimento_id) ?? [];
    arr.push(e); exMap.set(e.atendimento_id, arr);
  });
  const pgMap = new Map<number, AtendimentoPagamentoRow[]>();
  ((pg ?? []) as unknown as AtendimentoPagamentoRow[]).forEach((p) => {
    const arr = pgMap.get(p.atendimento_id) ?? [];
    arr.push(p); pgMap.set(p.atendimento_id, arr);
  });

  const items = rows.map((at) => buildAtendimento(at, exMap.get(at.id) ?? [], pgMap.get(at.id) ?? []));
  const nextCursorId = rows.length === pageSize ? rows[rows.length - 1].id : null;
  return { items, nextCursorId };
}

export function subscribe(listener: () => void) {
  cache.listeners.push(listener);
  return () => { cache.listeners = cache.listeners.filter((l) => l !== listener); };
}

/**
 * Recarrega um único atendimento e atualiza o cache local. Usado pelo
 * realtime e como fallback após mutações remotas.
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
      cache.atendimentos = cache.atendimentos.filter((a) => cache.idByProtocolo.get(a.protocolo) !== id);
      for (const [proto, rid] of cache.idByProtocolo.entries()) {
        if (rid === id) cache.idByProtocolo.delete(proto);
      }
      cache.protocoloById.delete(id);
      notify();
      return;
    }

    const built = buildAtendimento(at, exames ?? [], pgs ?? []);
    cache.idByProtocolo.set(at.protocolo, at.id);
    cache.protocoloById.set(at.id, at.protocolo);

    const idx = cache.atendimentos.findIndex((a) => a.protocolo === at.protocolo);
    if (idx >= 0) {
      cache.atendimentos = [
        ...cache.atendimentos.slice(0, idx),
        built,
        ...cache.atendimentos.slice(idx + 1),
      ];
    } else {
      cache.atendimentos = [built, ...cache.atendimentos];
    }
    notify();
  } catch (err) {
    logger.warn("atendimentoStore", "reloadAtendimentoById falhou", {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function getNextProtocolo(): string {
  const year = new Date().getFullYear();
  const prefix = `ATD-${year}-`;
  const nums = cache.atendimentos
    .map((a) => {
      const m = a.protocolo.match(new RegExp(`^ATD-\\d+-(\\d+)$`));
      return m ? parseInt(m[1], 10) : 0;
    });
  const next = Math.max(0, ...nums) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

// ============================================================
// C-2 — Fetchs server-side SEM tocar no cache global.
// ============================================================

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
    cache.idByProtocolo.set(at.protocolo, at.id);
    cache.protocoloById.set(at.id, at.protocolo);
    const built = buildAtendimento(at, exames ?? [], pgs ?? []);
    const idx = cache.atendimentos.findIndex((a) => a.protocolo === at.protocolo);
    if (idx >= 0) {
      cache.atendimentos = [
        ...cache.atendimentos.slice(0, idx),
        built,
        ...cache.atendimentos.slice(idx + 1),
      ];
    } else {
      cache.atendimentos = [built, ...cache.atendimentos];
    }
    notify();
    return built;
  } catch (err) {
    logger.warn("atendimentoStore", "fetchAtendimentoByProtocolo falhou", {
      protocolo,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

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
      cache.idByProtocolo.set(at.protocolo, at.id);
      cache.protocoloById.set(at.id, at.protocolo);
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
