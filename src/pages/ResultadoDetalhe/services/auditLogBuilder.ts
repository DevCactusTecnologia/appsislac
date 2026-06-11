// Builder puro do auditLog reconstruído a partir das rows do banco.
// Extraído de ResultadoDetalhe.tsx (Fase 1 — Architectural Split Program).
// Comportamento preservado literalmente — sem hora/minuto/segundo alterados.
import type { AtendimentoExameRow } from "@/data/atendimentoStore";
import type { Exame, ExameStatus, DbIdMap } from "../types";

export interface AuditLogEntry {
  acao: string;
  dataHora: string;
  usuario: string;
  iniciais: string;
  dados?: string;
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const fmtDateTime = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")} de ${MESES[d.getMonth()]} de ${d.getFullYear()} - ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;

const fmtIso = (iso: string | null | undefined, fallback: Date) =>
  fmtDateTime(iso ? new Date(iso) : fallback);

const isLiberado = (s: ExameStatus) =>
  s === "Digitado" || s === "Impresso" || s === "Retificado";

/**
 * Reconstrói o log a partir do estado vindo do banco, preservando hh:mm:ss.
 */
export function buildAuditLogFromDb(
  rows: AtendimentoExameRow[],
  exames: Exame[],
  idMap: DbIdMap,
): Record<number, AuditLogEntry[]> {
  const now = new Date();
  const log: Record<number, AuditLogEntry[]> = {};
  const rowByUiId = new Map<number, AtendimentoExameRow>();
  Object.entries(idMap).forEach(([uiIdStr, dbId]) => {
    const row = rows.find((r) => r.id === dbId);
    if (row) rowByUiId.set(Number(uiIdStr), row);
  });
  exames.forEach((exame) => {
    const row = rowByUiId.get(exame.id);
    const dbStatus = row?.status;
    const dataPedido = fmtIso(exame.dataColetaISO ?? exame.dataAnaliseISO ?? exame.dataLiberacaoISO, now);
    const dataColeta = fmtIso(exame.dataColetaISO ?? exame.dataAnaliseISO, now);
    const dataAnal = fmtIso(exame.dataAnaliseISO, now);
    const dataLib = fmtIso(exame.dataLiberacaoISO, now);
    const entries: AuditLogEntry[] = [
      { acao: "Pedido realizado", dataHora: dataPedido, usuario: "Felipe Andrade Melo", iniciais: "FA" },
      { acao: "Amostra coletada", dataHora: dataColeta, usuario: "Felipe Andrade Melo", iniciais: "FA" },
    ];
    if (dbStatus === "em_bancada" || dbStatus === "analisado" ||
        dbStatus === "em_analise" || dbStatus === "finalizado") {
      entries.push({ acao: "Bancada iniciada", dataHora: dataAnal, usuario: "Felipe Andrade Melo", iniciais: "FA" });
    }
    if (dbStatus === "analisado" || dbStatus === "em_analise" || dbStatus === "finalizado") {
      entries.push({ acao: "Análise concluída", dataHora: dataAnal, usuario: "Felipe Andrade Melo", iniciais: "FA" });
    }
    if (exame.status === "Resultado salvo" || exame.status === "Em retificação" || isLiberado(exame.status)) {
      const dadosAtuais = exame.parametros.map((p) => `${p.nome}: ${p.valor || "—"}`).join("\n");
      const foiRetificado = row?.retificado === true;
      const dataRetificacao = fmtIso(row?.retificado_at ?? null, new Date(dataAnal));
      if (foiRetificado) {
        entries.push({
          acao: "Resultado salvo",
          dataHora: dataAnal,
          usuario: "Felipe Andrade Melo",
          iniciais: "FA",
          dados: "Valores anteriores à retificação (não versionados).",
        });
        entries.push({
          acao: "Resultado retificado",
          dataHora: dataRetificacao,
          usuario: "Felipe Andrade Melo",
          iniciais: "FA",
        });
        entries.push({
          acao: "Resultado salvo (após retificação)",
          dataHora: dataRetificacao,
          usuario: "Felipe Andrade Melo",
          iniciais: "FA",
          dados: dadosAtuais,
        });
      } else {
        entries.push({
          acao: "Resultado salvo",
          dataHora: dataAnal,
          usuario: "Felipe Andrade Melo",
          iniciais: "FA",
          dados: dadosAtuais,
        });
      }
    }
    if (isLiberado(exame.status)) {
      entries.push({ acao: "Resultado liberado", dataHora: dataLib, usuario: "Felipe Andrade Melo", iniciais: "FA" });
    }
    if (exame.status === "Cancelado") {
      entries.push({ acao: "Análise cancelada", dataHora: fmtIso(exame.dataAnaliseISO ?? exame.dataLiberacaoISO, now), usuario: "Felipe Andrade Melo", iniciais: "FA" });
    }
    log[exame.id] = entries;
  });
  return log;
}
