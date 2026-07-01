// Store centralizado de tabelas de preço — backed by Supabase com cache síncrono.
// Modelo novo: exame_id é a fonte de verdade. nome_exame/codigoExame ficam como cache derivado.

import { db as supabase } from "@/runtime/db";
import { getCurrentTenantId } from "@/runtime/db";
import { getExameCatalogoById, getExamesCatalogo } from "./exameCatalogoStore";
import { persistOneOrThrow, persistOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";

export type TabelaTipo = "CBHPM" | "TUSS" | "Própria";

export interface ItemTabelaPreco {
  id: number;
  exameId: string;          // FK -> exames_catalogo.id (fonte de verdade)
  tabela: TabelaTipo;
  codigoExame: string;      // derivado do catálogo em runtime (não persistido)
  nomeExame: string;        // derivado do catálogo em runtime (não persistido)
  valor: number;
  porte: string;            // derivado do catálogo em runtime (não persistido)
  ativo: boolean;
  /** true quando exameId não foi encontrado em exames_catalogo (referência órfã). */
  orfao: boolean;
}

/** Texto exibido em qualquer UI quando o exame referenciado não existe mais. */
const ORFAO_NOME_LABEL = "⚠ Exame não encontrado no catálogo";

let itens: ItemTabelaPreco[] = [];
let _listeners: Array<() => void> = [];
function notify() { _listeners.forEach((fn) => fn()); }

function codigoFromCatalogo(exame: { mnemonico: string; codigoCBHPM: string; codigoTUSS: string } | null | undefined, tabela: TabelaTipo): string {
  if (!exame) return "";
  if (tabela === "CBHPM") return exame.codigoCBHPM || "";
  if (tabela === "TUSS") return exame.codigoTUSS || "";
  return exame.mnemonico || "";
}

function fromRow(r: any): ItemTabelaPreco {
  const exame = r.exame_id ? getExameCatalogoById(r.exame_id) : null;
  const tabela: TabelaTipo = r.tabela;
  const orfao = !exame;
  return {
    id: Number(r.id),
    exameId: r.exame_id ?? "",
    tabela,
    codigoExame: orfao ? "" : codigoFromCatalogo(exame, tabela),
    nomeExame: orfao ? ORFAO_NOME_LABEL : exame!.nome,
    valor: Number(r.valor) || 0,
    porte: orfao ? "-" : (exame!.porteCBHPM || "-"),
    ativo: !!r.ativo,
    orfao,
  };
}

export async function _initTabelaPrecoStore(): Promise<void> {
  // Schema novo: sem cache de codigo_exame/nome_exame/porte. Tudo derivado do catálogo.
  const { data, error } = await supabase
    .from("tabela_preco_itens")
    .select("id,exame_id,tabela,valor,ativo")
    .order("id");
  if (error) { showError(error, { scope: "tabelaPrecoStore.init", silent: true }); return; }
  itens = (data ?? []).map(fromRow);
  notify();
}

export const getTabelaPrecoItens = (): ItemTabelaPreco[] => itens;

export const getItensByTabela = (tabela: TabelaTipo): ItemTabelaPreco[] =>
  itens.filter(i => i.tabela === tabela);

export const getItensByTabelaAtivos = (tabela: TabelaTipo): ItemTabelaPreco[] =>
  itens.filter(i => i.tabela === tabela && i.ativo);

/** Itens cujo exame_id não existe em exames_catalogo. Útil para diagnóstico. */
export const getItensOrfaos = (tabela?: TabelaTipo): ItemTabelaPreco[] =>
  itens.filter(i => i.orfao && (!tabela || i.tabela === tabela));

/** Busca preço por exame_id (preferido). */
export const getPrecoByExameId = (exameId: string, tabela: TabelaTipo): number | null => {
  const item = itens.find(i => i.exameId === exameId && i.tabela === tabela && i.ativo);
  return item?.valor ?? null;
};

/** Busca preço por nome do exame (compatibilidade). Resolve via catálogo → exame_id. */
export const getPrecoExame = (nomeExame: string, tabela: TabelaTipo): number | null => {
  const exame = getExamesCatalogo().find(e => e.nome.toLowerCase() === nomeExame.toLowerCase());
  if (!exame) return null;
  return getPrecoByExameId(exame.id, tabela);
};

/**
 * Cobertura de uma tabela em relação ao catálogo ativo.
 * total = exames ativos no catálogo
 * precificados = exames ativos com linha em tabela_preco_itens (tabela) e valor > 0
 */
export const getCoberturaTabela = (tabela: TabelaTipo): { total: number; precificados: number } => {
  const ativos = getExamesCatalogo().filter(e => e.ativo);
  const ids = new Set(ativos.map(e => e.id));
  const precificados = itens.filter(
    i => i.tabela === tabela && i.valor > 0 && ids.has(i.exameId)
  ).length;
  return { total: ativos.length, precificados };
};

/** Cria preço sob demanda. exameId é obrigatório. Aguarda confirmação do servidor. */
export async function addItemTabelaPreco(item: {
  exameId: string;
  tabela: TabelaTipo;
  valor: number;
  porte?: string; // ignorado — derivado do catálogo
  ativo?: boolean;
}): Promise<ItemTabelaPreco | null> {
  const exame = getExameCatalogoById(item.exameId);
  if (!exame) {
    showError(new Error(`exame não encontrado: ${item.exameId}`), { scope: "tabelaPrecoStore.add", silent: true });
    return null;
  }
  const existing = itens.find(i => i.exameId === item.exameId && i.tabela === item.tabela);
  if (existing) {
    return existing;
  }

  const tempId = -Date.now();
  const novo: ItemTabelaPreco = {
    id: tempId,
    exameId: item.exameId,
    tabela: item.tabela,
    codigoExame: codigoFromCatalogo(exame, item.tabela),
    nomeExame: exame.nome,
    valor: item.valor,
    porte: exame.porteCBHPM || "-",
    ativo: item.ativo ?? true,
    orfao: false,
  };
  const prev = itens;
  itens = [...itens, novo];
  notify();

  try {
    const tenant_id = await getCurrentTenantId();
    const data = await persistOneOrThrow<any>(
      supabase.from("tabela_preco_itens").insert({
        tenant_id,
        exame_id: item.exameId,
        tabela: item.tabela,
        valor: item.valor,
        ativo: item.ativo ?? true,
      } as any),
      "tabelaPreco.add",
    );
    const persisted = fromRow(data);
    itens = itens.map(i => i.id === tempId ? persisted : i);
    notify();
    return persisted;
  } catch (e) {
    showError(e, { scope: "tabelaPrecoStore.add" });
    itens = prev; notify();
    return null;
  }
}

/** Upsert por (exameId, tabela): se existe atualiza, se não cria. */
export async function upsertPrecoByExame(exameId: string, tabela: TabelaTipo, valor: number, _porte = "-"): Promise<boolean> {
  const existing = itens.find(i => i.exameId === exameId && i.tabela === tabela);
  if (existing) {
    return await updateItemTabelaPreco(existing.id, { valor });
  }
  const result = await addItemTabelaPreco({ exameId, tabela, valor });
  return result !== null;
}

export async function updateItemTabelaPreco(
  id: number,
  patch: Partial<Pick<ItemTabelaPreco, "valor" | "ativo">>,
): Promise<boolean> {
  const prev = itens;
  itens = itens.map(i => i.id === id ? { ...i, ...patch } : i);
  notify();
  const row: { valor?: number; ativo?: boolean } = {};
  if (patch.valor !== undefined) row.valor = patch.valor;
  if (patch.ativo !== undefined) row.ativo = patch.ativo;
  try {
    await persistOrThrow(
      supabase.from("tabela_preco_itens").update(row).eq("id", id),
      "tabelaPreco.update",
    );
    return true;
  } catch (e) {
    showError(e, { scope: "tabelaPrecoStore.update" });
    itens = prev; notify();
    return false;
  }
}

export async function removeItemTabelaPreco(id: number): Promise<boolean> {
  const prev = itens;
  itens = itens.filter(i => i.id !== id);
  notify();
  try {
    await persistOrThrow(
      supabase.from("tabela_preco_itens").delete().eq("id", id),
      "tabelaPreco.remove",
    );
    return true;
  } catch (e) {
    showError(e, { scope: "tabelaPrecoStore.remove" });
    itens = prev; notify();
    return false;
  }
}

export async function toggleItemTabelaPreco(id: number): Promise<boolean> {
  const i = itens.find(x => x.id === id);
  if (!i) return false;
  return await updateItemTabelaPreco(id, { ativo: !i.ativo });
}

export function subscribeTabelaPreco(listener: () => void) {
  _listeners.push(listener);
  return () => { _listeners = _listeners.filter((l) => l !== listener); };
}
