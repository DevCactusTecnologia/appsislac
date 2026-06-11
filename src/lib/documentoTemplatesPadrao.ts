// HTML padrão por tipo de documento — espelha visualmente o layout exibido
// no modal "Prévia dos comprovantes", mas usando {{placeholders}} no lugar
// dos dados reais. Carregado no editor de templates (Configurações →
// Documentos → Novo) para que o usuário comece com um documento pronto e
// apenas personalize o que precisar.
import type { DocumentoTipo } from "@/data/documentoTemplatesStore";

const cabecalho = `
<div style="padding-bottom:14px;margin-bottom:18px;">
  <p style="font-size:15px;font-weight:700;color:#111;margin:0;letter-spacing:.2px;">{{laboratorio.nome}}</p>
  <p style="font-size:10.5px;color:#444;margin:2px 0 0 0;">{{laboratorio.razaoSocial}}</p>
  <p style="font-size:10px;color:#555;margin:3px 0 0 0;">{{laboratorio.endereco}} — {{laboratorio.cidade}}/{{laboratorio.estado}}</p>
  <p style="font-size:10px;color:#555;margin:1px 0 0 0;">{{laboratorio.telefone}} · {{laboratorio.email}}</p>
  <p style="font-size:10px;color:#555;margin:1px 0 0 0;">CNPJ {{laboratorio.cnpj}} · CNES {{laboratorio.cnes}}</p>
</div>`;

const idPaciente = `
<div style="margin-bottom:14px;">
  <p style="font-size:9.5px;font-weight:700;letter-spacing:1.5px;color:#666;margin:0 0 6px 0;text-transform:uppercase;">Identificação do paciente</p>
  <table style="width:100%;border-collapse:collapse;font-size:11px;">
    <tr><td style="padding:3px 0;color:#555;width:90px;">Nome</td><td style="padding:3px 0;color:#111;font-weight:600;">{{paciente.nome}}</td></tr>
    <tr><td style="padding:3px 0;color:#555;">CPF</td><td style="padding:3px 0;color:#111;">{{paciente.cpf}}</td></tr>
    <tr><td style="padding:3px 0;color:#555;">Nascimento</td><td style="padding:3px 0;color:#111;">{{paciente.nascimento}} ({{paciente.idade}})</td></tr>
  </table>
</div>`;

const idAtendimento = `
<div style="margin-bottom:18px;">
  <p style="font-size:9.5px;font-weight:700;letter-spacing:1.5px;color:#666;margin:0 0 6px 0;text-transform:uppercase;">Identificação do atendimento</p>
  <table style="width:100%;border-collapse:collapse;font-size:11px;">
    <tr><td style="padding:3px 0;color:#555;width:90px;">Protocolo</td><td style="padding:3px 0;color:#111;font-family:'Courier New',monospace;font-weight:700;">{{atendimento.protocolo}}</td></tr>
    <tr><td style="padding:3px 0;color:#555;">Data</td><td style="padding:3px 0;color:#111;">{{atendimento.data}}</td></tr>
    <tr><td style="padding:3px 0;color:#555;">Convênio</td><td style="padding:3px 0;color:#111;">{{convenio.nome}}</td></tr>
    <tr><td style="padding:3px 0;color:#555;">Solicitante</td><td style="padding:3px 0;color:#111;">{{solicitante.nome}}</td></tr>
  </table>
</div>`;

const assinaturaRodape = `
<div style="margin-top:24px;page-break-inside:avoid;">
  <p style="font-size:11px;color:#333;margin:0;">{{laboratorio.cidade}}/{{laboratorio.estado}}, {{atendimento.data}}.</p>
  <div style="text-align:center;margin-top:30mm;">
    <div style="display:inline-block;padding-top:6px;min-width:80mm;">
      <p style="font-size:11px;font-weight:700;color:#111;margin:0;">{{laboratorio.responsavelTecnico}}</p>
      <p style="font-size:10px;color:#555;margin:2px 0 0 0;">Responsável Técnico · {{laboratorio.responsavelTecnicoConselho}} {{laboratorio.responsavelTecnicoNumero}}/{{laboratorio.responsavelTecnicoUf}}</p>
    </div>
  </div>
  <p style="font-size:9px;color:#777;margin-top:14px;padding-top:10px;">Documento emitido eletronicamente em {{sistema.dataImpressao}}.</p>
</div>`;

