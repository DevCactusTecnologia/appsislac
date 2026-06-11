/**
 * Modelo CANÔNICO de etiqueta externa.
 *
 * Fica aqui (provider DBSync) por ser onde nasceu a necessidade,
 * mas é provider-agnostic — qualquer apoio futuro pode produzir
 * o mesmo `ExternalLabelData`.
 *
 * NÃO renderizar etiqueta nesta rodada — apenas persistir os dados.
 */

export interface ExternalLabelData {
  /** Provider que originou a etiqueta. */
  provider: string;
  /** Código de barras vindo do apoio. */
  barcode: string;
  /** Mnemônicos agrupados (ex.: ["HMG", "GLI"]) — agrupamento por tubo. */
  mnemonic_group: string[];
  /** Material (ex.: "Sangue total"). */
  material?: string;
  /** Volume requerido (ex.: "4 mL"). */
  volume?: string;
  /** Condição de transporte (ex.: "Refrigerado"). */
  transport?: string;
  /** EPL/ZPL bruto se o apoio enviar — preservado para auditoria. */
  raw_epl?: string;
  /** Protocolo externo associado — facilita troubleshooting. */
  external_protocol?: string;
}