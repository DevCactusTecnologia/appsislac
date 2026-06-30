import { db as supabase } from "@/runtime/db";
import { getCurrentTenantId } from "@/lib/db/tenantResolver";
import { persistOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";

export type TipoUnidade = "SEDE" | "FILIAL" | "PONTO_DE_COLETA";

export interface Unidade {
  id: string;
  nome: string;
  tipo: TipoUnidade;
  endereco: string;
  cidade: string;
  estado: string;
  telefone: string;
  ativo: boolean;
  padrao?: boolean;
  sedePaiId?: string;
}

const tipoLabels: Record<TipoUnidade, string> = {
  SEDE: "Sede",
  FILIAL: "Filial",
  PONTO_DE_COLETA: "Ponto de Coleta",
};

export function getTipoLabel(tipo: TipoUnidade): string {
  return tipoLabels[tipo];
}

let _unidades: Unidade[] = [];
let _listeners: Array<() => void> = [];

function notify() { _listeners.forEach((fn) => fn()); }

function fromRow(r: any): Unidade {
  return {
    id: r.id,
    nome: r.nome,
    tipo: r.tipo,
    endereco: r.endereco ?? "",
    cidade: r.cidade ?? "",
    estado: r.estado ?? "",
    telefone: r.telefone ?? "",
    ativo: !!r.ativo,
    padrao: !!r.padrao,
    sedePaiId: r.sede_pai_id ?? undefined,
  };
}

function toRow(u: Partial<Unidade>): any {
  const row: Record<string, unknown> = {};
  if (u.id !== undefined) row.id = u.id;
  if (u.nome !== undefined) row.nome = u.nome;
  if (u.tipo !== undefined) row.tipo = u.tipo;
  if (u.endereco !== undefined) row.endereco = u.endereco;
  if (u.cidade !== undefined) row.cidade = u.cidade;
  if (u.estado !== undefined) row.estado = u.estado;
  if (u.telefone !== undefined) row.telefone = u.telefone;
  if (u.ativo !== undefined) row.ativo = u.ativo;
  if (u.padrao !== undefined) row.padrao = u.padrao;
  if (u.sedePaiId !== undefined) row.sede_pai_id = u.sedePaiId ?? null;
  return row;
}

export async function _initUnidadesStore(): Promise<void> {
  const { data, error } = await supabase.from("unidades").select("*").order("nome");
  if (error) { showError(error, { scope: "unidadeStore.init", silent: true }); return; }
  _unidades = (data ?? []).map(fromRow);
  notify();
}

export function getUnidades(): Unidade[] { return _unidades; }
export function getUnidadesAtivas(): Unidade[] { return _unidades.filter((u) => u.ativo); }
export function getUnidadeById(id: string): Unidade | undefined { return _unidades.find((u) => u.id === id); }
export function getSedesEFiliais(): Unidade[] {
  return _unidades.filter((u) => u.ativo && (u.tipo === "SEDE" || u.tipo === "FILIAL"));
}

export async function addUnidade(data: Omit<Unidade, "id">): Promise<Unidade | null> {
  const id = `und-${String(_unidades.length + 1).padStart(3, "0")}`;
  const unidade: Unidade = { id, ...data };
  const prev = _unidades;
  _unidades = [unidade, ..._unidades];
  notify();
  try {
    const tenant_id = await getCurrentTenantId();
    await persistOrThrow(
      supabase.from("unidades").insert({ ...toRow(unidade), tenant_id }),
      "unidade.add",
    );
    return unidade;
  } catch (e) {
    showError(e, { scope: "unidadeStore.add" });
    _unidades = prev; notify();
    return null;
  }
}

export async function updateUnidade(id: string, updates: Partial<Omit<Unidade, "id">>): Promise<boolean> {
  const prev = _unidades;
  _unidades = _unidades.map((u) => (u.id === id ? { ...u, ...updates } : u));
  notify();
  try {
    await persistOrThrow(
      supabase.from("unidades").update(toRow(updates)).eq("id", id),
      "unidade.update",
    );
    return true;
  } catch (e) {
    showError(e, { scope: "unidadeStore.update" });
    _unidades = prev; notify();
    return false;
  }
}

export async function toggleUnidadeAtivo(id: string): Promise<boolean> {
  const u = _unidades.find((x) => x.id === id);
  if (!u) return false;
  return await updateUnidade(id, { ativo: !u.ativo });
}

export async function deleteUnidade(id: string): Promise<boolean> {
  const u = _unidades.find((x) => x.id === id);
  if (u?.padrao) return false;
  const prev = _unidades;
  _unidades = _unidades.filter((x) => x.id !== id);
  notify();
  try {
    await persistOrThrow(
      supabase.from("unidades").delete().eq("id", id),
      "unidade.delete",
    );
    return true;
  } catch (e) {
    showError(e, { scope: "unidadeStore.delete" });
    _unidades = prev; notify();
    return false;
  }
}

export function subscribeUnidades(listener: () => void) {
  _listeners.push(listener);
  return () => { _listeners = _listeners.filter((l) => l !== listener); };
}
