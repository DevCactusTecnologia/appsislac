-- =========================================================
-- MAPAS DE TRABALHO PADRÃO DO SISTEMA (read-only por trigger)
-- Mesmo padrão de Motivos de Cancelamento / Recoleta:
--   * coluna sistema boolean
--   * trigger protege rename/delete de itens sistema
--   * seed para tenants existentes
--   * função seed_default_mapas_trabalho_for_tenant(uuid)
-- =========================================================

ALTER TABLE public.mapas_trabalho
  ADD COLUMN IF NOT EXISTS sistema boolean NOT NULL DEFAULT false;

-- Trigger de proteção
CREATE OR REPLACE FUNCTION public.protect_mapas_trabalho_sistema()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $func$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.sistema = true THEN
    RAISE EXCEPTION 'Mapas de trabalho do sistema não podem ser excluídos';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.sistema = true AND NEW.nome <> OLD.nome THEN
    RAISE EXCEPTION 'Mapas de trabalho do sistema não podem ser renomeados';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_protect_mapas_trabalho_sistema ON public.mapas_trabalho;
CREATE TRIGGER trg_protect_mapas_trabalho_sistema
BEFORE UPDATE OR DELETE ON public.mapas_trabalho
FOR EACH ROW EXECUTE FUNCTION public.protect_mapas_trabalho_sistema();

-- Reforço de RLS DELETE: itens sistema não deletáveis nem por admin
DROP POLICY IF EXISTS "mapas_trabalho_delete" ON public.mapas_trabalho;
CREATE POLICY "mapas_trabalho_delete" ON public.mapas_trabalho
  FOR DELETE TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND (has_permission(auth.uid(), 'gestao_exames') OR has_role(auth.uid(), 'admin'::app_role))
    AND sistema = false
  );

-- Função reutilizável: seed dos mapas padrão para um tenant
CREATE OR REPLACE FUNCTION public.seed_default_mapas_trabalho_for_tenant(_tenant_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $func$
DECLARE _count integer := 0; _row integer;
BEGIN
  INSERT INTO public.mapas_trabalho
    (tenant_id, nome, descricao, tipo, template_key, conteudo, source, ativo, sistema, criado_por)
  SELECT _tenant_id, 'HEMOGRAMA COMPLETO', 'Réplica fiel de hemogram.blade.php. Tabela com 14 colunas técnicas + Observações.', 'INDIVIDUAL', 'hemogram',
         '<div style="text-align:center; margin-bottom:6px;">
    <h2 style="margin:0; font-size:13px; text-transform:uppercase; letter-spacing:0.5px;">Mapa de Trabalho — Hemograma Completo</h2>
    <p style="margin:2px 0 0 0; font-size:9px; color:#444;">
      Impresso em <strong>{{sistema.dataImpressao}}</strong> por <strong>{{sistema.usuario}}</strong>
    </p>
  </div>

<table style="width:100%; border-collapse:collapse; font-size:9px; font-family:Arial, sans-serif;">
  <tbody>
    <tr style="background-color:#F2F2F2; text-align:center; font-weight:600;">
      <td rowspan="3" style="border:1px solid #000; width:2%;">1</td>
      <td rowspan="2" style="border:1px solid #000; background-color:#FFF; text-align:left; font-weight:500; width:14%;">
        <div style="padding:5px;">
          <div style="display:flex; justify-content:space-between; font-size:9px;">
            <div><strong>PROTOCOLO:</strong> {{paciente.protocolo}}</div>
            <div style="font-weight:bolder; background-color:#CCC; padding:0 4px;">GUIA: {{paciente.guia}}</div>
          </div>
          <div style="font-size:9px;">{{paciente.nome}}</div>
          <div style="font-size:9px;">{{paciente.sexo}} {{paciente.idade}}</div>
        </div>
      </td>
      <td style="width:6%; border:1px solid #000;">HEMAC</td>
      <td style="width:6%; border:1px solid #000;">HEMOG</td>
      <td style="width:6%; border:1px solid #000;">HEMAT</td>
      <td style="width:6%; border:1px solid #000;">RDW</td>
      <td style="width:6%; border:1px solid #000;">LEUC</td>
      <td style="width:6%; border:1px solid #000;">MIEL</td>
      <td style="width:6%; border:1px solid #000;">META</td>
      <td style="width:6%; border:1px solid #000;">BAST</td>
      <td style="width:6%; border:1px solid #000;">SEGM</td>
      <td style="width:6%; border:1px solid #000;">EOSI</td>
      <td style="width:6%; border:1px solid #000;">BASO</td>
      <td style="width:6%; border:1px solid #000;">LINF</td>
      <td style="width:6%; border:1px solid #000;">MONO</td>
      <td style="width:6%; border:1px solid #000;">PLAQ</td>
    </tr>
    <tr>
      <td style="border:1px solid #000; height:26px;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
    </tr>
    <tr>
      <td style="border:1px solid #000; text-align:right; padding-right:5px;">Observações</td>
      <td colspan="14" style="border:1px solid #000; height:15px;"></td>
    </tr>
    <tr><td colspan="16" style="border:1px solid #000; height:10px;"></td></tr>
  </tbody>
</table>', 'legacy_html', true, true, 'sistema'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.mapas_trabalho
    WHERE tenant_id = _tenant_id AND nome = 'HEMOGRAMA COMPLETO'
  );
  GET DIAGNOSTICS _row = ROW_COUNT; _count := _count + _row;

  INSERT INTO public.mapas_trabalho
    (tenant_id, nome, descricao, tipo, template_key, conteudo, source, ativo, sistema, criado_por)
  SELECT _tenant_id, 'HIV', 'Réplica fiel de hiv.blade.php. Colunas POSITIVO / NEGATIVO / OBSERVAÇÕES.', 'INDIVIDUAL', 'hiv',
         '<div style="text-align:center; margin-bottom:6px;">
    <h2 style="margin:0; font-size:13px; text-transform:uppercase; letter-spacing:0.5px;">Mapa de Trabalho — HIV</h2>
    <p style="margin:2px 0 0 0; font-size:9px; color:#444;">
      Impresso em <strong>{{sistema.dataImpressao}}</strong> por <strong>{{sistema.usuario}}</strong>
    </p>
  </div>

