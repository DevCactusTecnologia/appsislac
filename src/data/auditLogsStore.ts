// Acesso ao log técnico imutável (audit_logs) — capturado via triggers PostgreSQL.
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/lib/showError";
import { getCurrentTenantId } from "@/data/_tenant";

export type AuditAcao = "INSERT" | "UPDATE" | "DELETE";

export interface AuditLogTech {
  id: string;
  tabela: string;
  registroId: string | null;
  acao: AuditAcao;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  userId: string | null;
  userEmail: string | null;
  createdAt: string; // ISO
}

export interface AuditDiffField {
  campo: string;
  de: unknown;
  para: unknown;
}

export interface FetchAuditLogsParams {
  tabela?: string;
  registroId?: string;
  registroIds?: string[];   // para casar com filhos (ex: exames/pagamentos do atendimento)
  acao?: AuditAcao;
  search?: string;          // filtro por email do usuário
  limit?: number;
  offset?: number;
}

function mapRow(row: Record<string, unknown>): AuditLogTech {
  return {
    id: String(row.id),
    tabela: String(row.tabela ?? ""),
    registroId: (row.registro_id as string | null) ?? null,
    acao: (row.acao as AuditAcao) ?? "INSERT",
    antes: (row.antes as Record<string, unknown> | null) ?? null,
    depois: (row.depois as Record<string, unknown> | null) ?? null,
    userId: (row.user_id as string | null) ?? null,
    userEmail: (row.user_email as string | null) ?? null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

/**
 * Busca paginada de audit_logs.
 * Aplica filtros opcionais por tabela, registro_id (ou lista) e ação.
 */
export async function fetchAuditLogs(params: FetchAuditLogsParams = {}): Promise<AuditLogTech[]> {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  // Defesa em profundidade: filtra explicitamente pelo tenant_id do usuário,
  // mesmo que a RLS já isole — assim evitamos qualquer vazamento se a policy
  // mudar no futuro.
  let tenantId: string | null = null;
  try {
    tenantId = await getCurrentTenantId();
  } catch {
    tenantId = null;
  }

  let req = supabase
    .from("audit_logs")
    .select("id, tabela, registro_id, acao, antes, depois, user_id, user_email, created_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (tenantId) req = req.eq("tenant_id", tenantId);
  if (params.tabela) req = req.eq("tabela", params.tabela);
  if (params.registroId) req = req.eq("registro_id", params.registroId);
  if (params.registroIds && params.registroIds.length > 0) {
    req = req.in("registro_id", params.registroIds);
  }
  if (params.acao) req = req.eq("acao", params.acao);
  if (params.search && params.search.trim()) {
    req = req.ilike("user_email", `%${params.search.trim()}%`);
  }

  const { data, error } = await req;
  if (error) {
    showError(error, { scope: "auditLogsStore.fetch", silent: true });
    return [];
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

/**
 * Calcula a diferença campo-a-campo entre dois snapshots JSONB.
 * Ignora campos técnicos voláteis (updated_at, created_at).
 */
const IGNORED_FIELDS = new Set(["updated_at", "created_at"]);

export function diffObjects(
  antes: Record<string, unknown> | null | undefined,
  depois: Record<string, unknown> | null | undefined,
): AuditDiffField[] {
  const a = (antes ?? {}) as Record<string, unknown>;
  const b = (depois ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: AuditDiffField[] = [];
  keys.forEach((k) => {
    if (IGNORED_FIELDS.has(k)) return;
    const va = a[k];
    const vb = b[k];
    if (JSON.stringify(va) !== JSON.stringify(vb)) {
      out.push({ campo: k, de: va, para: vb });
    }
  });
  return out.sort((x, y) => x.campo.localeCompare(y.campo));
}

/**
 * Lista de tabelas distintas presentes em audit_logs (para filtros).
 * Implementação simples: busca uma página e extrai distintos no cliente.
 */
export async function fetchAuditTabelas(): Promise<string[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("tabela")
    .order("tabela", { ascending: true })
    .limit(1000);
  if (error) {
    showError(error, { scope: "auditLogsStore.tabelas", silent: true });
    return [];
  }
  const set = new Set<string>();
  for (const r of data ?? []) set.add(String((r as { tabela: string }).tabela));
  return Array.from(set).sort();
}

/**
 * Resolve os IDs de exames e pagamentos vinculados a um atendimento.
 * Usado para montar o filtro `registroIds` na auditoria técnica e capturar
 * mudanças nos registros-filho do mesmo atendimento.
 */
export async function fetchAtendimentoRelatedIds(atendimentoId: string | number): Promise<{
  exameIds: string[];
  pagamentoIds: string[];
}> {
  const idNum = typeof atendimentoId === "string" ? Number(atendimentoId) : atendimentoId;
  if (!Number.isFinite(idNum)) return { exameIds: [], pagamentoIds: [] };

  const [exames, pags] = await Promise.all([
    supabase.from("atendimento_exames").select("id").eq("atendimento_id", idNum),
    supabase.from("atendimento_pagamentos").select("id").eq("atendimento_id", idNum),
  ]);

  const exameIds = (exames.data ?? []).map((r) => String((r as { id: number | string }).id));
  const pagamentoIds = (pags.data ?? []).map((r) => String((r as { id: number | string }).id));
  return { exameIds, pagamentoIds };
}

/* ------------------------------------------------------------------ */
/* Streaming — busca todas as páginas com mesmos filtros               */
/* ------------------------------------------------------------------ */

const STREAM_PAGE_SIZE = 500;
const STREAM_MAX_PAGES = 200; // hard ceiling: 100k registros, evita loop infinito

export interface StreamProgress {
  loaded: number;
  page: number;
}

/**
 * Busca todos os logs de auditoria em páginas sequenciais respeitando
 * os mesmos filtros, sem o teto de 1000. Reporta progresso e permite
 * cancelamento via AbortSignal.
 */
export async function fetchAuditLogsAll(
  params: Omit<FetchAuditLogsParams, "limit" | "offset"> = {},
  onProgress?: (p: StreamProgress) => void,
  signal?: AbortSignal,
): Promise<AuditLogTech[]> {
  const all: AuditLogTech[] = [];
  for (let pageIdx = 0; pageIdx < STREAM_MAX_PAGES; pageIdx++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const batch = await fetchAuditLogs({
      ...params,
      limit: STREAM_PAGE_SIZE,
      offset: pageIdx * STREAM_PAGE_SIZE,
    });
    all.push(...batch);
    onProgress?.({ loaded: all.length, page: pageIdx + 1 });
    if (batch.length < STREAM_PAGE_SIZE) break; // última página
    // Cede o thread para o navegador entre páginas (evita jank)
    await new Promise<void>((r) => setTimeout(r, 0));
  }
  return all;
}

/* ------------------------------------------------------------------ */
/* Exportações (CSV / PDF)                                            */
/* ------------------------------------------------------------------ */

function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function summarizeDiff(log: AuditLogTech): string {
  if (log.acao === "UPDATE") {
    const fields = diffObjects(log.antes, log.depois);
    if (fields.length === 0) return "(sem mudanças relevantes)";
    return fields
      .slice(0, 8)
      .map((f) => `${f.campo}: ${formatScalar(f.de)} → ${formatScalar(f.para)}`)
      .join(" | ") + (fields.length > 8 ? ` | +${fields.length - 8} campos` : "");
  }
  const obj = (log.acao === "INSERT" ? log.depois : log.antes) ?? {};
  const keys = Object.keys(obj).filter((k) => !["created_at", "updated_at"].includes(k));
  return keys.slice(0, 8).map((k) => `${k}=${formatScalar((obj as Record<string, unknown>)[k])}`).join(" | ");
}

function formatScalar(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.length > 60 ? v.slice(0, 60) + "…" : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 60 ? s.slice(0, 60) + "…" : s;
  } catch {
    return String(v);
  }
}

function downloadBlob(content: string | Blob, filename: string, mime: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function exportAuditLogsCsv(logs: AuditLogTech[], filename = "auditoria-tecnica.csv"): void {
  const header = ["Data/Hora", "Usuario", "Acao", "Tabela", "Registro", "Resumo das mudancas"];
  // Monta como array de chunks (Blob aceita várias partes — evita uma única
  // string gigante na memória ao exportar dezenas de milhares de linhas).
  const parts: string[] = ["\ufeff", header.join(","), "\n"];
  let failed = 0;
  for (const log of logs) {
    try {
      const row = [
        escapeCsv(log.createdAt),
        escapeCsv(log.userEmail ?? ""),
        escapeCsv(log.acao),
        escapeCsv(log.tabela),
        escapeCsv(log.registroId ?? ""),
        escapeCsv(summarizeDiff(log)),
      ].join(",");
      // Validação anti-corrupção: nenhum CRLF não escapado fora de aspas.
      // (escapeCsv já garante, mas validamos como defesa em profundidade.)
      if (/[\r\n](?=(?:[^"]*"[^"]*")*[^"]*$)/.test(row)) throw new Error("linha inválida");
      parts.push(row);
      parts.push("\n");
    } catch {
      failed++;
    }
  }
  const blob = new Blob(parts, { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, filename, "text/csv;charset=utf-8");
  if (failed > 0) {
    // Sinaliza para o chamador via evento global — o componente exibe um toast.
    try {
      window.dispatchEvent(new CustomEvent("auditExport:partialFailure", { detail: { kind: "csv", failed } }));
    } catch { /* noop em ambientes sem CustomEvent */ }
  }
}

/**
 * Cede o event loop entre chunks pesados — mantém o navegador responsivo.
 */
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    const w = globalThis as unknown as { requestIdleCallback?: (cb: () => void) => void };
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export async function exportAuditLogsPdf(
  logs: AuditLogTech[],
  filename = "auditoria-tecnica.pdf",
  onProgress?: (p: { rendered: number; total: number }) => void,
  signal?: AbortSignal,
): Promise<void> {
  // Usa html2pdf (já instalado no projeto) para imprimir um HTML estruturado.
  const html2pdf = (await import("html2pdf.js")).default as unknown as (
    el: HTMLElement,
  ) => { set: (opt: Record<string, unknown>) => { from: (el: HTMLElement) => { save: () => Promise<void> } } };

  const generatedAt = new Date().toLocaleString("pt-BR");
  const total = logs.length;

  const wrapper = document.createElement("div");
  wrapper.style.padding = "24px";
  wrapper.style.fontFamily = "Inter, system-ui, sans-serif";
  wrapper.style.color = "#0f172a";
  wrapper.innerHTML = `
    <h1 style="font-size:18px;font-weight:700;margin:0 0 4px">Auditoria técnica</h1>
    <p style="font-size:11px;color:#64748b;margin:0 0 16px">
      Exportado em ${escapeHtml(generatedAt)} — ${escapeHtml(String(total))} registro(s)
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:10px;table-layout:fixed">
      <thead style="display:table-header-group">
        <tr style="background:#f1f5f9">
          <th style="text-align:left;padding:6px;border:1px solid #e2e8f0;width:14%">Data/Hora</th>
          <th style="text-align:left;padding:6px;border:1px solid #e2e8f0;width:18%">Usuário</th>
          <th style="text-align:left;padding:6px;border:1px solid #e2e8f0;width:8%">Ação</th>
          <th style="text-align:left;padding:6px;border:1px solid #e2e8f0;width:14%">Tabela</th>
          <th style="text-align:left;padding:6px;border:1px solid #e2e8f0;width:14%">Registro</th>
          <th style="text-align:left;padding:6px;border:1px solid #e2e8f0;width:32%">Resumo</th>
        </tr>
      </thead>
      <tbody id="audit-pdf-body" style="display:table-row-group"></tbody>
    </table>
  `;

  const tbody = wrapper.querySelector("#audit-pdf-body") as HTMLTableSectionElement;

  // Renderiza linhas em chunks de 100 — cede o thread entre eles para
  // manter a UI responsiva mesmo com dezenas de milhares de logs.
  const CHUNK = 100;
  let failed = 0;
  for (let i = 0; i < total; i += CHUNK) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const slice = logs.slice(i, i + CHUNK);
    const rows: string[] = [];
    for (const l of slice) {
      try {
        rows.push(`
          <tr>
            <td style="padding:6px;border:1px solid #e2e8f0;white-space:nowrap;word-break:break-word">${escapeHtml(new Date(l.createdAt).toLocaleString("pt-BR"))}</td>
            <td style="padding:6px;border:1px solid #e2e8f0;word-break:break-word">${escapeHtml(l.userEmail ?? "Sistema")}</td>
            <td style="padding:6px;border:1px solid #e2e8f0">${escapeHtml(l.acao)}</td>
            <td style="padding:6px;border:1px solid #e2e8f0;font-family:monospace;word-break:break-all">${escapeHtml(l.tabela)}</td>
            <td style="padding:6px;border:1px solid #e2e8f0;font-family:monospace;word-break:break-all">${escapeHtml(l.registroId ?? "—")}</td>
            <td style="padding:6px;border:1px solid #e2e8f0;word-break:break-word">${escapeHtml(summarizeDiff(l))}</td>
          </tr>
        `);
      } catch {
        failed++;
      }
    }
    const html = rows.join("");
    tbody.insertAdjacentHTML("beforeend", html);
    onProgress?.({ rendered: Math.min(i + CHUNK, total), total });
    await yieldToBrowser();
  }

  // Renderiza fora da tela para não impactar a UI durante a captura
  wrapper.style.position = "fixed";
  wrapper.style.left = "-99999px";
  wrapper.style.top = "0";
  document.body.appendChild(wrapper);
  try {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    await html2pdf(wrapper)
      .set({
        margin: 10,
        filename,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        // `avoid-all` evita quebrar uma <tr> ao meio; combinado com
        // `display:table-header-group` no <thead>, jsPDF repete o cabeçalho
        // automaticamente em todas as páginas geradas.
        pagebreak: { mode: ["css", "legacy", "avoid-all"], avoid: "tr" },
      })
      .from(wrapper)
      .save();
  } finally {
    wrapper.remove();
  }
  if (failed > 0) {
    try {
      window.dispatchEvent(new CustomEvent("auditExport:partialFailure", { detail: { kind: "pdf", failed } }));
    } catch { /* noop */ }
  }
}

/**
 * Escapa qualquer valor para inclusão segura em HTML.
 * Cobre &, <, >, ", ', / e remove caracteres de controle invisíveis
 * (exceto \t, \n, \r) que poderiam corromper o layout do PDF.
 */
function escapeHtml(s: unknown): string {
  return String(s ?? "")
    // remove control chars que quebram parsing/render
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\//g, "&#x2F;");
}