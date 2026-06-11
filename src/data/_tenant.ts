/**
 * Proxy Legado para o Tenant Resolver consolidado.
 * 
 * TODO: Migrar call sites para import { ... } from "@/lib/db/tenantResolver"
 * e remover este arquivo na Fase 4 (Simplificação Extrema).
 */

import { 
  getCurrentTenantId as _getId, 
  getCurrentTenantNome as _getNome,
  clearTenantContextCache as _clear,
  getCachedTenantNome as _getCachedNome,
  installTenantAuthInvalidation as _install
} from "@/lib/db/tenantResolver";

export const getCurrentTenantId = _getId;
export const getCurrentTenantNome = _getNome;
export const clearTenantCache = _clear;
export const getCachedTenantNome = _getCachedNome;
export const installTenantAuthInvalidation = _install;
