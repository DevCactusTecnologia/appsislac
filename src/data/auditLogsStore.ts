// Acesso ao log técnico imutável.
//
// FONTE: `public.operational_audit` (consolidada — alimentada por triggers em
// `audit_logs`, `atendimento_audit`, `storage_audit` etc.). A leitura via
// `operationalAuditReader` desempacota `contexto` JSONB para reconstruir o
// shape `AuditLogTech` (antes/depois/user_email) sem mudar consumidores.
import { supabase } from "@/integrations/supabase/client";
import {
  fetchOperationalAuditLogs,
  fetchOperationalAuditTabelas,
} from "@/domains/tenant/services/operationalAuditReader";
import { escapeHtml } from "@/lib/escapeHtml";
import { wrapA4Document } from "@/lib/printShell";
import { buildAdminReportHeader } from "@/lib/adminReportHeader";

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

/**
 * Busca paginada de logs de auditoria — lê de `operational_audit`.
 * Mantém o mesmo contrato anterior (campos antes/depois/userEmail).
 */
export async function fetchAuditLogs(params: FetchAuditLogsParams = {}): Promise<AuditLogTech[]> {
  return fetchOperationalAuditLogs(params);
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

/** Lista de tabelas distintas (recurso_tipo) presentes em `operational_audit`. */
export async function fetchAuditTabelas(): Promise<string[]> {
  return fetchOperationalAuditTabelas();
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
  // Vetorial nativo via window.print() — sem html2pdf/html2canvas.
  // O usuário escolhe "Salvar como PDF" no diálogo do navegador.
  const { printHtmlInHiddenFrame } = await import("@/lib/printHtml");

  const generatedAt = new Date().toLocaleString("pt-BR");
  const total = logs.length;

  // Renderiza linhas em chunks para manter UI responsiva mesmo com dezenas de
  // milhares de logs (cede o thread entre lotes).
  const CHUNK = 100;
  const rowsParts: string[] = [];
  let failed = 0;
  for (let i = 0; i < total; i += CHUNK) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const slice = logs.slice(i, i + CHUNK);
    for (const l of slice) {
      try {
        rowsParts.push(`
          <tr>
            <td>${escapeHtml(new Date(l.createdAt).toLocaleString("pt-BR"))}</td>
            <td>${escapeHtml(l.userEmail ?? "Sistema")}</td>
            <td>${escapeHtml(l.acao)}</td>
            <td class="mono">${escapeHtml(l.tabela)}</td>
            <td class="mono">${escapeHtml(l.registroId ?? "—")}</td>
            <td>${escapeHtml(summarizeDiff(l))}</td>
          </tr>`);
      } catch {
        failed++;
      }
    }
    onProgress?.({ rendered: Math.min(i + CHUNK, total), total });
    await yieldToBrowser();
  }

  const title = filename.replace(/\.pdf$/i, "");
  const bodyHtml = `
  ${buildAdminReportHeader({
    titulo: "Auditoria técnica",
    subtitulo: `${total} registro(s) · exportado em ${generatedAt}`,
  })}
  <table>
    <colgroup><col class="c1"/><col class="c2"/><col class="c3"/><col class="c4"/><col class="c5"/><col class="c6"/></colgroup>
    <thead>
      <tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Tabela</th><th>Registro</th><th>Resumo</th></tr>
    </thead>
    <tbody>${rowsParts.join("")}</tbody>
  </table>`;
  const html = wrapA4Document({
    title,
    bodyHtml,
    orientation: "landscape",
    margin: "10mm",
    css: `
      table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
      th { background: #f1f5f9; text-align: left; padding: 6px; border: 1px solid #e2e8f0; }
      td { padding: 6px; border: 1px solid #e2e8f0; word-break: break-word; vertical-align: top; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; }
      col.c1 { width: 14%; } col.c2 { width: 18%; } col.c3 { width: 8%; }
      col.c4 { width: 14%; } col.c5 { width: 14%; } col.c6 { width: 32%; }
    `,
  });

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  printHtmlInHiddenFrame({ html, documentTitle: title });

  if (failed > 0) {
    try {
      window.dispatchEvent(new CustomEvent("auditExport:partialFailure", { detail: { kind: "pdf", failed } }));
    } catch { /* noop */ }
  }
}