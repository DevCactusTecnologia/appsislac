/**
 * DBSyncStatusAdapter — converte status BRUTO do DB Diagnósticos
 * para o vocabulário canônico de integração do SISLAC.
 *
 * Frontend, timeline e warnings consomem APENAS `IntegrationStatusKey`.
 * Strings cruas do DB nunca devem aparecer na UI.
 */

import type { IntegrationStatusKey } from "@/lib/integration/integrationStatus";

export interface DBSyncMappedStatus {
  /** Chave canônica do SISLAC. */
  canonical: IntegrationStatusKey;
  /** String original do DB — preservada para auditoria. */
  raw: string;
}

/**
 * Tabela de tradução. Usa `includes` case-insensitive para tolerar
 * variações de label (ex.: "Aguardando", "Aguardando Coleta").
 */
const RULES: Array<{ match: RegExp; canonical: IntegrationStatusKey }> = [
  { match: /aguardando/i,                       canonical: "AGUARDANDO_ENVIO" },
  { match: /enviad/i,                           canonical: "ENVIADO" },
  { match: /(recebid[oa]|área técnica|area tecnica|em análise|em analise|em processo|processand)/i,
                                                canonical: "PROCESSANDO" },
  { match: /(retorno|liberad[oa] parcial)/i,    canonical: "RETORNO_RECEBIDO" },
  { match: /(liberad[oa] (clínic|clinic|final)|conclu[íi]d)/i,
                                                canonical: "FINALIZADO" },
  { match: /(erro|falha|recus|rejeit|cancelad)/i, canonical: "FALHA" },
];

export function mapDBSyncStatus(raw: string | null | undefined): DBSyncMappedStatus {
  const safe = String(raw ?? "").trim();
  if (!safe) {
    return { canonical: "AGUARDANDO_ENVIO", raw: "" };
  }
  for (const rule of RULES) {
    if (rule.match.test(safe)) {
      return { canonical: rule.canonical, raw: safe };
    }
  }
  // Default conservador: trata como em processamento até evidência contrária.
  return { canonical: "PROCESSANDO", raw: safe };
}