const PAGAMENTO = `${cabecalho}
<p style="text-align:center;font-size:13px;font-weight:700;letter-spacing:3px;color:#111;margin:0 0 18px 0;text-transform:uppercase;">Recibo de Pagamento</p>
${idPaciente}
${idAtendimento}
<div style="margin-bottom:14px;padding:14px 16px;background:#fafafa;border-left:3px solid #111;">
  <p style="font-size:11.5px;line-height:1.65;color:#111;margin:0;text-align:justify;">
    Recebemos de <strong>{{paciente.nome}}</strong>, CPF {{paciente.cpf}}, a importância de <strong>{{totais.pago}}</strong>, referente aos serviços laboratoriais identificados sob o protocolo nº {{atendimento.protocolo}}, dando ao pagador, por este recibo, plena, geral e irrevogável quitação da obrigação no valor recebido.
  </p>
</div>
<p style="font-size:9.5px;font-weight:700;letter-spacing:1.5px;color:#666;margin:14px 0 6px 0;text-transform:uppercase;">Discriminação dos serviços</p>
{{exames.lista}}
<p style="font-size:9.5px;font-weight:700;letter-spacing:1.5px;color:#666;margin:14px 0 6px 0;text-transform:uppercase;">Pagamentos recebidos</p>
{{pagamentos.lista}}
<div style="margin-top:14px;border:1px solid #111;padding:12px 14px;">
  <table style="width:100%;border-collapse:collapse;font-size:11px;">
    <tr><td style="padding:3px 0;color:#555;">Subtotal</td><td style="padding:3px 0;text-align:right;">{{totais.subtotal}}</td></tr>
    <tr><td style="padding:3px 0;color:#555;">Desconto</td><td style="padding:3px 0;text-align:right;">{{totais.desconto}}</td></tr>
    <tr><td style="padding:6px 0 3px 0;color:#555;border-top:1px solid #ddd;">Total dos serviços</td><td style="padding:6px 0 3px 0;text-align:right;border-top:1px solid #ddd;">{{totais.total}}</td></tr>
    <tr><td style="padding:3px 0;color:#555;">Valor recebido</td><td style="padding:3px 0;text-align:right;font-weight:700;">{{totais.pago}}</td></tr>
    <tr><td style="padding:3px 0;color:#555;">Saldo devedor</td><td style="padding:3px 0;text-align:right;">{{totais.saldo}}</td></tr>
  </table>
</div>
${assinaturaRodape}`;

const ATENDIMENTO = `${cabecalho}
<p style="text-align:center;font-size:13px;font-weight:700;letter-spacing:3px;color:#111;margin:0 0 18px 0;text-transform:uppercase;">Comprovante de Atendimento</p>
${idPaciente}
${idAtendimento}
<div style="margin-bottom:14px;padding:14px 16px;background:#fafafa;border-left:3px solid #111;">
  <p style="font-size:11.5px;line-height:1.65;color:#111;margin:0;text-align:justify;">
    Declaramos para os devidos fins que o(a) Sr(a). <strong>{{paciente.nome}}</strong>, portador(a) do CPF {{paciente.cpf}}, foi atendido(a) por este laboratório na data <strong>{{atendimento.data}}</strong>, sob o protocolo nº <strong>{{atendimento.protocolo}}</strong>, para realização dos exames laboratoriais abaixo discriminados.
  </p>
</div>
<p style="font-size:9.5px;font-weight:700;letter-spacing:1.5px;color:#666;margin:14px 0 6px 0;text-transform:uppercase;">Exames solicitados</p>
{{exames.lista}}
<p style="font-size:10px;color:#777;font-style:italic;margin:14px 0 0 0;">Este documento comprova o atendimento e a solicitação dos exames listados, <strong>não substitui o laudo</strong> e <strong>não contém resultados</strong>.</p>
${assinaturaRodape}`;

