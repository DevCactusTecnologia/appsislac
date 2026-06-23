/**
 * CONTEXT PARA OPERAÇÕES COMPARTILHADAS
 * 
 * OBJETIVO: Evitar props drilling
 * USE: const { tenant, showError, showSuccess } = useAppContext();
 */

import React, { createContext, useContext, useCallback, ReactNode } from "react";
import { showError, showSuccess } from "@/lib/showError";
import { useTenantId } from "@/lib/tenantValidation";
import { handleError, type ErrorResult } from "@/lib/errorHandling";
import { PERMISSIONS } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";

// ============================================================================
// TYPES
// ============================================================================

interface AppContextType {
  // Tenant
  tenantId: string;

  // User & Permissions
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;

  // Notifications
  notify: (message: string, type: "success" | "error" | "warning") => void;
  notifySuccess: (message: string) => void;
  notifyError: (error: any, context: string) => void;
  notifyWarning: (message: string) => void;

  // Loading states (para componentes loadmapperem algo globalmente)
  setIsLoading: (loading: boolean) => void;
  isLoading: boolean;

  // Refetch functions
  refetch: (key: string) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const AppContext = createContext<AppContextType | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const { user } = useAuth();
  const tenantId = useTenantId();

  /**
   * Validar permissão
   */
  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;

      // Admin tem todas as permissões
      if (user.permissoes.includes(PERMISSIONS.ADMIN_ALL)) {
        return true;
      }

      return user.permissoes.includes(permission);
    },
    [user]
  );

  /**
   * Validar se tem alguma das permissões
   */
  const hasAnyPermission = useCallback(
    (permissions: string[]): boolean => {
      if (!user) return false;

      // Admin tem todas
      if (user.permissoes.includes(PERMISSIONS.ADMIN_ALL)) {
        return true;
      }

      return permissions.some((p) => user.permissoes.includes(p));
    },
    [user]
  );

  /**
   * Notificação genérica
   */
  const notify = useCallback(
    (message: string, type: "success" | "error" | "warning") => {
      if (type === "success") {
        showSuccess(message);
      } else {
        showError(message);
      }
    },
    []
  );

  /**
   * Notificar sucesso
   */
  const notifySuccess = useCallback((message: string) => {
    showSuccess(message);
  }, []);

  /**
   * Notificar erro com contexto
   */
  const notifyError = useCallback((error: any, context: string) => {
    const handled = handleError(error, context);
    showError(handled.message);
  }, []);

  /**
   * Notificar aviso
   */
  const notifyWarning = useCallback((message: string) => {
    showError(`⚠️  ${message}`);
  }, []);

  /**
   * Triggerrefetch (quando implementar React Query)
   */
  const refetch = useCallback((key: string) => {
    // TODO: Integrar com React Query
    console.debug(`[AppContext] Refetch solicitado para: ${key}`);
  }, []);

  const value: AppContextType = {
    tenantId,
    hasPermission,
    hasAnyPermission,
    notify,
    notifySuccess,
    notifyError,
    notifyWarning,
    setIsLoading,
    isLoading,
    refetch,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook para usar AppContext
 * 
 * USE SEMPRE: const { tenantId, hasPermission, notifyError } = useAppContext();
 * 
 * NUNCA: Passe via props para evitar drilling
 */
export function useAppContext(): AppContextType {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useAppContext deve ser usado dentro de AppProvider");
  }

  return context;
}

// ============================================================================
// PERMISSION HELPERS (Type-safe)
// ============================================================================

/**
 * Hook especializado para verificar permissão específica
 */
export function useHasPermission(permission: string): boolean {
  const { hasPermission } = useAppContext();
  return hasPermission(permission);
}

/**
 * Hook para renderizar condicional por permissão
 */
export function usePermissionGuard(permission: string): {
  allowed: boolean;
  PermissionGuard: React.ComponentType<{ children: ReactNode }>;
} {
  const allowed = useHasPermission(permission);

  const PermissionGuard = ({ children }: { children: ReactNode }) => {
    if (!allowed) return null;
    return <>{children}</>;
  };

  return { allowed, PermissionGuard };
}
