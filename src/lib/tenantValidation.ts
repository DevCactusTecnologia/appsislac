/**
 * VALIDAÇÃO CENTRALIZADA DE TENANT
 * 
 * REGRA OURO: Toda operação que acessa dados deve validar tenant_id
 * Nenhuma exceção. Falha segura em caso de dúvida.
 */

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Erro customizado para problemas de tenant
 */
export class TenantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantError";
  }
}

/**
 * Obter tenant_id do usuário autenticado (OBRIGATÓRIO)
 * FALHA SEGURA: Lança erro se não conseguir resolver
 */
export async function getTenantIdOrThrow(): Promise<string> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      throw new TenantError("❌ Usuário não autenticado");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const tenantId = (profile as { tenant_id?: string } | null)?.tenant_id;

    if (!tenantId) {
      console.error("❌ Tenant ID não encontrado para usuário", user.id);
      throw new TenantError("Seu acesso não foi configurado corretamente");
    }

    // Validar se tenant está ativo
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("status")
      .eq("id", tenantId)
      .single();

    if (tenantError || !tenant) {
      console.error("❌ Tenant não encontrado ou erro ao validar", tenantId);
      throw new TenantError("Seu laboratório foi desativado");
    }

    if ((tenant as { status?: string }).status !== "ativo") {
      console.error("❌ Tenant inativo", tenantId);
      throw new TenantError("Seu laboratório está inativo");
    }

    return tenantId;
  } catch (error) {
    if (error instanceof TenantError) {
      throw error;
    }
    console.error("❌ Erro ao resolver tenant", error);
    throw new TenantError("Erro ao validar acesso - entre em contato com suporte");
  }
}

/**
 * Hook React para obter tenant_id
 * USE SEMPRE: const tenantId = useTenantId();
 */
export function useTenantId(): string {
  const { user } = useAuth();

  if (!user?.tenantId) {
    throw new TenantError("❌ Tenant ID não disponível");
  }

  return user.tenantId;
}

/**
 * Validar se um tenant_id pertence ao usuário atual
 * SEGURANÇA: Impede acesso cruzado de tenants
 */
export async function validateTenantAccess(
  requestedTenantId: string
): Promise<boolean> {
  try {
    const userTenantId = await getTenantIdOrThrow();

    if (requestedTenantId !== userTenantId) {
      console.error(
        "❌ ACESSO NEGADO: Tentativa de acesso cruzado de tenant",
        { requested: requestedTenantId, actual: userTenantId }
      );
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * HELPERS para garantir tenant_id em queries
 */

/**
 * Adicionar automaticamente tenant_id a INSERT/UPDATE/DELETE
 * EXEMPLO:
 *   const query = supabase.from("pacientes").select("*");
 *   const safe = withTenantFilter(query, tenantId);
 */
export function withTenantFilter<T>(
  query: any,
  tenantId: string
): any {
  if (!tenantId) {
    throw new TenantError("❌ Tenant ID ausente - operação bloqueada");
  }
  return query.eq("tenant_id", tenantId);
}

/**
 * Validar que um objeto tem tenant_id antes de inserir
 */
export function ensureTenantIdInObject<T extends Record<string, any>>(
  obj: T,
  tenantId: string
): T & { tenant_id: string } {
  if (!tenantId) {
    throw new TenantError("❌ Tenant ID ausente - não é possível salvar");
  }

  return {
    ...obj,
    tenant_id: tenantId,
  };
}

/**
 * Validar array de objetos antes de inserir
 */
export function ensureTenantIdInArray<T extends Record<string, any>>(
  items: T[],
  tenantId: string
): (T & { tenant_id: string })[] {
  if (!tenantId) {
    throw new TenantError("❌ Tenant ID ausente - não é possível salvar");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new TenantError("❌ Array vazio ou inválido");
  }

  return items.map((item) => ({
    ...item,
    tenant_id: tenantId,
  }));
}

/**
 * Middleware para funções assíncronas
 * EXEMPLO:
 *   const safeLoadPatients = withTenantValidation(loadPatients);
 *   const patients = await safeLoadPatients();
 */
export function withTenantValidation<T extends (...args: any[]) => Promise<any>>(
  fn: T
): T {
  return (async (...args: any[]) => {
    await getTenantIdOrThrow();
    return fn(...args);
  }) as T;
}
