// ============================================================================
// OWNERSHIP OFICIAL — Pipeline de impressão do Mapa de Trabalho.
// Escopo: WORKFLOW OPERACIONAL. NÃO renderiza ciência (VR/metodologia/cálculo
// /unidade/snapshot). Esses pertencem ao Layout Científico.
//
// Cardinalidade: 1 exame → 0 ou 1 mapa (constraint UNIQUE em mapa_exames).
// Catch-all: o mapa LOTE com `isCatchAll = true` recebe todos os exames sem
// vínculo (substitui heurística textual antiga sobre o nome).
//
// Single renderer: legacy_html (TipTap). O caminho `visual_builder` foi
// removido (era dead-code — nenhum mapa em produção o usava).
//
// Ver: .lovable/memory/architecture/mapa-trabalho-runtime.md
// ============================================================================

import { renderPlaceholders } from "@/lib/mapaPlaceholders";
import {
  getMapaIdDoExame,
  getMapaTrabalhoById,
  getMapaCatchAll,
  type MapaTrabalho,
} from "@/data/mapaTrabalhoStore";
import { getParametros, loadParametros } from "@/data/exameParametrosStore";
import {
  buildPrintCss,
  colgroupHasUsableWidths as _colgroupHasUsableWidths,
  prepareMapaHtml,
} from "@/lib/mapaSharedStyles";

// Re-export para preservar API pública (testes em mapaPrint.test.ts importam daqui).
export const colgroupHasUsableWidths = _colgroupHasUsableWidths;

/** Um exame pendente já resolvido com dados do paciente / atendimento. */
export interface MapaExameTicket {
  protocolo: string;
  paciente: {
    nome: string;
    cpf: string;
    sexo: string;
    idade: string;
    nascimento?: string;
  };
  guia?: string;
  exameId: string | null; // null = sem catálogo (não cai em mapa individual)
  exameNome: string;
  exameCodigo?: string;
  exameMaterial?: string;
  analista: string;
  convenio?: string;
  dataAtendimento?: string;
  /** Sequência da amostra (1, 2, ...). >1 indica repetição do mesmo exame. */
  amostraSeq?: number;
  /** Grupo lógico de repetições do mesmo exame (mesmo UUID = mesma série). */
  grupoExameId?: string | null;
  /** Marca exames que reutilizam uma amostra previamente coletada. */
  isReutilizacao?: boolean;
  /** ID da amostra física: exames com mesmo amostraId compartilham o tubo. */
  amostraId?: string | null;
}

const formatDateBR = (d = new Date()) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Substitui placeholders e adiciona o sistema (data/usuário) automaticamente. */
function renderTicket(template: string, ticket: MapaExameTicket, usuario: string, ordem?: number): string {
  return renderPlaceholders(template, {
    paciente: {
      nome: ticket.paciente.nome,
      cpf: ticket.paciente.cpf,
      sexo: ticket.paciente.sexo,
      idade: ticket.paciente.idade,
      nascimento: ticket.paciente.nascimento ?? "",
      protocolo: ticket.protocolo,
      guia: ticket.guia ?? "",
    },
    protocolo: ticket.protocolo,
    guia: ticket.guia ?? "",
    ordem: ordem != null ? String(ordem) : "",
    atendimento: { data: ticket.dataAtendimento ?? "", prioridade: "" },
    convenio: { nome: ticket.convenio ?? "" },
    analista: { nome: ticket.analista || "—" },
    exame: {
      nome: ticket.exameNome,
      codigo: ticket.exameCodigo ?? "",
      material: ticket.exameMaterial ?? "",
    },
    sistema: { dataImpressao: formatDateBR(), usuario },
  });
}

// ─── Folhas individuais — geram UMA tabela única com várias linhas numeradas ──
// Cada exame pendente do mesmo tipo de folha vira uma "linha" da tabela.

