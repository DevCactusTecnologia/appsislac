// Realtime do atendimentoStore (Fase 4 split).
// Filtro server-side por tenant_id + dedupe local + coalescing de reloads.

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { getCurrentTenantId } from "../_tenant";
import { reloadAtendimentoById } from "./queries";

let _realtimeInstalled = false;
let _pendingReloads = new Set<number>();
let _reloadTimer: ReturnType<typeof setTimeout> | null = null;
let _realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let _realtimeTenantId: string | null = null;

const _lastSeen = new Map<string, number>();
const _DEDUPE_MS = 200;

function shouldSkip(key: string): boolean {
  const now = Date.now();
  const prev = _lastSeen.get(key);
  if (prev && now - prev < _DEDUPE_MS) return true;
  _lastSeen.set(key, now);
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
 * Idempotente.
 */
export function installAtendimentosRealtime(tenantId?: string | null): void {
  if (_realtimeInstalled) return;

  const open = (tid: string) => {
    if (_realtimeInstalled) return;
    _realtimeInstalled = true;
    _realtimeTenantId = tid;

    const channel = supabase.channel(`atendimentos-store:${tid}`);
    _realtimeChannel = channel;

    const handle = (table: string, idKey: "id" | "atendimento_id") =>
      (payload: { new?: Record<string, unknown> | null; old?: Record<string, unknown> | null; eventType?: string }) => {
        const row = (payload.new ?? payload.old) as Record<string, unknown> | null;
        if (!row) return;
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
  void getCurrentTenantId()
    .then((tid) => { if (tid) open(tid); })
    .catch((err) => logger.warn("atendimentoStore", "realtime: falha ao resolver tenant", { error: (err as Error)?.message }));
}

/** Idempotente. Chamado em logout / troca de usuário pelo storeBoot. */
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
