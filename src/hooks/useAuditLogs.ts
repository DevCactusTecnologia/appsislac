// React Query hooks para auditoria operacional consolidada.
// Lê via `operationalAuditReader` (fonte: `public.operational_audit`).
//
// Sigamos a regra de queryKey com prefixo `["tenant", tenantId, ...]`
// (cache governance) — invalida automaticamente ao trocar de tenant.
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  fetchOperationalAuditLogs,
  fetchOperationalAuditTabelas,
} from "@/domains/tenant/services/operationalAuditReader";
import type {
  AuditLogTech,
  FetchAuditLogsParams,
} from "@/data/auditLogsStore";
import { useAuth } from "@/contexts/AuthContext";

export function useAuditLogs(
  params: FetchAuditLogsParams,
  enabled = true,
): UseQueryResult<AuditLogTech[]> {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  return useQuery({
    queryKey: ["tenant", tenantId, "audit", "operational", params],
    queryFn: () => fetchOperationalAuditLogs(params),
    enabled: enabled && !!tenantId,
    staleTime: 30_000,
  });
}

export function useAuditTabelas(enabled = true): UseQueryResult<string[]> {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  return useQuery({
    queryKey: ["tenant", tenantId, "audit", "operational", "tabelas"],
    queryFn: () => fetchOperationalAuditTabelas(),
    enabled: enabled && !!tenantId,
    staleTime: 5 * 60_000,
  });
}
