// Store de especialistas baseado em Supabase (cache síncrono + mutações async).

import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "./_tenant";
import { persistOrThrow, persistOneOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";

export interface Especialista {
  id: number;
  friendlyId?: string;
  nome: string;
  crm: string;
  conselhoClasse: string;
  estadoEmissor: string;
  cpf: string;
  sexo: string;
  especialidade: string;
  telefone: string;
  email: string;
  status: "Ativo" | "Inativo";
}

let _especialistas: Especialista[] = [];
let _listeners: Array<() => void> = [];

function fromRow(r: any): Especialista {
  return {
    id: Number(r.id),
    friendlyId: r.friendly_id || "",
    nome: r.nome,
    crm: r.crm || "",
    conselhoClasse: r.conselho_classe || "CRM",
    estadoEmissor: r.estado_emissor || "",
    cpf: r.cpf || "",
    sexo: r.sexo || "",
    especialidade: r.especialidade || "",
    telefone: r.telefone || "",
    email: r.email || "",
    status: r.status === "Ativo" ? "Ativo" : "Inativo",
  };
}

function toRow(e: Partial<Especialista>): any {
  const row: any = {};
  if (e.nome !== undefined) row.nome = e.nome;
  if (e.crm !== undefined) row.crm = e.crm;
  if (e.conselhoClasse !== undefined) row.conselho_classe = e.conselhoClasse;
  if (e.estadoEmissor !== undefined) row.estado_emissor = e.estadoEmissor;
  if (e.cpf !== undefined) row.cpf = e.cpf;
  if (e.sexo !== undefined) row.sexo = e.sexo;
  if (e.especialidade !== undefined) row.especialidade = e.especialidade;
  if (e.telefone !== undefined) row.telefone = e.telefone;
  if (e.email !== undefined) row.email = e.email;
  if (e.status !== undefined) row.status = e.status;
  return row;
}

function notify() { _listeners.forEach(fn => fn()); }

export async function _initEspecialistasStore(): Promise<void> {
  const { data, error } = await supabase.from("especialistas").select("*").order("nome");
  if (error) {
    showError(error, { scope: "especialistaStore.init", silent: true });
    return;
  }
  _especialistas = (data ?? []).map(fromRow);
  notify();
}

export const getEspecialistas = (): Especialista[] => _especialistas;
export const getEspecialistasAtivos = (): Especialista[] => _especialistas.filter(e => e.status === "Ativo");
export const getSolicitantesNomes = (): string[] => getEspecialistasAtivos().map(e => e.nome);
export const getEspecialistaById = (id: number): Especialista | undefined =>
  _especialistas.find(e => e.id === id);

export async function addEspecialista(input: Omit<Especialista, "id">): Promise<Especialista> {
  const tempId = -Date.now();
  const optimistic: Especialista = { ...input, id: tempId };
  const prev = _especialistas;
  _especialistas = [optimistic, ..._especialistas];
  notify();

  try {
    const tenant_id = await getCurrentTenantId();
    const data = await persistOneOrThrow<any>(
      supabase.from("especialistas").insert({ ...toRow(input), tenant_id }),
      "especialistaStore.add",
    );
    const saved = fromRow(data);
    _especialistas = _especialistas.map(e => e.id === tempId ? saved : e);
    notify();
    return saved;
  } catch (err) {
    showError(err, { scope: "especialistaStore.add", userMessage: "Não foi possível salvar o especialista." });
    _especialistas = prev;
    notify();
    throw err;
  }
}

export async function updateEspecialista(id: number, patch: Partial<Especialista>): Promise<Especialista> {
  const prev = _especialistas;
  _especialistas = _especialistas.map(e => e.id === id ? { ...e, ...patch } : e);
  notify();

  try {
    const data = await persistOneOrThrow<any>(
      supabase.from("especialistas").update(toRow(patch)).eq("id", id),
      "especialistaStore.update",
    );
    const saved = fromRow(data);
    _especialistas = _especialistas.map(e => e.id === id ? saved : e);
    notify();
    return saved;
  } catch (err) {
    showError(err, { scope: "especialistaStore.update", userMessage: "Não foi possível atualizar o especialista." });
    _especialistas = prev;
    notify();
    throw err;
  }
}

export async function toggleEspecialistaStatus(id: number): Promise<void> {
  const e = _especialistas.find(x => x.id === id);
  if (!e) return;
  await updateEspecialista(id, { status: e.status === "Ativo" ? "Inativo" : "Ativo" });
}

export async function removeEspecialista(id: number): Promise<void> {
  const prev = _especialistas;
  _especialistas = _especialistas.filter(e => e.id !== id);
  notify();
  try {
    await persistOrThrow(
      supabase.from("especialistas").delete().eq("id", id),
      "especialistaStore.remove",
    );
  } catch (error) {
    showError(error, { scope: "especialistaStore.remove", userMessage: "Não foi possível remover o especialista." });
    _especialistas = prev;
    notify();
    throw error;
  }
}

export function subscribeEspecialistas(listener: () => void): () => void {
  _listeners.push(listener);
  return () => { _listeners = _listeners.filter(l => l !== listener); };
}
