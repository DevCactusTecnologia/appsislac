// Tipos extraídos de NovoAtendimento.tsx (Sprint 1 — slicing estrutural).
// Comportamento e contratos preservados literalmente.
export type CobrancaDestino = "paciente" | "convenio";

export interface Exame {
  id: number;
  nome: string;
  convenio: string;
  material: string;
  valor: number;
  /** Preço cheio antes do desconto distribuído (origem: examesCobranca.valorOriginal).
   *  Quando ausente ou igual a `valor`, não houve desconto histórico no exame. */
  valorOriginal?: number;
  addedByIA?: boolean;
  /** Justificativa clínica retornada pela IA (apenas estado local). */
  justificativaIA?: string;
  /** Confiança clínica da sugestão da IA (alta/media/baixa). */
  confiancaIA?: "alta" | "media" | "baixa";
  /** Observação a ser exibida/anexada (texto formatado pela IA, p.ex.). */
  observacaoIA?: string;
  /** Origem da cobrança: paciente (default) ou convênio específico (Fase 2 — faturamento híbrido). */
  cobrancaDestino: CobrancaDestino;
  /** Quando cobrancaDestino = 'convenio', id do convênio cobrado. */
  convenioCobrancaId?: number | null;
  /** Sequência da amostra (1, 2, 3...). Padrão = 1. */
  amostraSeq?: number;
  /** Grupo lógico que liga repetições do mesmo exame. */
  grupoExameId?: string;
  /** Tipo de processo — snapshot do catálogo (não editável neste fluxo). */
  tipoProcesso?: "INTERNO" | "TERCEIRIZADO";
  /** Lab apoio padrão do catálogo (referência). */
  labApoioIdPadrao?: string | null;
  /** Override do lab apoio neste atendimento (Fase 3). */
  labApoioIdOverride?: string | null;
  /** Solicitante específico deste exame (quando atendimento tem mais de um solicitante). */
  solicitanteExame?: string;
}

export type ExameTemplate = Omit<Exame, "cobrancaDestino" | "convenioCobrancaId">;
