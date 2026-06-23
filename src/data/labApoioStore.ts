// Store de Laboratórios de Apoio — backed by Supabase com cache síncrono.

import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/db/tenantResolver";
import { persistOrThrow, persistOneOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";

export interface LabApoio {
  id: string;
  nome: string;
  sigla: string;
  cnpj: string;
  telefone: string;
  email: string;
  contato: string;
  ativo: boolean;
  sistema?: boolean;
  /** Integração vinculada (provider real Hermes/etc.). Opcional. */
  integrationId?: string | null;
}

let labs: LabApoio[] = [];
let _listeners: Array<() => void> = [];
function notify() { _listeners.forEach((fn) => fn()); }

function fromRow(r: any): LabApoio {
  return {
    id: r.id,
    nome: r.nome,
    sigla: r.sigla ?? "",
    cnpj: r.cnpj ?? "",
    telefone: r.telefone ?? "",
    email: r.email ?? "",
    contato: r.contato ?? "",
    ativo: !!r.ativo,
    sistema: !!r.sistema,
    integrationId: r.integration_id ?? null,
  };
}

function toRow(l: Partial<LabApoio>): any {
  const row: Record<string, unknown> = {};
  if (l.nome !== undefined) row.nome = l.nome;
  if (l.sigla !== undefined) row.sigla = l.sigla;
  if (l.cnpj !== undefined) row.cnpj = l.cnpj;
  if (l.telefone !== undefined) row.telefone = l.telefone;
  if (l.email !== undefined) row.email = l.email;
  if (l.contato !== undefined) row.contato = l.contato;
  if (l.ativo !== undefined) row.ativo = l.ativo;
  if (l.integrationId !== undefined) row.integration_id = l.integrationId;
  return row;
}


export async function _initLabsApoioStore(): Promise<void> {
  const { data, error } = await supabase.from("labs_apoio").select("*").order("nome");
  if (error) { showError(error, { scope: "labApoioStore.init", silent: true }); return; }
  labs = (data ?? []).map(fromRow);
  notify();
}

export const getLabsApoio = (): LabApoio[] => labs;
export const getLabsApoioAtivos = (): LabApoio[] => labs.filter(l => l.ativo);

export async function addLabApoio(lab: Omit<LabApoio, "id">): Promise<LabApoio | null> {
  const tempId = `temp-${Date.now()}`;
  const novo: LabApoio = { ...lab, id: tempId };
  const prev = labs;
  labs = [...labs, novo];
  notify();
  try {
    const tenant_id = await getCurrentTenantId();
    const data = await persistOneOrThrow<any>(
      supabase.from("labs_apoio").insert({ ...toRow(lab), tenant_id }),
      "labApoioStore.add",
    );
    const persisted = fromRow(data);
    labs = labs.map(l => l.id === tempId ? persisted : l);
    notify();
    return persisted;
  } catch (error) {
    showError(error, { scope: "labApoioStore.add", userMessage: "Não foi possível cadastrar o laboratório de apoio." });
    labs = prev; notify();
    return null;
  }
}

export async function updateLabApoio(id: string, data: Partial<LabApoio>): Promise<boolean> {
  const prev = labs;
  labs = labs.map(l => l.id === id ? { ...l, ...data } : l);
  notify();
  try {
    await persistOrThrow(
      supabase.from("labs_apoio").update(toRow(data)).eq("id", id),
      "labApoioStore.update",
    );
    return true;
  } catch (error) {
    showError(error, { scope: "labApoioStore.update", userMessage: "Não foi possível atualizar o laboratório de apoio." });
    labs = prev; notify();
    return false;
  }
}

export async function removeLabApoio(id: string): Promise<boolean> {
  const target = labs.find(l => l.id === id);
  if (target?.sistema) return false;
  const prev = labs;
  labs = labs.filter(l => l.id !== id);
  notify();
  try {
    await persistOrThrow(
      supabase.from("labs_apoio").delete().eq("id", id),
      "labApoioStore.remove",
    );
    return true;
  } catch (error) {
    showError(error, { scope: "labApoioStore.remove", userMessage: "Não foi possível remover o laboratório de apoio." });
    labs = prev; notify();
    return false;
  }
}

export async function toggleLabApoio(id: string): Promise<boolean> {
  const l = labs.find(x => x.id === id);
  if (!l) return false;
  return await updateLabApoio(id, { ativo: !l.ativo });
}

export function subscribeLabsApoio(listener: () => void) {
  _listeners.push(listener);
  return () => { _listeners = _listeners.filter((l) => l !== listener); };
}
