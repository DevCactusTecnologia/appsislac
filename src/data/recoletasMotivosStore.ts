// Store de motivos de recoleta (`recoletas_motivos`).
// Itens com sistema=true não podem ser renomeados nem excluídos (trigger no DB).

import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/db/tenantResolver";
import { persistOneOrThrow, persistOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";

export interface RecoletaMotivo {
  id: string;
  nome: string;
  ativo: boolean;
  sistema: boolean;
  ordem: number;
}

let _cache: RecoletaMotivo[] = [];
let _loaded = false;
const _listeners = new Set<() => void>();
const _emit = () => _listeners.forEach((fn) => { try { fn(); } catch (e) { showError(e, { scope: "recoletasMotivos.listener", silent: true }); } });

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

function sortItems(list: RecoletaMotivo[]): RecoletaMotivo[] {
  return [...list].sort((a, b) => {
    if (a.ordem !== b.ordem) return a.ordem - b.ordem;
    return a.nome.localeCompare(b.nome);
  });
}

export async function loadRecoletasMotivos(): Promise<void> {
  const { data, error } = await supabase
    .from("recoletas_motivos")
    .select("id, nome, ativo, sistema, ordem")
    .order("ordem", { ascending: true });
  if (error) {
    showError(error, { scope: "recoletasMotivos.load", silent: true });
    return;
  }
  _cache = sortItems((data ?? []).map((r) => ({
    id: r.id, nome: r.nome, ativo: r.ativo, sistema: r.sistema, ordem: r.ordem,
  })));
  _loaded = true;
  _emit();
}

export function getRecoletasMotivos(): RecoletaMotivo[] { return _cache; }
export function getRecoletasMotivosAtivos(): RecoletaMotivo[] { return _cache.filter((m) => m.ativo); }
export function isRecoletasMotivosLoaded(): boolean { return _loaded; }
export function subscribeRecoletasMotivos(listener: () => void): () => void {
  _listeners.add(listener); return () => { _listeners.delete(listener); };
}
export function nomeRecoletaMotivoJaExiste(nome: string, ignoreId?: string): boolean {
  const n = normalize(nome);
  return _cache.some((m) => normalize(m.nome) === n && m.id !== ignoreId);
}

export async function addRecoletaMotivo(nome: string): Promise<RecoletaMotivo | null> {
  const trimmed = nome.trim();
  if (!trimmed || nomeRecoletaMotivoJaExiste(trimmed)) return null;
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;
  const nextOrdem = _cache.length > 0 ? Math.max(..._cache.map((m) => m.ordem)) + 1 : 1;
  let data: { id: string; nome: string; ativo: boolean; sistema: boolean; ordem: number };
  try {
    data = await persistOneOrThrow(
      supabase.from("recoletas_motivos").insert({ tenant_id: tenantId, nome: trimmed, sistema: false, ordem: nextOrdem }),
      "recoletasMotivos.add",
      { selectCols: "id, nome, ativo, sistema, ordem" },
    );
  } catch (error) {
    showError(error, { scope: "recoletasMotivos.add", userMessage: "Não foi possível adicionar o motivo de recoleta." });
    return null;
  }
  const novo: RecoletaMotivo = {
    id: data.id, nome: data.nome, ativo: data.ativo, sistema: data.sistema, ordem: data.ordem,
  };
  _cache = sortItems([..._cache, novo]);
  _emit();
  return novo;
}

export async function renameRecoletaMotivo(id: string, novoNome: string): Promise<boolean> {
  const item = _cache.find((m) => m.id === id);
  if (!item || item.sistema) return false;
  const trimmed = novoNome.trim();
  if (!trimmed || trimmed === item.nome) return !!trimmed;
  if (nomeRecoletaMotivoJaExiste(trimmed, id)) return false;
  const prev = _cache;
  _cache = sortItems(_cache.map((m) => (m.id === id ? { ...m, nome: trimmed } : m)));
  _emit();
  try {
    await persistOrThrow(
      supabase.from("recoletas_motivos").update({ nome: trimmed }).eq("id", id),
      "recoletasMotivos.rename",
    );
    return true;
  } catch (error) {
    _cache = prev; _emit();
    showError(error, { scope: "recoletasMotivos.rename", userMessage: "Não foi possível renomear o motivo." });
    return false;
  }
}

export async function toggleRecoletaMotivo(id: string): Promise<boolean> {
  const item = _cache.find((m) => m.id === id);
  if (!item) return false;
  const novo = !item.ativo;
  const prev = _cache;
  _cache = _cache.map((m) => (m.id === id ? { ...m, ativo: novo } : m));
  _emit();
  try {
    await persistOrThrow(
      supabase.from("recoletas_motivos").update({ ativo: novo }).eq("id", id),
      "recoletasMotivos.toggle",
    );
    return true;
  } catch (error) {
    _cache = prev; _emit();
    showError(error, { scope: "recoletasMotivos.toggle", userMessage: "Não foi possível alternar o motivo." });
    return false;
  }
}

export async function removeRecoletaMotivo(id: string): Promise<boolean> {
  const item = _cache.find((m) => m.id === id);
  if (!item || item.sistema) return false;
  const prev = _cache;
  _cache = _cache.filter((m) => m.id !== id);
  _emit();
  try {
    await persistOrThrow(
      supabase.from("recoletas_motivos").delete().eq("id", id),
      "recoletasMotivos.remove",
    );
    return true;
  } catch (error) {
    _cache = prev; _emit();
    showError(error, { scope: "recoletasMotivos.remove", userMessage: "Não foi possível excluir o motivo." });
    return false;
  }
}

export async function _initRecoletasMotivosStore(): Promise<void> {
  await loadRecoletasMotivos();
}
