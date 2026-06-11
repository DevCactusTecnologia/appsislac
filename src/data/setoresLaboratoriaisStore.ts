import { supabase } from "@/integrations/supabase/client";
import { SETORES_LABORATORIAIS } from "@/lib/laboratorioPadroes";
import { persistOneOrThrow, persistOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";

export interface SetorCustomizado {
  id: string;
  nome: string;
  ativo: boolean;
}

let cache: SetorCustomizado[] = [];
let loaded = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

export const subscribeSetoresCustomizados = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/** Carrega TODOS os setores customizados do tenant (ativos e inativos) — usado para gestão. */
export const loadSetoresCustomizados = async (): Promise<SetorCustomizado[]> => {
  const { data, error } = await supabase
    .from("setores_laboratoriais")
    .select("id, nome, ativo")
    .order("nome", { ascending: true });
  if (error) {
    showError(error, { scope: "setoresStore.load", silent: true });
    cache = [];
  } else {
    cache = (data ?? []) as SetorCustomizado[];
  }
  loaded = true;
  notify();
  return cache;
};

export const getSetoresCustomizados = (): SetorCustomizado[] => cache;
export const isSetoresLoaded = () => loaded;

/** Resolve o id de um setor pelo nome (case-insensitive). Retorna null se não encontrar.
 *  Garante que o cache esteja carregado antes de buscar. */
export const resolveSetorIdByNome = async (nome: string): Promise<string | null> => {
  const clean = (nome || "").trim().toUpperCase();
  if (!clean) return null;
  if (!loaded) {
    await loadSetoresCustomizados();
  }
  const found = cache.find((s) => s.nome.toUpperCase() === clean);
  return found?.id ?? null;
};

/** Lista mesclada (padrão SBPC/ML imutáveis + customizados ATIVOS do tenant), únicos e ordenados. */
export const getSetoresMerged = (): string[] => {
  const set = new Set<string>([...SETORES_LABORATORIAIS]);
  cache.forEach((s) => {
    if (s.ativo) set.add(s.nome);
  });
  return Array.from(set);
};

/** Lista classificada para combobox: cada setor com origem ("padrao" SBPC/ML ou "customizado"). */
export const getSetoresClassificados = (): { nome: string; origem: "padrao" | "customizado" }[] => {
  const padroes = (SETORES_LABORATORIAIS as readonly string[]).map((nome) => ({
    nome,
    origem: "padrao" as const,
  }));
  const padroesUpper = new Set(padroes.map((p) => p.nome.toUpperCase()));
  const customs = cache
    .filter((s) => s.ativo && !padroesUpper.has(s.nome.toUpperCase()))
    .map((s) => ({ nome: s.nome, origem: "customizado" as const }));
  return [...padroes, ...customs];
};

/** Verifica se o nome é um padrão fixo (case-insensitive). */
export const isSetorPadrao = (nome: string): boolean => {
  const n = nome.trim().toUpperCase();
  return (SETORES_LABORATORIAIS as readonly string[]).some((s) => s.toUpperCase() === n);
};

export const addSetorCustomizado = async (
  nome: string,
  tenantId: string,
): Promise<SetorCustomizado | null> => {
  const clean = nome.trim().toUpperCase();
  if (!clean) return null;
  if (isSetorPadrao(clean)) {
    // Já existe como padrão fixo — não duplicar
    return null;
  }
  // Já existe no cache?
  const existing = cache.find((s) => s.nome.toUpperCase() === clean);
  if (existing) return existing;

  try {
    const data = await persistOneOrThrow<SetorCustomizado>(
      supabase
        .from("setores_laboratoriais")
        .insert({ nome: clean, tenant_id: tenantId, ativo: true }),
      "setoresStore.add",
      { selectCols: "id, nome, ativo" },
    );
    cache = [...cache, data].sort((a, b) => a.nome.localeCompare(b.nome));
    notify();
    return data;
  } catch (error) {
    showError(error, { scope: "setoresStore.add", userMessage: "Não foi possível adicionar o setor." });
    return null;
  }
};

/** Renomeia um setor customizado. Retorna true se sucesso. */
export const renameSetorCustomizado = async (id: string, novoNome: string): Promise<boolean> => {
  const clean = novoNome.trim().toUpperCase();
  if (!clean) return false;
  if (isSetorPadrao(clean)) {
    return false;
  }
  const conflito = cache.find((s) => s.id !== id && s.nome.toUpperCase() === clean);
  if (conflito) {
    return false;
  }
  try {
    await persistOrThrow(
      supabase.from("setores_laboratoriais").update({ nome: clean }).eq("id", id),
      "setoresStore.rename",
    );
  } catch (error) {
    showError(error, { scope: "setoresStore.rename", userMessage: "Não foi possível renomear o setor." });
    return false;
  }
  cache = cache
    .map((s) => (s.id === id ? { ...s, nome: clean } : s))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  notify();
  return true;
};

/** Alterna o status ativo/inativo de um setor customizado. */
export const toggleSetorCustomizado = async (id: string): Promise<boolean> => {
  const setor = cache.find((s) => s.id === id);
  if (!setor) return false;
  const novoAtivo = !setor.ativo;
  try {
    await persistOrThrow(
      supabase.from("setores_laboratoriais").update({ ativo: novoAtivo }).eq("id", id),
      "setoresStore.toggle",
    );
  } catch (error) {
    showError(error, { scope: "setoresStore.toggle", userMessage: "Não foi possível alternar o setor." });
    return false;
  }
  cache = cache.map((s) => (s.id === id ? { ...s, ativo: novoAtivo } : s));
  notify();
  return true;
};

/** Remove um setor customizado permanentemente. */
export const removeSetorCustomizado = async (id: string): Promise<boolean> => {
  try {
    await persistOrThrow(
      supabase.from("setores_laboratoriais").delete().eq("id", id),
      "setoresStore.remove",
    );
  } catch (error) {
    showError(error, { scope: "setoresStore.remove", userMessage: "Não foi possível remover o setor." });
    return false;
  }
  cache = cache.filter((s) => s.id !== id);
  notify();
  return true;
};
