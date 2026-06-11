// Gerador de template HTML padrão para layouts de laudo.
//
// O template segue o modelo institucional anexo: cabeçalho com identificação
// do laboratório, dados do paciente, tabela de resultados (Parâmetro / Resultado /
// Valor de referência / Unidade) e rodapé de assinatura.
//
// Os placeholders usam o padrão ##CHAVE## (compatível com `laudoLayout.ts`):
//   ##PACIENTE_NOME##, ##PACIENTE_IDADE##, ##PACIENTE_SEXO##, ##DATA_COLETA##,
//   ##DATA_LIBERACAO##, ##PROTOCOLO##, ##SOLICITANTE##  -> resolvidos no laudo
//   ##<chave_do_parametro>## -> valor digitado para aquele parâmetro
//
// Cada parâmetro do exame vira uma linha da tabela; "—" aparece quando não há
// valor de referência cadastrado, deixando claro que aquele item é descritivo.

import type { ExameParametro } from "@/data/exameParametrosStore";

interface BuildTemplateInput {
  exameNome: string;
  parametros: ExameParametro[];
}

/** Gera HTML pronto para o editor de layout de laudo. */
export const buildLayoutTemplate = ({ exameNome, parametros }: BuildTemplateInput): string => {
  const visiveis = parametros.filter((p) => p.visivel !== false);
  const linhas = visiveis.length
    ? visiveis
        .map(
          (p) => `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-weight:500;">${escapeHtml(p.rotulo)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">
            <span style="font-weight:600;">##${escapeHtml(p.chave)}##</span>
            <span style="color:#dc2626;font-weight:700;margin-left:4px;">##FLAG_${escapeHtml(p.chave)}##</span>
          </td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;color:#475569;font-size:11px;">##REF_${escapeHtml(p.chave)}##</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;color:#475569;">##UNID_${escapeHtml(p.chave)}##</td>
        </tr>`,
        )
        .join("")
    : `
        <tr>
          <td colspan="4" style="padding:12px;text-align:center;color:#94a3b8;font-style:italic;">
            Cadastre os parâmetros do exame em "Parâmetros" para gerar as linhas automaticamente.
          </td>
        </tr>`;

  return `
<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <h2 style="margin:0 0 4px;font-size:16px;color:#1e293b;border-bottom:2px solid #4D41F3;padding-bottom:6px;">
    ${escapeHtml(exameNome)}
  </h2>
  <p style="margin:6px 0 14px;font-size:11px;color:#64748b;">
    <strong>Paciente:</strong> ##PACIENTE_NOME## &nbsp;|&nbsp;
    <strong>Idade:</strong> ##PACIENTE_IDADE## &nbsp;|&nbsp;
    <strong>Sexo:</strong> ##PACIENTE_SEXO## &nbsp;|&nbsp;
    <strong>Coleta:</strong> ##DATA_COLETA##
  </p>

  <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #e5e7eb;">
    <thead>
      <tr style="background:#f1f5f9;color:#1e293b;">
        <th style="padding:8px;text-align:left;border-bottom:1px solid #cbd5e1;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Parâmetro</th>
        <th style="padding:8px;text-align:center;border-bottom:1px solid #cbd5e1;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Resultado</th>
        <th style="padding:8px;text-align:center;border-bottom:1px solid #cbd5e1;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Valor de referência</th>
        <th style="padding:8px;text-align:center;border-bottom:1px solid #cbd5e1;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Unidade</th>
      </tr>
    </thead>
    <tbody>${linhas}
    </tbody>
  </table>

  <p style="margin:14px 0 0;font-size:10px;color:#64748b;line-height:1.5;">
    Métodologia conforme padrão do laboratório. Os valores de referência podem variar entre métodos analíticos.
    Em caso de dúvida, contate o responsável técnico.
  </p>
</div>`.trim();
};

/** Normaliza um rótulo em uma chave segura para placeholder (ex.: "Hemoglobina (g/dL)" → "HEMOGLOBINA_GDL"). */
export const slugifyChave = (rotulo: string): string =>
  rotulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()
    .slice(0, 32);

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
