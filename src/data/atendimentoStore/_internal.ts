// Estado compartilhado + helpers puros do atendimentoStore.
// Todos os submódulos importam daqui — o objeto `cache` é singleton e
// preserva exatamente a semântica do arquivo monolítico anterior
// (mesmas referências mutáveis, mesmo `notify`).
//
// IMPORTANTE: a divisão deste store em arquivos é puramente estrutural
// (split mecânico, Fase 4 do Architectural Split Program). A API pública
// — exportada por `./index.ts` — permanece IDÊNTICA.

import type { Tables } from "@/integrations/supabase/types";
import type { MockAtendimento, PagamentoRealizado } from "../types";
import { deriveAtendimentoStatus, derivePagamentoStatus } from "@/lib/atendimentoStatus";
import { formatDateBR as _formatDateBR, formatDateTimeBR as _formatDateTimeBR } from "@/lib/dateBR";
import { resolveMaterialNome } from "../materiaisAmostraStore";


export type AtendimentoRow = Tables<"atendimentos">;
export type AtendimentoExameDbRow = Tables<"atendimento_exames">;
export type AtendimentoPagamentoRow = Tables<"atendimento_pagamentos">;
export type ExamesCatalogoRow = Tables<"exames_catalogo">;

/** Resposta padrão das edge functions de atendimento (create/update). */
export interface AtendimentoTxResponse {
  ok: boolean;
  error?: string;
  protocolo?: string;
  atendimento_id?: number;
  guia_numero?: string;
  guia_data?: string;
}

// ── Cache em memória ──
// Objeto singleton: propriedades mutáveis preservam a semântica de
// `let _atendimentos = ...` do arquivo original (todos os submódulos
// veem a mesma referência, e atribuições novas continuam visíveis).
export const cache = {
  atendimentos: [] as MockAtendimento[],
  listeners: [] as Array<() => void>,
  idByProtocolo: new Map<string, number>(),
  protocoloById: new Map<number, string>(),
};

export function notify(): void {
  cache.listeners.forEach((fn) => fn());
}

// ── Helpers de formatação ──
// Status mapping: SSOT em src/lib/atendimentoStatus.ts.

export function formatCPF(digits: string): string {
  const d = (digits || "").replace(/\D/g, "").padStart(11, "0").slice(0, 11);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// Re-exports — preservam a API pública que outros módulos importam daqui.
// SSOT real em `@/lib/dateBR.ts`.
export const formatDateTimeBR = (iso: string): string => _formatDateTimeBR(iso);
export const formatDateBR = (iso: string | null): string => _formatDateBR(iso);


export function calcIdade(nascimentoIso: string | null): string {
  if (!nascimentoIso) return "";
  const nasc = new Date(nascimentoIso);
  const hoje = new Date();
  let anos = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) anos--;
  return `${anos} anos`;
}

// Mapeia label "Pendente" → status DB
export function mapExameStatus(
  label: string | undefined,
): "pendente" | "coletado" | "em_analise" | "finalizado" | "cancelado" {
  if (!label) return "pendente";
  const l = label.toLowerCase();
  if (l.includes("cancel")) return "cancelado";
  if (l.includes("liber") || l.includes("finaliz")) return "finalizado";
  if (l.includes("anali")) return "em_analise";
  if (l.includes("colet")) return "coletado";
  return "pendente";
}

// Converte data brasileira "dd/MM/yyyy [HH:mm[:ss]]" para ISO
export function brToIso(br: string | undefined): string | null {
  if (!br) return null;
  const [datePart, timePart] = br.split(" ");
  const dParts = datePart.split("/");
  if (dParts.length !== 3) return null;
  const iso = `${dParts[2]}-${dParts[1].padStart(2, "0")}-${dParts[0].padStart(2, "0")}`;
  if (!timePart) return iso;
  return `${iso}T${timePart.length === 5 ? timePart + ":00" : timePart}`;
}

// ── Colunas (select explícito; Fase D) ──
export const ATENDIMENTO_COLS =
  "id,protocolo,data,paciente_nome,paciente_cpf,paciente_nascimento," +
  "solicitante,convenio_nome,unidade_id,status_atendimento,status_pagamento," +
  "motivo_cancelamento,updated_at,origem_atendimento,jejum,prioridade_clinica";
