/**
 * Camada centralizada de queries seguras com validação de tenant_id obrigatória
 * 
 * REGRA: TODA query DEVE passar por esta camada
 * - Força validação de tenant_id
 * - Previne vazamento de dados
 * - Garante RLS ativo
 */

import { supabase } from "@/integrations/supabase/client";
import { getTenantIdFromAuth } from "./tenantResolver";

export class TenantValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantValidationError";
  }
}

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityError";
  }
}

/**
 * Valida que tenant_id existe e é válido
 * SEMPRE chamar antes de queries
 */
export async function validateTenantId(): Promise<string> {
  const tenantId = await getTenantIdFromAuth();
  
  if (!tenantId) {
    throw new TenantValidationError(
      "Tenant ID não identificado - acesso negado"
    );
  }
  
  if (typeof tenantId !== "string" || !tenantId.match(/^[a-f0-9-]{36}$/i)) {
    throw new TenantValidationError(
      "Tenant ID inválido - formato incorreto"
    );
  }
  
  return tenantId;
}

/**
 * SELECT com validação obrigatória de tenant_id
 * 
 * ANTES (INSEGURO):
 * const data = await supabase.from("pacientes").select("*");
 * 
 * DEPOIS (SEGURO):
 * const data = await secureSelect("pacientes", "*");
 */
export async function secureSelect<T = any>(
  table: string,
  columns: string = "*",
  options?: {
    filter?: (query: any) => any;
    single?: boolean;
  }
) {
  const tenantId = await validateTenantId();
  
  let query = supabase
    .from(table as never)
    .select(columns) as any;
  
  // ✅ OBRIGATÓRIO: Filtrar por tenant_id
  query = query.eq("tenant_id", tenantId);
  
  // Aplicar filtros adicionais se fornecidos
  if (options?.filter) {
    query = options.filter(query);
  }
  
  const result = options?.single
    ? await query.maybeSingle()
    : await query;
  
  if (result.error) {
    console.error(`[secureSelect] Erro em ${table}:`, result.error);
    throw new SecurityError(`Falha ao carregar dados de ${table}`);
  }
  
  return result.data as T[];
}

/**
 * INSERT com validação obrigatória de tenant_id
 * 
 * ANTES (INSEGURO):
 * await supabase.from("pacientes").insert({ nome: "João" });
 * 
 * DEPOIS (SEGURO):
 * await secureInsert("pacientes", { nome: "João" });
 */
export async function secureInsert<T = any>(
  table: string,
  data: Record<string, any> | Record<string, any>[],
  options?: {
    select?: string;
  }
) {
  const tenantId = await validateTenantId();
  
  // Garantir que tenant_id está presente
  const dataWithTenant = Array.isArray(data)
    ? data.map(d => ({ ...d, tenant_id: tenantId }))
    : { ...data, tenant_id: tenantId };
  
  let query = supabase
    .from(table as never)
    .insert(dataWithTenant as any) as any;
  
  if (options?.select) {
    query = query.select(options.select);
  }
  
  const result = await query;
  
  if (result.error) {
    console.error(`[secureInsert] Erro em ${table}:`, result.error);
    throw new SecurityError(`Falha ao inserir em ${table}`);
  }
  
  return result.data as T[];
}

/**
 * UPDATE com validação obrigatória de tenant_id
 * 
 * ANTES (INSEGURO):
 * await supabase.from("pacientes").update({ nome: "José" }).eq("id", id);
 * 
 * DEPOIS (SEGURO):
 * await secureUpdate("pacientes", { nome: "José" }, id);
 */
export async function secureUpdate<T = any>(
  table: string,
  data: Record<string, any>,
  id: string,
  options?: {
    idColumn?: string;
    select?: string;
  }
) {
  const tenantId = await validateTenantId();
  const idColumn = options?.idColumn || "id";
  
  // Previne atualização de tenant_id (segurança)
  if (data.tenant_id && data.tenant_id !== tenantId) {
    throw new SecurityError("Tentativa de mudar tenant_id - operação bloqueada");
  }
  
  let query = supabase
    .from(table as never)
    .update(data) as any;
  
  // ✅ OBRIGATÓRIO: Filtrar por tenant_id E id
  query = query
    .eq("tenant_id", tenantId)
    .eq(idColumn, id);
  
  if (options?.select) {
    query = query.select(options.select);
  }
  
  const result = await query;
  
  if (result.error) {
    console.error(`[secureUpdate] Erro em ${table}:`, result.error);
    throw new SecurityError(`Falha ao atualizar ${table}`);
  }
  
  // Verificar se alguma linha foi atualizada
  if (result.data && Array.isArray(result.data) && result.data.length === 0) {
    throw new SecurityError(`Registro não encontrado ou sem permissão`);
  }
  
  return result.data as T[];
}

/**
 * DELETE com validação obrigatória de tenant_id
 * 
 * ANTES (INSEGURO):
 * await supabase.from("pacientes").delete().eq("id", id);
 * 
 * DEPOIS (SEGURO):
 * await secureDelete("pacientes", id);
 */
export async function secureDelete(
  table: string,
  id: string,
  options?: {
    idColumn?: string;
    select?: string;
  }
) {
  const tenantId = await validateTenantId();
  const idColumn = options?.idColumn || "id";
  
  let query = supabase
    .from(table as never)
    .delete() as any;
  
  // ✅ OBRIGATÓRIO: Filtrar por tenant_id E id
  query = query
    .eq("tenant_id", tenantId)
    .eq(idColumn, id);
  
  if (options?.select) {
    query = query.select(options.select);
  }
  
  const result = await query;
  
  if (result.error) {
    console.error(`[secureDelete] Erro em ${table}:`, result.error);
    throw new SecurityError(`Falha ao deletar em ${table}`);
  }
  
  return result.data;
}

/**
 * Wrapper para operações em lote com validação
 */
export async function secureBatch(
  operations: Array<{
    type: "select" | "insert" | "update" | "delete";
    table: string;
    data?: any;
    id?: string;
    columns?: string;
    filter?: (q: any) => any;
  }>
) {
  const tenantId = await validateTenantId();
  
  const results = [];
  
  for (const op of operations) {
    try {
      let result;
      
      switch (op.type) {
        case "select":
          result = await secureSelect(op.table, op.columns, {
            filter: op.filter,
          });
          break;
          
        case "insert":
          result = await secureInsert(op.table, op.data);
          break;
          
        case "update":
          result = await secureUpdate(op.table, op.data, op.id!);
          break;
          
        case "delete":
          result = await secureDelete(op.table, op.id!);
          break;
      }
      
      results.push({ success: true, data: result });
    } catch (error) {
      results.push({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  }
  
  return results;
}
