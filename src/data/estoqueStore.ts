/**
 * Estoque Store — gestão de insumos, lotes e movimentações.
 * Multi-tenant via RLS (current_tenant_id() + has_role admin para mutações).
 */
import { supabase } from "@/integrations/supabase/client";
import { persistOneOrThrow, persistOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";

export type LoteStatus = "ativo" | "esgotado" | "vencido" | "descartado";
export type MovimentacaoTipo = "entrada" | "saida" | "ajuste" | "descarte";
export type CategoriaInsumo = "Reagentes" | "Descartáveis" | "EPIs" | "Tubos/Recipientes" | "Outros";

export const CATEGORIAS_INSUMO: CategoriaInsumo[] = [
  "Reagentes",
  "Descartáveis",
  "EPIs",
  "Tubos/Recipientes",
  "Outros",
];

export const UNIDADES_MEDIDA = ["un", "cx", "frasco", "kit", "mL", "L", "g", "kg", "par", "rolo"] as const;

export interface Fornecedor {
  id: string;
  tenant_id: string;
  nome: string;
  cnpj: string;
  contato: string;
  telefone: string;
  email: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Insumo {
  id: string;
  tenant_id: string;
  codigo: string;
  nome: string;
  categoria: string;
  unidade_medida: string;
  fornecedor_id: string | null;
  estoque_minimo: number;
  alerta_validade_dias: number;
  observacao: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lote {
  id: string;
  tenant_id: string;
  insumo_id: string;
  numero_lote: string;
  data_validade: string;
  quantidade_inicial: number;
  quantidade_atual: number;
  custo_unitario: number;
  fornecedor_id: string | null;
  data_entrada: string;
  nota_fiscal: string;
  observacao: string;
  status: LoteStatus;
  created_at: string;
  updated_at: string;
}

export interface Movimentacao {
  id: number;
  tenant_id: string;
  insumo_id: string;
  lote_id: string | null;
  tipo: MovimentacaoTipo;
  quantidade: number;
  motivo: string;
  observacao: string;
  usuario_email: string;
  data: string;
  created_at: string;
}

/* ─── Resolver tenant atual (para insert) ─── */
async function getTenantId(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  return profile?.tenant_id ?? null;
}

async function getUserEmail(): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  return userData?.user?.email ?? "";
}

/* ─── FORNECEDORES ─── */
export async function listarFornecedores(): Promise<Fornecedor[]> {
  const { data, error } = await supabase
    .from("estoque_fornecedores")
    .select("*")
    .order("nome");
  if (error) {
    showError(error, { scope: "estoque.listarFornecedores", silent: true });
    return [];
  }
  return (data ?? []) as Fornecedor[];
}

export async function salvarFornecedor(f: Partial<Fornecedor> & { nome: string }): Promise<{ ok: boolean; error?: string; data?: Fornecedor }> {
  const tenantId = await getTenantId();
  if (!tenantId) return { ok: false, error: "no-tenant" };

  const payload = {
    nome: f.nome,
    cnpj: f.cnpj ?? "",
    contato: f.contato ?? "",
    telefone: f.telefone ?? "",
    email: f.email ?? "",
    ativo: f.ativo ?? true,
  };
  try {
    if (f.id) {
      const data = await persistOneOrThrow<Fornecedor>(
        supabase.from("estoque_fornecedores").update(payload).eq("id", f.id),
        "estoque.fornecedor.atualizar",
      );
      return { ok: true, data };
    }
    const data = await persistOneOrThrow<Fornecedor>(
      supabase.from("estoque_fornecedores").insert({ tenant_id: tenantId, ...payload }),
      "estoque.fornecedor.criar",
    );
    return { ok: true, data };
  } catch (e) {
    showError(e, { scope: "estoqueStore.salvarFornecedor", silent: true });
    return { ok: false, error: (e as Error).message };
  }
}

export async function excluirFornecedor(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await persistOrThrow(
      supabase.from("estoque_fornecedores").delete().eq("id", id),
      "estoque.fornecedor.excluir",
    );
    return { ok: true };
  } catch (e) {
    showError(e, { scope: "estoqueStore.excluirFornecedor", silent: true });
    return { ok: false, error: (e as Error).message };
  }
}

/* ─── INSUMOS ─── */
export async function listarInsumos(): Promise<Insumo[]> {
  const { data, error } = await supabase
    .from("estoque_insumos")
    .select("*")
    .order("nome");
  if (error) {
    showError(error, { scope: "estoque.listarInsumos", silent: true });
    return [];
  }
  return (data ?? []) as Insumo[];
}

export async function salvarInsumo(i: Partial<Insumo> & { nome: string }): Promise<{ ok: boolean; error?: string; data?: Insumo }> {
  const tenantId = await getTenantId();
  if (!tenantId) return { ok: false, error: "no-tenant" };

  const payload = {
    codigo: i.codigo ?? "",
    nome: i.nome,
    categoria: i.categoria ?? "Outros",
    unidade_medida: i.unidade_medida ?? "un",
    fornecedor_id: i.fornecedor_id ?? null,
    estoque_minimo: i.estoque_minimo ?? 0,
    alerta_validade_dias: i.alerta_validade_dias ?? 30,
    observacao: i.observacao ?? "",
    ativo: i.ativo ?? true,
  };

  try {
    if (i.id) {
      const data = await persistOneOrThrow<Insumo>(
        supabase.from("estoque_insumos").update(payload).eq("id", i.id),
        "estoque.insumo.atualizar",
      );
      return { ok: true, data };
    }
    const data = await persistOneOrThrow<Insumo>(
      supabase.from("estoque_insumos").insert({ tenant_id: tenantId, ...payload }),
      "estoque.insumo.criar",
    );
    return { ok: true, data };
  } catch (e) {
    showError(e, { scope: "estoqueStore.salvarInsumo", silent: true });
    return { ok: false, error: (e as Error).message };
  }
}

export async function excluirInsumo(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await persistOrThrow(
      supabase.from("estoque_insumos").delete().eq("id", id),
      "estoque.insumo.excluir",
    );
    return { ok: true };
  } catch (e) {
    showError(e, { scope: "estoqueStore.excluirInsumo", silent: true });
    return { ok: false, error: (e as Error).message };
  }
}

