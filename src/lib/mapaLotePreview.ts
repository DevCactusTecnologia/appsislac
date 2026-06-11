// ============================================================================
// Pré-visualização de mapas LOTE no editor de "Mapas de Trabalho".
//
// Usa o MESMO motor de impressão (`buildLoteBlockFromTemplate`) que a página
// /mapa, garantindo fidelidade 1:1 entre o que o usuário vê no editor e o
// que sai impresso. Aqui os tickets são fictícios (vários pacientes com
// vários exames cada), permitindo que o operador valide o layout em escala.
// ============================================================================

import { buildLoteBlockFromTemplate, type MapaExameTicket } from "@/lib/mapaPrint";
import { buildPrintCss, prepareMapaHtml } from "@/lib/mapaSharedStyles";

/** Lote sintético: 3 pacientes × 2-3 exames cada — suficiente para visualizar o agrupamento. */
function buildPreviewTickets(): MapaExameTicket[] {
  const pacientes = [
    { nome: "MARIA SILVA EXEMPLO",    cpf: "000.000.000-01", sexo: "Feminino",  idade: "42 anos", nascimento: "01/01/1983", protocolo: "ATD-2026-0001234" },
    { nome: "JOÃO PEREIRA EXEMPLO",   cpf: "000.000.000-02", sexo: "Masculino", idade: "37 anos", nascimento: "15/05/1988", protocolo: "ATD-2026-0001235" },
    { nome: "ANA COSTA EXEMPLO",      cpf: "000.000.000-03", sexo: "Feminino",  idade: "29 anos", nascimento: "20/09/1996", protocolo: "ATD-2026-0001236" },
  ];

  // Exames demo (sem exameId real → sem parâmetros do catálogo, usa abreviação do nome).
  const examesPorPaciente: { nome: string; codigo: string; material: string }[][] = [
    [
      { nome: "GLICEMIA",          codigo: "GLI",  material: "Soro" },
      { nome: "COLESTEROL TOTAL",  codigo: "COL",  material: "Soro" },
      { nome: "TRIGLICERÍDEOS",    codigo: "TRG",  material: "Soro" },
    ],
    [
      { nome: "UREIA",             codigo: "URE",  material: "Soro" },
      { nome: "CREATININA",        codigo: "CRE",  material: "Soro" },
    ],
    [
      { nome: "TGO",               codigo: "TGO",  material: "Soro" },
      { nome: "TGP",               codigo: "TGP",  material: "Soro" },
      { nome: "FOSFATASE ALC.",    codigo: "FAL",  material: "Soro" },
    ],
  ];

  const tickets: MapaExameTicket[] = [];
  pacientes.forEach((p, idx) => {
    examesPorPaciente[idx].forEach((ex) => {
      tickets.push({
        protocolo: p.protocolo,
        paciente: { nome: p.nome, cpf: p.cpf, sexo: p.sexo, idade: p.idade, nascimento: p.nascimento },
        exameId: null,
        exameNome: ex.nome,
        exameCodigo: ex.codigo,
        exameMaterial: ex.material,
        analista: "ANALISTA DEMO",
        convenio: "Particular",
        dataAtendimento: new Date().toLocaleDateString("pt-BR"),
      });
    });
  });
  return tickets;
}

/**
 * Gera HTML completo (com `<style>` de impressão) simulando o mapa LOTE em uso real,
 * com vários pacientes e exames. Usado pelo editor de Mapas de Trabalho.
 */
export function buildLotePreviewHtml(
  templateHtml: string,
  orientation: "portrait" | "landscape" = "portrait",
): string {
  const bloco = buildLotePreviewBlock(templateHtml);
  const css = buildPrintCss(orientation);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Pré-visualização do mapa</title>
  <style>${css}</style>
</head>
<body>
  ${prepareMapaHtml(bloco)}
</body>
</html>`;
}

/**
 * Gera SOMENTE o bloco interno do mapa LOTE (com `.mapa-page`), pronto para
 * ser embrulhado por `wrapHtmlAsA4Preview` no editor de mapas.
 */
export function buildLotePreviewBlock(templateHtml: string): string {
  const tickets = buildPreviewTickets();
  const grupo = new Map<string, MapaExameTicket[]>();
  for (const t of tickets) {
    const arr = grupo.get(t.protocolo) ?? [];
    arr.push(t);
    grupo.set(t.protocolo, arr);
  }
  return buildLoteBlockFromTemplate({
    templateHtml,
    analista: "ANALISTA DEMO",
    ticketsAgrupadosPorPaciente: grupo,
    usuario: "Operador Demo",
  });
}