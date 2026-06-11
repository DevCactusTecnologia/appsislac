/**
 * Métodos WSDL DBSync conhecidos.
 * Apenas os dois primeiros são implementados nesta rodada.
 */
export const DBSYNC_METHODS = {
  RECEBE_ATENDIMENTO: "RecebeAtendimento",
  CONSULTA_STATUS: "ConsultaStatusAtendimento",
  // Reservados (rodadas futuras):
  LISTA_PENDENTES: "ListaProcedimentosPendentes",
  ENVIA_AMOSTRAS: "EnviaAmostras",
  GET_PDF: "ConsultaLaudoPDF",
} as const;

export type DBSyncMethod = (typeof DBSYNC_METHODS)[keyof typeof DBSYNC_METHODS];

export type DBSyncEnvironment = "HOMOLOG" | "PRODUCAO";

export interface DBSyncProviderConfig {
  wsdl_url: string;
  ambiente: DBSyncEnvironment;
  timeout_ms?: number;
  /** Configurações TLS opcionais — usadas no transport HTTP real (futuro). */
  ssl?: {
    reject_unauthorized?: boolean;
  };
}

export interface DBSyncCredentials {
  /** Usuário fornecido pelo apoio. */
  usuario: string;
  /** Chave/senha — JAMAIS armazenar em claro; cifrar via `_shared/crypto.ts`. */
  chave: string;
}