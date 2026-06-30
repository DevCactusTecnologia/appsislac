// Store de Estados (UFs) e Cidades (IBGE) com cache em memória.
// - Estados: carga única na primeira chamada.
// - Cidades: lazy por uf_id (cache permanente após primeira carga).
import { db as supabase } from "@/runtime/db";
import { showError } from "@/lib/showError";

export interface Estado {
  id: number;
  name: string;
  uf: string;
}

export interface Cidade {
  id: number;
  code_ibge: string;
  name: string;
  uf_id: number;
}

let _estados: Estado[] | null = null;
let _estadosPromise: Promise<Estado[]> | null = null;
const _cidadesByUf = new Map<number, Cidade[]>();
const _cidadesPromiseByUf = new Map<number, Promise<Cidade[]>>();

const titleCase = (s: string): string =>
  s
    .toLowerCase()
    .split(/(\s|-|')/)
    .map((part) => (/[a-záàâãéèêíïóôõöúçñ]/i.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join("");

export async function fetchEstados(): Promise<Estado[]> {
  if (_estados) return _estados;
  if (_estadosPromise) return _estadosPromise;
  _estadosPromise = (async () => {
    const { data, error } = await supabase.from("states").select("id, name, uf").order("name");
    if (error) {
      showError(error, { scope: "geoStore.fetchEstados", silent: true });
      return [];
    }
    _estados = (data ?? []).map((r: any) => ({ id: r.id, name: titleCase(r.name), uf: r.uf }));
    return _estados;
  })();
  return _estadosPromise;
}

export function getEstadosCache(): Estado[] | null {
  return _estados;
}

export function findEstadoByUf(uf: string): Estado | undefined {
  if (!_estados) return undefined;
  const u = (uf || "").toUpperCase().trim();
  return _estados.find((e) => e.uf === u);
}

export async function fetchCidadesByUfId(ufId: number): Promise<Cidade[]> {
  const cached = _cidadesByUf.get(ufId);
  if (cached) return cached;
  const inflight = _cidadesPromiseByUf.get(ufId);
  if (inflight) return inflight;
  const p = (async () => {
    const { data, error } = await supabase
      .from("cities")
      .select("id, code_ibge, name, uf_id")
      .eq("uf_id", ufId)
      .order("name");
    if (error) {
      showError(error, { scope: "geoStore.fetchCidadesByUfId", silent: true });
      _cidadesPromiseByUf.delete(ufId);
      return [];
    }
    const cidades: Cidade[] = (data ?? []).map((r: any) => ({
      id: r.id,
      code_ibge: r.code_ibge,
      name: titleCase(r.name),
      uf_id: r.uf_id,
    }));
    _cidadesByUf.set(ufId, cidades);
    _cidadesPromiseByUf.delete(ufId);
    return cidades;
  })();
  _cidadesPromiseByUf.set(ufId, p);
  return p;
}

export async function fetchCidadesByUf(uf: string): Promise<Cidade[]> {
  await fetchEstados();
  const est = findEstadoByUf(uf);
  if (!est) return [];
  return fetchCidadesByUfId(est.id);
}
