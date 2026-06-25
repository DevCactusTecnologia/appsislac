// Store de valores de referência — backed by Supabase com cache síncrono.

import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/db/tenantResolver";
import { persistOneOrThrow, persistOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";

/**
 * Categorias do redesign "Padrão + Variações". Resolver usa a maior prioridade
 * compatível com o paciente; 'padrao' é fallback.
 */
export type CategoriaVR =
  | "padrao" | "gestante" | "recem_nascido" | "crianca" | "adolescente"
  | "adulto" | "idoso" | "masculino" | "feminino" | "custom";

export type JejumVR = "qualquer" | "com_jejum" | "sem_jejum";
export type OperadorVR = "entre" | "menor" | "menor_igual" | "maior" | "maior_igual" | "igual";

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
  criticoMin?: string;
  criticoMax?: string;
  /** Categoria do redesign Padrão+Variações. Default 'custom' para registros legados. */
  categoria?: CategoriaVR;
  /** Condição de jejum exigida. 'qualquer' = não filtra. */
  jejum?: JejumVR;
  /** Operador comparativo do limite. 'entre' usa valorMin–valorMax. */
  operador?: OperadorVR;
}


export const CATEGORIA_META: Record<CategoriaVR, {
  label: string; icon: string; idadeMinDias: number | null; idadeMaxDias: number | null;
  sexo: "Ambos" | "Masculino" | "Feminino"; prioridade: number;
}> = {
  gestante:      { label: "Gestante",       icon: "🤰", idadeMinDias: null, idadeMaxDias: null, sexo: "Feminino",  prioridade: 100 },
  recem_nascido: { label: "Recém-nascido",  icon: "👶", idadeMinDias: 0,      idadeMaxDias: 28,     sexo: "Ambos",     prioridade: 90 },
  crianca:       { label: "Criança",        icon: "🧒", idadeMinDias: 29,     idadeMaxDias: 12*365, sexo: "Ambos",     prioridade: 80 },
  adolescente:   { label: "Adolescente",    icon: "🧑", idadeMinDias: 13*365, idadeMaxDias: 18*365, sexo: "Ambos",     prioridade: 70 },
  idoso:         { label: "Idoso",          icon: "🧓", idadeMinDias: 65*365, idadeMaxDias: null,   sexo: "Ambos",     prioridade: 60 },
  adulto:        { label: "Adulto",         icon: "🧑‍⚕️", idadeMinDias: 19*365, idadeMaxDias: 64*365, sexo: "Ambos",  prioridade: 50 },
  masculino:     { label: "Masculino",      icon: "♂️", idadeMinDias: null, idadeMaxDias: null, sexo: "Masculino", prioridade: 40 },
  feminino:      { label: "Feminino",       icon: "♀️", idadeMinDias: null, idadeMaxDias: null, sexo: "Feminino",  prioridade: 40 },
  custom:        { label: "Personalizada",  icon: "⚙️", idadeMinDias: null, idadeMaxDias: null, sexo: "Ambos",     prioridade: 30 },
  padrao:        { label: "Padrão",         icon: "📍", idadeMinDias: null, idadeMaxDias: null, sexo: "Ambos",     prioridade: 1  },
};

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
    criticoMin: r.critico_min ?? "",
    criticoMax: r.critico_max ?? "",
    categoria: (r.categoria as CategoriaVR) ?? "custom",
    jejum: (r.jejum as JejumVR) ?? "qualquer",
    operador: (r.operador as OperadorVR) ?? "entre",
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
  if (v.criticoMin !== undefined) row.critico_min = v.criticoMin || null;
  if (v.criticoMax !== undefined) row.critico_max = v.criticoMax || null;
  if (v.categoria !== undefined) row.categoria = v.categoria;
  if (v.jejum !== undefined) row.jejum = v.jejum;
  if (v.operador !== undefined) row.operador = v.operador;
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
 * Resolve os valores de referência mais adequados para um parâmetro,
 * considerando sexo, idade e gestação do paciente. Nova lógica:
 *
 *  1) Filtra VRs pelo exame+parâmetro.
 *  2) Para cada VR, checa se é COMPATÍVEL com o paciente (sexo, idade,
 *     categoria — gestante exige `gestante=true`).
 *  3) Escolhe a maior prioridade compatível. Empate: VR com sexo específico
 *     vence VR com sexo Ambos.
 *  4) Se nada bate → null (sem fallback silencioso).
 */
