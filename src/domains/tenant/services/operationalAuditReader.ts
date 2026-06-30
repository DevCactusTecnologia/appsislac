// Reader consolidado de auditoria operacional.
//
// Lê de `public.operational_audit` (fonte unificada — alimentada por
// triggers em `audit_logs`, `atendimento_audit`, `storage_audit` etc.)
// e devolve o mesmo shape de `AuditLogTech` consumido pela UI legada,
// reconstituindo `antes/depois/user_email` a partir de `contexto` JSONB.
//
// Mantém o contrato de `fetchAuditLogs` para que os consumidores
// existentes (Auditoria.tsx, AuditoriaTecnicaTab.tsx) possam ser
// migrados sem mudar a UI.
import { db as supabase } from "@/runtime/db";
import { showError } from "@/lib/showError";
import type {
  AuditLogTech,
  AuditAcao,
  FetchAuditLogsParams,
} from "@/data/auditLogsStore";

interface OperationalAuditRow {
  id: number | string;
  tenant_id: string | null;
  ator_id: string | null;
  recurso_tipo: string | null;
  recurso_id: string | null;
  acao: string | null;
  contexto: Record<string, unknown> | null;
  created_at: string;
}

function mapRow(row: OperationalAuditRow): AuditLogTech {
  const ctx = (row.contexto ?? {}) as Record<string, unknown>;
  return {
    id: String(row.id),
    tabela: String(row.recurso_tipo ?? ""),
    registroId: row.recurso_id ?? null,
    acao: ((row.acao as AuditAcao) ?? "INSERT") as AuditAcao,
    antes: (ctx.antes as Record<string, unknown> | null) ?? null,
    depois: (ctx.depois as Record<string, unknown> | null) ?? null,
    userId: row.ator_id ?? null,
    userEmail: (ctx.user_email as string | null) ?? null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function fetchOperationalAuditLogs(
  params: FetchAuditLogsParams = {},
): Promise<AuditLogTech[]> {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  // RLS de `operational_audit` já isola por tenant; não precisamos filtrar
  // explicitamente. Mantemos o request enxuto.
  let req = supabase
    .from("operational_audit")
    .select("id, tenant_id, ator_id, recurso_tipo, recurso_id, acao, contexto, created_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.tabela) req = req.eq("recurso_tipo", params.tabela);
  if (params.registroId) req = req.eq("recurso_id", params.registroId);
  if (params.registroIds && params.registroIds.length > 0) {
    req = req.in("recurso_id", params.registroIds);
  }
  if (params.acao) req = req.eq("acao", params.acao);
  if (params.search && params.search.trim()) {
    // user_email mora em contexto JSONB — filtro via operador ->>
    req = req.ilike("contexto->>user_email", `%${params.search.trim()}%`);
  }

  const { data, error } = await req;
  if (error) {
    showError(error, { scope: "operationalAuditReader.fetch", silent: true });
    return [];
  }
  return (data ?? []).map((r) => mapRow(r as unknown as OperationalAuditRow));
}

export async function fetchOperationalAuditTabelas(): Promise<string[]> {
  const { data, error } = await supabase
    .from("operational_audit")
    .select("recurso_tipo")
    .order("recurso_tipo", { ascending: true })
    .limit(1000);
  if (error) {
    showError(error, { scope: "operationalAuditReader.tabelas", silent: true });
    return [];
  }
  const set = new Set<string>();
  for (const r of data ?? []) set.add(String((r as { recurso_tipo: string }).recurso_tipo));
  return Array.from(set).filter(Boolean).sort();
}
