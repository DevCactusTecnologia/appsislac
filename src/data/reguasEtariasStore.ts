/**
 * Réguas etárias — presets reutilizáveis de faixas etárias por parâmetro.
 *
 * Persistência:
 * - Presets de sistema (sys:*): definidos em código, NÃO vão para o banco.
 * - Réguas customizadas: persistidas em `public.reguas_etarias` (multi-tenant via RLS).
 *
 * Escopo por exame (estilo Lareval):
 * - `exame_id IS NULL` → régua global (visível em todos os exames).
 * - `exame_id = <id>`  → régua exclusiva daquele exame.
 *
 * O wrapper público continua aceitando `exameNome` (string) para compat com a UI;
 * a resolução nome ↔ id é feita via `exameCatalogoStore`.
 */

import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/db/tenantResolver";
import { getExamesCatalogo, getExameCatalogoById } from "@/data/exameCatalogoStore";
import { FaixaEtaria, MAX_DIAS, toDias } from "@/lib/idadeFaixas";

export interface ReguaEtaria {
  id: string;
  nome: string;
  /** Presets de fábrica — somente leitura. */
  sistema?: boolean;
  /** Nome do exame de escopo (display). Vazio = global. */
  exameNome?: string;
  /** UUID do exame de escopo. Vazio = global. */
  exameId?: string;
  faixas: FaixaEtaria[];
}

const normalize = (s?: string) => (s ?? "").trim().toLowerCase();

const PRESETS: ReguaEtaria[] = [
  {
    id: "sys:pediatrica-sysmex",
    nome: "Pediátrica Sysmex (5 faixas)",
    sistema: true,
    faixas: [
      { id: "p1", label: "0–3m",       deDias: 0,                            ateDias: toDias(3, "Meses") },
      { id: "p2", label: "3m1d–1a11m", deDias: toDias(3, "Meses") + 1,       ateDias: toDias(2, "Anos") - 1 },
      { id: "p3", label: "2–4a",       deDias: toDias(2, "Anos"),            ateDias: toDias(5, "Anos") - 1 },
      { id: "p4", label: "5–11a",      deDias: toDias(5, "Anos"),            ateDias: toDias(12, "Anos") - 1 },
      { id: "p5", label: "12a+",       deDias: toDias(12, "Anos"),           ateDias: MAX_DIAS },
    ],
  },
  {
    id: "sys:neonatal-detalhada",
    nome: "Neonatal/Pediátrica detalhada (8 faixas)",
    sistema: true,
    faixas: [
      { id: "n1", label: "0–7d",       deDias: 0,                            ateDias: 7 },
      { id: "n2", label: "8d–1m",      deDias: 8,                            ateDias: toDias(1, "Meses") },
      { id: "n3", label: "1m1d–6m",    deDias: toDias(1, "Meses") + 1,       ateDias: toDias(6, "Meses") },
      { id: "n4", label: "6m1d–1a",    deDias: toDias(6, "Meses") + 1,       ateDias: toDias(1, "Anos") },
      { id: "n5", label: "1a1d–3a",    deDias: toDias(1, "Anos") + 1,        ateDias: toDias(3, "Anos") },
      { id: "n6", label: "3a1d–6a",    deDias: toDias(3, "Anos") + 1,        ateDias: toDias(6, "Anos") },
      { id: "n7", label: "6a1d–11a",   deDias: toDias(6, "Anos") + 1,        ateDias: toDias(11, "Anos") },
      { id: "n8", label: "12a+",       deDias: toDias(12, "Anos"),           ateDias: MAX_DIAS },
    ],
  },
  {
    id: "sys:adulto-faixas",
    nome: "Adulto por faixas (4 faixas)",
    sistema: true,
    faixas: [
      { id: "ad1", label: "0–11a",     deDias: 0,                            ateDias: toDias(12, "Anos") - 1 },
      { id: "ad2", label: "12–17a",    deDias: toDias(12, "Anos"),           ateDias: toDias(18, "Anos") - 1 },
      { id: "ad3", label: "18–59a",    deDias: toDias(18, "Anos"),           ateDias: toDias(60, "Anos") - 1 },
      { id: "ad4", label: "60a+",      deDias: toDias(60, "Anos"),           ateDias: MAX_DIAS },
    ],
  },
  {
    id: "sys:ciclo-vida",
    nome: "Ciclo de vida completo (7 faixas)",
    sistema: true,
    faixas: [
      { id: "cv1", label: "0–1m",      deDias: 0,                            ateDias: toDias(1, "Meses") },
      { id: "cv2", label: "1m1d–1a",   deDias: toDias(1, "Meses") + 1,       ateDias: toDias(1, "Anos") },
      { id: "cv3", label: "1a1d–11a",  deDias: toDias(1, "Anos") + 1,        ateDias: toDias(12, "Anos") - 1 },
      { id: "cv4", label: "12–17a",    deDias: toDias(12, "Anos"),           ateDias: toDias(18, "Anos") - 1 },
      { id: "cv5", label: "18–39a",    deDias: toDias(18, "Anos"),           ateDias: toDias(40, "Anos") - 1 },
      { id: "cv6", label: "40–59a",    deDias: toDias(40, "Anos"),           ateDias: toDias(60, "Anos") - 1 },
      { id: "cv7", label: "60a+",      deDias: toDias(60, "Anos"),           ateDias: MAX_DIAS },
    ],
  },
  {
    id: "sys:adulto-unico",
    nome: "Adulto único (1 faixa)",
    sistema: true,
    faixas: [
      { id: "a1", label: "0–150a", deDias: 0, ateDias: MAX_DIAS },
    ],
  },
];

