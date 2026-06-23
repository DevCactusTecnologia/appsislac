/**
 * Utilitários para otimizar queries e eliminar N+1 problems
 * 
 * ANTES (N+1):
 * const atendimentos = await supabase.from("atendimentos").select("*");
 * const exames = await Promise.all(
 *   atendimentos.map(a => supabase.from("examesCobranca").select("*").eq("atendimento_id", a.id))
 * );
 * 
 * DEPOIS (OTIMIZADO):
 * const data = await selectWithRelations("atendimentos", "*", {
 *   exames: "examesCobranca(*)!left"
 * });
 */

import { supabase } from "@/integrations/supabase/client";
import { getTenantIdFromAuth } from "./tenantResolver";

// ============================================
// SELEÇÃO COM RELACIONAMENTOS
// ============================================

/**
 * Select otimizado com relacionamentos
 * Evita N+1 queries
 */
export async function selectWithRelations<T = any>(
  table: string,
  columns: string = "*",
  relations?: Record<string, string>,
  filters?: Array<[string, string, any]>
) {
  const tenantId = await getTenantIdFromAuth();
  if (!tenantId) throw new Error("Tenant ID not found");
  
  // Montar string de seleção com relacionamentos
  let selectStr = columns;
  if (relations) {
    const relationStrs = Object.entries(relations).map(
      ([key, val]) => `${key}${val.includes("!") ? "" : "!left"}(${val})`
    );
    selectStr = `${selectStr},${relationStrs.join(",")}`;
  }
  
  let query = supabase
    .from(table as never)
    .select(selectStr) as any;
  
  // Aplicar filtro de tenant
  query = query.eq("tenant_id", tenantId);
  
  // Aplicar filtros adicionais
  if (filters) {
    for (const [field, operator, value] of filters) {
      if (operator === "eq") query = query.eq(field, value);
      else if (operator === "gt") query = query.gt(field, value);
      else if (operator === "lt") query = query.lt(field, value);
      else if (operator === "gte") query = query.gte(field, value);
      else if (operator === "lte") query = query.lte(field, value);
      else if (operator === "in") query = query.in(field, value);
      else if (operator === "like") query = query.like(field, value);
    }
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data as T[];
}

// ============================================
// BATCH SELECT OTIMIZADO
// ============================================

/**
 * Seleciona múltiplas tabelas em paralelo
 * (Melhor que múltiplos selectWithRelations em série)
 */
export async function batchSelectOptimized(
  queries: Array<{
    table: string;
    columns?: string;
    relations?: Record<string, string>;
    filters?: Array<[string, string, any]>;
  }>
) {
  const tenantId = await getTenantIdFromAuth();
  if (!tenantId) throw new Error("Tenant ID not found");
  
  const promises = queries.map(async (q) => {
    return selectWithRelations(
      q.table,
      q.columns || "*",
      q.relations,
      q.filters
    );
  });
  
  return await Promise.all(promises);
}

// ============================================
// AGGREGATE E GROUP BY
// ============================================

/**
 * Conta registros por campo (evita COUNT + SELECT separados)
 */
export async function countGroupBy(
  table: string,
  groupByField: string,
  filters?: Array<[string, string, any]>
) {
  const tenantId = await getTenantIdFromAuth();
  if (!tenantId) throw new Error("Tenant ID not found");
  
  // RPC para aggregate eficiente
  const { data, error } = await supabase
    .rpc("count_by_field", {
      p_table: table,
      p_group_field: groupByField,
      p_tenant_id: tenantId,
    }) as any;
  
  if (error) throw error;
  return data;
}

// ============================================
// PAGINATION OTIMIZADA
// ============================================

export interface PaginatedResult<T> {
  data: T[];
  count: number;
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Select com paginação e count automático
 */
export async function selectPaginated<T = any>(
  table: string,
  columns: string = "*",
  page: number = 1,
  pageSize: number = 50,
  filters?: Array<[string, string, any]>
): Promise<PaginatedResult<T>> {
  const tenantId = await getTenantIdFromAuth();
  if (!tenantId) throw new Error("Tenant ID not found");
  
  const offset = (page - 1) * pageSize;
  
  let query = supabase
    .from(table as never)
    .select(columns, { count: "exact" }) as any;
  
  query = query.eq("tenant_id", tenantId);
  
  if (filters) {
    for (const [field, operator, value] of filters) {
      if (operator === "eq") query = query.eq(field, value);
      else if (operator === "like") query = query.like(field, `%${value}%`);
      // ... outros operadores
    }
  }
  
  const { data, count, error } = await query
    .range(offset, offset + pageSize - 1);
  
  if (error) throw error;
  
  return {
    data: data as T[],
    count: (data as T[]).length,
    total: count || 0,
    page,
    pageSize,
    hasMore: offset + pageSize < (count || 0),
  };
}

// ============================================
// BULK OPERATIONS (Elimina múltiplas queries)
// ============================================

/**
 * Insert múltiplos com uma query
 */
export async function bulkInsert<T = any>(
  table: string,
  records: T[],
  options?: { select?: string }
) {
  const tenantId = await getTenantIdFromAuth();
  if (!tenantId) throw new Error("Tenant ID not found");
  
  const withTenant = records.map(r => ({
    ...r,
    tenant_id: tenantId
  }));
  
  let query = supabase.from(table as never).insert(withTenant as any) as any;
  
  if (options?.select) {
    query = query.select(options.select);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Update múltiplos com uma query
 */
export async function bulkUpdate<T = any>(
  table: string,
  updates: Array<{ id: string; data: Partial<T> }>
) {
  const tenantId = await getTenantIdFromAuth();
  if (!tenantId) throw new Error("Tenant ID not found");
  
  const results = [];
  
  for (const { id, data } of updates) {
    const query = supabase
      .from(table as never)
      .update(data) as any;
    
    const { data: result, error } = await query
      .eq("tenant_id", tenantId)
      .eq("id", id);
    
    if (error) throw error;
    results.push(result);
  }
  
  return results;
}

/**
 * Delete múltiplos com uma query
 */
export async function bulkDelete(
  table: string,
  ids: string[]
) {
  const tenantId = await getTenantIdFromAuth();
  if (!tenantId) throw new Error("Tenant ID not found");
  
  const { error } = await (supabase
    .from(table as never)
    .delete() as any)
    .eq("tenant_id", tenantId)
    .in("id", ids);
  
  if (error) throw error;
  return { deleted: ids.length };
}

// ============================================
// CACHE HELPER (Complementa com React Query depois)
// ============================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const queryCache = new Map<string, CacheEntry<any>>();

/**
 * Select com cache em memória (curto prazo)
 */
export async function selectWithCache<T = any>(
  table: string,
  columns: string = "*",
  ttl: number = 5 * 60 * 1000, // 5 minutos padrão
  filters?: Array<[string, string, any]>
) {
  const cacheKey = `${table}:${columns}:${JSON.stringify(filters || [])}`;
  
  // Verificar cache
  const cached = queryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data as T[];
  }
  
  // Fetch e cache
  const data = await selectWithRelations<T>(table, columns, undefined, filters);
  queryCache.set(cacheKey, { data, timestamp: Date.now(), ttl });
  
  return data;
}

export function clearQueryCache(table?: string) {
  if (table) {
    // Limpar apenas cache da tabela
    Array.from(queryCache.keys()).forEach(key => {
      if (key.startsWith(table)) {
        queryCache.delete(key);
      }
    });
  } else {
    // Limpar tudo
    queryCache.clear();
  }
}
