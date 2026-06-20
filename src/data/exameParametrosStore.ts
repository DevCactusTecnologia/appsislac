// Store de parâmetros por exame (carregamento sob demanda + cache em memória)
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "./_tenant";
import { persistOneOrThrow, persistOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";

export type ParametroTipo = "Texto" | "Número" | "Select" | "Formula";

export interface ExameParametro {
  id: number;
  exameId: string;
  tipo: ParametroTipo;
  rotulo: string;
  chave: string;
  abreviacao: string;
  qtdCaracteres: string;
  chaveApoio: string;
  exibirAnterior: string;
  exibirMapa: string;
  obrigatorio: string;
  valorReferencia: string;
  visivel: boolean;
  ordem: number;
  /** Opções para parâmetros do tipo "Select" (lista suspensa). */
  opcoesSelect: string[];
  /** Quantidade de casas decimais (apenas para tipos Número e Fórmula). */
  casasDecimais: number;
  /** Limite inferior crítico/pânico (texto numérico). Vazio = sem alerta de pânico baixo. */
  criticoMin: string;
  /** Limite superior crítico/pânico (texto numérico). Vazio = sem alerta de pânico alto. */
  criticoMax: string;
  /** Separador decimal usado na entrada/exibição: '.' ou ','. */
  separadorDecimal: "." | ",";
  /** Quantidade total de dígitos (inteiros + decimais). 0/undefined = sem limite. */
  qtdDigitos: number;
}

const cache = new Map<string, ExameParametro[]>();
const listeners = new Map<string, Set<() => void>>();

const fromRow = (r: any): ExameParametro => ({
  id: r.id,
  exameId: r.exame_id,
  tipo: (r.tipo as ParametroTipo) ?? "Texto",
  rotulo: r.rotulo ?? "",
  chave: r.chave ?? "",
  abreviacao: r.abreviacao ?? "",
  qtdCaracteres: r.qtd_caracteres ?? "",
  chaveApoio: r.chave_apoio ?? "",
  exibirAnterior: r.exibir_anterior ?? "",
  exibirMapa: r.exibir_mapa ?? "",
  obrigatorio: r.obrigatorio ?? "",
  valorReferencia: r.valor_referencia ?? "",
  visivel: !!r.visivel,
  ordem: r.ordem ?? 0,
  opcoesSelect: normalizeOpcoesSelect(r.opcoes_select),
  casasDecimais: typeof r.casas_decimais === "number" ? r.casas_decimais : 2,
  criticoMin: r.critico_min ?? "",
  criticoMax: r.critico_max ?? "",
  separadorDecimal: (r.separador_decimal === "," ? "," : ".") as "." | ",",
  qtdDigitos: typeof r.qtd_digitos === "number" ? r.qtd_digitos : 0,
});

const toRow = (p: Partial<ExameParametro>): any => ({
  ...(p.exameId !== undefined && { exame_id: p.exameId }),
  ...(p.tipo !== undefined && { tipo: p.tipo }),
  ...(p.rotulo !== undefined && { rotulo: p.rotulo }),
  ...(p.chave !== undefined && { chave: p.chave }),
  ...(p.abreviacao !== undefined && { abreviacao: p.abreviacao }),
  ...(p.qtdCaracteres !== undefined && { qtd_caracteres: p.qtdCaracteres }),
  ...(p.chaveApoio !== undefined && { chave_apoio: p.chaveApoio }),
  ...(p.exibirAnterior !== undefined && { exibir_anterior: p.exibirAnterior }),
  ...(p.exibirMapa !== undefined && { exibir_mapa: p.exibirMapa }),
  ...(p.obrigatorio !== undefined && { obrigatorio: p.obrigatorio }),
  ...(p.valorReferencia !== undefined && { valor_referencia: p.valorReferencia }),
  ...(p.visivel !== undefined && { visivel: p.visivel }),
  ...(p.ordem !== undefined && { ordem: p.ordem }),
  ...(p.opcoesSelect !== undefined && { opcoes_select: normalizeOpcoesSelect(p.opcoesSelect) }),
  ...(p.casasDecimais !== undefined && { casas_decimais: p.casasDecimais }),
  ...(p.criticoMin !== undefined && { critico_min: p.criticoMin }),
  ...(p.criticoMax !== undefined && { critico_max: p.criticoMax }),
  ...(p.separadorDecimal !== undefined && { separador_decimal: p.separadorDecimal }),
  ...(p.qtdDigitos !== undefined && { qtd_digitos: p.qtdDigitos || null }),
});

/**
 * Normaliza opções de Select tolerando dados legados onde a lista inteira
 * foi salva como um único elemento com vírgulas (ex.: ["A, B, C"]).
 * Sempre devolve um array com cada opção como item individual, sem duplicatas
 * nem entradas vazias.
 */
const normalizeOpcoesSelect = (raw: unknown): string[] => {
  const arr = Array.isArray(raw) ? raw : raw == null ? [] : [String(raw)];
  const out: string[] = [];
  for (const item of arr) {
    const txt = typeof item === "string" ? item : String(item ?? "");
    for (const part of txt.split(",")) {
      const trimmed = part.trim().toUpperCase();
      if (trimmed && !out.includes(trimmed)) out.push(trimmed);
    }
  }
  return out;
};

const notify = (exameId: string) => {
  listeners.get(exameId)?.forEach((fn) => fn());
};

export async function loadParametros(exameId: string): Promise<ExameParametro[]> {
  const { data, error } = await supabase
    .from("exame_parametros")
    .select("*")
    .eq("exame_id", exameId)
    .order("ordem", { ascending: true })
    .order("id", { ascending: true });
  if (error) { showError(error, { scope: "exameParametrosStore.load", silent: true }); return []; }
  const list = (data ?? []).map(fromRow);
  cache.set(exameId, list);
  notify(exameId);
  return list;
}

export const getParametros = (exameId: string): ExameParametro[] =>
  cache.get(exameId) ?? [];

export async function addParametro(
  exameId: string,
  data: Omit<ExameParametro, "id" | "exameId">
): Promise<ExameParametro | null> {
  try {
    // Pré-checagem: sem sessão válida o PostgREST trata como anon e a RLS
    // bloqueia o INSERT mesmo com profile/admin corretos. Damos um erro
    // claro em vez do criptográfico "row-level security policy".
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      throw new Error("Sessão expirada. Faça login novamente para criar o parâmetro.");
    }
    const tenant_id = await getCurrentTenantId();
    if (!tenant_id) {
      throw new Error("Não foi possível identificar o laboratório (tenant) do usuário logado.");
    }
    const row = await persistOneOrThrow<any>(
      supabase.from("exame_parametros").insert({ ...toRow({ ...data, exameId }), tenant_id }),
      "exameParametros.add",
    );
    const novo = fromRow(row);
    cache.set(exameId, [...(cache.get(exameId) ?? []), novo]);
    notify(exameId);
    return novo;
  } catch (e) {
    showError(e, { scope: "exameParametrosStore.add" });
    return null;
  }
}

