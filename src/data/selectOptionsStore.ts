// ──────────────────────────────────────────────────────────────────────────
// Store genérica para opções de selects configuráveis (`select_options`).
//
// 🔒 GLOBAL DICTIONARIES — DEFINIÇÃO ARQUITETURAL OFICIAL (intencional):
//   `tenant_id IS NULL` em `select_options` representa um *dicionário global
//   compartilhado da plataforma* (ex.: tipos sanguíneos, estados, cidades,
//   classificações universais, tabelas SUS, opções globais imutáveis).
//   A RLS (`tenant_id IS NULL OR tenant_id = current_tenant_id()`) é
//   intencional e segura: dados globais são read-only para todos os tenants.
//
// 🚨 REGRA INVIOLÁVEL:
//   Dados OPERACIONAIS de tenant (atendimentos, pacientes, financeiro, etc.)
//   NUNCA devem usar `tenant_id = NULL`. Esse padrão é EXCLUSIVO desta tabela
//   de dicionários e de catálogos compartilhados explicitamente declarados.
//
// Tenant overrides: um tenant pode inserir uma opção com o mesmo `valor` e
// `tenant_id` próprio para sobrescrever um item global (ver `mergeRows`).
// ──────────────────────────────────────────────────────────────────────────

import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "./_tenant";
import { persistOneOrThrow, persistOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";

export interface SelectOption {
  id: string;
  tenantId: string | null;
  categoria: string;
  valor: string;
  label: string;
  ordem: number;
  ativo: boolean;
  sistema: boolean;
}

const _cacheByCategoria = new Map<string, SelectOption[]>();
const _loaded = new Set<string>();
const _listeners = new Map<string, Set<() => void>>();

function _emit(categoria: string) {
  const set = _listeners.get(categoria);
  if (!set) return;
  set.forEach((fn) => {
    try { fn(); } catch (e) { showError(e, { scope: "selectOptions.listener", silent: true }); }
  });
}

function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

/** Mescla globais + tenant: tenant override (mesmo `valor`) tem prioridade. */
function mergeRows(rows: SelectOption[]): SelectOption[] {
  const byValor = new Map<string, SelectOption>();
  // Globais primeiro
  for (const r of rows.filter((x) => x.tenantId === null)) {
    byValor.set(normalize(r.valor), r);
  }
  // Tenant sobrescreve
  for (const r of rows.filter((x) => x.tenantId !== null)) {
    byValor.set(normalize(r.valor), r);
  }
  return [...byValor.values()].sort((a, b) => {
    if (a.ordem !== b.ordem) return a.ordem - b.ordem;
    return a.label.localeCompare(b.label);
  });
}

function mapRow(r: any): SelectOption {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    categoria: r.categoria,
    valor: r.valor,
    label: r.label,
    ordem: r.ordem,
    ativo: r.ativo,
    sistema: r.sistema,
  };
}

export async function loadSelectOptions(categoria: string): Promise<void> {
  const { data, error } = await supabase
    .from("select_options")
    .select("id, tenant_id, categoria, valor, label, ordem, ativo, sistema")
    .eq("categoria", categoria)
    .order("ordem", { ascending: true });
  if (error) {
    showError(error, { scope: `selectOptions.load(${categoria})`, silent: true });
    return;
  }
  _cacheByCategoria.set(categoria, mergeRows((data ?? []).map(mapRow)));
  _loaded.add(categoria);
  _emit(categoria);
}

export function getSelectOptions(categoria: string): SelectOption[] {
  return _cacheByCategoria.get(categoria) ?? [];
}

export function getSelectOptionsAtivas(categoria: string): SelectOption[] {
  return (_cacheByCategoria.get(categoria) ?? []).filter((o) => o.ativo);
}

export function isSelectOptionsLoaded(categoria: string): boolean {
  return _loaded.has(categoria);
}

export function subscribeSelectOptions(categoria: string, listener: () => void): () => void {
  let set = _listeners.get(categoria);
  if (!set) { set = new Set(); _listeners.set(categoria, set); }
  set.add(listener);
  return () => { set!.delete(listener); };
}

/** Garante que a categoria esteja carregada — usar antes de exibir UI. */
export async function ensureSelectOptions(categoria: string): Promise<SelectOption[]> {
  if (!_loaded.has(categoria)) await loadSelectOptions(categoria);
  return getSelectOptionsAtivas(categoria);
}

