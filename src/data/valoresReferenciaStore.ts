// Store de valores de referência — backed by Supabase com cache síncrono.

import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "./_tenant";
import { persistOneOrThrow, persistOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";

export interface ValorReferencia {
  id: number;
  exameNome: string;
  parametroNome: string;
  sexo: "Ambos" | "Masculino" | "Feminino";
  idadeMin: string;
  idadeMax: string;
  unidadeIdade: "Anos" | "Meses" | "Dias";
  valorMin: string;
  valorMax: string;
  unidade: string;
  descricao: string;
}

let valoresReferencia: ValorReferencia[] = [];
let _listeners: Array<() => void> = [];
function notify() { _listeners.forEach((fn) => fn()); }

function fromRow(r: any): ValorReferencia {
  return {
    id: Number(r.id),
    exameNome: r.exame_nome,
    parametroNome: r.parametro_nome ?? "",
    sexo: r.sexo,
    idadeMin: r.idade_min ?? "",
    idadeMax: r.idade_max ?? "",
    unidadeIdade: r.unidade_idade,
    valorMin: r.valor_min ?? "",
    valorMax: r.valor_max ?? "",
    unidade: r.unidade ?? "",
    descricao: r.descricao ?? "",
  };
}

function toRow(v: Partial<ValorReferencia>): any {
  const row: Record<string, unknown> = {};
  if (v.exameNome !== undefined) row.exame_nome = v.exameNome;
  if (v.parametroNome !== undefined) row.parametro_nome = v.parametroNome;
  if (v.sexo !== undefined) row.sexo = v.sexo;
  if (v.idadeMin !== undefined) row.idade_min = v.idadeMin;
  if (v.idadeMax !== undefined) row.idade_max = v.idadeMax;
  if (v.unidadeIdade !== undefined) row.unidade_idade = v.unidadeIdade;
  if (v.valorMin !== undefined) row.valor_min = v.valorMin;
  if (v.valorMax !== undefined) row.valor_max = v.valorMax;
  if (v.unidade !== undefined) row.unidade = v.unidade;
  if (v.descricao !== undefined) row.descricao = v.descricao;
  return row;
}

export async function _initValoresReferenciaStore(): Promise<void> {
  const { data, error } = await supabase.from("valores_referencia").select("*").order("id");
  if (error) { showError(error, { scope: "valoresReferenciaStore.init", silent: true }); return; }
  valoresReferencia = (data ?? []).map(fromRow);
  notify();
}

export const getValoresReferencia = (): ValorReferencia[] => valoresReferencia;

export const setValoresReferencia = (valores: ValorReferencia[]) => {
  valoresReferencia = valores;
  notify();
};

export async function addValorReferencia(valor: Omit<ValorReferencia, "id">): Promise<ValorReferencia | null> {
  try {
    const tenant_id = await getCurrentTenantId();
    const data = await persistOneOrThrow<any>(
      supabase.from("valores_referencia").insert({ ...toRow(valor), tenant_id }),
      "valoresReferencia.add",
    );
    const novo = fromRow(data);
    valoresReferencia = [...valoresReferencia, novo];
    notify();
    return novo;
  } catch (e) {
    showError(e, { scope: "valoresReferenciaStore.add" });
    return null;
  }
}

export async function updateValorReferencia(id: number, valor: Omit<ValorReferencia, "id">): Promise<boolean> {
  const prev = valoresReferencia;
  valoresReferencia = valoresReferencia.map((v) => (v.id === id ? { ...valor, id } : v));
  notify();
  try {
    await persistOrThrow(
      supabase.from("valores_referencia").update(toRow(valor)).eq("id", id),
      "valoresReferencia.update",
    );
    return true;
  } catch (e) {
    showError(e, { scope: "valoresReferenciaStore.update" });
    valoresReferencia = prev;
    notify();
    return false;
  }
}

export async function removeValorReferencia(id: number): Promise<boolean> {
  const prev = valoresReferencia;
  valoresReferencia = valoresReferencia.filter((v) => v.id !== id);
  notify();
  try {
    await persistOrThrow(
      supabase.from("valores_referencia").delete().eq("id", id),
      "valoresReferencia.remove",
    );
    return true;
  } catch (e) {
    showError(e, { scope: "valoresReferenciaStore.remove" });
    valoresReferencia = prev;
    notify();
    return false;
  }
}

export function subscribeValoresReferencia(listener: () => void) {
  _listeners.push(listener);
  return () => { _listeners = _listeners.filter((l) => l !== listener); };
}

/**
 * Converte idade do paciente para a unidade desejada (em anos).
 */
const parseIdadeAnos = (idadeStr: string): number | null => {
  const anosMatch = idadeStr.match(/(\d+)\s*ano/i);
  const mesesMatch = idadeStr.match(/(\d+)\s*m[eê]s/i);
  let anos = anosMatch ? parseInt(anosMatch[1]) : 0;
  if (mesesMatch) anos += parseInt(mesesMatch[1]) / 12;
  if (!anosMatch && !mesesMatch) return null;
  return anos;
};

/**
 * Resolve os valores de referência mais adequados para um parâmetro,
 * considerando sexo e idade do paciente.
 */
export const resolverReferencia = (
  exameNome: string,
  parametroNome: string,
  sexoPaciente: string,
  idadePaciente: string
): { refMin: string; refMax: string; refUnidade: string; descricao: string } | null => {
  const idadeAnos = parseIdadeAnos(idadePaciente);

  const candidatos = valoresReferencia.filter(
    (v) => v.exameNome.toLowerCase() === exameNome.toLowerCase() &&
           v.parametroNome.toLowerCase() === parametroNome.toLowerCase()
  );
  if (candidatos.length === 0) return null;

  const sexoNorm = sexoPaciente.toLowerCase().startsWith("m") ? "Masculino" : "Feminino";

  let melhor: ValorReferencia | null = null;
  let melhorScore = -1;

  for (const c of candidatos) {
    let score = 0;
    if (c.sexo === sexoNorm) score += 2;
    else if (c.sexo === "Ambos") score += 1;
    else continue;

    if (idadeAnos !== null) {
      const min = parseFloat(c.idadeMin) || 0;
      const max = parseFloat(c.idadeMax) || 999;
      let minAnos = min;
      let maxAnos = max;
      if (c.unidadeIdade === "Meses") { minAnos = min / 12; maxAnos = max / 12; }
      if (c.unidadeIdade === "Dias") { minAnos = min / 365; maxAnos = max / 365; }
      if (idadeAnos >= minAnos && idadeAnos <= maxAnos) score += 3;
      else continue;
    }

    if (score > melhorScore) { melhorScore = score; melhor = c; }
  }

  if (!melhor) {
    const fallback = candidatos.find((c) => c.sexo === "Ambos");
    if (fallback) return { refMin: fallback.valorMin, refMax: fallback.valorMax, refUnidade: fallback.unidade, descricao: fallback.descricao };
    return null;
  }

  return { refMin: melhor.valorMin, refMax: melhor.valorMax, refUnidade: melhor.unidade, descricao: melhor.descricao };
};
