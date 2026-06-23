/**
 * QUERY PATTERNS OTIMIZADOS
 * 
 * OBJETIVO: Evitar N+1 queries
 * REGRA: USE SEMPRE os padrões deste arquivo
 * 
 * ❌ NÃO faça:
 *    const atendimentos = await supabase.from("atendimentos").select("*");
 *    const comExames = await Promise.all(
 *      atendimentos.map(a => supabase.from("exames").select("*").eq("id", a.exam_id))
 *    );
 * 
 * ✅ FAÇA:
 *    const result = await queryAppointmentsWithExams(tenantId);
 */

import { supabase } from "@/integrations/supabase/client";
import { getTenantIdOrThrow } from "@/lib/tenantValidation";

// ============================================================================
// PADRÃO 1: QUERY COM JOIN
// ============================================================================

/**
 * Carregar atendimentos com exames em uma única query
 * 
 * ANTES (N+1):
 *   - 1 query para atendimentos
 *   - N queries para exames
 *   - Total: N+1 queries
 * 
 * DEPOIS (1 query):
 *   - 1 query com join
 *   - Total: 1 query
 */
export async function queryAppointmentsWithExams(tenantId: string, limit: number = 100) {
  const { data, error } = await supabase
    .from("atendimentos")
    .select(
      `
      *,
      examesCobranca (
        *
      )
    `
    )
    .eq("tenant_id", tenantId)
    .limit(limit);

  if (error) {
    console.error("❌ Erro ao carregar atendimentos com exames", error);
    throw error;
  }

  return data || [];
}

/**
 * Carregar pacientes com atendimentos
 */
export async function queryPatientsWithAppointments(
  tenantId: string,
  limit: number = 100
) {
  const { data, error } = await supabase
    .from("pacientes")
    .select(
      `
      *,
      atendimentos (
        id,
        data,
        convenio_id,
        status
      )
    `
    )
    .eq("tenant_id", tenantId)
    .limit(limit);

  if (error) {
    console.error("❌ Erro ao carregar pacientes com atendimentos", error);
    throw error;
  }

  return data || [];
}

// ============================================================================
// PADRÃO 2: MÚLTIPLAS QUERIES PARALELAS (Em vez de loop)
// ============================================================================

/**
 * Carregar múltiplas tabelas em paralelo
 * 
 * ANTES (sequencial = lento):
 *   const atendimentos = await query1();
 *   const exames = await query2();
 *   const pacientes = await query3();
 *   // Total: 3 segundos se cada leva 1 segundo
 * 
 * DEPOIS (paralelo = rápido):
 *   const [atendimentos, exames, pacientes] = await Promise.all([...])
 *   // Total: 1 segundo
 */
export async function queryFinanceiroData(tenantId: string) {
  const [atendimentos, exames, convenios] = await Promise.all([
    supabase
      .from("atendimentos")
      .select("id, data, paciente_id, convenio_id, status")
      .eq("tenant_id", tenantId),
    supabase
      .from("examesCobranca")
      .select("id, atendimento_id, exame_nome, valor")
      .eq("tenant_id", tenantId),
    supabase
      .from("convenios")
      .select("id, nome, tabela_preco")
      .eq("tenant_id", tenantId),
  ]);

  if (atendimentos.error || exames.error || convenios.error) {
    console.error("❌ Erro ao carregar dados financeiros", {
      atendimentos: atendimentos.error,
      exames: exames.error,
      convenios: convenios.error,
    });
    throw new Error("Erro ao carregar dados");
  }

  return {
    atendimentos: atendimentos.data || [],
    exames: exames.data || [],
    convenios: convenios.data || [],
  };
}

// ============================================================================
// PADRÃO 3: PAGINAÇÃO EFICIENTE
// ============================================================================

/**
 * Carregar com paginação (NUNCA fazer LIMIT sem offset!)
 */
export async function queryPatientsPaginated(
  tenantId: string,
  page: number = 1,
  pageSize: number = 50
) {
  const offset = (page - 1) * pageSize;

  const { data, error, count } = await supabase
    .from("pacientes")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    console.error("❌ Erro ao carregar pacientes", error);
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

// ============================================================================
// PADRÃO 4: FILTRO EFICIENTE (Não usar SELECT * depois filtrar no JS!)
// ============================================================================

/**
 * ❌ NÃO FAÇA:
 *    const todosOsPacientes = await supabase.from("pacientes").select("*");
 *    const ativos = todosOsPacientes.filter(p => p.status === "ativo");
 * 
 * ✅ FAÇA:
 *    const ativos = await supabase.from("pacientes")
 *      .select("*")
 *      .eq("status", "ativo");
 */
export async function queryActivePatients(tenantId: string) {
  const { data, error } = await supabase
    .from("pacientes")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "ativo");

  if (error) throw error;
  return data || [];
}

/**
 * Filtrar por data range
 */
export async function queryAppointmentsByDateRange(
  tenantId: string,
  startDate: string,
  endDate: string
) {
  const { data, error } = await supabase
    .from("atendimentos")
    .select("*")
    .eq("tenant_id", tenantId)
    .gte("data", startDate)
    .lte("data", endDate)
    .order("data", { ascending: false });

  if (error) throw error;
  return data || [];
}

// ============================================================================
// PADRÃO 5: BATCH OPERATIONS (Em vez de loop com inserts)
// ============================================================================

/**
 * ❌ NÃO FAÇA:
 *    for (const item of items) {
 *      await supabase.from("table").insert(item);
 *    }
 * 
 * ✅ FAÇA:
 *    await supabase.from("table").insert(items);
 */
export async function insertMultipleExams(
  exams: Array<{
    atendimento_id: string;
    exame_nome: string;
    valor: number;
    tenant_id: string;
  }>
) {
  if (!exams.length) {
    console.warn("⚠️  Array de exames vazio");
    return [];
  }

  const { data, error } = await supabase
    .from("examesCobranca")
    .insert(exams)
    .select();

  if (error) {
    console.error("❌ Erro ao inserir múltiplos exames", error);
    throw error;
  }

  return data || [];
}

/**
 * Atualizar múltiplos em uma transação (quando possível)
 */
export async function updateMultipleAppointments(
  updates: Array<{
    id: string;
    status: string;
    updated_at: string;
  }>
) {
  if (!updates.length) {
    console.warn("⚠️  Array de atualizações vazio");
    return [];
  }

  // Usar RPC para transação se tiver
  // Senão, fazer updates em paralelo (muito melhor que sequencial)
  const promises = updates.map((update) =>
    supabase
      .from("atendimentos")
      .update({ status: update.status, updated_at: update.updated_at })
      .eq("id", update.id)
  );

  const results = await Promise.all(promises);

  const errors = results.filter((r) => r.error);
  if (errors.length > 0) {
    console.error("❌ Erros ao atualizar", errors);
    throw new Error("Erro ao atualizar dados");
  }

  return results.map((r) => r.data).flat();
}

// ============================================================================
// PADRÃO 6: CACHE INVALIDATION MARKERS
// ============================================================================

/**
 * Marcar query para invalidação
 * USE COM: React Query, SWR, ou seu cache favorito
 */
export const QUERY_KEYS = {
  APPOINTMENTS: "appointments",
  PATIENTS: "patients",
  EXAMS: "exams",
  FINANCEIRO: "financeiro",
  CONVENIOS: "convenios",
} as const;

/**
 * Quando atualizar dados, invalidar cache:
 * 
 * queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PATIENTS] })
 */
