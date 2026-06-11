// Validações legais e códigos de verificação de comprovantes.
// Extraído de src/lib/comprovantes.ts (Fase: domain slicing).
// Comportamento e contratos preservados literalmente.
import { getLabConfig } from "@/data/labConfigStore";

export type ComprovanteTipo = "pagamento" | "atendimento" | "comparecimento";

/** Gera código curto e determinístico (FNV-1a hex, 10 chars) para verificação. */
export function codigoVerificacao(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const hex = (h >>> 0).toString(16).padStart(8, "0").toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

/**
 * Recompute the verification code for a given comprovante. Used by the
 * /verificar/:codigo page to confirm that a code matches a document the
 * user types in (deterministic FNV-1a, no DB lookup needed).
 */
export function codigoVerificacaoDeComprovante(d: {
  tipo: ComprovanteTipo;
  protocolo: string;
  paciente: { nome: string };
  data: string;
  totais?: { total: number };
}): string {
  return codigoVerificacao(
    `${d.tipo}|${d.protocolo}|${d.paciente.nome}|${d.data}|${d.totais?.total ?? ""}`,
  );
}

export const UFS_VALIDAS = new Set([
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI",
  "RJ","RN","RS","RO","RR","SC","SP","SE","TO",
]);
export const CONSELHOS_VALIDOS = new Set(["CRBM","CRF","CRM","CRBIO","CRO","CRN","CRBQ"]);

export function validarCnpj(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((s, n, i) => s + Number(n) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const dv1 = calc(d.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]);
  const dv2 = calc(d.slice(0, 13), [6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return dv1 === Number(d[12]) && dv2 === Number(d[13]);
}

/**
 * Verifica se a configuração legal do laboratório está completa e
 * consistente para emitir um comprovante específico.
 *
 * Regras:
 * - Pagamento (recibo): exige CNPJ válido + CNES + RT completo (RDC ANVISA 302/2005)
 * - Atendimento / Comparecimento: exige ao menos CNES + RT completo
 */
export function validarLaboratorioParaComprovante(
  tipo: ComprovanteTipo,
): { ok: true } | { ok: false; erros: string[] } {
  const lab = getLabConfig();
  const erros: string[] = [];

  if (!lab.nome?.trim()) erros.push("Nome do laboratório não cadastrado.");

  if (tipo === "pagamento") {
    if (!lab.cnpj?.trim()) {
      erros.push("CNPJ é obrigatório para emitir recibo de pagamento.");
    } else if (!validarCnpj(lab.cnpj)) {
      erros.push("CNPJ cadastrado é inválido (verifique os dígitos).");
    }
  } else if (lab.cnpj && !validarCnpj(lab.cnpj)) {
    erros.push("CNPJ cadastrado é inválido (verifique os dígitos).");
  }

  const cnes = (lab.cnes ?? "").replace(/\D/g, "");
  if (!cnes) erros.push("CNES não cadastrado (obrigatório para documentos clínicos).");
  else if (cnes.length !== 7) erros.push("CNES deve ter exatamente 7 dígitos.");

  const rtNome = lab.responsavelTecnico?.trim() ?? "";
  const rtConselho = lab.responsavelTecnicoConselho?.trim() ?? "";
  const rtNumero = lab.responsavelTecnicoNumero?.trim() ?? "";
  const rtUf = lab.responsavelTecnicoUf?.trim() ?? "";

  if (!rtNome) erros.push("Nome do Responsável Técnico não cadastrado.");
  if (!rtConselho) erros.push("Conselho do RT não cadastrado (CRBM, CRF, CRM…).");
  else if (!CONSELHOS_VALIDOS.has(rtConselho))
    erros.push(`Conselho '${rtConselho}' não é reconhecido.`);
  if (!rtNumero) erros.push("Número de registro do RT não cadastrado.");
  if (!rtUf) erros.push("UF do conselho do RT não cadastrada.");
  else if (!UFS_VALIDAS.has(rtUf)) erros.push(`UF '${rtUf}' do RT é inválida.`);

  return erros.length === 0 ? { ok: true } : { ok: false, erros };
}
