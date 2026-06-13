// Persistência das listas do Financeiro — agora apoiada na tabela canônica
// `select_options` (categorias `financeiro_tipo_despesa`, `financeiro_destino_pagamento`,
// `financeiro_forma_pagamento`).
//
// As tabelas legadas (`financeiro_tipos_despesa`, `financeiro_destinos_pagamento`,
// `financeiro_formas_pagamento`) permanecem populadas pelos triggers
// `trg_fwd_*` (sincronia 1:1) até serem removidas em migração final. Este
// store NÃO escreve mais nelas.
//
// API externa preservada: getTiposDespesa/getDestinosPagamento/getFormasPagamento,
// subscribeListas, createItem, deleteItem, reloadAll, _initFinanceiroListasStore.
// `ListaItem.id` agora é o `select_options.id` (uuid).
//
// Permissões: RLS de `select_options` já exige `has_permission('gestao_financeira')`
// para estas categorias (ver migration 20260613_select_options_per_category_rls).

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

const CATEGORIA_DB: Record<Categoria, string> = {
  tipo_despesa: "financeiro_tipo_despesa",
  destino_pagamento: "financeiro_destino_pagamento",
  forma_pagamento: "financeiro_forma_pagamento",
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
  const orderByOrdem = cat === "forma_pagamento";
  let req = supabase
    .from("select_options")
    .select("id, label, sistema, ativo, ordem")
    .eq("categoria", CATEGORIA_DB[cat])
    .eq("ativo", true);
  req = orderByOrdem
    ? req.order("ordem", { ascending: true })
    : req.order("label", { ascending: true });
  const { data, error } = await req;
  if (error) { showError(error, { scope: `financeiroListas.load.${cat}`, silent: true }); return []; }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    nome: r.label as string,
    sistema: !!r.sistema,
    ativo: !!r.ativo,
    ordem: typeof r.ordem === "number" ? r.ordem : undefined,
  }));
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
 * Cria um novo item na categoria. Retorna o item criado ou lança erro.
 * Valida duplicidade (case/acentos insensíveis) localmente antes do backend.
 */
export async function createItem(cat: Categoria, nome: string): Promise<ListaItem> {
  const trimmed = nome.trim();
  if (!trimmed) throw new Error("Nome obrigatório");
  if (nomeJaExiste(cat, trimmed)) throw new Error("Já existe um item com este nome");

  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error("Tenant não encontrado");

  const categoriaDb = CATEGORIA_DB[cat];
  // `valor` deve ser estável; usamos o nome normalizado como chave.
  const valor = normalize(trimmed).replace(/\s+/g, "_");
  const nextOrdem = _cache[cat].length > 0
    ? Math.max(..._cache[cat].map((i) => i.ordem ?? 0)) + 1
    : 1;

  let data: { id: string; label: string; sistema: boolean; ativo: boolean; ordem: number };
  try {
    data = await persistOneOrThrow(
      supabase
        .from("select_options")
        .insert({
          tenant_id: tenantId,
          categoria: categoriaDb,
          valor,
          label: trimmed,
          ordem: nextOrdem,
          sistema: false,
        }),
      `financeiroListas.create.${cat}`,
      { selectCols: "id, label, sistema, ativo, ordem" },
    );
  } catch (error) {
    const code = (error as { cause?: { code?: string } }).cause?.code;
    if (code === "23505") throw new Error("Já existe um item com este nome");
    showError(error, { scope: `financeiroListas.create.${cat}`, userMessage: "Não foi possível criar o item." });
    throw error;
  }

  const novo: ListaItem = { id: data.id, nome: data.label, sistema: data.sistema, ativo: data.ativo, ordem: data.ordem };
  _cache[cat] = [..._cache[cat], novo].sort((a, b) => a.nome.localeCompare(b.nome));
  _emit();
  return novo;
}

/**
 * Remove um item. Itens `sistema=true` continuam protegidos no DB (RLS/trigger
 * de select_options).
 */
export async function deleteItem(cat: Categoria, id: string): Promise<void> {
  const item = _cache[cat].find((x) => x.id === id);
  if (!item) return;
  if (item.sistema) throw new Error("Itens do sistema não podem ser excluídos");

  // Optimistic
  const prev = _cache[cat];
  _cache[cat] = prev.filter((x) => x.id !== id);
  _emit();

  try {
    await persistOrThrow(
      supabase.from("select_options").delete().eq("id", id),
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