const MIGRATION_FLAG_PREFIX = "sislac:reguas:migrated:";
const LEGACY_STORAGE_PREFIX = "sislac:reguas:";

let cache = new Map<string, ReguaEtaria[]>();
let listeners: Array<() => void> = [];
function notify() { listeners.forEach((fn) => fn()); }

function resolveExameNome(exameId?: string | null): string | undefined {
  if (!exameId) return undefined;
  const ex = getExameCatalogoById(exameId);
  return ex?.nome;
}

function resolveExameId(exameNome?: string): string | undefined {
  if (!exameNome) return undefined;
  const target = normalize(exameNome);
  return getExamesCatalogo().find((e) => normalize(e.nome) === target)?.id;
}

interface DbRegua {
  id: string;
  nome: string;
  exame_id: string | null;
  faixas: FaixaEtaria[];
}

function dbToRegua(row: DbRegua): ReguaEtaria {
  return {
    id: row.id,
    nome: row.nome,
    faixas: Array.isArray(row.faixas) ? row.faixas : [],
    exameId: row.exame_id ?? undefined,
    exameNome: resolveExameNome(row.exame_id),
  };
}

async function fetchCustom(tenantId: string): Promise<ReguaEtaria[]> {
  const { data, error } = await supabase
    .from("reguas_etarias")
    .select("id,nome,exame_id,faixas")
    .eq("tenant_id", tenantId)
    .eq("sistema", false)
    .order("nome");
  if (error) {
    console.warn("[reguasEtariasStore] fetch falhou:", error.message);
    return [];
  }
  return (data ?? []).map(dbToRegua);
}

/** Migração one-shot por tenant: localStorage → tabela. */
async function migrateFromLocalStorage(tenantId: string): Promise<void> {
  const flagKey = `${MIGRATION_FLAG_PREFIX}${tenantId}`;
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(flagKey) === "1") return;
  try {
    const raw = localStorage.getItem(`${LEGACY_STORAGE_PREFIX}${tenantId}`);
    if (!raw) {
      localStorage.setItem(flagKey, "1");
      return;
    }
    const legacy: Array<{ nome: string; faixas: FaixaEtaria[]; exameNome?: string; sistema?: boolean }> = JSON.parse(raw);
    const custom = legacy.filter((r) => !r.sistema);
    if (custom.length > 0) {
      const rows = custom.map((r) => ({
        tenant_id: tenantId,
        nome: r.nome,
        exame_id: resolveExameId(r.exameNome) ?? null,
        faixas: r.faixas,
        sistema: false,
      }));
      const { error } = await supabase.from("reguas_etarias").insert(rows);
      if (error) {
        console.warn("[reguasEtariasStore] migração localStorage falhou:", error.message);
        return; // não marca flag — tenta de novo na próxima carga
      }
    }
    localStorage.setItem(flagKey, "1");
    // limpa storage legado depois de migrar com sucesso
    localStorage.removeItem(`${LEGACY_STORAGE_PREFIX}${tenantId}`);
  } catch (e) {
    console.warn("[reguasEtariasStore] migração abortada:", e);
  }
}

