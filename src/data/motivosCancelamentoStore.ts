// Persistência dos Motivos de Cancelamento (tabela `motivos_cancelamento`).
// Itens com `sistema=true` não podem ser renomeados nem excluídos (trigger no DB).
// Tenant_id resolvido server-side via RLS.

import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "./_tenant";
import { persistOneOrThrow, persistOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";

export interface MotivoCancelamento {
  id: string;
  nome: string;
  ativo: boolean;
  sistema: boolean;
  ordem: number;
}

let _cache: MotivoCancelamento[] = [];
let _loaded = false;
const _listeners = new Set<() => void>();
const _emit = () => _listeners.forEach((fn) => { try { fn(); } catch (e) { showError(e, { scope: "motivosCancelamento.listener", silent: true }); } });

function sortItems(list: MotivoCancelamento[]): MotivoCancelamento[] {
  return [...list].sort((a, b) => {
    if (a.ordem !== b.ordem) return a.ordem - b.ordem;
    return a.nome.localeCompare(b.nome);
  });
}

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

export async function loadMotivosCancelamento(): Promise<void> {
  const { data, error } = await supabase
    .from("motivos_cancelamento")
    .select("id, nome, ativo, sistema, ordem")
    .order("ordem", { ascending: true });
  if (error) {
    showError(error, { scope: "motivosCancelamento.load", silent: true });
    return;
  }
  _cache = sortItems(
    (data ?? []).map((r) => ({
      id: r.id,
      nome: r.nome,
      ativo: r.ativo,
      sistema: r.sistema,
      ordem: r.ordem,
    })),
  );
  _loaded = true;
  _emit();
}

export function getMotivosCancelamento(): MotivoCancelamento[] {
  return _cache;
}

/** Apenas ativos — para uso nos diálogos de cancelamento operacionais. */
export function getMotivosCancelamentoAtivos(): MotivoCancelamento[] {
  return _cache.filter((m) => m.ativo);
}

export function isMotivosCancelamentoLoaded(): boolean {
  return _loaded;
}

export function subscribeMotivosCancelamento(listener: () => void): () => void {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}

export function nomeMotivoJaExiste(nome: string, ignoreId?: string): boolean {
  const n = normalize(nome);
  return _cache.some((m) => normalize(m.nome) === n && m.id !== ignoreId);
}

export async function addMotivoCancelamento(nome: string): Promise<MotivoCancelamento | null> {
  const trimmed = nome.trim();
  if (!trimmed) return null;
  if (nomeMotivoJaExiste(trimmed)) return null;

  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;

  const nextOrdem = _cache.length > 0 ? Math.max(..._cache.map((m) => m.ordem)) + 1 : 1;

  let data: { id: string; nome: string; ativo: boolean; sistema: boolean; ordem: number };
  try {
    data = await persistOneOrThrow(
      supabase
        .from("motivos_cancelamento")
        .insert({ tenant_id: tenantId, nome: trimmed, sistema: false, ordem: nextOrdem }),
      "motivosCancelamento.add",
      { selectCols: "id, nome, ativo, sistema, ordem" },
    );
  } catch (error) {
    showError(error, { scope: "motivosCancelamento.add", userMessage: "Não foi possível adicionar o motivo." });
    return null;
  }

  const novo: MotivoCancelamento = {
    id: data.id,
    nome: data.nome,
    ativo: data.ativo,
    sistema: data.sistema,
    ordem: data.ordem,
  };
  _cache = sortItems([..._cache, novo]);
  _emit();
  return novo;
}

export async function renameMotivoCancelamento(id: string, novoNome: string): Promise<boolean> {
  const item = _cache.find((m) => m.id === id);
  if (!item) return false;
  if (item.sistema) return false;
  const trimmed = novoNome.trim();
  if (!trimmed) return false;
  if (trimmed === item.nome) return true;
  if (nomeMotivoJaExiste(trimmed, id)) return false;

  const prev = _cache;
  _cache = sortItems(_cache.map((m) => (m.id === id ? { ...m, nome: trimmed } : m)));
  _emit();

  try {
    await persistOrThrow(
      supabase.from("motivos_cancelamento").update({ nome: trimmed }).eq("id", id),
      "motivosCancelamento.rename",
    );
    return true;
  } catch (error) {
    _cache = prev;
    _emit();
    showError(error, { scope: "motivosCancelamento.rename", userMessage: "Não foi possível renomear o motivo." });
    return false;
  }
}

export async function toggleMotivoCancelamento(id: string): Promise<boolean> {
  const item = _cache.find((m) => m.id === id);
  if (!item) return false;
  const novoAtivo = !item.ativo;

  const prev = _cache;
  _cache = _cache.map((m) => (m.id === id ? { ...m, ativo: novoAtivo } : m));
  _emit();

  try {
    await persistOrThrow(
      supabase.from("motivos_cancelamento").update({ ativo: novoAtivo }).eq("id", id),
      "motivosCancelamento.toggle",
    );
    return true;
  } catch (error) {
    _cache = prev;
    _emit();
    showError(error, { scope: "motivosCancelamento.toggle", userMessage: "Não foi possível alternar o motivo." });
    return false;
  }
}

export async function removeMotivoCancelamento(id: string): Promise<boolean> {
  const item = _cache.find((m) => m.id === id);
  if (!item) return false;
  if (item.sistema) return false;

  const prev = _cache;
  _cache = _cache.filter((m) => m.id !== id);
  _emit();

  try {
    await persistOrThrow(
      supabase.from("motivos_cancelamento").delete().eq("id", id),
      "motivosCancelamento.remove",
    );
    return true;
  } catch (error) {
    _cache = prev;
    _emit();
    showError(error, { scope: "motivosCancelamento.remove", userMessage: "Não foi possível excluir o motivo." });
    return false;
  }
}

/** Boot: chamado no startup. */
export async function _initMotivosCancelamentoStore(): Promise<void> {
  await loadMotivosCancelamento();
}
