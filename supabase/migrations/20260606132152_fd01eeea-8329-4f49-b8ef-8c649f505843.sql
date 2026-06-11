-- 1. Atualiza a restrição de tipos de documento na tabela documento_templates
ALTER TABLE public.documento_templates DROP CONSTRAINT IF EXISTS documento_templates_tipo_check;
ALTER TABLE public.documento_templates ADD CONSTRAINT documento_templates_tipo_check CHECK (tipo = ANY (ARRAY['comprovante_pagamento'::text, 'comprovante_atendimento'::text, 'declaracao_comparecimento'::text, 'cabecalho'::text, 'rodape'::text, 'documento'::text, 'orcamento'::text]));

-- 2. Insere o modelo padrão de Orçamento para cada tenant que ainda não o possui
-- Nota: O HTML abaixo é o modelo padrão definido em documentoTemplatesPadrao.ts
INSERT INTO public.documento_templates (tenant_id, tipo, nome, descricao, conteudo, ativo, padrao, criado_por)
SELECT 
  id as tenant_id,
  'orcamento' as tipo,
  'Orçamento' as nome,
  'Modelo padrão de orçamento de serviços laboratoriais.' as descricao,
  '<div style="padding-bottom:14px;margin-bottom:18px;">
  <p style="font-size:15px;font-weight:700;color:#111;margin:0;letter-spacing:.2px;">{{laboratorio.nome}}</p>
  <p style="font-size:10.5px;color:#444;margin:2px 0 0 0;">{{laboratorio.razaoSocial}}</p>
  <p style="font-size:10px;color:#555;margin:3px 0 0 0;">{{laboratorio.endereco}} — {{laboratorio.cidade}}/{{laboratorio.estado}}</p>
  <p style="font-size:10px;color:#555;margin:1px 0 0 0;">{{laboratorio.telefone}} · {{laboratorio.email}}</p>
  <p style="font-size:10px;color:#555;margin:1px 0 0 0;">CNPJ {{laboratorio.cnpj}} · CNES {{laboratorio.cnes}}</p>
</div>
<p style="text-align:center;font-size:13px;font-weight:700;letter-spacing:3px;color:#111;margin:0 0 18px 0;text-transform:uppercase;">Orçamento de Serviços</p>
<div style="margin-bottom:14px;">
  <p style="font-size:9.5px;font-weight:700;letter-spacing:1.5px;color:#666;margin:0 0 6px 0;text-transform:uppercase;">Identificação do paciente</p>
  <table style="width:100%;border-collapse:collapse;font-size:11px;">
    <tr><td style="padding:3px 0;color:#555;width:90px;">Nome</td><td style="padding:3px 0;color:#111;font-weight:600;">{{paciente.nome}}</td></tr>
    <tr><td style="padding:3px 0;color:#555;">CPF</td><td style="padding:3px 0;color:#111;">{{paciente.cpf}}</td></tr>
    <tr><td style="padding:3px 0;color:#555;">Nascimento</td><td style="padding:3px 0;color:#111;">{{paciente.nascimento}} ({{paciente.idade}})</td></tr>
  </table>
</div>
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
<div style="margin-top:24px;page-break-inside:avoid;">
  <p style="font-size:11px;color:#333;margin:0;">{{laboratorio.cidade}}/{{laboratorio.estado}}, {{atendimento.data}}.</p>
  <div style="text-align:center;margin-top:30mm;">
    <div style="display:inline-block;padding-top:6px;min-width:80mm;">
      <p style="font-size:11px;font-weight:700;color:#111;margin:0;">{{laboratorio.responsavelTecnico}}</p>
      <p style="font-size:10px;color:#555;margin:2px 0 0 0;">Responsável Técnico · {{laboratorio.responsavelTecnicoConselho}} {{laboratorio.responsavelTecnicoNumero}}/{{laboratorio.responsavelTecnicoUf}}</p>
    </div>
  </div>
  <p style="font-size:9px;color:#777;margin-top:14px;padding-top:10px;">Documento emitido eletronicamente em {{sistema.dataImpressao}}.</p>
</div>' as conteudo,
  true as ativo,
  true as padrao,
  'sistema' as criado_por
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM documento_templates dt 
  WHERE dt.tenant_id = t.id AND dt.tipo = 'orcamento'
);