/**
 * Renderiza um mapa individual usando EXATAMENTE o HTML do template salvo
 * em "Configurações → Mapas de Trabalho".
 *
 * Estratégia (FIDELIDADE ABSOLUTA ao editor):
 *   • Para cada paciente pendente, replicamos o HTML do template inteiro,
 *     trocando apenas placeholders ({{paciente.*}}, {{ordem}}, etc.) e o
 *     "1" da primeira `<td rowspan="…">` (heurística para o número da
 *     sequência quando o template não usa {{ordem}}).
 *   • Entre cada bloco inserimos um parágrafo vazio para dar respiro visual
 *     ao operador. Não fazemos nenhuma cirurgia no HTML (não dividimos
 *     thead/tbody/colgroup, não mexemos em `<tr>`/`<td>`): isso garante que
 *     larguras, bordas, cores e estrutura saiam BIT-A-BIT iguais ao editor.
 *   • Os blocos quebram naturalmente entre páginas — o CSS de impressão
 *     impede `page-break-inside` no meio de cada bloco (`.mapa-bloco-paciente`).
 */
function renderMapaIndividualFromTemplate(
  mapa: MapaTrabalho,
  tickets: MapaExameTicket[],
  usuario: string,
): string {
  const html = mapa.conteudo || "";
  if (tickets.length === 0) return "";
  if (!html.trim()) return "";

  // Detecta se o template usa o placeholder {{ordem}} — se não, aplicamos a
  // heurística legada de trocar o "1" da primeira `<td rowspan="…">` pelo
  // número da sequência por paciente.
  const templateUsaOrdem = /\{\{\s*ordem\s*\}\}/i.test(html);

  // Separador entre blocos de paciente: parágrafo vazio com altura mínima.
  // O wrapper `.mapa-bloco-paciente` recebe `page-break-inside: avoid` no CSS
  // base (mapaSharedStyles.ts) para evitar que um paciente seja partido entre
  // páginas durante a impressão.
  const separador = `<p class="mapa-separador" style="margin:0; padding:6px 0; height:10px;">&nbsp;</p>`;

  const blocos = tickets.map((t, i) => {
    const numero = i + 1;
    let bloco = html;
    if (!templateUsaOrdem) {
      bloco = bloco.replace(
        /(<td[^>]*rowspan\s*=\s*["']?\d+["']?[^>]*>)\s*1\s*(<\/td>)/i,
        `$1${numero}$2`,
      );
    }
    const rendered = renderTicket(bloco, t, usuario, numero);
    return `<div class="mapa-bloco-paciente">${rendered}</div>`;
  });

  return `<div class="mapa-page">${blocos.join(separador)}</div>`;
}

/** HTML do bloco "Lote" — uma linha por paciente, com blocos horizontais por exame. */
function buildLoteBlock(
  analista: string,
  ticketsAgrupadosPorPaciente: Map<string, MapaExameTicket[]>,
  usuario: string,
): string {
  // Catch-all oficial (LOTE + isCatchAll = true). Substitui a antiga heurística
  // textual sobre o nome do mapa.
  const mapaLote = getMapaCatchAll();

  return buildLoteBlockFromTemplate({
    templateHtml: mapaLote?.conteudo ?? "",
    analista,
    ticketsAgrupadosPorPaciente,
    usuario,
  });
}

/**
 * Versão pura do bloco LOTE: recebe o HTML do template explicitamente,
 * permitindo gerar a pré-visualização no editor (Configurações → Mapas
 * de Trabalho) com o conteúdo em edição (ainda não salvo).
 */
export function buildLoteBlockFromTemplate({
  templateHtml,
  analista,
  ticketsAgrupadosPorPaciente,
  usuario,
}: {
  templateHtml: string;
  analista: string;
  ticketsAgrupadosPorPaciente: Map<string, MapaExameTicket[]>;
  usuario: string;
}): string {
  // ─────────────────────────────────────────────────────────────────────────
  // O Mapa do Analista — Lote tem layout FIXO (não é editável pelo usuário).
  // Ignoramos qualquer `templateHtml` recebido e geramos a estrutura de
  // referência (PDF MAPA_TESTE.pdf):
  //   • Cabeçalho global (cinza) com "MAPA DO ANALISTA — <analista>".
  //   • Para cada paciente, UMA tabela 2 colunas:
  //       ┌─┬─────────────────────────────────────────────┐
  //       │ │ PROTOCOLO: ATD-…    GUIA: …                 │  ← cinza
  //       │N│ NOME PACIENTE  Sexo  Idade                  │  ← cinza
  //       │ │ [EXAME ▸ abrev]  [EXAME ▸ abrev abrev abrev]│  ← flex-wrap
  //       └─┴─────────────────────────────────────────────┘
  //   • Cada bloco de exame ocupa o espaço necessário; quando excede a
  //     largura útil, quebra para a linha de baixo (flex-wrap).
  //   • Pacientes não são partidos entre páginas (CSS `mapa-bloco-paciente`).
  // O parâmetro `templateHtml` é mantido na assinatura por compatibilidade
  // com o preview do editor, mas seu conteúdo é ignorado intencionalmente.
  void templateHtml;

  const renderBlocosExames = (tickets: MapaExameTicket[]): string =>
    // Agrupa tickets por TUBO (mesmo amostraId compartilhado) ou pelo nome
    // do exame quando não houver amostra física vinculada. Isso evita
    // reimprimir cabeçalho de exame quando vários exames usam o mesmo
    // material/recipiente.
    (() => {
      type Grupo = { chave: string; tubo: boolean; tickets: MapaExameTicket[] };
      const ordem: string[] = [];
      const grupos = new Map<string, Grupo>();
      for (const t of tickets) {
        const chave = t.amostraId ? `tubo:${t.amostraId}` : `ex:${t.exameNome}-${t.amostraSeq ?? 1}`;
        let g = grupos.get(chave);
        if (!g) {
          g = { chave, tubo: !!t.amostraId, tickets: [] };
          grupos.set(chave, g);
          ordem.push(chave);
        }
        g.tickets.push(t);
      }
      return ordem
        .map((k) => grupos.get(k)!)
        .map(({ tickets: gTickets, tubo }) => {
          const t = gTickets[0];
        const params = getParametros(t.exameId ?? "");
        const visiveis = params.filter((p) => p.visivel !== false && p.exibirMapa !== "Não");
        const colsAbrev = visiveis.length > 0
          ? visiveis.map((p) => p.abreviacao || p.chave || p.rotulo).filter(Boolean)
          : [t.exameNome.slice(0, 6).toUpperCase()];
        // Larguras MÍNIMAS iguais por coluna garantem alinhamento perfeito entre
        // o nome do exame (mesclado) e as abreviações abaixo. Quando o nome é
        // mais largo que o somatório das colunas, ele é quem dita a largura
        // total do bloco — e as colunas se distribuem proporcionalmente via
        // `flex:1` (preenchendo 100% da largura ocupada pelo cabeçalho).
        const minColPx = 38; // largura mínima por abreviação
        const cols = colsAbrev
          .map(
            (abrev, i) => `
          <div style="flex:1 1 0; min-width:${minColPx}px; font-size:8px; padding:1px 6px; text-align:center; font-weight:700; border-bottom:1px dashed #000; white-space:nowrap; ${i < colsAbrev.length - 1 ? "border-right:1px dashed #000;" : ""}">${escapeHtml(abrev)}</div>
        `,
          )
          .join("");
        const fill = colsAbrev
          .map(
            (_, i) => `
          <div style="flex:1 1 0; min-width:${minColPx}px; height:18px; padding:0 6px; ${i < colsAbrev.length - 1 ? "border-right:1px dashed #000;" : ""}"></div>
        `,
          )
          .join("");
        // Largura mínima do bloco = soma das larguras mínimas das colunas.
        // Assim o nome do exame "mescla" visualmente sobre todas as abreviações
        // (1 célula em cima, N células embaixo) sem desalinhar.
        const minBlocoPx = minColPx * colsAbrev.length;
        // Cabeçalho do exame: nome + (#N quando seq > 1) + badge REUTIL. quando
        // for reutilização. Quando o tubo é compartilhado, lista os outros
        // exames do mesmo tubo numa segunda linha de subtítulo.
        const nomesTubo = tubo
          ? Array.from(new Set(gTickets.map((g) => g.exameNome)))
          : [t.exameNome];
        const tituloPrincipal = tubo
          ? nomesTubo[0]
          : `${t.exameNome}${(t.amostraSeq ?? 1) > 1 ? ` #${t.amostraSeq}` : ""}`;
        const reuso = !tubo && t.isReutilizacao
          ? ` <span style="font-size:7px; padding:0 3px; border:1px solid #000; border-radius:2px; vertical-align:middle;">REUTIL.</span>`
          : "";
        const subTubo = tubo && nomesTubo.length > 1
          ? `<div style="font-size:7px; color:#444; padding:0 8px 1px; text-align:center; white-space:nowrap;">+ ${escapeHtml(nomesTubo.slice(1).join(" · "))}</div>`
          : "";
        const badgeTubo = tubo
          ? ` <span style="font-size:7px; padding:0 3px; border:1px dashed #000; border-radius:2px; vertical-align:middle;">MESMO TUBO · ${nomesTubo.length}</span>`
          : "";
        return `
          <div style="display:flex; flex-direction:column; border-right:1px solid #000; flex:0 0 auto; min-width:${minBlocoPx}px;">
            <div style="font-size:8px; padding:2px 8px; text-align:center; white-space:nowrap; font-weight:600;">${escapeHtml(tituloPrincipal)}${reuso}${badgeTubo}</div>
            ${subTubo}
            <div style="display:flex;">${cols}</div>
            <div style="display:flex;">${fill}</div>
          </div>
        `;
        })
        .join("");
    })();

  let idx = 0;
  const blocosPaciente: string[] = [];
  ticketsAgrupadosPorPaciente.forEach((tickets) => {
    const head = tickets[0];
    const numero = ++idx;
    const blocosExames = renderBlocosExames(tickets);
    const protocolo = escapeHtml(head.protocolo || "-");
    const guia = escapeHtml(head.guia || "-");
    const nome = escapeHtml(head.paciente.nome || "");
    const sexo = escapeHtml(head.paciente.sexo || "");
    const idade = escapeHtml(head.paciente.idade || "");
    blocosPaciente.push(`
      <table class="mapa-bloco-paciente" style="width:100%; border-collapse:collapse; font-size:9px; font-family:Arial,Helvetica,sans-serif; border:1px solid #000; margin-bottom:6px;">
        <tbody>
          <tr>
            <td rowspan="3" style="width:24px; min-width:24px; border-right:1px solid #000; background:#F2F2F2; text-align:center; vertical-align:middle; font-size:11px; font-weight:600;">${numero}</td>
            <td style="padding:3px 6px; background:#F2F2F2; border-bottom:1px solid #000;">
              <strong>PROTOCOLO:</strong> ${protocolo} &nbsp; <strong>GUIA:</strong> ${guia}
            </td>
          </tr>
          <tr>
            <td style="padding:3px 6px; background:#F2F2F2; border-bottom:1px solid #000;">
              <strong>${nome}</strong>${sexo ? ` <span style="color:#444;">${sexo}</span>` : ""}${idade ? ` <span style="color:#444;">${idade}</span>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:0;">
              <div style="display:flex; flex-wrap:wrap; align-items:stretch;">${blocosExames}</div>
            </td>
          </tr>
        </tbody>
      </table>
    `);
  });

  const cabecalho = `
    <div style="font-size:9px; font-family:Arial,Helvetica,sans-serif; padding:5px 6px; text-align:right; background:#F2F2F2; font-weight:600; border:1px solid #000; margin-bottom:6px;">
      MAPA DO ANALISTA — ${escapeHtml(analista || "—")}, Impresso em ${formatDateBR()} por ${escapeHtml(usuario)}
    </div>`;

  return `<div class="mapa-page">${cabecalho}${blocosPaciente.join("")}</div>`;
}

export interface BuildMapaHtmlInput {
  tickets: MapaExameTicket[];
  /** Nome a ser exibido no rodapé "Impresso por". */
  usuario?: string;
  /** Nome do analista exibido no cabeçalho do bloco "Lote". Se omitido, usa o analista do primeiro ticket sem mapa. */
  analistaLote?: string;
  /** Título principal do documento. */
  tituloDocumento?: string;
  /** Orientação da página A4. Default: portrait. */
  orientation?: "portrait" | "landscape";
}

/**
 * Gera o HTML completo de impressão.
 * Pré-condição: os parâmetros dos exames usados no Lote devem estar carregados
 * (chame `prefetchParametrosForTickets` antes).
 */
export function buildMapasHtml({
  tickets,
  usuario = "—",
  analistaLote,
  tituloDocumento = "Mapas de Trabalho",
  orientation = "portrait",
}: BuildMapaHtmlInput): string {
  const cssReset = buildPrintCss(orientation);
  if (tickets.length === 0) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(tituloDocumento)}</title><style>${cssReset}</style></head><body><p style="font-size:11px;color:#444;">Nenhum exame pendente para imprimir.</p></body></html>`;
  }

  // 1) Separa: tickets com mapa individual vs sem mapa (vão pro Lote).
  //    Agrupa tickets por mapa individual para gerar UMA folha com várias linhas
  //    numeradas (1, 2, 3...) — fiel ao layout legado.
  const grupoIndividual = new Map<string, { mapa: MapaTrabalho; tickets: MapaExameTicket[] }>();
  const semMapa: MapaExameTicket[] = [];

  for (const t of tickets) {
    let escolhido: MapaTrabalho | undefined;
    if (t.exameId) {
      // Cardinalidade 1:N — cada exame está vinculado a no máximo UM mapa.
      const mid = getMapaIdDoExame(t.exameId);
      const m = mid ? getMapaTrabalhoById(mid) : undefined;
      if (m && m.ativo && m.tipo === "INDIVIDUAL") escolhido = m;
    }
    if (escolhido) {
      const g = grupoIndividual.get(escolhido.id) ?? { mapa: escolhido, tickets: [] };
      g.tickets.push(t);
      grupoIndividual.set(escolhido.id, g);
    } else {
      semMapa.push(t);
    }
  }

  // 2) Renderiza cada grupo de mapa individual como UMA folha (uma linha por
  //    ticket). Renderer único: legacy_html (TipTap).
  const blocosIndividuais = Array.from(grupoIndividual.values())
    .map(({ mapa, tickets: ts }) => renderMapaIndividualFromTemplate(mapa, ts, usuario))
    .join("");

  // 3) Lote — agrupa por paciente (chave: protocolo)
  let blocoLote = "";
  if (semMapa.length > 0) {
    const grupo = new Map<string, MapaExameTicket[]>();
    for (const t of semMapa) {
      const arr = grupo.get(t.protocolo) ?? [];
      arr.push(t);
      grupo.set(t.protocolo, arr);
    }
    const analista = analistaLote ?? (semMapa.find((t) => t.analista)?.analista || "—");
    blocoLote = buildLoteBlock(analista, grupo, usuario);
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(tituloDocumento)}</title>
  <style>${cssReset}</style>
</head>
<body>
  ${prepareMapaHtml(blocosIndividuais)}
  ${prepareMapaHtml(blocoLote)}
</body>
</html>`;
}

/**
 * Garante que os parâmetros dos exames listados estejam carregados em cache antes
 * de gerar o HTML do Lote.
 */
export async function prefetchParametrosForTickets(tickets: MapaExameTicket[]): Promise<void> {
  const ids = Array.from(new Set(tickets.map((t) => t.exameId).filter((x): x is string => !!x)));
  await Promise.all(ids.map((id) => loadParametros(id)));
}