<table style="width:100%; border-collapse:collapse; font-size:9px; font-family:Arial, sans-serif;">
  <tbody>
    <tr style="background-color:#F2F2F2; text-align:center; font-weight:600;">
      <td rowspan="2" style="width:1%; border:1px solid #000;">1</td>
      <td rowspan="2" style="width:15%; border:1px solid #000; background-color:#FFF; text-align:left; font-weight:500;">
        <div style="padding:5px;">
          <div style="display:flex; justify-content:space-between; font-size:9px;">
            <div><strong>PROTOCOLO:</strong> {{paciente.protocolo}}</div>
            <div style="font-weight:bolder; background-color:#CCC; padding:0 4px;">GUIA: {{paciente.guia}}</div>
          </div>
          <div style="font-size:9px;">{{paciente.nome}}</div>
          <div style="font-size:9px;">{{paciente.sexo}} {{paciente.idade}}</div>
        </div>
      </td>
      <td style="width:10%; border:1px solid #000;">POSITIVO</td>
      <td style="width:10%; border:1px solid #000;">NEGATIVO</td>
      <td style="width:57%; border:1px solid #000;">OBSERVAÇÕES</td>
    </tr>
    <tr>
      <td style="border:1px solid #000; height:26px;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
    </tr>
    <tr><td colspan="5" style="border:1px solid #000; height:10px;"></td></tr>
  </tbody>
</table>', 'legacy_html', true, true, 'sistema'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.mapas_trabalho
    WHERE tenant_id = _tenant_id AND nome = 'HIV'
  );
  GET DIAGNOSTICS _row = ROW_COUNT; _count := _count + _row;

  INSERT INTO public.mapas_trabalho
    (tenant_id, nome, descricao, tipo, template_key, conteudo, source, ativo, sistema, criado_por)
  SELECT _tenant_id, 'PARASITOLOGICO DE FEZES', 'Réplica fiel de fezes.blade.php. 9 colunas + Observações.', 'INDIVIDUAL', 'fezes',
         '<div style="text-align:center; margin-bottom:6px;">
    <h2 style="margin:0; font-size:13px; text-transform:uppercase; letter-spacing:0.5px;">Mapa de Trabalho — Parasitológico de Fezes</h2>
    <p style="margin:2px 0 0 0; font-size:9px; color:#444;">
      Impresso em <strong>{{sistema.dataImpressao}}</strong> por <strong>{{sistema.usuario}}</strong>
    </p>
  </div>

