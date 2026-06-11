// Audit log access — reads from public.atendimento_audit + public.app_settings_audit
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

// Lista pacientes com auditoria — usado pelo autocomplete
export async function fetchAuditPacientes(query: string): Promise<AuditPaciente[]> {
  const q = query.trim();
  let req = supabase
    .from("atendimento_audit")
    .select("protocolo, paciente_nome, atendimento_id, changed_at")
    .not("protocolo", "eq", "")
    .order("changed_at", { ascending: false })
    .limit(200);

  if (q) {
    const digits = q.replace(/\D/g, "");
    if (digits.length >= 3) {
      req = req.or(`protocolo.ilike.%${q}%,paciente_nome.ilike.%${q}%`);
    } else {
      req = req.or(`protocolo.ilike.%${q}%,paciente_nome.ilike.%${q}%`);
    }
  }

  const { data, error } = await req;
  if (error) {
    showError(error, { scope: "auditoriaStore.pacientes", silent: true });
    return [];
  }

  // Agrega CPF dos atendimentos
  const ids = Array.from(new Set((data ?? []).map((r: any) => r.atendimento_id).filter(Boolean)));
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
    const proto = (row as any).protocolo as string;
    if (!proto || seen.has(proto)) continue;
    seen.add(proto);
    out.push({
      protocolo: proto,
      paciente: (row as any).paciente_nome || "",
      cpf: cpfMap.get((row as any).atendimento_id) || "",
      dataCriacao: fmt((row as any).changed_at),
    });
  }
  return out;
}

export async function fetchAuditLogsByProtocolo(protocolo: string): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from("atendimento_audit")
    .select(
      "id, changed_at, changed_by_email, acao, entidade, operacao, paciente_nome, protocolo, exame_nome, old_value, new_value, justificativa, pos_finalizacao, atendimento_id"
    )
    .eq("protocolo", protocolo)
    .order("changed_at", { ascending: true });

  if (error) {
    showError(error, { scope: "auditoriaStore.logs", silent: true });
    return [];
  }

  return (data ?? []).map((row: any) => {
    const email = row.changed_by_email || "Sistema";
    const tipo = classifyAction(row.entidade, row.acao);
    const acaoFinal = row.exame_nome ? `${row.acao} — ${row.exame_nome}` : row.acao;
    return {
      id: String(row.id),
      dataIso: row.changed_at,
      dataHora: fmt(row.changed_at),
      usuario: email,
      iniciais: iniciaisFromEmail(email),
      acao: acaoFinal,
      tipo,
      paciente: row.paciente_nome || "",
      protocolo: row.protocolo || "",
      exameNome: row.exame_nome || undefined,
      entidade: row.entidade,
      operacao: row.operacao,
      oldValue: row.old_value,
      newValue: row.new_value,
      justificativa: row.justificativa || undefined,
      posFinalizacao: !!row.pos_finalizacao,
    } satisfies AuditLog;
  });
}

// Logs de configurações (app_settings_audit) — opcional, busca recente
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

  // Busca emails dos perfis para os UUIDs encontrados
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
