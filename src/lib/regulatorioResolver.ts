// ============================================================
// resolveResultadoRegulatorio — Helper central regulatório
// ------------------------------------------------------------
// Regra OFICIAL SISLAC (RDC 786/2023):
//   O laudo deve refletir a REALIDADE EXECUTADA (snapshot),
//   NÃO o estado atual do layout científico.
//
// Resolução (Exames 2.2):
//   metodologia = COALESCE(snapshot, layoutPadrao.metodologia)
//   unidade     = COALESCE(snapshot, layoutPadrao.unidadePadrao)
//
// Flags do layout controlam a EXIBIÇÃO no laudo:
//   exibirMetodologiaLaudo
//   exibirUnidadeLaudo
//
// Fonte de verdade científica = `exame_layouts` (padrão).
// O catálogo NÃO contém mais metodologia/unidade desde Exames 2.2.
// ============================================================

import { getExamesCatalogo } from "@/data/exameCatalogoStore";
import { getLayouts } from "@/data/exameLayoutsStore";
import { escapeHtml } from "@/lib/escapeHtml";

export interface ResultadoRegulatorio {
  metodologia: string;
  unidade: string;
  exibirMetodologia: boolean;
  exibirUnidade: boolean;
}

export interface ResolveRegulatorioInput {
  exameNome: string;
  metodologiaSnapshot?: string | null;
  unidadeSnapshot?: string | null;
}

export function resolveResultadoRegulatorio(
  input: ResolveRegulatorioInput,
): ResultadoRegulatorio {
  const catalogo = getExamesCatalogo().find((c) => c.nome === input.exameNome);
  const layouts = catalogo?.id ? getLayouts(catalogo.id) : [];
  const layoutPadrao = layouts.find((l) => l.padrao) ?? layouts[0];

  const metodologia =
    (input.metodologiaSnapshot ?? "").trim() ||
    (layoutPadrao?.metodologia ?? "").trim();
  const unidade =
    (input.unidadeSnapshot ?? "").trim() ||
    (layoutPadrao?.unidadePadrao ?? "").trim();

  // Flags default = true (exibir) — só oculta quando explicitamente false.
  const exibirMetodologia = (layoutPadrao?.exibirMetodologiaLaudo !== false) && !!metodologia;
  const exibirUnidade = (layoutPadrao?.exibirUnidadeLaudo !== false) && !!unidade;

  return { metodologia, unidade, exibirMetodologia, exibirUnidade };
}

/**
 * Renderiza um bloco HTML discreto com metodologia/unidade para o laudo.
 * Vazio se nada deve ser exibido — não polui o layout.
 */
export function renderRegulatorioFooterHtml(reg: ResultadoRegulatorio): string {
  if (!reg.exibirMetodologia && !reg.exibirUnidade) return "";
  const partes: string[] = [];
  if (reg.exibirMetodologia) {
    partes.push(
      `<span><strong style="font-weight:600;">Metodologia:</strong> ${escapeHtml(reg.metodologia)}</span>`,
    );
  }
  if (reg.exibirUnidade) {
    partes.push(
      `<span><strong style="font-weight:600;">Unidade:</strong> ${escapeHtml(reg.unidade)}</span>`,
    );
  }
  return `
    <div style="margin-top:4px;padding-top:4px;font-size:10px;color:#64748b;line-height:1.5;display:flex;flex-wrap:wrap;gap:12px;">
      ${partes.join("")}
    </div>
  `;
}