<table style="width:100%; border-collapse:collapse; font-size:9px; font-family:Arial, sans-serif;">
  <tbody>
    <tr style="background-color:#F2F2F2; text-align:center; font-weight:600;">
      <td rowspan="3" style="border:1px solid #000; width:2%;">1</td>
      <td rowspan="2" style="border:1px solid #000; background-color:#FFF; text-align:left; font-weight:500; width:17%;">
        <div style="padding:5px;">
          <div style="display:flex; justify-content:space-between; font-size:9px;">
            <div><strong>PROTOCOLO:</strong> {{paciente.protocolo}}</div>
            <div style="font-weight:bolder; background-color:#CCC; padding:0 4px;">GUIA: {{paciente.guia}}</div>
          </div>
          <div style="font-size:9px;">{{paciente.nome}}</div>
          <div style="font-size:9px;">{{paciente.sexo}} {{paciente.idade}}</div>
        </div>
      </td>
      <td style="width:9%; border:1px solid #000;">GIARD. LAMB</td>
      <td style="width:9%; border:1px solid #000;">ENTAM. HISTO</td>
      <td style="width:9%; border:1px solid #000;">ENTAM. COLI</td>
      <td style="width:9%; border:1px solid #000;">ENDOL. NANA</td>
      <td style="width:9%; border:1px solid #000;">HYMEM. NANA</td>
      <td style="width:9%; border:1px solid #000;">ENT. BIUS</td>
      <td style="width:9%; border:1px solid #000;">ANCYLOST.</td>
      <td style="width:9%; border:1px solid #000;">ASCAR. LUMBRI</td>
      <td style="width:9%; border:1px solid #000;">NEGATIVO</td>
    </tr>
    <tr>
      <td style="border:1px solid #000; height:26px;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
    </tr>
    <tr>
      <td style="border:1px solid #000; text-align:right; padding-right:5px;">Observações</td>
      <td colspan="9" style="border:1px solid #000; height:15px;"></td>
    </tr>
    <tr><td colspan="11" style="border:1px solid #000; height:10px;"></td></tr>
  </tbody>
</table>', 'legacy_html', true, true, 'sistema'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.mapas_trabalho
    WHERE tenant_id = _tenant_id AND nome = 'PARASITOLOGICO DE FEZES'
  );
  GET DIAGNOSTICS _row = ROW_COUNT; _count := _count + _row;

  INSERT INTO public.mapas_trabalho
    (tenant_id, nome, descricao, tipo, template_key, conteudo, source, ativo, sistema, criado_por)
  SELECT _tenant_id, 'URINA DE JATO MEDIO', 'Réplica fiel de urina.blade.php. Caracteres físicos, químicos e microscopia do sedimento.', 'INDIVIDUAL', 'urina',
         '<div style="text-align:center; margin-bottom:6px;">
    <h2 style="margin:0; font-size:13px; text-transform:uppercase; letter-spacing:0.5px;">Mapa de Trabalho — Urina de Jato Médio (EAS)</h2>
    <p style="margin:2px 0 0 0; font-size:9px; color:#444;">
      Impresso em <strong>{{sistema.dataImpressao}}</strong> por <strong>{{sistema.usuario}}</strong>
    </p>
  </div>