const parseIdadeAnos = (idadeStr: string): number | null => {
  const anosMatch = idadeStr.match(/(\d+)\s*ano/i);
  const mesesMatch = idadeStr.match(/(\d+)\s*m[eê]s/i);
  let anos = anosMatch ? parseInt(anosMatch[1]) : 0;
  if (mesesMatch) anos += parseInt(mesesMatch[1]) / 12;
  if (!anosMatch && !mesesMatch) return null;
  return anos;
};

const idadeStrParaDias = (idadeStr: string): number | null => {
  const a = parseIdadeAnos(idadeStr);
  if (a === null) return null;
  return Math.round(a * 365);
};

const compativel = (
  vr: ValorReferencia,
  sexoNorm: "Masculino" | "Feminino" | null,
  idadeDias: number | null,
  gestante: boolean,
): boolean => {
  const cat: CategoriaVR = (vr.categoria as CategoriaVR) ?? "custom";
  const meta = CATEGORIA_META[cat];

  // Padrão é sempre compatível
  if (cat === "padrao") return true;

  // Gestante: só vale se paciente está marcada como gestante
  if (cat === "gestante") return gestante === true && sexoNorm === "Feminino";

  // Sexo da categoria precisa bater
  if (meta.sexo !== "Ambos" && sexoNorm && meta.sexo !== sexoNorm) return false;

  // Faixa etária da categoria (quando definida)
  if (idadeDias !== null) {
    if (meta.idadeMinDias !== null && idadeDias < meta.idadeMinDias) return false;
    if (meta.idadeMaxDias !== null && idadeDias > meta.idadeMaxDias) return false;
  }

  // 'custom' usa os campos legados (sexo + idadeMin/idadeMax + unidadeIdade)
  if (cat === "custom") {
    if (vr.sexo !== "Ambos" && sexoNorm && vr.sexo !== sexoNorm) return false;
    if (idadeDias !== null && vr.idadeMin && vr.idadeMax) {
      const fator = vr.unidadeIdade === "Anos" ? 365 : vr.unidadeIdade === "Meses" ? 30 : 1;
      const minD = (parseFloat(vr.idadeMin) || 0) * fator;
      const maxD = (parseFloat(vr.idadeMax) || 99999) * fator;
      if (idadeDias < minD || idadeDias > maxD) return false;
    }
  }

  return true;
};

export interface ResolverContexto {
  sexo: string;
  idade: string;
  gestante?: boolean;
}

export const resolverReferencia = (
  exameNome: string,
  parametroNome: string,
  sexoPaciente: string,
  idadePaciente: string,
  gestante: boolean = false,
): { refMin: string; refMax: string; refUnidade: string; descricao: string; criticoMin?: string; criticoMax?: string } | null => {
  const candidatos = valoresReferencia.filter(
    (v) => v.exameNome.toLowerCase() === exameNome.toLowerCase() &&
           v.parametroNome.toLowerCase() === parametroNome.toLowerCase()
  );
  if (candidatos.length === 0) return null;

  const s = (sexoPaciente || "").toLowerCase();
  const sexoNorm: "Masculino" | "Feminino" | null =
    s.startsWith("m") ? "Masculino" : s.startsWith("f") ? "Feminino" : null;
  const idadeDias = idadeStrParaDias(idadePaciente);

  const compats = candidatos.filter((c) => compativel(c, sexoNorm, idadeDias, gestante));
  if (compats.length === 0) return null;

  compats.sort((a, b) => {
    const pa = CATEGORIA_META[(a.categoria as CategoriaVR) ?? "custom"].prioridade;
    const pb = CATEGORIA_META[(b.categoria as CategoriaVR) ?? "custom"].prioridade;
    if (pb !== pa) return pb - pa;
    const sa = a.sexo !== "Ambos" ? 1 : 0;
    const sb = b.sexo !== "Ambos" ? 1 : 0;
    return sb - sa;
  });

  const m = compats[0];
  return {
    refMin: m.valorMin, refMax: m.valorMax, refUnidade: m.unidade, descricao: m.descricao,
    criticoMin: m.criticoMin || undefined, criticoMax: m.criticoMax || undefined,
  };
};
