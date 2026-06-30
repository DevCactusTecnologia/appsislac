// Store centralizado de convênios — backed by Supabase com cache síncrono.

import { db as supabase } from "@/runtime/db";
import { getCurrentTenantId } from "@/lib/db/tenantResolver";
import { persistOrThrow, persistOneOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";

export interface Convenio {
  id: number;
  nome: string;
  registroANS: string;
  tipo: "Saúde" | "Odontológico" | "Ocupacional";
  tabela: string;
  diasRetorno: number;
  ativo: boolean;
  /** Se TRUE, atendimentos cobrados deste convênio liberam coleta/análise mesmo sem pagamento. */
  liberaFluxoSemPagamento: boolean;
  /** Prazo padrão para fechar fatura do convênio (em dias). */
  prazoFaturamentoDias: number;
}

let convenios: Convenio[] = [];
let _listeners: Array<() => void> = [];
function notify() { _listeners.forEach((fn) => fn()); }

function fromRow(r: any): Convenio {
  return {
    id: r.id,
    nome: r.nome,
    registroANS: r.registro_ans ?? "",
    tipo: r.tipo,
    tabela: r.tabela,
    diasRetorno: r.dias_retorno ?? 0,
    ativo: !!r.ativo,
    liberaFluxoSemPagamento: !!r.libera_fluxo_sem_pagamento,
    prazoFaturamentoDias: r.prazo_faturamento_dias ?? 30,
  };
}

function toRow(c: Partial<Convenio>): any {
  const row: Record<string, unknown> = {};
  if (c.id !== undefined) row.id = c.id;
  if (c.nome !== undefined) row.nome = c.nome;
  if (c.registroANS !== undefined) row.registro_ans = c.registroANS;
  if (c.tipo !== undefined) row.tipo = c.tipo;
  if (c.tabela !== undefined) row.tabela = c.tabela;
  if (c.diasRetorno !== undefined) row.dias_retorno = c.diasRetorno;
  if (c.ativo !== undefined) row.ativo = c.ativo;
  if (c.liberaFluxoSemPagamento !== undefined) row.libera_fluxo_sem_pagamento = c.liberaFluxoSemPagamento;
  if (c.prazoFaturamentoDias !== undefined) row.prazo_faturamento_dias = c.prazoFaturamentoDias;
  return row;
}

export async function _initConveniosStore(): Promise<void> {
  const { data, error } = await supabase.from("convenios").select("*").order("id");
  if (error) { showError(error, { scope: "convenioStore.init", silent: true }); return; }
  convenios = (data ?? []).map(fromRow);
  // Garante que o Particular esteja sempre vinculado à tabela Própria
  const particular = convenios.find(c => c.id === 0);
  if (particular && particular.tabela !== "Própria") {
    convenios = convenios.map(c => c.id === 0 ? { ...c, tabela: "Própria" } : c);
    persistOrThrow(
      supabase.from("convenios").update({ tabela: "Própria" }).eq("id", 0),
      "convenioStore.forcarTabelaPropriaParticular",
    ).catch((e) => showError(e, { scope: "convenioStore.forcarTabelaPropriaParticular", silent: true }));
  }
  notify();
}

export const isParticular = (conv: Convenio) => conv.id === 0;

export const getConvenios = (): Convenio[] => convenios;
export const getConveniosAtivos = (): Convenio[] => convenios.filter(c => c.ativo);
export const getConveniosAtivosNomes = (): string[] => convenios.filter(c => c.ativo).map(c => c.nome);

export async function addConvenio(conv: Omit<Convenio, "id">): Promise<Convenio | null> {
  const nextId = (convenios.reduce((max, c) => Math.max(max, c.id), 0)) + 1;
  const novo = { ...conv, id: nextId };
  const prev = convenios;
  convenios = [...convenios, novo];
  notify();
  try {
    const tenant_id = await getCurrentTenantId();
    await persistOneOrThrow(
      supabase.from("convenios").insert({ ...toRow(novo), tenant_id }),
      "convenioStore.add",
    );
    return novo;
  } catch (error) {
    showError(error, { scope: "convenioStore.add", userMessage: "Não foi possível criar o convênio." });
    convenios = prev; notify();
    return null;
  }
}

export async function updateConvenio(id: number, conv: Omit<Convenio, "id">): Promise<boolean> {
  const prev = convenios;
  convenios = convenios.map(c => c.id === id ? { ...conv, id } : c);
  notify();
  try {
    await persistOrThrow(
      supabase.from("convenios").update(toRow(conv)).eq("id", id),
      "convenioStore.update",
    );
    return true;
  } catch (error) {
    showError(error, { scope: "convenioStore.update", userMessage: "Não foi possível atualizar o convênio." });
    convenios = prev; notify();
    return false;
  }
}

export async function removeConvenio(id: number): Promise<boolean> {
  if (id === 0) return false; // Particular protegido
  const prev = convenios;
  convenios = convenios.filter(c => c.id !== id);
  notify();
  try {
    await persistOrThrow(
      supabase.from("convenios").delete().eq("id", id),
      "convenioStore.remove",
    );
    return true;
  } catch (error) {
    showError(error, { scope: "convenioStore.remove", userMessage: "Não foi possível remover o convênio." });
    convenios = prev; notify();
    return false;
  }
}

export async function toggleConvenio(id: number): Promise<boolean> {
  if (id === 0) return false; // Particular sempre ativo
  const c = convenios.find(x => x.id === id);
  if (!c) return false;
  const prev = convenios;
  convenios = convenios.map(x => x.id === id ? { ...x, ativo: !x.ativo } : x);
  notify();
  try {
    await persistOrThrow(
      supabase.from("convenios").update({ ativo: !c.ativo }).eq("id", id),
      "convenioStore.toggle",
    );
    return true;
  } catch (error) {
    showError(error, { scope: "convenioStore.toggle", userMessage: "Não foi possível alternar o status do convênio." });
    convenios = prev; notify();
    return false;
  }
}

export const getTabelaByConvenioNome = (nome: string): string => {
  if (nome === "Particular") return "Própria";
  const conv = convenios.find(c => c.nome === nome);
  return conv?.tabela ?? "Própria";
};

export function subscribeConvenios(listener: () => void) {
  _listeners.push(listener);
  return () => { _listeners = _listeners.filter((l) => l !== listener); };
}