export async function updateParametro(
  id: number,
  exameId: string,
  data: Partial<Omit<ExameParametro, "id" | "exameId">>
): Promise<boolean> {
  try {
    await persistOrThrow(
      supabase.from("exame_parametros").update(toRow(data)).eq("id", id),
      "exameParametros.update",
    );
    const list = cache.get(exameId) ?? [];
    cache.set(exameId, list.map((p) => (p.id === id ? { ...p, ...data } : p)));
    notify(exameId);
    return true;
  } catch (e) {
    showError(e, { scope: "exameParametrosStore.update" });
    return false;
  }
}

export async function removeParametro(id: number, exameId: string): Promise<boolean> {
  try {
    await persistOrThrow(
      supabase.from("exame_parametros").delete().eq("id", id),
      "exameParametros.remove",
    );
    const list = cache.get(exameId) ?? [];
    cache.set(exameId, list.filter((p) => p.id !== id));
    notify(exameId);
    return true;
  } catch (e) {
    showError(e, { scope: "exameParametrosStore.remove" });
    return false;
  }
}

export function subscribeParametros(exameId: string, fn: () => void): () => void {
  if (!listeners.has(exameId)) listeners.set(exameId, new Set());
  listeners.get(exameId)!.add(fn);
  return () => listeners.get(exameId)?.delete(fn);
}

/** Atualiza o campo `ordem` de vários parâmetros em lote (drag-and-drop). */
export async function reorderParametros(
  exameId: string,
  ordered: { id: number; ordem: number }[],
): Promise<boolean> {
  // Atualiza otimisticamente o cache local antes do round-trip
  const list = cache.get(exameId) ?? [];
  const ordemPorId = new Map(ordered.map((o) => [o.id, o.ordem]));
  const novo = list
    .map((p) => (ordemPorId.has(p.id) ? { ...p, ordem: ordemPorId.get(p.id)! } : p))
    .sort((a, b) => a.ordem - b.ordem);
  cache.set(exameId, novo);
  notify(exameId);

  // Persiste em paralelo
  try {
    await Promise.all(
      ordered.map((o) =>
        persistOrThrow(
          supabase.from("exame_parametros").update({ ordem: o.ordem }).eq("id", o.id),
          "exameParametros.reorder",
        ),
      ),
    );
    return true;
  } catch (e) {
    showError(e, { scope: "exameParametrosStore.reorder" });
    return false;
  }
}

/** Verifica se já existe outro parâmetro com a mesma chave para o exame (case-insensitive). */
export const isChaveDuplicada = (
  exameId: string,
  chave: string,
  ignoreId?: number,
): boolean => {
  const lista = cache.get(exameId) ?? [];
  const k = chave.trim().toUpperCase();
  return lista.some((p) => p.chave.trim().toUpperCase() === k && p.id !== ignoreId);
};