const COMPARECIMENTO = `${cabecalho}
<p style="text-align:center;font-size:13px;font-weight:700;letter-spacing:3px;color:#111;margin:0 0 18px 0;text-transform:uppercase;">Declaração de Comparecimento</p>
${idPaciente}
${idAtendimento}
<div style="margin-bottom:14px;padding:14px 16px;background:#fafafa;border-left:3px solid #111;">
  <p style="font-size:11.5px;line-height:1.65;color:#111;margin:0;text-align:justify;">
    Declaramos, para os devidos fins de direito, que o(a) Sr(a). <strong>{{paciente.nome}}</strong>, portador(a) do CPF {{paciente.cpf}}, compareceu a esta unidade na data <strong>{{atendimento.data}}</strong>, no horário aproximado das <strong>______</strong> às <strong>______</strong>, para realização de exames laboratoriais sob o protocolo nº <strong>{{atendimento.protocolo}}</strong>.
  </p>
  <p style="font-size:11.5px;line-height:1.65;color:#111;margin:10px 0 0 0;text-align:justify;">Por ser expressão da verdade, firmamos a presente declaração.</p>
</div>
${assinaturaRodape}`;

const DOCUMENTO_LIVRE = `${cabecalho}
<p style="text-align:center;font-size:13px;font-weight:700;letter-spacing:3px;color:#111;margin:0 0 18px 0;text-transform:uppercase;">Título do Documento</p>
${idPaciente}
<div style="margin-bottom:14px;padding:14px 16px;background:#fafafa;border-left:3px solid #111;">
  <p style="font-size:11.5px;line-height:1.65;color:#111;margin:0;text-align:justify;">
    Edite este conteúdo livremente. Use os placeholders disponíveis (ex.: <strong>{{paciente.nome}}</strong>, <strong>{{atendimento.protocolo}}</strong>, <strong>{{atendimento.data}}</strong>) para inserir dados dinâmicos no documento.
  </p>
</div>
${assinaturaRodape}`;

const ORCAMENTO = `${cabecalho}
<p style="text-align:center;font-size:13px;font-weight:700;letter-spacing:3px;color:#111;margin:0 0 18px 0;text-transform:uppercase;">Orçamento de Serviços</p>
${idPaciente}
<div style="margin-bottom:14px;padding:14px 16px;background:#fafafa;border-left:3px solid #111;">
  <p style="font-size:11.5px;line-height:1.65;color:#111;margin:0;text-align:justify;">
    Apresentamos a proposta de orçamento para a realização dos exames laboratoriais solicitados para <strong>{{paciente.nome}}</strong>. Este orçamento tem validade de 10 (dez) dias a partir da data de emissão.
  </p>
</div>
<p style="font-size:9.5px;font-weight:700;letter-spacing:1.5px;color:#666;margin:14px 0 6px 0;text-transform:uppercase;">Exames Orçados</p>
{{exames.lista}}
<div style="margin-top:14px;border:1px solid #111;padding:12px 14px;">
  <table style="width:100%;border-collapse:collapse;font-size:11px;">
    <tr><td style="padding:3px 0;color:#555;">Subtotal</td><td style="padding:3px 0;text-align:right;">{{totais.subtotal}}</td></tr>
    <tr><td style="padding:3px 0;color:#555;">Desconto</td><td style="padding:3px 0;text-align:right;">{{totais.desconto}}</td></tr>
    <tr><td style="padding:6px 0 3px 0;color:#555;border-top:1px solid #ddd;">Total Previsto</td><td style="padding:6px 0 3px 0;text-align:right;font-weight:700;border-top:1px solid #ddd;font-size:13px;">{{totais.total}}</td></tr>
  </table>
</div>
<p style="font-size:10px;color:#777;font-style:italic;margin:14px 0 0 0;">Observação: Os valores informados podem sofrer alteração caso haja mudança na solicitação médica ou na tabela de preços vigente no dia da realização dos exames.</p>
${assinaturaRodape}`;

