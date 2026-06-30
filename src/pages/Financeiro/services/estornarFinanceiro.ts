// Estorno formal — Fase 9.
// Wrapper sobre a RPC `financeiro_estornar(p_id, p_motivo, p_tipo)`.
// p_tipo ∈ "pagamento" | "fatura" | "saida".
import { db as supabase } from "@/runtime/db";
import { showError } from "@/lib/showError";

export type EstornoTipo = "pagamento" | "fatura" | "saida";

export async function estornarFinanceiro(
  tipo: EstornoTipo,
  id: number,
  motivo: string,
): Promise<void> {
  const { error } = await supabase.rpc("financeiro_estornar", {
    p_id: id,
    p_motivo: motivo,
    p_tipo: tipo,
  });
  if (error) {
    showError(error, { scope: "financeiro.estornar" });
    throw error;
  }
}
