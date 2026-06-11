// Distribuição proporcional do desconto entre exames cobrados do paciente.
// Extraído de NovoAtendimento.tsx > finalizarAtendimento (Fase 2 —
// Architectural Split Program). Função pura, comportamento idêntico.
//
// Regra de negócio:
//   Desconto é dado: ninguém paga por ele (nem paciente, nem convênio).
//   Como NÃO afeta convênio (faturamento próprio), distribuímos
//   proporcionalmente entre os exames cobrados do paciente, abatendo o
//   valor de cada um.
import type { Exame } from "../types";

export function distribuirDescontoEntreExames(
  exames: Exame[],
  desconto: number,
): Exame[] {
  const desc = Math.max(0, Math.round(desconto * 100) / 100);
  if (desc <= 0) return exames;
  const pacienteIdxs = exames
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.cobrancaDestino !== "convenio");
  const subtotalPaciente = pacienteIdxs.reduce((s, { e }) => s + e.valor, 0);
  if (subtotalPaciente <= 0) return exames;
  const totalDesc = Math.min(desc, subtotalPaciente);
  let restante = Math.round(totalDesc * 100); // em centavos
  const novosValores = new Map<number, number>();
  pacienteIdxs.forEach(({ e, i }, idx) => {
    const isLast = idx === pacienteIdxs.length - 1;
    const share = isLast
      ? restante
      : Math.round((e.valor / subtotalPaciente) * totalDesc * 100);
    const safeShare = Math.max(0, Math.min(share, Math.round(e.valor * 100)));
    restante -= safeShare;
    novosValores.set(i, Math.max(0, Math.round(e.valor * 100) - safeShare) / 100);
  });
  return exames.map((e, i) =>
    novosValores.has(i) ? { ...e, valor: novosValores.get(i)! } : e,
  );
}