export const EXAME_COLS =
  "id,atendimento_id,nome_exame,exame_id,ordem,valor,valor_original,analista,status," +
  "cobranca_destino,convenio_cobranca_id,amostra_seq,grupo_exame_id," +
  "is_reutilizacao,material_id,amostra_id,tipo_processo,lab_apoio_id,solicitante,data_liberacao";

export const PAGAMENTO_COLS = "id,atendimento_id,tipo,valor,data";

// ── Conversão DB row → MockAtendimento (preserva API legacy) ──
export function buildAtendimento(
  atRow: AtendimentoRow,
  exames: AtendimentoExameDbRow[],
  pagamentos: AtendimentoPagamentoRow[],
): MockAtendimento {
  const dsAt = deriveAtendimentoStatus(atRow.status_atendimento);
  const dsPg = derivePagamentoStatus(atRow.status_pagamento);

  const examesOrdenados = [...exames].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const pagamentosFmt: PagamentoRealizado[] = pagamentos.map((p) => ({
    tipo: p.tipo,
    valor: Number(p.valor),
    data: formatDateBR(p.data),
  }));

  return {
    protocolo: atRow.protocolo,
    data: formatDateTimeBR(atRow.data),
    nome: atRow.paciente_nome,
    cpf: formatCPF(atRow.paciente_cpf),
    nascimento: formatDateBR(atRow.paciente_nascimento),
    idade: calcIdade(atRow.paciente_nascimento),
    statusAtendimento: { label: dsAt.label, type: dsAt.type, showIcon: dsAt.showIcon },
    statusPagamento: { label: dsPg.label, type: dsPg.type },
    motivoCancelamento: atRow.motivo_cancelamento ?? undefined,
    solicitante: atRow.solicitante,
    convenio: atRow.convenio_nome,
    exames: examesOrdenados.map((e) => e.nome_exame),
    examesCobranca: examesOrdenados.map((e) => ({
      nome: e.nome_exame,
      cobrancaDestino: (e.cobranca_destino === "convenio" ? "convenio" : "paciente") as "paciente" | "convenio",
      convenioCobrancaId: e.convenio_cobranca_id ?? null,
      valor: Number(e.valor) || 0,
      valorOriginal: (() => {
        const vo = (e as { valor_original?: number | string | null }).valor_original;
        const n = Number(vo);
        const valorEf = Number(e.valor) || 0;
        // Fallback: sem valor_original → assume "sem desconto" (= valor efetivo).
        return Number.isFinite(n) && n > 0 ? n : valorEf;
      })(),
      analista: e.analista || "",
      exameId: e.exame_id ?? null,
      status: e.status ?? "pendente",
      dataLiberacaoISO: e.data_liberacao ?? null,
      atendimentoExameId: e.id,
      amostraSeq: typeof e.amostra_seq === "number" ? e.amostra_seq : 1,
      grupoExameId: e.grupo_exame_id ?? null,
      isReutilizacao: !!e.is_reutilizacao,
      material: resolveMaterialNome(e.material_id),
      amostraId: e.amostra_id ?? null,
      tipoProcesso: (e.tipo_processo === "TERCEIRIZADO" ? "TERCEIRIZADO" : "INTERNO"),
      labApoioId: e.lab_apoio_id ?? null,
      solicitante: (e as { solicitante?: string }).solicitante ?? "",
    })),
    unidadeId: atRow.unidade_id,
    guiaNumero: (atRow as { guia_numero?: string | null }).guia_numero ?? undefined,
    pagamentosRealizados: pagamentosFmt.length > 0 ? pagamentosFmt : undefined,
    updatedAt: atRow.updated_at ? formatDateTimeBR(atRow.updated_at) : undefined,
    origem: ((atRow as { origem_atendimento?: string }).origem_atendimento ?? "INTERNO") as MockAtendimento["origem"],
    jejum: !!(atRow as { jejum?: boolean }).jejum,
    prioridadeClinica: (((atRow as { prioridade_clinica?: string }).prioridade_clinica ?? "normal") as MockAtendimento["prioridadeClinica"]),
  };
}