/* ─── LOTES ─── */
export async function listarLotes(insumoId?: string): Promise<Lote[]> {
  let query = supabase.from("estoque_lotes").select("*").order("data_validade", { ascending: true });
  if (insumoId) query = query.eq("insumo_id", insumoId);
  const { data, error } = await query;
  if (error) {
    showError(error, { scope: "estoque.listarLotes", silent: true });
    return [];
  }
  return (data ?? []) as Lote[];
}

export async function salvarLote(l: Partial<Lote> & { insumo_id: string; numero_lote: string; data_validade: string }): Promise<{ ok: boolean; error?: string; data?: Lote }> {
  const tenantId = await getTenantId();
  if (!tenantId) return { ok: false, error: "no-tenant" };

  const qtdInicial = l.quantidade_inicial ?? 0;
  const payload = {
    insumo_id: l.insumo_id,
    numero_lote: l.numero_lote,
    data_validade: l.data_validade,
    quantidade_inicial: qtdInicial,
    quantidade_atual: l.quantidade_atual ?? qtdInicial,
    custo_unitario: l.custo_unitario ?? 0,
    fornecedor_id: l.fornecedor_id ?? null,
    data_entrada: l.data_entrada ?? new Date().toISOString().slice(0, 10),
    nota_fiscal: l.nota_fiscal ?? "",
    observacao: l.observacao ?? "",
    status: l.status ?? "ativo",
  };

  try {
    if (l.id) {
      const data = await persistOneOrThrow<Lote>(
        supabase.from("estoque_lotes").update(payload).eq("id", l.id),
        "estoque.lote.atualizar",
      );
      return { ok: true, data };
    }
    const data = await persistOneOrThrow<Lote>(
      supabase.from("estoque_lotes").insert({ tenant_id: tenantId, ...payload }),
      "estoque.lote.criar",
    );
    if (data && qtdInicial > 0) {
      await registrarMovimentacao({
        insumo_id: l.insumo_id,
        lote_id: data.id,
        tipo: "entrada",
        quantidade: qtdInicial,
        motivo: "Entrada inicial do lote",
      });
    }
    return { ok: true, data };
  } catch (e) {
    showError(e, { scope: "estoqueStore.salvarLote", silent: true });
    return { ok: false, error: (e as Error).message };
  }
}

