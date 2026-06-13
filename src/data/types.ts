/**
 * Tipos compartilhados do domínio operacional.
 * Sem dados fictícios — apenas contratos de tipo.
 */

export type StatusType =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "purple"
  | "teal";

export interface PagamentoRealizado {
  tipo: string;
  valor: number;
  data: string;
}

export type CobrancaDestino = "paciente" | "convenio";

/**
 * Metadados de cobrança por exame (faturamento híbrido).
 * Vive em paralelo a `MockAtendimento.exames` (string[]).
 * Quando ausente, todos os exames são cobrados do paciente.
 */
export interface ExameCobrancaInfo {
  nome: string;
  cobrancaDestino: CobrancaDestino;
  convenioCobrancaId?: number | null;
  /** Valor unitário do exame para persistência. Quando ausente, assume 0. */
  valor?: number;
  /** Analista responsável pelo exame. */
  analista?: string;
  /** ID do exame no catálogo. */
  exameId?: string | null;
  /** Status individual do exame. */
  status?: string;
  /** Data/hora ISO em que o exame foi liberado/finalizado. */
  dataLiberacaoISO?: string | null;
  /** ID interno do registro atendimento_exames. */
  atendimentoExameId?: number;
  /** Sequência da amostra (1, 2, 3...). */
  amostraSeq?: number;
  /** Grupo lógico que liga repetições do mesmo exame. */
  grupoExameId?: string | null;
  /** Reutilização de amostra anterior. */
  isReutilizacao?: boolean;
  /** Material/recipiente da amostra. */
  material?: string;
  /** ID da amostra física. */
  amostraId?: string | null;
  /** Tipo de processo. */
  tipoProcesso?: "INTERNO" | "TERCEIRIZADO" | string | null;
  /** Laboratório de apoio destino. */
  labApoioId?: string | null;
  /** Médico solicitante deste exame específico (quando atendimento tem múltiplos solicitantes). */
  solicitante?: string;
}

/**
 * Representação canônica de um atendimento usada em telas e componentes.
 * O nome `MockAtendimento` é mantido apenas por compatibilidade histórica;
 * NÃO há mais dados fictícios associados.
 */
export interface MockAtendimento {
  protocolo: string;
  data: string;
  nome: string;
  cpf: string;
  nascimento: string;
  idade: string;
  statusAtendimento: { label: string; type: StatusType; showIcon?: boolean };
  statusPagamento: { label: string; type: StatusType };
  motivoCancelamento?: string;
  solicitante: string;
  convenio: string;
  exames: string[];
  /** Metadados de cobrança alinhados por nome com `exames` (mesmo índice). */
  examesCobranca?: ExameCobrancaInfo[];
  unidadeId?: string;
  /** Número da guia diária por unidade (ex.: "SE-001"). Gerado server-side. */
  guiaNumero?: string;
  pagamentosRealizados?: PagamentoRealizado[];
  updatedAt?: string;
  /**
   * Origem operacional do atendimento. `INTERNO` (default) = recepção;
   * `WEB_APROVADO` = solicitação web convertida pela recepção;
   * `WEB_AUTO` = convertida automaticamente após pagamento;
   * `AGENDAMENTO` = pré-agendamento sem pagamento.
   */
  origem?: "INTERNO" | "WEB_AUTO" | "WEB_APROVADO" | "AGENDAMENTO";
}