<table style="width:100%; border-collapse:collapse; font-size:9px; font-family:Arial, sans-serif;">
  <tbody>
    <tr style="background-color:#F2F2F2; font-weight:600; border-top:1px solid #000;">
      <td colspan="2" style="border:1px solid #000;"></td>
      <td style="width:16%; border:1px solid #000; padding-left:5px;">CARACTERES FÍSICOS</td>
      <td colspan="2" style="width:32%; border:1px solid #000; padding-left:5px;">CARACTERES QUÍMICOS</td>
      <td colspan="2" style="width:32%; border:1px solid #000; padding-left:5px;">MICROSCOPIA DO SEDIMENTO (400x)</td>
    </tr>
    <tr>
      <td rowspan="6" style="width:1%; border:1px solid #000; text-align:center;">1</td>
      <td rowspan="6" style="border:1px solid #000; background-color:#FFF; text-align:left; font-weight:500; width:18%;">
        <div style="padding:5px;">
          <div style="display:flex; justify-content:space-between; font-size:9px;">
            <div><strong>PROTOCOLO:</strong> {{paciente.protocolo}}</div>
            <div style="font-weight:bolder; background-color:#CCC; padding:0 4px;">GUIA: {{paciente.guia}}</div>
          </div>
          <div style="font-size:9px;">{{paciente.nome}}</div>
          <div style="font-size:9px;">{{paciente.sexo}} {{paciente.idade}}</div>
        </div>
      </td>
      <td style="width:16%; border:1px solid #000; padding-left:5px;">Volume:</td>
      <td style="width:16%; border:1px solid #000; padding-left:5px;">pH:</td>
      <td style="width:16%; border:1px solid #000; padding-left:5px;">Bilirrubina:</td>
      <td colspan="2" style="width:16%; border:1px solid #000; padding-left:5px;">Células Epiteliais:</td>
    </tr>
    <tr>
      <td style="border:1px solid #000; padding-left:5px;">Cor:</td>
      <td style="border:1px solid #000; padding-left:5px;">Nitrito:</td>
      <td style="border:1px solid #000; padding-left:5px;">Sangue:</td>
      <td colspan="2" style="border:1px solid #000; padding-left:5px;">Leucócitos:</td>
    </tr>
    <tr>
      <td style="border:1px solid #000; padding-left:5px;">Aspecto:</td>
      <td style="border:1px solid #000; padding-left:5px;">Proteínas:</td>
      <td style="border:1px solid #000; padding-left:5px;">Sais Biliares:</td>
      <td colspan="2" style="border:1px solid #000; padding-left:5px;">Piócitos:</td>
    </tr>
    <tr>
      <td style="border:1px solid #000; padding-left:5px;">Depósito:</td>
      <td style="border:1px solid #000; padding-left:5px;">Glicose:</td>
      <td style="border:1px solid #000;"></td>
      <td colspan="2" style="border:1px solid #000; padding-left:5px;">Hemácias:</td>
    </tr>
    <tr>
      <td style="border:1px solid #000; padding-left:5px;">Cheiro:</td>
      <td style="border:1px solid #000; padding-left:5px;">Corpos Cetônicos:</td>
      <td style="border:1px solid #000;"></td>
      <td colspan="2" style="border:1px solid #000; padding-left:5px;">Cilindro:</td>
    </tr>
    <tr>
      <td style="border:1px solid #000; padding-left:5px;">Densidade:</td>
      <td style="border:1px solid #000; padding-left:5px;">Urobilinogênio:</td>
      <td style="border:1px solid #000;"></td>
      <td colspan="2" style="border:1px solid #000; padding-left:5px;">Cristais:</td>
    </tr>
    <tr>
      <td colspan="5" style="border:1px solid #000; padding-left:5px;">Observações:</td>
      <td colspan="2" style="border:1px solid #000; padding-left:5px;">Muco:</td>
    </tr>
    <tr><td colspan="7" style="height:8px;"></td></tr>
  </tbody>
</table>', 'legacy_html', true, true, 'sistema'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.mapas_trabalho
    WHERE tenant_id = _tenant_id AND nome = 'URINA DE JATO MEDIO'
  );
  GET DIAGNOSTICS _row = ROW_COUNT; _count := _count + _row;

  INSERT INTO public.mapas_trabalho
    (tenant_id, nome, descricao, tipo, template_key, conteudo, source, ativo, sistema, criado_por)
  SELECT _tenant_id, 'MAPA PADRÃO — Demais exames (Lote)', 'Réplica fiel de others-exams.blade.php. Mapa padrão para todos os exames sem mapa individual configurado.', 'LOTE', 'others',
         '<div style="text-align:center; margin-bottom:6px;">
    <h2 style="margin:0; font-size:13px; text-transform:uppercase; letter-spacing:0.5px;">Mapa do Analista — Padrão (Demais Exames)</h2>
    <p style="margin:2px 0 0 0; font-size:9px; color:#444;">
      Impresso em <strong>{{sistema.dataImpressao}}</strong> por <strong>{{sistema.usuario}}</strong>
    </p>
  </div>

