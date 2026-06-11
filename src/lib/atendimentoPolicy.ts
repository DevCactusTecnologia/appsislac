// Política de edição de atendimentos — fonte única de verdade no frontend.
//
// Regras (alinhadas à decisão do produto):
//   - Edição/cancelamento de atendimentos é SEMPRE permitida.
//   - Em casos sensíveis (atendimento finalizado, cancelado, ou criado fora da
//     janela de edição configurável), o frontend exibe um ALERTA e exige
//     JUSTIFICATIVA obrigatória antes de prosseguir.
//   - A justificativa é gravada na coluna `atendimento_audit.justificativa`
//     via RPC `set_audit_justificativa`, e o campo `pos_finalizacao` é
//     marcado automaticamente pelos triggers de auditoria.
//   - A janela de edição (default: 24h) é configurável por tenant em
//     `app_settings.edit_window_hours`.

import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/lib/showError";

export type StatusInput = string | { label?: string } | null | undefined;

const DEFAULT_EDIT_WINDOW_HOURS = 24;
let _cachedWindowHours: number | null = null;
let _cacheLoadedAt = 0;
const CACHE_TTL_MS = 60_000; // 1 minuto

function asLabel(s: StatusInput): string {
  if (!s) return "";
  if (typeof s === "string") return s;
  return s.label ?? "";
}

/** Atendimento finalizado — laudo já foi liberado. */
export function isAtendimentoFinalizado(status: StatusInput): boolean {
  const l = asLabel(status).toLowerCase();
  return l === "resultado liberado";
}

/** Atendimento cancelado — fluxo encerrado por cancelamento. */
export function isAtendimentoCancelado(status: StatusInput): boolean {
  const l = asLabel(status).toLowerCase();
  return l === "cancelado" || l === "pedido cancelado";
}

/** Lê janela de edição configurada (em horas). Cacheado por 1 min. */
export async function getEditWindowHours(): Promise<number> {
  const now = Date.now();
  if (_cachedWindowHours !== null && now - _cacheLoadedAt < CACHE_TTL_MS) {
    return _cachedWindowHours;
  }
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "edit_window_hours")
      .maybeSingle();
    const raw = (data as { value: unknown } | null)?.value;
    const parsed = Number(raw);
    _cachedWindowHours = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_EDIT_WINDOW_HOURS;
  } catch {
    _cachedWindowHours = DEFAULT_EDIT_WINDOW_HOURS;
  }
  _cacheLoadedAt = now;
  return _cachedWindowHours;
}

/** Versão síncrona — usa o último valor cacheado, ou o default. */
export function getEditWindowHoursSync(): number {
  return _cachedWindowHours ?? DEFAULT_EDIT_WINDOW_HOURS;
}

/** Invalida cache (chamar após salvar nova configuração). */
export function invalidateEditWindowCache(): void {
  _cachedWindowHours = null;
  _cacheLoadedAt = 0;
}

/** Pré-carrega o valor — chamar no boot da app. */
export function preloadEditWindow(): void {
  void getEditWindowHours();
}

function parseDate(value: string | Date): Date | null {
  if (value instanceof Date) return value;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(value)) {
    const [datePart, timePart = "00:00"] = value.split(/\s|-/).filter(Boolean);
    const [dd, mm, yyyy] = datePart.split("/").map(Number);
    const [hh = 0, mi = 0] = timePart.split(":").map(Number);
    const d = new Date(yyyy, (mm ?? 1) - 1, dd ?? 1, hh, mi);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Retorna true se o atendimento foi criado há mais que a janela configurada.
 * Aceita ISO ou "dd/mm/yyyy" / "dd/mm/yyyy HH:mm".
 */
export function isForaDaJanelaEdicao(dataAtendimento?: string | Date | null): boolean {
  if (!dataAtendimento) return false;
  const dt = parseDate(dataAtendimento);
  if (!dt) return false;
  const horas = getEditWindowHoursSync();
  return Date.now() - dt.getTime() > horas * 60 * 60 * 1000;
}

/** Compatibilidade — alias do nome antigo. */
export function isMaisDe24h(dataAtendimento?: string | Date | null): boolean {
  return isForaDaJanelaEdicao(dataAtendimento);
}

/**
 * True quando a ação de editar/cancelar exige confirmação extra do usuário
 * (e justificativa).
 */
export function requerConfirmacaoEdicao(
  status: StatusInput,
  dataAtendimento?: string | Date | null,
): boolean {
  return (
    isAtendimentoFinalizado(status) ||
    isAtendimentoCancelado(status) ||
    isForaDaJanelaEdicao(dataAtendimento)
  );
}

/** Mensagem de alerta exibida antes de prosseguir com a edição. */
export function mensagemAlertaEdicao(
  status: StatusInput,
  dataAtendimento?: string | Date | null,
): string {
  if (isAtendimentoFinalizado(status)) {
    return "Este atendimento já foi finalizado (laudo liberado). Informe a justificativa — ela será registrada na auditoria com seu usuário, data e horário.";
  }
  if (isAtendimentoCancelado(status)) {
    return "Este atendimento está cancelado. Informe a justificativa — ela será registrada na auditoria com seu usuário, data e horário.";
  }
  if (isForaDaJanelaEdicao(dataAtendimento)) {
    const h = getEditWindowHoursSync();
    return `Este atendimento foi criado há mais de ${h}h. Informe a justificativa — ela será registrada na auditoria com seu usuário, data e horário.`;
  }
  return "Confirme a alteração. A ação será registrada na auditoria.";
}

/**
 * Envia a justificativa para o backend antes de qualquer mutação sensível.
 * Os triggers de auditoria leem automaticamente esse valor via GUC de sessão.
 * Tolerante a falhas: se a RPC não existir/erro, segue sem bloquear.
 */
export async function setAuditJustificativa(text: string): Promise<void> {
  try {
    await supabase.rpc("set_audit_justificativa" as never, { _text: text } as never);
  } catch (e) {
    showError(e, { scope: "atendimentoPolicy.setAuditJustificativa", silent: true });
  }
}

// ── Compatibilidade com chamadas antigas ──
export function isEdicaoClinicaBloqueada(_status: StatusInput): boolean {
  return false;
}

export function mensagemBloqueioClinico(status: StatusInput): string {
  return mensagemAlertaEdicao(status);
}
