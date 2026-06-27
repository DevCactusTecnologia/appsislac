// laudoHtmlBuilder — extração mecânica do `buildLaudoHtml` originalmente
// inline em src/pages/ResultadoDetalhe.tsx (linhas 776–1086).
//
// CONSTRAINT — mem://constraints/layout-impressao-travado.md
// Margens (@page 4/11/4/11mm), rodapé de 4mm, bloco de assinatura,
// fontes (Helvetica/Courier New) e TODO o CSS de impressão estão CONGELADOS
// e foram movidos aqui SEM EDITAR uma única linha do conteúdo HTML/CSS.
// Qualquer alteração ao corpo desta função exige pedido explícito do usuário.
//
// A função foi convertida de `useCallback` para função pura: recebe as deps
// do componente (`paciente`, `analistaAtual`, `assinaturaLaudo`, `getResolvedRef`)
// como argumentos nomeados, em vez de capturá-las do closure React.

import { isValueInRange } from "@/components/ResultadoValidationBar";
import { renderCabecalhoPadrao, renderRodapePadrao } from "@/lib/documentoRenderer";
import { resolveResultadoRegulatorio, renderRegulatorioFooterHtml } from "@/lib/regulatorioResolver";
import { getLabConfig } from "@/data/labConfigStore";
import { buildWatermarkCss } from "@/lib/watermark";
import type { Exame, Paciente, Parametro } from "../types";

export interface AnalistaAtual {
  nome: string;
  iniciais: string;
}

export interface AssinaturaLaudo {
  tipo: "carimbo" | "imagem";
  conselho: string | null;
  url: string | null;
}

export type ResolveRefFn = (exameNome: string, param: Parametro) => {
  refMin?: string;
  refMax?: string;
  refUnidade?: string;
};

export interface BuildLaudoHtmlArgs {
  paciente: Paciente;
  analistaAtual: AnalistaAtual;
  assinaturaLaudo: AssinaturaLaudo;
  getResolvedRef: ResolveRefFn;
  printable: Exame[];
  customByExame?: Record<number, string>;
  solicitanteLabel?: string;
  pageMargins?: { top: number; right: number; bottom: number; left: number };
}

/**
 * Monta o HTML do laudo. Para cada exame, usa o HTML renderizado a partir
 * do Layout Científico (em `customByExame`). Se não houver, cai na tabela
 * padrão hardcoded — fallback de emergência mantido por retro-compat.
 */
