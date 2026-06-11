// Contagem pura de etiquetas estimadas para o atendimento.
// Extraído de NovoAtendimento.tsx > finalizarAtendimento (Fase 2 —
// Architectural Split Program). Comportamento preservado literalmente.
//
// Regra: cada exame consome `catalogo.quantidadeEtiquetas` (clamp 1..20,
// default 1). Exames com tipoProcesso = TERCEIRIZADO contam também no
// total de terceirizados.
import type { Exame } from "../types";

export interface EtiquetaCatalogoEntry {
  nome: string;
  quantidadeEtiquetas?: number | null;
}

export interface ContagemEtiquetas {
  total: number;
  terceirizados: number;
  temTerceirizados: boolean;
}

export function contarEtiquetas(
  exames: Exame[],
  catalogo: EtiquetaCatalogoEntry[],
): ContagemEtiquetas {
  let total = 0;
  let terceirizados = 0;
  let temTerceirizados = false;
  for (const e of exames) {
    const cat = catalogo.find(
      (c) => c.nome.toLowerCase() === e.nome.toLowerCase(),
    );
    const q = Math.max(1, Math.min(20, Number(cat?.quantidadeEtiquetas ?? 1)));
    total += q;
    if ((e.tipoProcesso ?? "INTERNO") === "TERCEIRIZADO") {
      terceirizados += q;
      temTerceirizados = true;
    }
  }
  return { total, terceirizados, temTerceirizados };
}
