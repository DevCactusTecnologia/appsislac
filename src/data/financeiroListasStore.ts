// Persistência das listas do Financeiro nas 3 tabelas dedicadas:
//  - financeiro_tipos_despesa
//  - financeiro_destinos_pagamento
//  - financeiro_formas_pagamento
//
// Cada item tem: id, nome, sistema (protegido), ativo. Unicidade por (tenant_id, nome).
// Tenant_id é resolvido server-side via RLS — frontend nunca envia.
//
// Substitui o antigo `financeiroCustomListsStore.ts` (que usava app_settings).

import { supabase } from "@/integrations/supabase/client";
import { persistOneOrThrow, persistOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";

export interface ListaItem {
  id: string;
  nome: string;
  sistema: boolean;
  ativo: boolean;
  ordem?: number;
}

type Categoria = "tipo_despesa" | "destino_pagamento" | "forma_pagamento";

const TABLE_BY_CATEGORIA: Record<Categoria, "financeiro_tipos_despesa" | "financeiro_destinos_pagamento" | "financeiro_formas_pagamento"> = {
  tipo_despesa: "financeiro_tipos_despesa",
  destino_pagamento: "financeiro_destinos_pagamento",
  forma_pagamento: "financeiro_formas_pagamento",
};

// Cache + listeners
const _cache: Record<Categoria, ListaItem[]> = {
  tipo_despesa: [],
  destino_pagamento: [],
  forma_pagamento: [],
};
const _listeners = new Set<() => void>();
const _emit = () => _listeners.forEach((fn) => { try { fn(); } catch (e) { showError(e, { scope: "financeiroListas.listener", silent: true }); } });

async function getCurrentTenantId(): Promise<string | null> {
  const { data, error } = await supabase.rpc("current_tenant_id");
  if (error) {
    showError(error, { scope: "financeiroListas.currentTenant", silent: true });
    return null;
  }
  return (data as string | null) ?? null;
}

async function loadCategoria(cat: Categoria): Promise<ListaItem[]> {
  if (cat === "forma_pagamento") {
    const { data, error } = await supabase
      .from("financeiro_formas_pagamento")
      .select("id, nome, sistema, ativo, ordem")
      .eq("ativo", true)
      .order("ordem", { ascending: true });
    if (error) { showError(error, { scope: `financeiroListas.load.${cat}`, silent: true }); return []; }
    return (data ?? []).map((r) => ({ id: r.id, nome: r.nome, sistema: r.sistema, ativo: r.ativo, ordem: r.ordem }));
  }
  const table = TABLE_BY_CATEGORIA[cat] as "financeiro_tipos_despesa" | "financeiro_destinos_pagamento";
  const { data, error } = await supabase
    .from(table)
    .select("id, nome, sistema, ativo")
    .eq("ativo", true)
    .order("nome", { ascending: true });
  if (error) { showError(error, { scope: `financeiroListas.load.${cat}`, silent: true }); return []; }
  return (data ?? []).map((r) => ({ id: r.id, nome: r.nome, sistema: r.sistema, ativo: r.ativo }));
}

export async function reloadAll(): Promise<void> {
  const [tipos, destinos, formas] = await Promise.all([
    loadCategoria("tipo_despesa"),
    loadCategoria("destino_pagamento"),
    loadCategoria("forma_pagamento"),
  ]);
  _cache.tipo_despesa = tipos;
  _cache.destino_pagamento = destinos;
  _cache.forma_pagamento = formas;
  _emit();
}

export function getTiposDespesa(): ListaItem[] { return _cache.tipo_despesa; }
export function getDestinosPagamento(): ListaItem[] { return _cache.destino_pagamento; }
export function getFormasPagamento(): ListaItem[] { return _cache.forma_pagamento; }

export function subscribeListas(listener: () => void): () => void {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}

const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

export function nomeJaExiste(cat: Categoria, nome: string): boolean {
  const n = normalize(nome);
  return _cache[cat].some((item) => normalize(item.nome) === n);
}

/**
 * Cria um novo item na categoria. Retorna o item criado (do cache) ou lança erro.
 * Valida duplicidade (case/acentos insensíveis) localmente antes de chamar o backend.
 */
export async function createItem(cat: Categoria, nome: string): Promise<ListaItem> {
  const trimmed = nome.trim();
  if (!trimmed) throw new Error("Nome obrigatório");
  if (nomeJaExiste(cat, trimmed)) throw new Error("Já existe um item com este nome");

  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error("Tenant não encontrado");

  const table = TABLE_BY_CATEGORIA[cat];
  let data: { id: string; nome: string; sistema: boolean; ativo: boolean };
  try {
    data = await persistOneOrThrow(
      supabase
        .from(table)
        .insert({ tenant_id: tenantId, nome: trimmed, sistema: false } as never),
      `financeiroListas.create.${cat}`,
      { selectCols: "id, nome, sistema, ativo" },
    );
  } catch (error) {
    const code = (error as { cause?: { code?: string } }).cause?.code;
    if (code === "23505") throw new Error("Já existe um item com este nome");
    showError(error, { scope: `financeiroListas.create.${cat}`, userMessage: "Não foi possível criar o item." });
    throw error;
  }

  const novo: ListaItem = { id: data.id, nome: data.nome, sistema: data.sistema, ativo: data.ativo };
  _cache[cat] = [..._cache[cat], novo].sort((a, b) => a.nome.localeCompare(b.nome));
  _emit();
  return novo;
}

/**
 * Remove um item (soft delete via RLS: `sistema=true` é bloqueado pelo trigger).
 */
export async function deleteItem(cat: Categoria, id: string): Promise<void> {
  const item = _cache[cat].find((x) => x.id === id);
  if (!item) return;
  if (item.sistema) throw new Error("Itens do sistema não podem ser excluídos");

  const table = TABLE_BY_CATEGORIA[cat];
  // Optimistic
  const prev = _cache[cat];
  _cache[cat] = prev.filter((x) => x.id !== id);
  _emit();

  try {
    await persistOrThrow(
      supabase.from(table).delete().eq("id", id),
      `financeiroListas.delete.${cat}`,
    );
  } catch (error) {
    _cache[cat] = prev;
    _emit();
    showError(error, { scope: `financeiroListas.delete.${cat}`, userMessage: "Não foi possível excluir o item." });
    throw error;
  }
}

/** Inicialização no boot (chamada pelo storeBoot). */
export async function _initFinanceiroListasStore(): Promise<void> {
  await reloadAll();
}
