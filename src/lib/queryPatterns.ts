/**
 * QUERY PATTERNS - ANTI-N+1 E OTIMIZAÇÕES
 * 
 * Padrões de query otimizadas para Supabase
 * Nunca chamar essas queries em loop!
 */

import { db as supabase } from "@/runtime/db";

/**
 * Cache keys para React Query / SWR
 */
export const QUERY_KEYS = {
  APPOINTMENTS: "appointments",
  PATIENTS: "patients",
  EXAMS: "exams",
  FINANCEIRO: "financeiro",
  CONVENIOS: "convenios",
  SOROTECA: "soroteca",
} as const;

/**
 * Query: Listar atendimentos COM exames (1 query, não N+1)
 * 
 * ❌ ERRADO:
 * const appointments = await getAppointments();
 * for (const apt of appointments) {
 *   apt.exams = await getExams(apt.id); // N queries!
 * }
 * 
 * ✅ CORRETO: Usar função abaixo
 */
export async function queryAppointmentsWithExams(
  tenantId: string,
  filters?: {
    status?: string;
    limit?: number;
    offset?: number;
  }
) {
  const query = (supabase as any)
    .from("atendimentos")
    .select(`
      id,
      paciente_id,
      convenio_id,
      status,
      data_atendimento,
      valor_total,
      examesCobranca (
        id,
        nome_exame,
        quantidade,
        valor_unitario,
        valor_total
      )
    `)
    .eq("tenant_id", tenantId);

  if (filters?.status) {
    query.eq("status", filters.status);
  }

  if (filters?.limit) {
    query.limit(filters.limit);
  }

  if (filters?.offset) {
    query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error("❌ Erro ao listar atendimentos com exames:", error);
    throw error;
  }

  return data || [];
}

/**
 * Query: Listar pacientes COM paginação
 * Nunca fazer select sem limit!
 */
export async function queryPatientsPaginated(
  tenantId: string,
  page: number = 1,
  pageSize: number = 25
) {
  const offset = (page - 1) * pageSize;

  const { data, count, error } = await (supabase as any)
    .from("pacientes")
    .select(
      `
        id,
        nome,
        cpf,
        email,
        telefone,
        data_cadastro,
        status
      `,
      { count: "exact" }
    )
    .eq("tenant_id", tenantId)
    .range(offset, offset + pageSize - 1)
    .order("data_cadastro", { ascending: false });

  if (error) {
    console.error("❌ Erro ao listar pacientes:", error);
    throw error;
  }

  return {
    data: data || [],
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  };
}

/**
 * Query: Dados financeiros (múltiplas tabelas em paralelo)
 * Use Promise.all() para paralelizar queries independentes
 */
export async function queryFinanceiroData(tenantId: string) {
  const [entradas, saidas, aReceberData, faturadasData] = await Promise.all([
    // Entradas (faturamento)
    (supabase as any)
      .from("financeiro_entradas")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("data", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),

    // Saídas (despesas)
    (supabase as any)
      .from("financeiro_saidas")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("data", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),

    // A receber
    (supabase as any)
      .from("atendimentos")
      .select("id, valor_total, status")
      .eq("tenant_id", tenantId)
      .eq("status", "a_receber"),

    // Faturadas
    (supabase as any)
      .from("atendimentos")
      .select("id, valor_total, status")
      .eq("tenant_id", tenantId)
      .eq("status", "faturado"),
  ]);

  return {
    entradas: entradas.data || [],
    saidas: saidas.data || [],
    aReceber: aReceberData.data || [],
    faturadas: faturadasData.data || [],
  };
}

/**
 * Insert: Múltiplos exames em uma única operação (batch)
 * 
 * ❌ ERRADO:
 * for (const exam of exams) {
 *   await insert(exam); // N inserts!
 * }
 * 
 * ✅ CORRETO: Usar função abaixo
 */
export async function insertMultipleExams(
  exams: Array<{
    atendimento_id: string;
    nome_exame: string;
    quantidade: number;
    valor_unitario: number;
    tenant_id: string;
  }>
) {
  if (exams.length === 0) {
    return [];
  }

  const { data, error } = await (supabase as any)
    .from("examesCobranca")
    .insert(exams)
    .select();

  if (error) {
    console.error("❌ Erro ao inserir exames:", error);
    throw error;
  }

  return data || [];
}

/**
 * Update: Batch update de status
 */
export async function updateMultipleStatus(
  tenantId: string,
  ids: string[],
  newStatus: string
) {
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await (supabase as any)
    .from("atendimentos")
    .update({ status: newStatus })
    .eq("tenant_id", tenantId)
    .in("id", ids)
    .select();

  if (error) {
    console.error("❌ Erro ao atualizar status:", error);
    throw error;
  }

  return data || [];
}

/**
 * Delete: Batch delete com validação de tenant
 */
export async function deleteMultipleExams(tenantId: string, ids: string[]) {
  if (ids.length === 0) {
    return;
  }

  const { error } = await (supabase as any)
    .from("examesCobranca")
    .delete()
    .eq("tenant_id", tenantId)
    .in("id", ids);

  if (error) {
    console.error("❌ Erro ao deletar exames:", error);
    throw error;
  }
}

/**
 * Contagem: Com filtro e tenant
 */
export async function countAppointments(
  tenantId: string,
  filters?: { status?: string }
): Promise<number> {
  let query = (supabase as any)
    .from("atendimentos")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { count, error } = await query;

  if (error) {
    console.error("❌ Erro ao contar atendimentos:", error);
    return 0;
  }

  return count || 0;
}

/**
 * Search: Busca full-text com tenant
 */
export async function searchPatients(
  tenantId: string,
  searchTerm: string,
  limit: number = 10
) {
  const { data, error } = await (supabase as any)
    .from("pacientes")
    .select("id, nome, cpf, email")
    .eq("tenant_id", tenantId)
    .or(`nome.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
    .limit(limit);

  if (error) {
    console.error("❌ Erro ao buscar pacientes:", error);
    return [];
  }

  return data || [];
}
