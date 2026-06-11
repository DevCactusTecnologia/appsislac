/**
 * DTOs tipados — Hermes Pardini (Multiapoio).
 * Formato neutro derivado do XML, usado por services e persistência.
 */

export interface VerificarRecebimentoInput {
  clientCode: string;
  externalProtocol: string;
  /** Ano do pedido apoio (ex.: 2026). Default = ano corrente. */
  ano?: number;
  /** Login (codigoCliente / códigocliente Hermes). Substitui WS-Security. */
  login?: string;
  /** Senha (texto puro — só no transporte; persistida cifrada). */
  passwd?: string;
}

export interface VerificarRecebimentoOutput {
  externalProtocol: string;
  recebido: boolean;
  dataRecebimento?: string;
  situacao?: string;
  mensagem?: string;
}

export interface GetResultadoInput {
  clientCode: string;
  externalProtocol: string;
  ano?: number;
  login?: string;
  passwd?: string;
  /** Código do exame específico (vazio = pedido inteiro). */
  codExmApoio?: string;
  /** Trazer PDF embutido (1 = sim, vazio/0 = não). */
  pdf?: 0 | 1;
  /** Versão do resultado (default 1). */
  versaoResultado?: number;
  /** Receber laudo em papel timbrado personalizado. */
  papelTimbrado?: boolean;
  /** Valor de referência individualizado (0 = padrão / 1 = individualizado). */
  valorReferencia?: 0 | 1;
}

export interface ResultadoExameDTO {
  codigoApoio: string;
  nomeExame: string;
  status: string;
  valor?: string;
  unidade?: string;
  referencia?: string;
  /** Linhas estruturadas do `ValorDeReferencia.Tabela` (categorias/parâmetros/valores). */
  referenciaLinhas?: ValorReferenciaLinha[];
  /** Texto livre quando `ValorDeReferencia.Valor` (sem tabela). */
  referenciaTexto?: string;
  metodo?: string;
  material?: string;
  liberadoEm?: string;
  observacao?: string;
}

export interface GetResultadoOutput {
  externalProtocol: string;
  pacienteNome?: string;
  pacienteDocumento?: string;
  dataColeta?: string;
  dataLiberacao?: string;
  status: "PARCIAL" | "FINAL" | "PENDENTE" | "ERRO";
  exames: ResultadoExameDTO[];
  laudoPdfUrl?: string;
  /** PDF embarcado (base64) quando o provedor devolve `<pdf>` no envelope. */
  laudoPdfBase64?: string;
}

export interface ParsedResponse<T> {
  ok: boolean;
  data?: T;
  faultCode?: string;
  faultString?: string;
  raw: string;
  /** Trilha de diagnóstico do parser (etapas/blocos detectados ou ignorados). */
  debug?: string[];
}

// =====================================================================
// Resultados v1.2 — DTOs alinhados ao XSD oficial Hermes Pardini.
// Estrutura: Resultados > Pedido > SuperExame > Exame > ItemDeExame
//            > Resultado > Conteudo > Valor (+ ValorDeReferencia)
// =====================================================================

export interface PeriodoResultados {
  dataInicial?: string;
  horaInicial?: string;
  dataFinal?: string;
  horaFinal?: string;
}

export interface ControleDeLote {
  emissor: string;
  dataEmissao?: string;
  horaEmissao?: string;
  periodo?: PeriodoResultados;
  codLab: string;
}

export interface InfAdicionalValor {
  conteudo: string;
  tipo: "alfanumerico" | "decimal";
  casasDecimais: number;
  tamanhoMaximo?: number;
  idValor?: number;
}

export interface InfAdicional {
  descricao?: string;
  valor?: InfAdicionalValor;
  idInfAdicional?: number;
}

export interface ValorResultado {
  conteudo: string;
  nome?: string;
  tipo: "alfanumerico" | "decimal";
  casasDecimais: number;
  tamanhoMaximo?: number;
  idValor?: number;
}

export interface ValorReferenciaLinha {
  idLinha?: number;
  categoria1?: string;
  categoria2?: string;
  categoria3?: string;
  categoria4?: string;
  parametro1?: string;
  unidadeDoParametro1?: string;
  parametro2?: string;
  unidadeDoParametro2?: string;
  valor1?: string;
  valor2?: string;
  unidadeDoValor?: string;
}

export type ValorDeReferencia =
  | { tipo: "tabela"; linhas: ValorReferenciaLinha[] }
  | {
      tipo: "texto";
      conteudo: string;
      casasDecimais?: number;
      tamanhoMaximo?: number;
      tipoValor?: "alfanumerico" | "decimal";
      idValor?: number;
    };

export interface ResultadoItem {
  idResultado?: number;
  nome?: string;
  valores: ValorResultado[];
  unidadeDeMedida?: string;
  valorDeReferencia?: ValorDeReferencia;
}

export interface ItemDeExame {
  idItemDeExame?: number;
  nome: string;
  metodo?: string;
  interpretacao?: string;
  comentarioPatologista?: string;
  nota?: string;
  unidade?: string;
  condicaoDaAmostra?: string;
  estimulo?: string;
  resultados: ResultadoItem[];
  observacao?: string;
}

export interface ExameResultado {
  idExame?: number;
  infAdicionais: InfAdicional[];
  itensDeExame: ItemDeExame[];
  observacao?: string;
}

export interface SuperExameResultado {
  materialNome: string;
  exameNome: string;
  codExmApoio: string;
  codExmLab?: string;
  codigoFormato: string;
  retificacao?: string;
  exames: ExameResultado[];
}

export interface PedidoResultado {
  codPedApoio: string;
  codPedLab?: string;
  nomePaciente: string;
  retificacao?: string;
  superExames: SuperExameResultado[];
}

export interface ResultadosLote {
  protocolo: number;
  id: string;
  controleDeLote: ControleDeLote;
  pedidos: PedidoResultado[];
}