// ============================================================
// CRUD (admin do tenant)
// ============================================================

function valorJaExiste(categoria: string, valor: string, ignoreId?: string): boolean {
  const n = normalize(valor);
  return (_cacheByCategoria.get(categoria) ?? []).some(
    (o) => normalize(o.valor) === n && o.id !== ignoreId,
  );
}

export async function addSelectOption(input: {
  categoria: string;
  valor: string;
  label: string;
  ordem?: number;
}): Promise<SelectOption | null> {
  const valor = input.valor.trim();
  const label = input.label.trim();
  if (!valor || !label || valorJaExiste(input.categoria, valor)) return null;
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;
  const cache = _cacheByCategoria.get(input.categoria) ?? [];
  const nextOrdem =
    input.ordem ??
    (cache.length > 0 ? Math.max(...cache.map((o) => o.ordem)) + 1 : 1);
  try {
    const data = await persistOneOrThrow(
      supabase.from("select_options").insert({
        tenant_id: tenantId,
        categoria: input.categoria,
        valor,
        label,
        ordem: nextOrdem,
        sistema: false,
      }),
      "selectOptions.add",
      { selectCols: "id, tenant_id, categoria, valor, label, ordem, ativo, sistema" },
    );
    await loadSelectOptions(input.categoria);
    return mapRow(data);
  } catch (error) {
    showError(error, { scope: "selectOptions.add", userMessage: "Não foi possível adicionar a opção." });
    return null;
  }
}

export async function updateSelectOptionLabel(id: string, novoLabel: string): Promise<boolean> {
  const trimmed = novoLabel.trim();
  if (!trimmed) return false;
  // localiza categoria afetada
  let categoria: string | null = null;
  for (const [cat, list] of _cacheByCategoria) {
    if (list.some((o) => o.id === id)) { categoria = cat; break; }
  }
  try {
    await persistOrThrow(
      supabase.from("select_options").update({ label: trimmed }).eq("id", id),
      "selectOptions.updateLabel",
    );
    if (categoria) await loadSelectOptions(categoria);
    return true;
  } catch (error) {
    showError(error, { scope: "selectOptions.updateLabel", userMessage: "Não foi possível renomear." });
    return false;
  }
}

export async function toggleSelectOption(id: string): Promise<boolean> {
  let categoria: string | null = null;
  let atual: SelectOption | undefined;
  for (const [cat, list] of _cacheByCategoria) {
    const f = list.find((o) => o.id === id);
    if (f) { categoria = cat; atual = f; break; }
  }
  if (!atual) return false;
  try {
    await persistOrThrow(
      supabase.from("select_options").update({ ativo: !atual.ativo }).eq("id", id),
      "selectOptions.toggle",
    );
    if (categoria) await loadSelectOptions(categoria);
    return true;
  } catch (error) {
    showError(error, { scope: "selectOptions.toggle", userMessage: "Não foi possível alternar." });
    return false;
  }
}

export async function reorderSelectOption(id: string, ordem: number): Promise<boolean> {
  let categoria: string | null = null;
  for (const [cat, list] of _cacheByCategoria) {
    if (list.some((o) => o.id === id)) { categoria = cat; break; }
  }
  try {
    await persistOrThrow(
      supabase.from("select_options").update({ ordem }).eq("id", id),
      "selectOptions.reorder",
    );
    if (categoria) await loadSelectOptions(categoria);
    return true;
  } catch (error) {
    showError(error, { scope: "selectOptions.reorder", userMessage: "Não foi possível reordenar." });
    return false;
  }
}

export async function removeSelectOption(id: string): Promise<boolean> {
  let categoria: string | null = null;
  for (const [cat, list] of _cacheByCategoria) {
    if (list.some((o) => o.id === id)) { categoria = cat; break; }
  }
  try {
    await persistOrThrow(
      supabase.from("select_options").delete().eq("id", id),
      "selectOptions.remove",
    );
    if (categoria) await loadSelectOptions(categoria);
    return true;
  } catch (error) {
    showError(error, { scope: "selectOptions.remove", userMessage: "Não foi possível excluir." });
    return false;
  }
}

// Categorias conhecidas, expostas para evitar typos espalhados pelo código.
export const SELECT_CATEGORIAS = {
  CANAIS_COMUNICACAO: "canais_comunicacao",
} as const;