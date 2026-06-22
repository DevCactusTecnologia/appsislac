// Impressão direta de comprovante (sem modal/preview) — extraído de
// NovoAtendimento.tsx > imprimirComprovante (Fase 2A — slicing arquitetural).
// Comportamento preservado literalmente. Função pura quanto à lógica;
// efeitos colaterais ficam restritos a `printHtmlInHiddenFrame`.
import type { PagamentoRealizado } from "@/data/types";
import type { Paciente } from "@/data/pacienteStore";
import { getPacientes } from "@/data/pacienteStore";
import { buildComprovanteHtml } from "@/lib/comprovantes";
import { printHtmlInHiddenFrame } from "@/lib/printHtml";
import type { Exame } from "../types";

export type ComprovanteTipo = "pagamento" | "atendimento" | "comparecimento";

export interface ImprimirComprovanteParams {
  tipo: ComprovanteTipo;
  pacienteQuery: string;
  editAtendimentoData: { cpf: string; nascimento: string; idade: string } | null;
  editProtocolo?: string;
  convenios: string[];
  solicitantes: string[];
  unidadeAtiva?: { nome: string; endereco?: string; cidade?: string; estado?: string };
  exames: Exame[];
  pagamentosRealizados: PagamentoRealizado[];
  totais: {
    subtotal: number;
    desconto: number;
    valorPago: number;
    total: number;
    saldoDevedor: number;
  };
}

const TIPO_LABELS: Record<ComprovanteTipo, string> = {
  pagamento: "COMPROVANTE DE PAGAMENTO",
  atendimento: "COMPROVANTE DE ATENDIMENTO",
  comparecimento: "COMPROVANTE DE COMPARECIMENTO",
};

export function imprimirComprovante(params: ImprimirComprovanteParams): void {
  const {
    tipo, pacienteQuery, editAtendimentoData, editProtocolo,
    convenios, solicitantes, unidadeAtiva, exames, pagamentosRealizados, totais,
  } = params;
  const paciente: Paciente | undefined = getPacientes().find(p => p.nome === pacienteQuery);
  const cpf = paciente?.cpf || editAtendimentoData?.cpf || "";
  const nascimento = paciente?.dataNascimento || editAtendimentoData?.nascimento || "";
  const idade = paciente?.idade || editAtendimentoData?.idade || "";
  const protocoloAtual = editProtocolo ? decodeURIComponent(editProtocolo) : "";
  const d = new Date();
  const dataAtual = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  const html = buildComprovanteHtml({
    tipo,
    protocolo: protocoloAtual,
    data: dataAtual,
    paciente: { nome: pacienteQuery || "Paciente", cpf, nascimento, idade },
    convenio: convenios[0] || "Particular",
    solicitante: solicitantes[0] || "",
    unidade: unidadeAtiva
      ? { nome: unidadeAtiva.nome, endereco: unidadeAtiva.endereco, cidade: unidadeAtiva.cidade, estado: unidadeAtiva.estado }
      : undefined,
    exames: exames.map(e => ({ nome: e.nome, material: e.material, valor: e.valor })),
    pagamentos: pagamentosRealizados,
    totais: {
      subtotal: totais.subtotal,
      desconto: totais.desconto,
      pago: totais.valorPago,
      total: totais.total,
      saldo: totais.saldoDevedor,
    },
  });
  printHtmlInHiddenFrame({
    html,
    frameId: "comprovante-print-frame",
    documentTitle: `${TIPO_LABELS[tipo]} ${protocoloAtual}`.trim(),
  });
}
