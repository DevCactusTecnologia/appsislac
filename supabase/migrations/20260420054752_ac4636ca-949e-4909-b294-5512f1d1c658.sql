-- ============================================================================
-- Atualiza o conteúdo dos 5 Mapas de Trabalho com a réplica fiel dos .blade.php
-- ============================================================================

-- 1) HEMOGRAMA COMPLETO
UPDATE public.mapas_trabalho
SET conteudo = $HTML$
<div style="text-align:center; margin-bottom:6px;">
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
      <td style="border:1px solid #000; height:26px;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td>
    </tr>
    <tr>
      <td style="border:1px solid #000; text-align:right; padding-right:5px;">Observações</td>
      <td colspan="14" style="border:1px solid #000; height:15px;"></td>
    </tr>
    <tr><td colspan="16" style="border:1px solid #000; height:10px;"></td></tr>
  </tbody>
</table>
$HTML$,
updated_at = now()
WHERE id = '369bb522-a3ff-4f50-b313-bcd83ca4fe6d';

-- 2) HIV
UPDATE public.mapas_trabalho
SET conteudo = $HTML$
<div style="text-align:center; margin-bottom:6px;">
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
</table>
$HTML$,
updated_at = now()
WHERE id = 'bc7a9234-5b53-4112-8910-dc52f177023e';

-- 3) PARASITOLOGICO DE FEZES
UPDATE public.mapas_trabalho
SET conteudo = $HTML$
<div style="text-align:center; margin-bottom:6px;">
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
      <td style="border:1px solid #000; height:26px;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td>
    </tr>
    <tr>
      <td style="border:1px solid #000; text-align:right; padding-right:5px;">Observações</td>
      <td colspan="9" style="border:1px solid #000; height:15px;"></td>
    </tr>
    <tr><td colspan="11" style="border:1px solid #000; height:10px;"></td></tr>
  </tbody>
</table>
$HTML$,
updated_at = now()
WHERE id = '4b32149f-77cb-4bda-9e00-3e7b1411bbbb';

-- 4) URINA DE JATO MEDIO
UPDATE public.mapas_trabalho
SET conteudo = $HTML$
<div style="text-align:center; margin-bottom:6px;">
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
</table>
$HTML$,
updated_at = now()
WHERE id = '7217a979-3bf3-4b55-9db6-7f9c0c09c3f0';

-- 5) MAPA DO ANALISTA — Lote (demais exames)
UPDATE public.mapas_trabalho
SET conteudo = $HTML$
<div style="text-align:center; margin-bottom:6px;">
  <h2 style="margin:0; font-size:13px; text-transform:uppercase; letter-spacing:0.5px;">Mapa do Analista</h2>
  <p style="margin:2px 0 0 0; font-size:9px; color:#444;">
    Impresso em <strong>{{sistema.dataImpressao}}</strong> por <strong>{{sistema.usuario}}</strong>
  </p>
</div>
<table style="width:100%; border-collapse:collapse; font-size:9px; font-family:Arial, sans-serif;">
  <tbody>
    <tr style="text-align:center; font-weight:600;">
      <td style="width:1%; border:1px solid #000;">1</td>
      <td style="width:15%; border:1px solid #000; background-color:#FFF; text-align:left; font-weight:500;">
        <div style="padding:5px;">
          <div style="display:flex; justify-content:space-between; font-size:9px;">
            <div><strong>PROTOCOLO:</strong> {{paciente.protocolo}}</div>
            <div style="font-weight:bolder; background-color:#CCC; padding:0 4px;">GUIA: {{paciente.guia}}</div>
          </div>
          <div style="font-size:9px;">{{paciente.nome}}</div>
          <div style="font-size:9px;">{{paciente.sexo}} {{paciente.idade}}</div>
        </div>
      </td>
      <td style="width:80%; border:1px solid #000; padding:0;">
        <div style="display:flex; flex-wrap:wrap;">
          <div style="display:flex; flex-direction:column; border-right:1px solid #000;">
            <div style="font-size:8px; margin-top:1px; margin-bottom:3px; background-color:#F2F2F2; padding:0 4px;">{{exame.nome}}</div>
            <div style="display:flex; background-color:#FFF;">
              <div style="height:15px; padding:0 25px; text-align:center; border-bottom:1px dashed #000; border-right:1px dashed #000;">{{parametro.abreviacao}}</div>
            </div>
            <div style="display:flex; background-color:#FFF;">
              <div style="visibility:hidden; height:20px; padding:0 25px;">{{parametro.abreviacao}}</div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  </tbody>
</table>
$HTML$,
updated_at = now()
WHERE id = 'd82f5ef2-5397-4207-8d01-6febd94e9a0f';