// Cabeçalho padrão usado pelo tipo "Cabeçalho" — combina identidade do
// laboratório com os dados de identificação do atendimento (paciente,
// idade, sexo, convênio, solicitante, protocolo, cadastro e finalização).
const CABECALHO_DOCUMENTO = `${cabecalho}
<div style="margin-top:8px;margin-bottom:14px;display:flex;gap:24px;flex-wrap:wrap;">
  <table style="flex:1;min-width:260px;border-collapse:collapse;font-size:11px;">
    <tr><td style="padding:2px 0;color:#555;width:90px;">Paciente</td><td style="padding:2px 0;color:#111;font-weight:600;">{{paciente.nome}}</td></tr>
    <tr><td style="padding:2px 0;color:#555;">Idade</td><td style="padding:2px 0;color:#111;">{{paciente.idade}}</td></tr>
    <tr><td style="padding:2px 0;color:#555;">Convênio</td><td style="padding:2px 0;color:#111;">{{convenio.nome}}</td></tr>
    <tr><td style="padding:2px 0;color:#555;">Solicitante</td><td style="padding:2px 0;color:#111;">{{solicitante.nome}}</td></tr>
  </table>
  <table style="flex:1;min-width:220px;border-collapse:collapse;font-size:11px;">
    <tr><td style="padding:2px 0;color:#555;width:90px;">Protocolo</td><td style="padding:2px 0;color:#111;font-family:'Courier New',monospace;font-weight:700;">{{atendimento.protocolo}}</td></tr>
    <tr><td style="padding:2px 0;color:#555;">Sexo</td><td style="padding:2px 0;color:#111;">{{paciente.sexo}}</td></tr>
    <tr><td style="padding:2px 0;color:#555;">Cadastro</td><td style="padding:2px 0;color:#111;">{{atendimento.dataCadastro}}</td></tr>
    <tr><td style="padding:2px 0;color:#555;">Finalização</td><td style="padding:2px 0;color:#111;">{{atendimento.dataFinalizacao}}</td></tr>
  </table>
</div>`;

const TEMPLATES_PADRAO: Record<DocumentoTipo, string> = {
  comprovante_pagamento: PAGAMENTO,
  comprovante_atendimento: ATENDIMENTO,
  declaracao_comparecimento: COMPARECIMENTO,
  cabecalho: CABECALHO_DOCUMENTO,
  rodape: assinaturaRodape,
  documento: DOCUMENTO_LIVRE,
  orcamento: ORCAMENTO,
};

export function getTemplatePadraoHtml(tipo: DocumentoTipo): string {
  return TEMPLATES_PADRAO[tipo] ?? "";
}

export function removerLinhasHorizontaisDocumento(html: string): string {
  return String(html ?? "")
    .replace(/<hr\b[^>]*\/?>(?:<\/hr>)?/gi, "")
    .replace(
      /<(div|p|span)([^>]*)style="([^"]*border-(?:top|bottom)\s*:[^"]*)"([^>]*)>/gi,
      (_match, tag, before, style, after) => {
        const cleanStyle = String(style)
          .split(";")
          .map((part) => part.trim())
          .filter((part) => part && !/^border-(?:top|bottom)\s*:/i.test(part))
          .join(";");
        return `<${tag}${before}style="${cleanStyle}"${after}>`;
      },
    )
    .replace(
      /<p([^>]*)style="([^"]*border-top\s*:[^"]*)"([^>]*)>([\s\S]*?Documento emitido eletronicamente[\s\S]*?)<\/p>/gi,
      (_match, before, style, after, inner) => {
        const cleanStyle = String(style)
          .split(";")
          .map((part) => part.trim())
          .filter((part) => part && !part.toLowerCase().startsWith("border-top"))
          .join(";");
        return `<p${before}style="${cleanStyle}"${after}>${inner}</p>`;
      },
    );
}
