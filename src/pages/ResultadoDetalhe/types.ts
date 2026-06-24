// Tipos extraídos de ResultadoDetalhe.tsx (Fase 3 — slicing estrutural).
// Comportamento e contratos preservados literalmente.
import type { ExameParametro } from "@/data/exameParametrosStore";

export type ExameStatus =
  | "Pendente"
  | "Digitado"
  | "Cancelado"
  | "Impresso"
  | "Resultado salvo"
  | "Em retificação"
  | "Retificado";

export interface Parametro {
  nome: string;
  obrigatorio: boolean;
  unidade: string;
  refMin: string;
  refMax: string;
  refUnidade: string;
  valor: string;
  /**
   * Metadados do parâmetro real (vindos de `exame_parametros`) usados pelo
   * LayoutScientificRuntime para tipagem de input e persistência por chave.
   * Opcionais para retro-compat com construções antigas que ainda usem
   * `Parametro` sem metadados.
   */
  chave?: string;
  rotulo?: string;
  tipo?: ExameParametro["tipo"];
  opcoesSelect?: string[];
  casasDecimais?: number;
  separadorDecimal?: "." | ",";
  qtdDigitos?: number;
  criticoMin?: string;
  criticoMax?: string;
  parametroId?: number;
  /**
   * Texto livre de "Valor de referência" salvo em `exame_parametros.valor_referencia`.
   * Usado como fallback descritivo quando não há faixa estruturada em `valores_referencia`.
   */
  valorReferencia?: string;
  /** Expressão da fórmula (tipo "Formula") salva em `exame_parametros.formula`. */
  formula?: string;
  /**
   * Cabeçalho de seção (texto do layout) a ser renderizado ANTES deste parâmetro.
   * Preserva a estrutura visual do layout científico (ex.: "CARACTERÍSTICAS FÍSICAS").
   */
  headerAntes?: string;
}

export interface Exame {
  id: number;
  nome: string;
  material: string;
  status: ExameStatus;
  dataAnalise: string;
  /** ISO timestamps vindos do banco para reconstrução fiel do auditLog (com hh:mm:ss) */
  dataColetaISO?: string | null;
  dataAnaliseISO?: string | null;
  dataLiberacaoISO?: string | null;
  /** Solicitante específico do exame (vazio = comum a todos os solicitantes do atendimento). */
  solicitante?: string;
  parametros: Parametro[];
  /** Snapshot regulatório (RDC 786/2023). */
  metodologiaSnapshot?: string | null;
  unidadeSnapshot?: string | null;
}

export interface Paciente {
  id: number;
  nome: string;
  cpf: string;
  sexo: string;
  nascimento: string;
  idade: string;
  protocolo: string;
  dataCadastro: string;
  statusGeral: string;
  exames: Exame[];
  convenio?: string;
  solicitante?: string;
}

export const statusExameMap: Record<ExameStatus, { type: "warning" | "success" | "danger" | "info" }> = {
  Pendente: { type: "warning" },
  Digitado: { type: "success" },
  Cancelado: { type: "danger" },
  Impresso: { type: "success" },
  "Resultado salvo": { type: "info" },
  "Em retificação": { type: "warning" },
  Retificado: { type: "info" },
};

// Mapa: id da row no DB (atendimento_exames.id) por exame da UI.
// Usado para persistir mudanças no exame correto via updateAtendimentoExame.
export type DbIdMap = Record<number, number>;
