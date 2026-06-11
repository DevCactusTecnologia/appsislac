// Audit log access — reads from public.operational_audit (fonte unificada).
// `app_settings_audit` continua sendo lido diretamente porque o forwarder
// destino é `platform_audit` (super_admin only).
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/lib/showError";

export type AuditTipo =
  | "atendimento"
  | "coleta"
  | "analise"
  | "resultado"
  | "cancelamento"
  | "impressao"
  | "alteracao"
  | "configuracao";

export interface AuditLog {
  id: string;
  dataHora: string;       // dd/mm/yyyy HH:MM:SS
  dataIso: string;
  usuario: string;        // email
  iniciais: string;
  acao: string;
  tipo: AuditTipo;
  paciente: string;
  protocolo: string;
  exameNome?: string;
  entidade: "atendimento" | "exame" | "pagamento" | "configuracao";
  operacao: "INSERT" | "UPDATE" | "DELETE";
  oldValue?: unknown;
  newValue?: unknown;
  justificativa?: string;
  posFinalizacao?: boolean;
}

export interface AuditPaciente {
  paciente: string;
  protocolo: string;
  cpf: string;
  dataCriacao: string;
}

function fmt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} - ${hh}:${mi}:${ss}`;
}

function iniciaisFromEmail(email: string): string {
  if (!email) return "—";
  const local = email.split("@")[0] || email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (local.slice(0, 2)).toUpperCase();
}

function classifyAction(entidade: string, acao: string): AuditTipo {
  const a = (acao || "").toLowerCase();
  if (entidade === "configuracao") return "configuracao";
  if (a.includes("cancel")) return "cancelamento";
  if (a.includes("colet")) return "coleta";
  if (a.includes("análise") || a.includes("analise") || a.includes("analista")) return "analise";
  if (a.includes("resultado") || a.includes("liberado")) return "resultado";
  if (a.includes("impress") || a.includes("laudo")) return "impressao";
  if (a.includes("pagamento")) return "alteracao";
  if (entidade === "atendimento") return "atendimento";
  return "alteracao";
}

// Lista pacientes com auditoria — usado pelo autocomplete.
// Lê de operational_audit (recurso_tipo IN atendimento/exame/pagamento/critico),
// pivotando por contexto->>protocolo.
export async function fetchAuditPacientes(query: string): Promise<AuditPaciente[]> {
  const q = query.trim();
  let req = supabase
    .from("operational_audit")
    .select("recurso_id, contexto, created_at")
    .in("recurso_tipo", ["atendimento", "exame", "pagamento", "critico"])
    .not("contexto->>protocolo", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (q) {
    req = req.or(
      `contexto->>protocolo.ilike.%${q}%,contexto->>paciente_nome.ilike.%${q}%`,
    );
  }

  const { data, error } = await req;
  if (error) {
    showError(error, { scope: "auditoriaStore.pacientes", silent: true });
    return [];
  }

  // Agrega CPF dos atendimentos
  const ids = Array.from(
    new Set(
      (data ?? [])
        .map((r: any) => Number(r.recurso_id))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  );
  let cpfMap = new Map<number, string>();
  if (ids.length > 0) {
    const { data: ats } = await supabase
      .from("atendimentos")
      .select("id, paciente_cpf")
      .in("id", ids as number[]);
    cpfMap = new Map((ats ?? []).map((a: any) => [a.id, a.paciente_cpf || ""]));
  }

  const seen = new Set<string>();
  const out: AuditPaciente[] = [];
  for (const row of data ?? []) {
    const ctx = ((row as any).contexto ?? {}) as Record<string, unknown>;
    const proto = (ctx.protocolo as string) || "";
    if (!proto || seen.has(proto)) continue;
    seen.add(proto);
    const aid = Number((row as any).recurso_id);
    out.push({
      protocolo: proto,
      paciente: (ctx.paciente_nome as string) || "",
      cpf: cpfMap.get(aid) || "",
      dataCriacao: fmt((row as any).created_at),
    });
  }
  return out;
}

export async function fetchAuditLogsByProtocolo(protocolo: string): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from("operational_audit")
    .select("id, created_at, ator_id, acao, recurso_tipo, contexto")
    .in("recurso_tipo", ["atendimento", "exame", "pagamento", "critico"])
    .eq("contexto->>protocolo", protocolo)
    .order("created_at", { ascending: true });

  if (error) {
    showError(error, { scope: "auditoriaStore.logs", silent: true });
    return [];
  }

  return (data ?? []).map((row: any) => {
    const ctx = (row.contexto ?? {}) as Record<string, unknown>;
    const email = (ctx.email as string) || "Sistema";
    const entidade = ((ctx.entidade as string) || row.recurso_tipo || "atendimento") as
      | "atendimento" | "exame" | "pagamento" | "configuracao";
    const operacao = ((ctx.operacao as string) || "UPDATE") as "INSERT" | "UPDATE" | "DELETE";
    const exameNome = (ctx.exame_nome as string) || "";
    const tipo = classifyAction(entidade, row.acao);
    const acaoFinal = exameNome ? `${row.acao} — ${exameNome}` : row.acao;
    return {
      id: String(row.id),
      dataIso: row.created_at,
      dataHora: fmt(row.created_at),
      usuario: email,
      iniciais: iniciaisFromEmail(email),
      acao: acaoFinal,
      tipo,
      paciente: (ctx.paciente_nome as string) || "",
      protocolo: (ctx.protocolo as string) || "",
      exameNome: exameNome || undefined,
      entidade,
      operacao,
      oldValue: ctx.old_value,
      newValue: ctx.new_value,
      justificativa: (ctx.justificativa as string) || undefined,
      posFinalizacao: !!ctx.pos_finalizacao,
    } satisfies AuditLog;
  });
}

// Logs de configurações (app_settings_audit) — mantido na tabela original;
// o forwarder envia para `platform_audit` que é super_admin only.
const APP_SETTINGS_AUDIT_PAGE_SIZE = 100;

export async function fetchAppSettingsAudit(
  limit = APP_SETTINGS_AUDIT_PAGE_SIZE,
  before?: string,
): Promise<AuditLog[]> {
  let q = supabase
    .from("app_settings_audit")
    .select("id, changed_at, changed_by, operacao, key, old_value, new_value")
    .order("changed_at", { ascending: false })
    .limit(limit);
  if (before) q = q.lt("changed_at", before);
  const { data, error } = await q;

  if (error) {
    showError(error, { scope: "auditoriaStore.appSettingsAudit", silent: true });
    return [];
  }

  const userIds = Array.from(
    new Set((data ?? []).map((r: any) => r.changed_by).filter(Boolean))
  );
  let emailMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, email")
      .in("user_id", userIds as string[]);
    emailMap = new Map((profs ?? []).map((p: any) => [p.user_id, p.email || ""]));
  }

  return (data ?? []).map((row: any) => {
    const email = emailMap.get(row.changed_by) || "Sistema";
    return {
      id: `cfg-${row.id}`,
      dataIso: row.changed_at,
      dataHora: fmt(row.changed_at),
      usuario: email,
      iniciais: iniciaisFromEmail(email),
      acao: `Configuração ${row.operacao.toLowerCase()}: ${row.key}`,
      tipo: "configuracao",
      paciente: "—",
      protocolo: "",
      entidade: "configuracao",
      operacao: row.operacao,
      oldValue: row.old_value,
      newValue: row.new_value,
    } satisfies AuditLog;
  });
}