export async function excluirLote(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await persistOrThrow(
      supabase.from("estoque_lotes").delete().eq("id", id),
      "estoque.lote.excluir",
    );
    return { ok: true };
  } catch (e) {
    showError(e, { scope: "estoqueStore.excluirLote", silent: true });
    return { ok: false, error: (e as Error).message };
  }
}

/* ─── MOVIMENTAÇÕES ─── */
export async function listarMovimentacoes(filtros?: { insumoId?: string; loteId?: string; limit?: number }): Promise<Movimentacao[]> {
  let query = supabase.from("estoque_movimentacoes").select("*").order("data", { ascending: false });
  if (filtros?.insumoId) query = query.eq("insumo_id", filtros.insumoId);
  if (filtros?.loteId) query = query.eq("lote_id", filtros.loteId);
  if (filtros?.limit) query = query.limit(filtros.limit);
  const { data, error } = await query;
  if (error) {
    showError(error, { scope: "estoque.listarMovimentacoes", silent: true });
    return [];
  }
  return (data ?? []) as Movimentacao[];
}

export async function registrarMovimentacao(m: Partial<Movimentacao> & { insumo_id: string; tipo: MovimentacaoTipo; quantidade: number }): Promise<{ ok: boolean; error?: string }> {
  const tenantId = await getTenantId();
  if (!tenantId) return { ok: false, error: "no-tenant" };
  const email = await getUserEmail();

  try {
    await persistOneOrThrow(
      supabase.from("estoque_movimentacoes").insert({
        tenant_id: tenantId,
        insumo_id: m.insumo_id,
        lote_id: m.lote_id ?? null,
        tipo: m.tipo,
        quantidade: m.quantidade,
        motivo: m.motivo ?? "",
        observacao: m.observacao ?? "",
        usuario_email: email,
        data: m.data ?? new Date().toISOString(),
      }),
      "estoque.movimentacao.registrar",
    );
    return { ok: true };
  } catch (e) {
    showError(e, { scope: "estoqueStore.registrarMovimentacao", silent: true });
    return { ok: false, error: (e as Error).message };
  }
}

/* ─── HELPERS visuais ─── */
export type ValidadeStatus = "ok" | "vence_em_breve" | "vencido";

export function statusValidade(dataValidade: string, alertaDias: number = 30): ValidadeStatus {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const validade = new Date(dataValidade);
  validade.setHours(0, 0, 0, 0);
  const diffDias = Math.floor((validade.getTime() - hoje.getTime()) / 86_400_000);
  if (diffDias < 0) return "vencido";
  if (diffDias <= alertaDias) return "vence_em_breve";
  return "ok";
}

export function diasParaVencer(dataValidade: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const validade = new Date(dataValidade);
  validade.setHours(0, 0, 0, 0);
  return Math.floor((validade.getTime() - hoje.getTime()) / 86_400_000);
}

/** Soma estoque atual de todos lotes ativos de um insumo. */
export function totalEstoque(lotes: Lote[], insumoId: string): number {
  return lotes
    .filter((l) => l.insumo_id === insumoId && l.status === "ativo")
    .reduce((sum, l) => sum + Number(l.quantidade_atual), 0);
}