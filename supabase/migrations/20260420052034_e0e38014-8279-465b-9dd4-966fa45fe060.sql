
-- Limpa mapas e vínculos do tenant principal
DELETE FROM public.mapa_exames WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.mapas_trabalho WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- Recria os 5 mapas oficiais
INSERT INTO public.mapas_trabalho (tenant_id, nome, descricao, tipo, conteudo, placeholders_usados, config, ativo, criado_por)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'HEMOGRAMA COMPLETO',
    'Layout fixo do Hemograma Completo. As colunas técnicas (Hemácias, Hemoglobina, Hematócrito, RDW, Leucócitos, Bastões, Segmentados, Eosinófilos, Basófilos, Linfócitos, Monócitos, Plaquetas) são geradas automaticamente na impressão.',
    'INDIVIDUAL',
    '<h2 style="text-align:center;margin:0 0 4px 0;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">Mapa de Trabalho — Hemograma Completo</h2><p style="text-align:center;margin:0 0 12px 0;font-size:11px;color:#555;">Impresso em <strong>{{sistema.dataImpressao}}</strong> por {{sistema.usuario}}</p><p style="font-size:10px;color:#666;font-style:italic;text-align:center;margin-top:8px;">Layout fixo: o sistema gera automaticamente as colunas técnicas e linhas em branco para preenchimento manual.</p>',
    '["sistema.dataImpressao","sistema.usuario"]'::jsonb,
    '{}'::jsonb,
    true,
    'sistema'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'HIV',
    'Layout fixo para HIV teste rápido. As colunas POSITIVO / NEGATIVO / OBSERVAÇÕES são geradas automaticamente na impressão.',
    'INDIVIDUAL',
    '<h2 style="text-align:center;margin:0 0 4px 0;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">Mapa de Trabalho — HIV</h2><p style="text-align:center;margin:0 0 12px 0;font-size:11px;color:#555;">Impresso em <strong>{{sistema.dataImpressao}}</strong> por {{sistema.usuario}}</p><p style="font-size:11px;margin-top:8px;"><strong>Método:</strong> Imunocromatografia rápida<br><strong>Material:</strong> Sangue total / Soro</p>',
    '["sistema.dataImpressao","sistema.usuario"]'::jsonb,
    '{}'::jsonb,
    true,
    'sistema'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'PARASITOLOGICO DE FEZES',
    'Layout fixo do Parasitológico de Fezes. Colunas (Giárdia, Entamoeba histolytica, Entamoeba coli, Endolimax, Hymenolepis, Enterobius, Ancylostoma, Áscaris, Negativo) são geradas na impressão.',
    'INDIVIDUAL',
    '<h2 style="text-align:center;margin:0 0 4px 0;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">Mapa de Trabalho — Parasitológico de Fezes</h2><p style="text-align:center;margin:0 0 12px 0;font-size:11px;color:#555;">Impresso em <strong>{{sistema.dataImpressao}}</strong> por {{sistema.usuario}}</p><p style="font-size:11px;margin-top:8px;"><strong>Método:</strong> Hoffmann, Pons e Janer (sedimentação espontânea)</p>',
    '["sistema.dataImpressao","sistema.usuario"]'::jsonb,
    '{}'::jsonb,
    true,
    'sistema'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'URINA DE JATO MEDIO',
    'Layout fixo do EAS / Urina de Jato Médio. Os campos (Volume, Cor, Aspecto, pH, Nitrito, Glicose, Hemácias, Leucócitos, Cilindros etc.) são gerados automaticamente em três blocos.',
    'INDIVIDUAL',
    '<h2 style="text-align:center;margin:0 0 4px 0;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">Mapa de Trabalho — Urina de Jato Médio (EAS)</h2><p style="text-align:center;margin:0 0 12px 0;font-size:11px;color:#555;">Impresso em <strong>{{sistema.dataImpressao}}</strong> por {{sistema.usuario}}</p><p style="font-size:10px;color:#666;font-style:italic;text-align:center;margin-top:8px;">Layout fixo: três seções (Caracteres Físicos, Caracteres Químicos, Microscopia do Sedimento) são geradas automaticamente na impressão.</p>',
    '["sistema.dataImpressao","sistema.usuario"]'::jsonb,
    '{}'::jsonb,
    true,
    'sistema'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'MAPA DO ANALISTA — Lote (demais exames)',
    'Mapa consolidado por analista para TODOS os demais exames do sistema (exceto Hemograma, HIV, Parasitológico de Fezes e Urina de Jato Médio). Cada paciente gera 1 linha com blocos horizontais lado a lado de cada exame, contendo colunas dos parâmetros (abreviações). Geração 100% automática.',
    'LOTE',
    '<h2 style="text-align:center;margin:0 0 4px 0;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">Mapa do Analista</h2><p style="text-align:center;margin:0 0 12px 0;font-size:11px;color:#555;">Impresso em <strong>{{sistema.dataImpressao}}</strong> por {{sistema.usuario}}</p><p style="font-size:10px;color:#666;font-style:italic;text-align:center;margin-top:8px;">Geração automática: o sistema produz uma linha por paciente do dia, com blocos horizontais de cada exame contendo as colunas dos parâmetros (abreviações) e linhas tracejadas para preenchimento manual.</p><p style="font-size:10px;color:#666;text-align:center;margin-top:6px;">Hemograma Completo, HIV, Parasitológico de Fezes e Urina de Jato Médio possuem mapas individuais próprios e saem em folhas separadas.</p>',
    '["sistema.dataImpressao","sistema.usuario"]'::jsonb,
    '{}'::jsonb,
    true,
    'sistema'
  );
