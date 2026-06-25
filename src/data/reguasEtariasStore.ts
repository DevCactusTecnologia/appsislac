/**
 * Réguas etárias — presets reutilizáveis de faixas etárias por parâmetro.
 *
 * Persistência client-only em localStorage namespaced por tenant. Não toca em
 * `valores_referencia` (a régua só dita as colunas da matriz; trocar de régua
 * NÃO reescreve VRs).
 */

import { getCurrentTenantId } from "@/lib/db/tenantResolver";
import { FaixaEtaria, MAX_DIAS, toDias } from "@/lib/idadeFaixas";

export interface ReguaEtaria {
  id: string;
  nome: string;
  /** Réguas de fábrica não podem ser editadas/removidas, só duplicadas. */
  sistema?: boolean;
  /**
   * Quando preenchido, a régua é exclusiva desse exame (estilo Lareval).
   * Quando vazio/undefined, a régua é global (visível em todos os exames).
   * Normalizado em lowercase para casamento case-insensitive.
   */
  exameNome?: string;
  faixas: FaixaEtaria[];
}

const normalizeExame = (s?: string) => (s ?? "").trim().toLowerCase();

const STORAGE_PREFIX = "sislac:reguas:";

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

let cache = new Map<string, ReguaEtaria[]>();
let listeners: Array<() => void> = [];
function notify() { listeners.forEach((fn) => fn()); }

function storageKey(tenantId: string): string {
  return `${STORAGE_PREFIX}${tenantId}`;
}

function loadFromStorage(tenantId: string): ReguaEtaria[] {
  try {
    const raw = localStorage.getItem(storageKey(tenantId));
    const custom: ReguaEtaria[] = raw ? JSON.parse(raw) : [];
    return [...PRESETS, ...custom.filter((r) => !r.sistema)];
  } catch {
    return [...PRESETS];
  }
}

function persistCustom(tenantId: string, all: ReguaEtaria[]): void {
  const custom = all.filter((r) => !r.sistema);
  localStorage.setItem(storageKey(tenantId), JSON.stringify(custom));
}

export async function loadReguas(): Promise<ReguaEtaria[]> {
  const tenantId = await getCurrentTenantId();
  const lista = loadFromStorage(tenantId);
  cache.set(tenantId, lista);
  notify();
  return lista;
}

export function getReguas(tenantId?: string): ReguaEtaria[] {
  if (tenantId && cache.has(tenantId)) return cache.get(tenantId)!;
  // fallback: alguma régua já carregada para outro tenant na mesma sessão
  const first = cache.values().next().value;
  return first ?? [...PRESETS];
}

/**
 * Réguas visíveis para um exame: presets de sistema + globais (sem exameNome)
 * + as específicas desse exame.
 */
export function getReguasParaExame(exameNome: string, tenantId?: string): ReguaEtaria[] {
  const target = normalizeExame(exameNome);
  return getReguas(tenantId).filter((r) => {
    const escopo = normalizeExame(r.exameNome);
    return !escopo || escopo === target;
  });
}

export async function addRegua(input: Omit<ReguaEtaria, "id" | "sistema">): Promise<ReguaEtaria> {
  const tenantId = await getCurrentTenantId();
  const nova: ReguaEtaria = {
    ...input,
    exameNome: normalizeExame(input.exameNome) || undefined,
    id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };
  const all = [...loadFromStorage(tenantId), nova];
  persistCustom(tenantId, all);
  cache.set(tenantId, all);
  notify();
  return nova;
}

export async function updateRegua(id: string, patch: Partial<Omit<ReguaEtaria, "id" | "sistema">>): Promise<boolean> {
  const tenantId = await getCurrentTenantId();
  const all = loadFromStorage(tenantId);
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0 || all[idx].sistema) return false;
  const merged: ReguaEtaria = { ...all[idx], ...patch };
  if ("exameNome" in patch) merged.exameNome = normalizeExame(patch.exameNome) || undefined;
  all[idx] = merged;
  persistCustom(tenantId, all);
  cache.set(tenantId, all);
  notify();
  return true;
}

export async function removeRegua(id: string): Promise<boolean> {
  const tenantId = await getCurrentTenantId();
  const all = loadFromStorage(tenantId);
  const target = all.find((r) => r.id === id);
  if (!target || target.sistema) return false;
  const novos = all.filter((r) => r.id !== id);
  persistCustom(tenantId, novos);
  cache.set(tenantId, novos);
  notify();
  return true;
}

export async function duplicarRegua(id: string, novoNome?: string): Promise<ReguaEtaria | null> {
  const tenantId = await getCurrentTenantId();
  const all = loadFromStorage(tenantId);
  const origem = all.find((r) => r.id === id);
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
