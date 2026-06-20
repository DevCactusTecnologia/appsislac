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
        /* Cada .laudo-a4-page representa UMA folha A4 completa (210x297mm)
           com as margens aplicadas como padding interno. Isso evita que o
           html2pdf adicione margens externas em cima do nosso cálculo de
           altura, que era a causa do rodapé fora de posição e da 2ª página
           em branco. O html2pdf é configurado com margin:0 porque a margem
           real já está no padding interno da folha. */
        @page { size: A4; margin: 0; }
        .laudo-a4-page {
          width: 210mm !important;
          height: 297mm !important;
          min-height: 297mm !important;
          max-height: 297mm !important;
          margin: 0 !important;
          padding: ${m.top}mm ${m.right}mm ${printBottomMarginMm}mm ${m.left}mm !important;
          box-sizing: border-box !important;
          background: #ffffff !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
        }
        .laudo-a4-cabecalho { flex: 0 0 auto; }
        .laudo-a4-corpo { flex: 1 1 auto; min-height: 0; }
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
        /* Zera quaisquer margens/paddings/max-widths trazidos pelos templates
           configurados em /configuracoes → Documentos, garantindo que o
           conteúdo use toda a largura útil definida por @page e que html2pdf
           (que ignora @page) também respeite essas margens. */
        .laudo-cabecalho-wrap, .laudo-rodape-wrap,
        .laudo-cabecalho-wrap *, .laudo-rodape-wrap * {
          max-width: none !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          box-sizing: border-box !important;
        }
        .laudo-cabecalho-wrap > *, .laudo-rodape-wrap > * { margin-top:0 !important; margin-bottom:0 !important; padding-top:0 !important; padding-bottom:0 !important; }
        .laudo-cabecalho-wrap > * > *:first-child, .laudo-rodape-wrap > * > *:first-child { margin-top:0 !important; padding-top:0 !important; }
        .laudo-cabecalho-wrap > * > *:last-child, .laudo-rodape-wrap > * > *:last-child { margin-bottom:0 !important; padding-bottom:0 !important; }
        /* Esconde parágrafos vazios deixados por templates do editor para que
           a distância entre cabeçalho e nome do exame seja de apenas 1 linha. */
        .laudo-cabecalho-wrap p:empty,
        .laudo-cabecalho-wrap p:has(> br:only-child),
        .laudo-rodape-wrap p:empty,
        .laudo-rodape-wrap p:has(> br:only-child) { display: none !important; }
        /* Garante que imagens (cabeçalho/rodapé) nunca ultrapassem a largura útil,
           evitando que o html2canvas amplie a windowWidth e desbalanceie a margem direita. */
        .laudo-cabecalho-wrap img, .laudo-rodape-wrap img { max-width: 100% !important; height: auto !important; display: block; }
        .laudo-cabecalho-wrap, .laudo-rodape-wrap { width: 100% !important; }
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
          line-height: 1.6 !important;
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
        #laudo-content p, #laudo-content div, #laudo-content h1, #laudo-content h2,
        #laudo-content h3, #laudo-content h4, #laudo-content h5, #laudo-content h6,
        #laudo-content ul, #laudo-content ol, #laudo-content li, #laudo-content pre {
          margin: 0 !important;
        }
        #laudo-content br { line-height: 1.4 !important; }
        /* O corpo do laudo começa imediatamente após o cabeçalho — sem
           respiro extra (apenas o line-height padrão de 1 parágrafo). */
        .laudo-a4-corpo > #laudo-content > *:first-child,
        .laudo-a4-corpo #laudo-content .exame-bloco:first-child,
        .laudo-a4-corpo #laudo-content .exame-bloco-custom:first-child {
          margin-top: 0 !important;
          padding-top: 0 !important;
        }
        /* Evita quebra de exame e assinatura entre páginas. */
        .exame-bloco { page-break-inside: avoid; break-inside: avoid; }
        .assinatura-bloco { page-break-inside: avoid; break-inside: avoid; }
        .exame-bloco + .assinatura-bloco { page-break-before: avoid; break-before: avoid; }
        @media print {
          .exame-bloco, .assinatura-bloco { page-break-inside: avoid !important; break-inside: avoid !important; }
          .exame-bloco + .assinatura-bloco { page-break-before: avoid !important; break-before: avoid !important; }
          html, body { margin:0 !important; padding:0 !important; height:100% !important; }
        }
      </style>

      <div class="laudo-a4-page">
        <div class="laudo-a4-cabecalho">
          ${cabecalhoPadrao
            ? `<div class="laudo-cabecalho-wrap">${cabecalhoPadrao}</div>`
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
              <div style="font-size:12pt;font-weight:700;color:#000000;padding-bottom:0;margin-bottom:2px;font-family:Helvetica,Arial,sans-serif;">${exame.nome} <span style="font-size:12pt;font-weight:400;color:#888;">(${exame.material})</span></div>
              <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-family:'Courier New',Courier,monospace;">
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
          <p class="assinatura-liberado-linha" style="font-size:9pt;color:#000;display:block;width:${assinaturaLineWidthMm}mm;max-width:calc(100% - ${assinaturaRightOffsetMm}mm);min-width:0;text-align:right;box-sizing:border-box;padding:0;margin:0 ${assinaturaRightOffsetMm}mm 0 auto;overflow:visible;overflow-wrap:anywhere;word-break:break-word;white-space:normal;line-height:1.6;"><span class="assinatura-liberado-prefixo">CONFERIDO E LIBERADO POR: </span><span class="assinatura-liberado-nome">${(analistaAtual.nome || "").toUpperCase()}</span></p>
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
