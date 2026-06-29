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

export interface AuditUser {
  nome: string;
  iniciais: string;
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
 * `defaultUser` é usado quando o banco ainda não armazena o autor real de
 * cada evento (legado) — normalmente o usuário operacional logado.
 */
export function buildAuditLogFromDb(
  rows: AtendimentoExameRow[],
  exames: Exame[],
  idMap: DbIdMap,
  defaultUser: AuditUser = { nome: "—", iniciais: "?" },
): Record<number, AuditLogEntry[]> {
  const now = new Date();
  const log: Record<number, AuditLogEntry[]> = {};
  const rowByUiId = new Map<number, AtendimentoExameRow>();
  Object.entries(idMap).forEach(([uiIdStr, dbId]) => {
    const row = rows.find((r) => r.id === dbId);
    if (row) rowByUiId.set(Number(uiIdStr), row);
  });
  const u = { usuario: defaultUser.nome, iniciais: defaultUser.iniciais };
  const SEM_REGISTRO = "__SEM_REGISTRO__";
  const semRegistroUser = { usuario: "Sistema", iniciais: "SI" };
  exames.forEach((exame) => {
    const row = rowByUiId.get(exame.id);
    const dbStatus = row?.status;
    const semColeta  = (row?.analista ?? "") === SEM_REGISTRO;
    const semAnalise = (row?.analista ?? "") === SEM_REGISTRO;
    const dataPedido = fmtIso(exame.dataColetaISO ?? exame.dataAnaliseISO ?? exame.dataLiberacaoISO, now);
    const dataColeta = fmtIso(exame.dataColetaISO ?? exame.dataAnaliseISO, now);
    const dataAnal = fmtIso(exame.dataAnaliseISO, now);
    const dataLib = fmtIso(exame.dataLiberacaoISO, now);
    const entries: AuditLogEntry[] = [
      { acao: "Pedido realizado", dataHora: dataPedido, ...u },
    ];
    if (semColeta) {
      entries.push({
        acao: "Não houve registro de coleta",
        dataHora: dataColeta,
        ...semRegistroUser,
        dados: "Etapa de coleta desativada nas Configurações → Fluxo / Rotina.",
      });
    } else {
      entries.push({ acao: "Amostra coletada", dataHora: dataColeta, ...u });
    }
    if (semAnalise) {
      entries.push({
        acao: "Não houve registro da análise",
        dataHora: dataAnal,
        ...semRegistroUser,
        dados: "Etapa de análise desativada nas Configurações → Fluxo / Rotina.",
      });
    } else {
      if (dbStatus === "em_bancada" || dbStatus === "analisado" ||
          dbStatus === "em_analise" || dbStatus === "finalizado") {
        entries.push({ acao: "Bancada iniciada", dataHora: dataAnal, ...u });
      }
      if (dbStatus === "analisado" || dbStatus === "em_analise" || dbStatus === "finalizado") {
        entries.push({ acao: "Análise concluída", dataHora: dataAnal, ...u });
      }
    }
    if (exame.status === "Resultado salvo" || exame.status === "Em retificação" || isLiberado(exame.status)) {
      const dadosAtuais = exame.parametros.map((p) => `${p.nome}: ${p.valor || "—"}`).join("\n");
      const foiRetificado = row?.retificado === true;
      const dataRetificacao = fmtIso(row?.retificado_at ?? null, new Date(dataAnal));
      if (foiRetificado) {
        entries.push({
          acao: "Resultado salvo",
          dataHora: dataAnal,
          ...u,
          dados: "Valores anteriores à retificação (não versionados).",
        });
        entries.push({
          acao: "Resultado retificado",
          dataHora: dataRetificacao,
          ...u,
        });
        entries.push({
          acao: "Resultado salvo (após retificação)",
          dataHora: dataRetificacao,
          ...u,
          dados: dadosAtuais,
        });
      } else {
        entries.push({
          acao: "Resultado salvo",
          dataHora: dataAnal,
          ...u,
          dados: dadosAtuais,
        });
      }
    }
    if (isLiberado(exame.status)) {
      entries.push({ acao: "Resultado liberado", dataHora: dataLib, ...u });
    }
    if (exame.status === "Cancelado") {
      entries.push({ acao: "Análise cancelada", dataHora: fmtIso(exame.dataAnaliseISO ?? exame.dataLiberacaoISO, now), ...u });
    }
    log[exame.id] = entries;
  });
  return log;
}
