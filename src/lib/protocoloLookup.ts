/**
 * Helper compartilhado para mapear protocolo → IDs reais (atendimento + exames).
 *
 * Centraliza a busca dos IDs do banco a partir do protocolo do atendimento,
 * evitando divergências entre páginas e mocks. Uso típico antes de chamadas
 * de auditoria (ex: `registrarLiberacaoCritica`).
 */
import { db as supabase } from "@/runtime/db";
import { showError } from "@/lib/showError";

export interface ProtocoloIds {
  atendimentoId: number | null;
  exames: Array<{ id: number; nomeExame: string; exameId: string | null }>;
}

/**
 * Resolve `atendimento.id` (bigint) a partir do `protocolo` (texto).
 * Retorna `null` se não encontrar — UI deve tratar e mostrar mensagem.
 */
export async function resolveAtendimentoIdByProtocolo(
  protocolo: string,
): Promise<number | null> {
  if (!protocolo) return null;
  const { data, error } = await supabase
    .from("atendimentos")
    .select("id")
    .eq("protocolo", protocolo)
    .maybeSingle();
  if (error) {
    showError(error, { scope: "protocoloLookup.resolverAtendimento", silent: true });
    return null;
  }
  return data?.id ?? null;
}