export function buildLaudoHtml(args: BuildLaudoHtmlArgs): string {
  const {
    paciente, analistaAtual, assinaturaLaudo, getResolvedRef,
    printable, customByExame, solicitanteLabel, pageMargins,
  } = args;
  // Cabeçalho padrão configurado em /configuracoes → Documentos.
  // Quando existe um template marcado como "padrão" para o tipo "cabeçalho",
  // ele substitui o cabeçalho legado deste laudo (logo + dados do laboratório
  // + variáveis do paciente/atendimento conforme o template).
  // Margens padrão alinhadas ao modelo institucional do laudo de referência:
  // ~10mm topo/inferior e ~12mm nas laterais, garantindo conteúdo centralizado
  // e alinhamento entre cabeçalho, corpo e rodapé em todas as páginas.
  const m = pageMargins ?? { top: 4, right: 11, bottom: 4, left: 11 };
  const pageContentWidthMm = 210 - m.left - m.right;
  const printBottomMarginMm = Number.isFinite(m.bottom) ? m.bottom : 4;
  // A arte institucional do rodapé define uma faixa lateral direita protegida
  // ligeiramente maior que a margem técnica do @page. A assinatura deve terminar
  // exatamente no limite interno visual dessa faixa, sem invadir a margem.
  const assinaturaRightOffsetMm = Math.max(0, Math.max(m.right, 15) - m.right);
  const assinaturaLineWidthMm = Math.max(70, pageContentWidthMm - assinaturaRightOffsetMm);
  const cabecalhoPadrao = renderCabecalhoPadrao({
    paciente: {
      nome: paciente.nome,
      cpf: paciente.cpf,
      nascimento: paciente.nascimento,
      idade: paciente.idade,
      sexo: paciente.sexo,
    },
    atendimento: {
      protocolo: paciente.protocolo,
      data: paciente.dataCadastro,
      convenio: paciente.convenio || undefined,
      solicitante: solicitanteLabel || paciente.solicitante || undefined,
      dataCadastro: paciente.dataCadastro,
      dataFinalizacao: new Date().toLocaleDateString("pt-BR"),
    },
  });
  // Remove blocos vazios/whitespace no final do cabeçalho (ex.: <p>&nbsp;</p>,
  // <p><br></p>, <div></div>) que criam um espaço visível entre o cabeçalho
  // e o nome do exame mesmo quando o template não tem conteúdo ali.
  const trimTrailingEmptyBlocks = (html: string): string => {
    let out = html;
    // executa repetidamente até estabilizar
    for (let i = 0; i < 20; i++) {
      const next = out.replace(
        /(?:\s|<p[^>]*>\s*(?:&nbsp;|&#160;|\u00a0)?\s*(?:<br\s*\/?>\s*)*<\/p>|<div[^>]*>\s*(?:&nbsp;|&#160;|\u00a0)?\s*(?:<br\s*\/?>\s*)*<\/div>|<br\s*\/?>)+\s*$/i,
        "",
      );
      if (next === out) break;
      out = next;
    }
    return out;
  };
  const cabecalhoPadraoTrimmed = trimTrailingEmptyBlocks(cabecalhoPadrao);
  const rodapePadrao = renderRodapePadrao({
    paciente: {
      nome: paciente.nome,
      cpf: paciente.cpf,
      nascimento: paciente.nascimento,
      idade: paciente.idade,
      sexo: paciente.sexo,
    },
    atendimento: {
      protocolo: paciente.protocolo,
      data: paciente.dataCadastro,
      convenio: paciente.convenio || undefined,
      solicitante: solicitanteLabel || paciente.solicitante || undefined,
      dataCadastro: paciente.dataCadastro,
      dataFinalizacao: new Date().toLocaleDateString("pt-BR"),
    },
  });
  return `
      <style>
        /* Usamos a fonte "Courier" nativa (base PDF Type 1) para o corpo dos
           resultados — espelha o padrão do laudo de referência (Laravel) e
           renderiza nítido no PDF, sem dependência de webfont externa que
           pode chegar parcial no html2canvas e causar aspecto "embaçado". */
        /* Cada .laudo-a4-page representa UMA folha A4 completa (210x297mm)
           com as margens aplicadas como padding interno. Isso evita que o
           html2pdf adicione margens externas em cima do nosso cálculo de
           altura, que era a causa do rodapé fora de posição e da 2ª página
           em branco. O html2pdf é configurado com margin:0 porque a margem
           real já está no padding interno da folha. */
        @page { size: A4; margin: 0; }

        /* Paginação natural: o container NÃO trava altura nem usa overflow:hidden.
           Isso permite que o motor de impressão quebre o fluxo entre páginas
           respeitando `page-break-inside: avoid` em cada `.exame-bloco`.
           `min-height: 297mm` garante que laudos curtos ainda preencham a folha. */
        .laudo-a4-page {
          width: 210mm !important;
          min-height: 297mm !important;
          margin: 0 !important;
          padding: ${m.top}mm ${m.right}mm ${printBottomMarginMm}mm ${m.left}mm !important;
          box-sizing: border-box !important;
          background: #ffffff !important;
          display: flex !important;
          flex-direction: column !important;
        }
        .laudo-a4-cabecalho { flex: 0 0 auto; padding: 0 !important; margin: 0 !important; }
        .laudo-a4-cabecalho > *:last-child, .laudo-a4-cabecalho * :last-child { margin-bottom: 0 !important; padding-bottom: 0 !important; }
        .laudo-cabecalho-wrap > *:last-child { margin-bottom: 0 !important; padding-bottom: 0 !important; }
        .laudo-a4-corpo { flex: 1 1 auto; min-height: 0; padding-top: 0 !important; margin-top: 0 !important; }
        .laudo-a4-rodape { flex: 0 0 auto; margin-top: auto !important; }
        /* Fontes do corpo do laudo: respeitamos a fonte definida no editor
           do Layout Científico (font-family inline). Aplicamos apenas um
           fallback quando o layout não define fonte alguma, sem !important
           para não sobrescrever a escolha do usuário. */
        .exame-bloco-custom { font-family: Helvetica, Arial, sans-serif; }
        /* Cabeçalho/rodapé do laudo: Helvetica 9pt (espelha o padrão do laudo de referência),
           sobrescrevendo qualquer fonte inline herdada do template configurado. */
        .laudo-cabecalho-wrap, .laudo-cabecalho-wrap *,
        .laudo-rodape-wrap, .laudo-rodape-wrap * {
          font-family: Helvetica, Arial, sans-serif !important;
          font-size: 9pt !important;
        }
        /* Zera margens/paddings/max-widths trazidos pelos templates configurados
           em /configuracoes → Documentos no WRAPPER do cabeçalho/rodapé, garantindo
           que o conteúdo use toda a largura útil definida por @page. NÃO zeramos
           margens de elementos internos (td, th, figure, img, table) para preservar
           alinhamentos definidos no editor (ex.: imagem alinhada à direita em uma
           célula da tabela do cabeçalho). */
        .laudo-cabecalho-wrap, .laudo-rodape-wrap {
          max-width: none !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          box-sizing: border-box !important;
          width: 100% !important;
        }
        .laudo-cabecalho-wrap *, .laudo-rodape-wrap * {
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
        .laudo-cabecalho-wrap > *, .laudo-rodape-wrap > * { margin-top:0 !important; margin-bottom:0 !important; padding-top:0 !important; padding-bottom:0 !important; }
        .laudo-cabecalho-wrap > * > *:first-child, .laudo-rodape-wrap > * > *:first-child { margin-top:0 !important; padding-top:0 !important; }
        .laudo-cabecalho-wrap > * > *:last-child, .laudo-rodape-wrap > * > *:last-child { margin-bottom:0 !important; padding-bottom:0 !important; }
        /* Alinhamento horizontal do cabeçalho com o corpo do laudo (nome do
           exame). Templates configurados em /configuracoes → Documentos
           costumam usar uma tabela wrapper com cellpadding/cellspacing e a
           primeira coluna com padding-left. Isso empurrava a logomarca
           para a direita em relação ao corpo. Zeramos só o lado esquerdo
           dos containers de 1º nível e da primeira célula de cada linha —
           preserva qualquer alinhamento à direita (ex.: logo PNCQ) feito
           via text-align:right. */
        .laudo-cabecalho-wrap,
        .laudo-cabecalho-wrap * {
          padding-left: 0 !important;
        }
        /* Zera margin-left de todos os descendentes EXCETO imagens
           (que podem usar margin-left:auto para alinhamento à direita)
           e elementos explicitamente alinhados à direita. text-align:right
           continua funcionando normalmente em td/p/div. */
        .laudo-cabecalho-wrap,
        .laudo-cabecalho-wrap > *,
        .laudo-cabecalho-wrap table,
        .laudo-cabecalho-wrap tbody,
        .laudo-cabecalho-wrap tr,
        .laudo-cabecalho-wrap td,
        .laudo-cabecalho-wrap th,
        .laudo-cabecalho-wrap p,
        .laudo-cabecalho-wrap div,
        .laudo-cabecalho-wrap span {
          margin-left: 0 !important;
        }
        /* CKEditor também envolve tabelas do cabeçalho em <figure class="table">.
           O margin-left padrão do browser (40px) era exatamente o recuo que
           deixava logo/dados do cabeçalho fora da linha do nome do exame. */
        .laudo-cabecalho-wrap figure,
        .laudo-cabecalho-wrap figcaption {
          margin: 0 !important;
          padding: 0 !important;
        }
        .laudo-cabecalho-wrap figure.table {
          display: block !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        .laudo-cabecalho-wrap table {
          border-collapse: collapse !important;
          border-spacing: 0 !important;
          width: 100% !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
        }
        /* Remove cellpadding/cellspacing herdados de tabelas do CKEditor
           que empurram a primeira coluna para a direita. */
        .laudo-cabecalho-wrap table[cellpadding],
        .laudo-cabecalho-wrap table[cellspacing] {
          border-spacing: 0 !important;
        }
        .laudo-cabecalho-wrap td,
        .laudo-cabecalho-wrap th { padding-left: 0 !important; }
        /* Esconde parágrafos vazios deixados por templates do editor para que
           a distância entre cabeçalho e nome do exame seja de apenas 1 linha. */
        .laudo-cabecalho-wrap p:empty,
        .laudo-rodape-wrap p:empty { display: none !important; }
        .laudo-cabecalho-wrap p > br:only-child,
        .laudo-rodape-wrap p > br:only-child { display: none !important; }
        /* Imagens do cabeçalho/rodapé: limitamos a largura mas NÃO forçamos
           display:block (que ignoraria text-align do td/p) nem zeramos margens
           (que cancelaria float:right ou margin:auto do CKEditor). */
        .laudo-cabecalho-wrap img, .laudo-rodape-wrap img { max-width: 100% !important; height: auto !important; }
        .laudo-rodape-wrap { text-align: center !important; }
        .laudo-rodape-wrap > *,
        .laudo-rodape-wrap img,
        .laudo-rodape-wrap table {
          margin-left: auto !important;
          margin-right: auto !important;
        }
        /* Idem para o corpo do laudo. */
        #laudo-content { max-width: none !important; margin: 0 !important; padding: 0 !important; }
        /* Garante que o conteúdo do laudo (inclusive layouts científicos
           customizados com tabelas próprias) nunca ultrapasse a largura útil
           (188mm = 210 − 11 − 11), evitando overflow na margem direita. */
        #laudo-content, #laudo-content > *, #laudo-content .exame-bloco,
        #laudo-content .exame-bloco-custom, #laudo-content .exame-bloco > *,
        #laudo-content .exame-bloco-custom > * {
          max-width: 100% !important;
          box-sizing: border-box !important;
          overflow-wrap: normal !important;
          word-break: normal !important;
          word-wrap: normal !important;
          hyphens: none !important;
        }
        #laudo-content table {
          width: 100% !important;
          max-width: 100% !important;
          table-layout: fixed !important;
          box-sizing: border-box !important;
        }
        #laudo-content img { max-width: 100% !important; height: auto !important; }
        /* Bloco de assinatura ("CONFERIDO E LIBERADO POR…"): respeita largura útil
           sem clipar verticalmente o texto (overflow visível). */
        #laudo-content .assinatura-bloco,
        #laudo-content .assinatura-bloco * {
          max-width: 100% !important;
          box-sizing: border-box !important;
          overflow-wrap: break-word !important;
          word-break: break-word !important;
          white-space: normal !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
        }
        #laudo-content .assinatura-bloco {
          display: block !important;
          width: 100% !important;
          max-width: 100% !important;
          overflow: visible !important;
        }
        #laudo-content .assinatura-liberado-linha {
          display: block !important;
          width: ${assinaturaLineWidthMm}mm !important;
          max-width: calc(100% - ${assinaturaRightOffsetMm}mm) !important;
          min-width: 0 !important;
          margin-left: auto !important;
          margin-right: ${assinaturaRightOffsetMm}mm !important;
          text-align: right !important;
          overflow: visible !important;
          overflow-wrap: anywhere !important;
          word-break: break-word !important;
          white-space: normal !important;
          padding-right: 0 !important;
          line-height: 1.4 !important;
          font-size: 6pt !important;
        }
        #laudo-content .assinatura-liberado-linha *,
        #laudo-content .assinatura-liberado-prefixo,
        #laudo-content .assinatura-liberado-nome {
          font-size: 6pt !important;
          line-height: 1.4 !important;
        }
        #laudo-content .assinatura-liberado-prefixo {
          display: inline !important;
          white-space: normal !important;
        }
        #laudo-content .assinatura-liberado-nome {
          display: inline !important;
          min-width: 0 !important;
          max-width: 100% !important;
          text-align: right !important;
          overflow-wrap: anywhere !important;
          word-break: break-word !important;
          white-space: normal !important;
        }

        /* Padrão institucional: padding 0 em todas as tabelas/células do laudo. */
        #laudo-content table, #laudo-content table * { border-spacing: 0 !important; }
        #laudo-content td, #laudo-content th { padding: 0 !important; }
        #laudo-content th, #laudo-content td { text-align: left !important; vertical-align: top !important; }
        /* Espaçamento entre linhas padrão. */
        #laudo-content, #laudo-content * { line-height: 1.4 !important; }
        /* Cor preta forçada em todos os textos do laudo, cabeçalho e rodapé. */
        #laudo-content, #laudo-content *,
        .laudo-cabecalho-wrap, .laudo-cabecalho-wrap *,
        .laudo-rodape-wrap, .laudo-rodape-wrap * { color: #000 !important; }
        #laudo-content p, #laudo-content div, #laudo-content h1, #laudo-content h2,
        #laudo-content h3, #laudo-content h4, #laudo-content h5, #laudo-content h6,
        #laudo-content ul, #laudo-content ol, #laudo-content li, #laudo-content pre {
          margin: 0 !important;
        }
        #laudo-content br { line-height: 1.4 !important; }
        /* Espaçamento de 16px entre o cabeçalho do laudo e o primeiro exame. */
        .laudo-a4-corpo > #laudo-content > *:first-child,
        .laudo-a4-corpo #laudo-content .exame-bloco:first-child,
        .laudo-a4-corpo #laudo-content .exame-bloco-custom:first-child {
          margin-top: 16px !important;
          padding-top: 0 !important;
        }
        /* Evita quebra de exame e assinatura entre páginas. */
        .exame-bloco { page-break-inside: avoid; break-inside: avoid; }
        /* Remove parágrafos vazios (deixados pelo editor CKEditor) que criavam
           grandes espaços entre o cabeçalho, o nome do exame e o resultado nos
           layouts científicos customizados. */
        #laudo-content .exame-bloco-custom p:empty,
        #laudo-content .exame-bloco-custom div:empty { display: none !important; }
        #laudo-content .exame-bloco-custom p > br:only-child { display: none !important; }
        #laudo-content .exame-bloco-custom > *:first-child { margin-top: 0 !important; padding-top: 0 !important; }
        #laudo-content .exame-bloco-custom > *:last-child { margin-bottom: 0 !important; padding-bottom: 0 !important; }
        /* CKEditor envolve tabelas em <figure class="table">. O navegador
           aplica margin 1em 40px por padrão a &lt;figure&gt;, o que empurra todo
           o corpo do exame ~40px à direita e desalinha do título. html2canvas
           ignorava esse padrão; o motor vetorial respeita. Zeramos margens de
           figure/figcaption no laudo para preservar o alinhamento original. */
        #laudo-content figure, #laudo-content figcaption { margin: 0 !important; padding: 0 !important; }
        #laudo-content figure.table { display: block !important; width: 100% !important; max-width: 100% !important; }
        .assinatura-bloco { page-break-inside: avoid; break-inside: avoid; }
        .exame-bloco + .assinatura-bloco { page-break-before: avoid; break-before: avoid; }
        @media print {
          .exame-bloco, .assinatura-bloco { page-break-inside: avoid !important; break-inside: avoid !important; }
          .exame-bloco + .assinatura-bloco { page-break-before: avoid !important; break-before: avoid !important; }
          html, body { margin:0 !important; padding:0 !important; height:100% !important; }
        }
        /* Marca d'água global (configurada em /configuracoes → Laboratório). */
        ${buildWatermarkCss(getLabConfig().watermark)}
      </style>

      <div class="laudo-a4-page">
        <div class="laudo-a4-cabecalho">
          ${cabecalhoPadraoTrimmed
            ? `<div class="laudo-cabecalho-wrap">${cabecalhoPadraoTrimmed}</div>`
            : `<div style="text-align:center;border-bottom:2px solid #3b3b98;padding-bottom:8px;">
                <h1 style="font-size:14pt;color:#3b3b98;margin:0 0 4px;">LAUDO DE EXAMES LABORATORIAIS</h1>
                <p style="font-size:9pt;color:#666;margin:0;">Protocolo: ${paciente.protocolo} | Data: ${paciente.dataCadastro}</p>
                ${solicitanteLabel ? `<p style="font-size:9pt;color:#3b3b98;margin:4px 0 0;font-weight:600;">Solicitante: ${solicitanteLabel}</p>` : ""}
              </div>`}
        </div>
        <div class="laudo-a4-corpo">
          <div id="laudo-content" style="font-family:Helvetica,Arial,sans-serif;color:#1a1a2e;font-size:12px;">

        ${printable.map((exame) => {
          // Snapshot regulatório (metodologia/unidade) — exibido de forma discreta
          // abaixo do bloco do exame, respeitando flags do catálogo.
          const reg = resolveResultadoRegulatorio({
            exameNome: exame.nome,
            metodologiaSnapshot: exame.metodologiaSnapshot,
            unidadeSnapshot: exame.unidadeSnapshot,
          });
          const regFooter = renderRegulatorioFooterHtml(reg);

          // "Data Coleta: DD/MM/AAAA às HH:MM:SS" à direita do nome do exame —
          // espelha o padrão Laravel/LabMedCenter. Fallback: dataCadastro do
          // atendimento quando não houver carimbo de coleta/análise.
          const isoColeta = exame.dataColetaISO || exame.dataAnaliseISO || null;
          let dataColetaLabel = "";
          if (isoColeta) {
            const d = new Date(isoColeta);
            if (!Number.isNaN(d.getTime())) {
              dataColetaLabel = `Data Coleta: ${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour12: false })}`;
            }
          }
          if (!dataColetaLabel && paciente.dataCadastro) {
            dataColetaLabel = `Data Coleta: ${paciente.dataCadastro}`;
          }
          const dataColetaHtml = dataColetaLabel
            ? `<span style="font-size:8pt;font-weight:700;color:#000;font-family:Helvetica,Arial,sans-serif;white-space:nowrap;">${dataColetaLabel}</span>`
            : "";

          // Se houver layout cadastrado para este exame, usa-o.
          const custom = customByExame?.[exame.id];
          if (custom) return `<div class="exame-bloco" style="page-break-inside:avoid;break-inside:avoid;margin-bottom:16px;">${custom}${regFooter}</div>`;

          // Fallback: tabela padrão de parâmetros.
          const resolvedParams = exame.parametros.map((p) => {
            const ref = getResolvedRef(exame.nome, p);
            const outOfRange = p.valor && ref.refMin && ref.refMax && !isValueInRange(p.valor, ref.refMin, ref.refMax);
            return { ...p, ...ref, outOfRange };
          });
          return `
            <div class="exame-bloco" style="margin-bottom:20px;page-break-inside:avoid;break-inside:avoid;">
              <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding-bottom:0;margin-bottom:2px;font-family:Helvetica,Arial,sans-serif;"><div style="font-size:12pt;font-weight:700;color:#000000;">${exame.nome} <span style="font-size:12pt;font-weight:400;color:#888;">(${exame.material})</span></div>${dataColetaHtml}</div>
              <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-family:Courier,'Courier New',monospace;">

                <thead><tr>
                  <th style="background:#f0f0f8;text-align:left;padding:6px 8px;font-size:9pt;text-transform:uppercase;color:#555;border-bottom:1px solid #ddd;font-family:Helvetica,Arial,sans-serif;">Parâmetro</th>
                  <th style="background:#f0f0f8;text-align:left;padding:6px 8px;font-size:9pt;text-transform:uppercase;color:#555;border-bottom:1px solid #ddd;font-family:Helvetica,Arial,sans-serif;">Resultado</th>
                  <th style="background:#f0f0f8;text-align:left;padding:6px 8px;font-size:9pt;text-transform:uppercase;color:#555;border-bottom:1px solid #ddd;font-family:Helvetica,Arial,sans-serif;">Unidade</th>
                  <th style="background:#f0f0f8;text-align:left;padding:6px 8px;font-size:9pt;text-transform:uppercase;color:#555;border-bottom:1px solid #ddd;font-family:Helvetica,Arial,sans-serif;">Referência</th>
                </tr></thead>
                <tbody>
                  ${resolvedParams.map((p) => `
                    <tr>
                      <td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:9pt;">${p.nome}</td>
                      <td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:9pt;${p.outOfRange ? 'color:#dc2626;font-weight:600;' : ''}">${(p.tipo === "Select" ? (p.valor || "").toUpperCase() : p.valor) || "—"}</td>
                      <td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:9pt;">${p.unidade}</td>
                      <td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:9pt;">${p.refMin && p.refMax ? `${p.refMin} - ${p.refMax} ${p.refUnidade}` : "—"}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
              ${regFooter}
            </div>
          `;
        }).join("")}
        <div class="assinatura-bloco" style="margin-top:18px;page-break-inside:avoid;break-inside:avoid;font-family:Helvetica,Arial,sans-serif;color:#000;width:100%;max-width:100%;box-sizing:border-box;overflow:visible;">
          <p class="assinatura-liberado-linha" style="font-size:6pt;color:#000;display:block;width:${assinaturaLineWidthMm}mm;max-width:calc(100% - ${assinaturaRightOffsetMm}mm);min-width:0;text-align:right;box-sizing:border-box;padding:0;margin:0 ${assinaturaRightOffsetMm}mm 0 auto;overflow:visible;overflow-wrap:anywhere;word-break:break-word;white-space:normal;line-height:1.4;"><span class="assinatura-liberado-prefixo" style="font-size:6pt;">CONFERIDO E LIBERADO POR: </span><span class="assinatura-liberado-nome" style="font-size:6pt;">${(analistaAtual.nome || "").toUpperCase()}</span></p>
          <div style="height:28px;"></div>
          <div style="text-align:center;color:#000;line-height:1.6;">
            ${assinaturaLaudo.tipo === "imagem" && assinaturaLaudo.url
              ? `<img src="${assinaturaLaudo.url}" alt="Assinatura" style="max-height:60px;max-width:240px;object-fit:contain;margin:0 auto 2px;display:block;" />`
              : ``}
            <p style="font-size:10pt;margin:0;font-weight:700;color:#000;line-height:1.6;">${(analistaAtual.nome || "").toUpperCase()}</p>
            <p style="font-size:9pt;margin:0;color:#000;line-height:1.6;">Responsável Técnico</p>
            ${assinaturaLaudo.conselho ? `<p style="font-size:9pt;margin:0;color:#000;line-height:1.6;">${assinaturaLaudo.conselho}</p>` : ""}
          </div>
        </div>
          </div>
        </div>
        <div class="laudo-a4-rodape">
          ${rodapePadrao
            ? `<div class="laudo-rodape-wrap">${rodapePadrao}</div>`
            : `<div style="border-top:1px solid #ddd;padding-top:4px;text-align:center;font-size:8pt;color:#999;">
                <p style="margin:0;">Documento gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}</p>
              </div>`}
        </div>
      </div>
    `;
}