<table style="width:100%; border-collapse:collapse; font-size:9px; font-family:Arial, Helvetica, sans-serif; border:1px solid #000;">
  <tbody>
    <tr>
      <td colspan="3" style="padding:5px; text-align:right; background-color:#F2F2F2; font-weight:600; border:1px solid #000;">
        MAPA DO ANALISTA — {{analista.nome}}, Impresso em {{sistema.dataImpressao}} por {{sistema.usuario}}
      </td>
    </tr>
    <tr style="text-align:center; font-weight:600;">
      <td style="width:1%; border:1px solid #000;">1</td>
      <td style="width:15%; border:1px solid #000; background-color:#FFF; text-align:left; font-weight:500; padding:0;">
        <div style="padding:5px;">
          <div style="display:flex; justify-content:space-between; font-size:9px;">
            <div><strong>PROTOCOLO:</strong> {{paciente.protocolo}}</div>
            <div style="font-weight:bolder; background-color:#CCC; padding:0 4px;">GUIA: {{paciente.guia}}</div>
          </div>
          <div style="font-size:9px; margin-top:2px;">{{paciente.nome}}</div>
          <div style="font-size:9px; color:#444;">{{paciente.sexo}} {{paciente.idade}}</div>
        </div>
      </td>
      <td style="width:84%; border:1px solid #000; padding:0;">
        <div style="display:flex; flex-wrap:wrap; align-items:stretch;">
          <div style="display:flex; flex-direction:column; border-right:1px solid #000;">
            <div style="font-size:8px; padding:2px 6px; background-color:#F2F2F2; text-align:center; font-weight:600;">GLICEMIA</div>
            <div style="display:flex;">
              <div style="font-size:8px; padding:1px 8px; text-align:center; border-bottom:1px dashed #000;">GLI</div>
            </div>
            <div style="display:flex;">
              <div style="height:20px; padding:0 8px;"></div>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; border-right:1px solid #000;">
            <div style="font-size:8px; padding:2px 6px; background-color:#F2F2F2; text-align:center; font-weight:600;">COLESTEROL TOTAL E FRAÇÕES</div>
            <div style="display:flex;">
              <div style="font-size:8px; padding:1px 8px; text-align:center; border-bottom:1px dashed #000; border-right:1px dashed #000;">COL</div>
              <div style="font-size:8px; padding:1px 8px; text-align:center; border-bottom:1px dashed #000; border-right:1px dashed #000;">HDL</div>
              <div style="font-size:8px; padding:1px 8px; text-align:center; border-bottom:1px dashed #000;">LDL</div>
            </div>
            <div style="display:flex;">
              <div style="height:20px; padding:0 8px; border-right:1px dashed #000;"></div>
              <div style="height:20px; padding:0 8px; border-right:1px dashed #000;"></div>
              <div style="height:20px; padding:0 8px;"></div>
            </div>
          </div>
          <div style="display:flex; flex-direction:column;">
            <div style="font-size:8px; padding:2px 6px; background-color:#F2F2F2; text-align:center; font-weight:600;">TRANSAMINASES</div>
            <div style="display:flex;">
              <div style="font-size:8px; padding:1px 8px; text-align:center; border-bottom:1px dashed #000; border-right:1px dashed #000;">TGO</div>
              <div style="font-size:8px; padding:1px 8px; text-align:center; border-bottom:1px dashed #000;">TGP</div>
            </div>
            <div style="display:flex;">
              <div style="height:20px; padding:0 8px; border-right:1px dashed #000;"></div>
              <div style="height:20px; padding:0 8px;"></div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  </tbody>
</table>', 'legacy_html', true, true, 'sistema'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.mapas_trabalho
    WHERE tenant_id = _tenant_id AND nome = 'MAPA PADRÃO — Demais exames (Lote)'
  );
  GET DIAGNOSTICS _row = ROW_COUNT; _count := _count + _row;

  RETURN _count;
END;
$func$;

-- Seed para todos os tenants existentes
DO $seed$
DECLARE t record;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_default_mapas_trabalho_for_tenant(t.id);
  END LOOP;
END;
$seed$;