export async function loadReguas(): Promise<ReguaEtaria[]> {
  const tenantId = await getCurrentTenantId();
  await migrateFromLocalStorage(tenantId);
  const custom = await fetchCustom(tenantId);
  const lista = [...PRESETS, ...custom];
  cache.set(tenantId, lista);
  notify();
  return lista;
}

export function getReguas(tenantId?: string): ReguaEtaria[] {
  if (tenantId && cache.has(tenantId)) return cache.get(tenantId)!;
  const first = cache.values().next().value;
  return first ?? [...PRESETS];
}

export function getReguasParaExame(exameNome: string, tenantId?: string): ReguaEtaria[] {
  const target = normalize(exameNome);
  return getReguas(tenantId).filter((r) => {
    const escopo = normalize(r.exameNome);
    return !escopo || escopo === target;
  });
}

export async function addRegua(
  input: Omit<ReguaEtaria, "id" | "sistema" | "exameId"> & { exameNome?: string }
): Promise<ReguaEtaria> {
  const tenantId = await getCurrentTenantId();
  const exameId = resolveExameId(input.exameNome);
  const { data, error } = await supabase
    .from("reguas_etarias")
    .insert({
      tenant_id: tenantId,
      nome: input.nome,
      exame_id: exameId ?? null,
      faixas: input.faixas,
      sistema: false,
    })
    .select("id,nome,exame_id,faixas")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar régua");
  const nova = dbToRegua(data as DbRegua);
  const all = [...PRESETS, ...(await fetchCustom(tenantId))];
  cache.set(tenantId, all);
  notify();
  return nova;
}

export async function updateRegua(
  id: string,
  patch: Partial<Omit<ReguaEtaria, "id" | "sistema" | "exameId">> & { exameNome?: string }
): Promise<boolean> {
  if (id.startsWith("sys:")) return false;
  const tenantId = await getCurrentTenantId();
  const updates: Record<string, unknown> = {};
  if (patch.nome !== undefined) updates.nome = patch.nome;
  if (patch.faixas !== undefined) updates.faixas = patch.faixas;
  if ("exameNome" in patch) updates.exame_id = resolveExameId(patch.exameNome) ?? null;
  const { error } = await supabase.from("reguas_etarias").update(updates).eq("id", id);
  if (error) {
    console.warn("[reguasEtariasStore] update falhou:", error.message);
    return false;
  }
  const all = [...PRESETS, ...(await fetchCustom(tenantId))];
  cache.set(tenantId, all);
  notify();
  return true;
}

export async function removeRegua(id: string): Promise<boolean> {
  if (id.startsWith("sys:")) return false;
  const tenantId = await getCurrentTenantId();
  const { error } = await supabase.from("reguas_etarias").delete().eq("id", id);
  if (error) {
    console.warn("[reguasEtariasStore] remove falhou:", error.message);
    return false;
  }
  const all = [...PRESETS, ...(await fetchCustom(tenantId))];
  cache.set(tenantId, all);
  notify();
  return true;
}

export async function duplicarRegua(id: string, novoNome?: string): Promise<ReguaEtaria | null> {
  const origem = getReguas().find((r) => r.id === id);
  if (!origem) return null;
  return addRegua({
    nome: novoNome ?? `${origem.nome} (cópia)`,
    exameNome: origem.exameNome,
    faixas: origem.faixas.map((f, i) => ({ ...f, id: `f_${Date.now()}_${i}` })),
  });
}

export function subscribeReguas(listener: () => void): () => void {
  listeners.push(listener);
  return () => { listeners = listeners.filter((l) => l !== listener); };
}
