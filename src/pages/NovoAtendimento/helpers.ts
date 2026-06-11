// Helpers puros extraídos de NovoAtendimento.tsx (Sprint 1 — slicing estrutural).
// Comportamento preservado literalmente. Sem estado de componente.
import { getConveniosAtivosNomes, getConvenios } from "@/data/convenioStore";
import { getSolicitantesNomes } from "@/data/especialistaStore";
import { getTabelaPrecoItens } from "@/data/tabelaPrecoStore";
import type { CobrancaDestino, ExameTemplate } from "./types";

/* ─── Reactive cadastros (recomputados quando os stores hidratam) ─── */
export function computeAvailableConvenios(): string[] {
  return ["Particular", ...getConveniosAtivosNomes().filter(n => n !== "Particular")];
}

export function computeAvailableSolicitantes(): string[] {
  const seen = new Set<string>();
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const out: string[] = [];
  for (const nome of getSolicitantesNomes()) {
    const key = norm(nome);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(nome);
  }
  return out;
}

export const buildAvailableExames = (): ExameTemplate[] => {
  const fromStore = getTabelaPrecoItens()
    .filter(i => i.ativo)
    .map((i, idx) => ({ id: 10000 + idx, nome: i.nomeExame, convenio: i.tabela, material: "Sangue", valor: i.valor }));
  return fromStore;
};

/**
 * Resolve a origem padrão de cobrança ao adicionar um exame.
 * Regra (Fase 2 - faturamento híbrido):
 * - Se houver convênio ≠ Particular selecionado, default = cobrar do primeiro convênio não-Particular.
 * - Caso contrário, default = cobrar do paciente.
 */
export function resolveCobrancaDefault(
  conveniosSelecionados: string[],
  convenioPreferido?: string,
): { cobrancaDestino: CobrancaDestino; convenioCobrancaId: number | null } {
  const preferido = convenioPreferido && convenioPreferido !== "Particular"
    && conveniosSelecionados.includes(convenioPreferido)
    ? convenioPreferido
    : null;
  const naoParticular = preferido ?? conveniosSelecionados.find(n => n !== "Particular");
  if (!naoParticular) return { cobrancaDestino: "paciente", convenioCobrancaId: null };
  const conv = getConvenios().find(c => c.nome === naoParticular);
  if (!conv) return { cobrancaDestino: "paciente", convenioCobrancaId: null };
  return { cobrancaDestino: "convenio", convenioCobrancaId: conv.id };
}
