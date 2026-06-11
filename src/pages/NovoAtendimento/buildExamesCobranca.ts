// Fonte única para montagem do payload `examesCobranca` enviado ao
// backend (create-atendimento / update-atendimento). Antes existiam 2
// cópias idênticas (14 linhas cada) em NovoAtendimento.tsx — qualquer
// divergência entre elas geraria bugs sutis de persistência.
//
// REGRA (preservada literalmente da auditoria):
//  - amostraSeq default = 1
//  - grupoExameId default = null
//  - tipoProcesso default = "INTERNO"
//  - labApoioId: somente quando TERCEIRIZADO; usa override se houver,
//    senão padrão do catálogo, senão null.
//  - solicitante: somente preenchido quando o atendimento tem mais de
//    um solicitante. "__ambos" sentinel é convertido para "" (vazio).
import type { Exame } from "./types";

export interface ExameCobrancaPayload {
  nome: string;
  cobrancaDestino: Exame["cobrancaDestino"];
  convenioCobrancaId: number | null;
  valor: number;
  amostraSeq: number;
  grupoExameId: string | null;
  tipoProcesso: "INTERNO" | "TERCEIRIZADO";
  labApoioId: string | null;
  solicitante: string;
}

export function buildExamesCobranca(
  exames: Exame[],
  solicitantes: string[],
): ExameCobrancaPayload[] {
  const multiSolicitantes = solicitantes.length > 1;
  return exames.map((e) => ({
    nome: e.nome,
    cobrancaDestino: e.cobrancaDestino,
    convenioCobrancaId: e.convenioCobrancaId ?? null,
    valor: e.valor,
    amostraSeq: e.amostraSeq ?? 1,
    grupoExameId: e.grupoExameId ?? null,
    tipoProcesso: e.tipoProcesso ?? "INTERNO",
    labApoioId: (e.tipoProcesso ?? "INTERNO") === "TERCEIRIZADO"
      ? (e.labApoioIdOverride ?? e.labApoioIdPadrao ?? null)
      : null,
    solicitante: multiSolicitantes
      ? ((e.solicitanteExame === "__ambos" ? "" : e.solicitanteExame) ?? "")
      : "",
  }));
}
