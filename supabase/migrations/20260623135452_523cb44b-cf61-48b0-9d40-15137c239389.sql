
DROP TRIGGER IF EXISTS sync_amostra_tipo_material_biu ON public.amostras;
DROP FUNCTION IF EXISTS public.sync_amostra_tipo_material();

ALTER TABLE public.amostras DROP COLUMN IF EXISTS tipo_material CASCADE;
ALTER TABLE public.exames_catalogo DROP COLUMN IF EXISTS material CASCADE;
ALTER TABLE public.atendimento_exames DROP COLUMN IF EXISTS material CASCADE;

CREATE VIEW public.vw_coletas_operacionais AS
SELECT ae.tenant_id, ae.atendimento_id, ae.id AS atendimento_exame_id, ae.exame_id, ae.nome_exame,
  ae.material_id, ae.status, ae.coletor, ae.data_coleta,
  a.id AS amostra_id, a.codigo_barra AS amostra_codigo, a.material_id AS amostra_material_id,
  a.status AS amostra_status, a.data_validade AS amostra_validade,
  at.id AS atendimento_pk, at.protocolo, at.unidade_id, at.paciente_id, at.paciente_nome, at.data AS atendimento_data
FROM public.atendimento_exames ae
LEFT JOIN public.amostras a ON a.atendimento_exame_id = ae.id
JOIN public.atendimentos at ON at.id = ae.atendimento_id
WHERE ae.data_coleta IS NOT NULL OR ae.status = ANY (ARRAY['coletado','em_bancada','em_analise','analisado','finalizado','liberado']);

CREATE VIEW public.vw_coleta_diaria AS
SELECT tenant_id, unidade_id, ((data_coleta AT TIME ZONE 'America/Sao_Paulo'))::date AS dia,
  count(*) AS total_coletas, count(DISTINCT atendimento_id) AS total_atendimentos, count(DISTINCT amostra_id) AS total_amostras
FROM public.vw_coletas_operacionais
WHERE data_coleta IS NOT NULL
GROUP BY tenant_id, unidade_id, ((data_coleta AT TIME ZONE 'America/Sao_Paulo'))::date;

CREATE VIEW public.exames_publicos_view AS
SELECT ep.id AS publico_id, ep.tenant_id, ep.exame_id, ep.destaque, ep.ordem, ep.modo_publicacao,
  ec.nome, ec.categoria, ec.material_id, m.nome AS material,
  ec.preparo_paciente AS preparo, ec.requer_jejum,
  COALESCE(tpi.valor, 0::numeric) AS valor
FROM public.exames_publicos ep
JOIN public.exames_catalogo ec ON ec.id = ep.exame_id AND ec.tenant_id = ep.tenant_id AND ec.ativo = true
LEFT JOIN public.materiais_amostra m ON m.id = ec.material_id
LEFT JOIN public.tabela_preco_itens tpi ON tpi.exame_id = ep.exame_id AND tpi.tenant_id = ep.tenant_id AND tpi.tabela = 'Própria' AND tpi.ativo = true
WHERE ep.ativo = true;

CREATE VIEW public.vw_producao_operacional AS
SELECT ae.tenant_id, ae.atendimento_id, ae.id AS atendimento_exame_id, ae.exame_id, ae.nome_exame,
  ae.material_id, ae.status, ae.analista, ae.coletor, ae.data_coleta, ae.data_analise, ae.data_liberacao,
  ae.tipo_processo, ae.lab_apoio_id, ae.retificado,
  at.protocolo, at.unidade_id, at.paciente_id, at.paciente_nome,
  ec.categoria AS exame_categoria, ec.codigo AS exame_codigo
FROM public.atendimento_exames ae
JOIN public.atendimentos at ON at.id = ae.atendimento_id
LEFT JOIN public.exames_catalogo ec ON ec.id = ae.exame_id
WHERE ae.status = ANY (ARRAY['coletado','em_bancada','em_analise','analisado','finalizado','liberado']);

CREATE VIEW public.vw_producao_diaria AS
SELECT tenant_id, exame_categoria,
  ((COALESCE(data_analise, data_coleta) AT TIME ZONE 'America/Sao_Paulo'))::date AS dia,
  count(*) FILTER (WHERE status='em_bancada') AS em_bancada,
  count(*) FILTER (WHERE status='em_analise') AS em_analise,
  count(*) FILTER (WHERE status='analisado') AS analisado,
  count(*) FILTER (WHERE status = ANY (ARRAY['finalizado','liberado'])) AS liberado,
  count(*) AS total
FROM public.vw_producao_operacional
GROUP BY tenant_id, exame_categoria, ((COALESCE(data_analise, data_coleta) AT TIME ZONE 'America/Sao_Paulo'))::date;

CREATE VIEW public.vw_liberacao_diaria AS
SELECT tenant_id, unidade_id, ((data_liberacao AT TIME ZONE 'America/Sao_Paulo'))::date AS dia,
  count(*) AS total_liberados,
  avg(EXTRACT(epoch FROM (data_liberacao - data_coleta))) FILTER (WHERE data_coleta IS NOT NULL AND data_liberacao IS NOT NULL) AS tempo_medio_coleta_liberacao_seg
FROM public.vw_producao_operacional
WHERE data_liberacao IS NOT NULL
GROUP BY tenant_id, unidade_id, ((data_liberacao AT TIME ZONE 'America/Sao_Paulo'))::date;

CREATE OR REPLACE FUNCTION public.dashboard_metrics(_inicio timestamp with time zone, _fim timestamp with time zone)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_tenant uuid := public.current_tenant_id(); v_is_sa boolean := public.is_super_admin(auth.uid()); v_result jsonb;
BEGIN
  IF v_tenant IS NULL AND NOT v_is_sa THEN
    RETURN jsonb_build_object('porAnalista','[]'::jsonb,'porConvenio','[]'::jsonb,'porMaterial','[]'::jsonb,'porExame','[]'::jsonb,'totalExames',0,'serieDiaria','[]'::jsonb,'intervalo',jsonb_build_object('inicio',_inicio,'fim',_fim));
  END IF;
  WITH base AS (
    SELECT e.nome_exame, m.nome AS material_nome, e.analista, e.coletor, a.convenio_nome, a.data
    FROM public.atendimento_exames e
    JOIN public.atendimentos a ON a.id = e.atendimento_id
    LEFT JOIN public.materiais_amostra m ON m.id = e.material_id
    WHERE a.data BETWEEN _inicio AND _fim AND e.status <> 'cancelado' AND (v_is_sa OR a.tenant_id = v_tenant)
  ),
  por_analista AS (SELECT COALESCE(NULLIF(btrim(analista),''),NULLIF(btrim(coletor),''),'Sem responsável') AS nome, COUNT(*)::bigint AS total FROM base GROUP BY 1 ORDER BY total DESC LIMIT 200),
  por_convenio AS (SELECT COALESCE(NULLIF(btrim(convenio_nome),''),'—') AS nome, COUNT(*)::bigint AS total FROM base GROUP BY 1 ORDER BY total DESC LIMIT 200),
  por_material AS (SELECT COALESCE(NULLIF(btrim(material_nome),''),'Sem material') AS nome, COUNT(*)::bigint AS total FROM base GROUP BY 1 ORDER BY total DESC LIMIT 200),
  por_exame AS (SELECT nome_exame AS nome, COUNT(*)::bigint AS total FROM base GROUP BY 1 ORDER BY total DESC LIMIT 500),
  serie AS (SELECT to_char(data AT TIME ZONE 'UTC','YYYY-MM-DD') AS dia, COUNT(*)::bigint AS total FROM base GROUP BY 1 ORDER BY 1)
  SELECT jsonb_build_object(
    'porAnalista',COALESCE((SELECT jsonb_agg(jsonb_build_object('nome',nome,'total',total)) FROM por_analista),'[]'::jsonb),
    'porConvenio',COALESCE((SELECT jsonb_agg(jsonb_build_object('nome',nome,'total',total)) FROM por_convenio),'[]'::jsonb),
    'porMaterial',COALESCE((SELECT jsonb_agg(jsonb_build_object('nome',nome,'total',total)) FROM por_material),'[]'::jsonb),
    'porExame',COALESCE((SELECT jsonb_agg(jsonb_build_object('nome',nome,'total',total)) FROM por_exame),'[]'::jsonb),
    'totalExames',COALESCE((SELECT SUM(total) FROM por_exame),0),
    'serieDiaria',COALESCE((SELECT jsonb_agg(jsonb_build_object('dia',dia,'total',total)) FROM serie),'[]'::jsonb),
    'intervalo',jsonb_build_object('inicio',_inicio,'fim',_fim)
  ) INTO v_result;
  RETURN v_result;
END; $function$;

CREATE OR REPLACE FUNCTION public.dashboard_daily_series(_inicio timestamp with time zone, _fim timestamp with time zone, _nome_exame text DEFAULT NULL, _convenio text DEFAULT NULL, _analista text DEFAULT NULL, _material text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_tenant uuid := public.current_tenant_id(); v_is_sa boolean := public.is_super_admin(auth.uid()); v_result jsonb;
BEGIN
  IF v_tenant IS NULL AND NOT v_is_sa THEN RETURN '[]'::jsonb; END IF;
  WITH base AS (
    SELECT to_char(a.data AT TIME ZONE 'UTC','YYYY-MM-DD') AS dia,
      COALESCE(NULLIF(btrim(e.analista),''),NULLIF(btrim(e.coletor),''),'') AS resp
    FROM public.atendimento_exames e
    JOIN public.atendimentos a ON a.id = e.atendimento_id
    LEFT JOIN public.materiais_amostra m ON m.id = e.material_id
    WHERE a.data BETWEEN _inicio AND _fim AND e.status <> 'cancelado' AND (v_is_sa OR a.tenant_id = v_tenant)
      AND (_nome_exame IS NULL OR e.nome_exame = _nome_exame)
      AND (_material IS NULL OR m.nome = _material)
      AND (_convenio IS NULL OR a.convenio_nome = _convenio)
  ),
  filtrada AS (SELECT dia FROM base WHERE _analista IS NULL OR resp = _analista),
  agg AS (SELECT dia, COUNT(*)::bigint AS total FROM filtrada GROUP BY dia ORDER BY dia)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('dia',dia,'total',total)),'[]'::jsonb) INTO v_result FROM agg;
  RETURN v_result;
END; $function$;

CREATE OR REPLACE FUNCTION public.ocorrencias_page(_cursor_occurred_at timestamp with time zone DEFAULT NULL, _cursor_id bigint DEFAULT NULL, _cursor_kind text DEFAULT NULL, _limit integer DEFAULT 50, _date_from timestamp with time zone DEFAULT NULL, _date_to timestamp with time zone DEFAULT NULL, _busca text DEFAULT NULL)
 RETURNS TABLE(kind text, row_id bigint, atendimento_id bigint, protocolo text, paciente_nome text, paciente_cpf text, data_protocolo timestamp with time zone, occurred_at timestamp with time zone, motivo text, exame_nome text, exame_material text, exame_data_coleta timestamp with time zone, exame_data_analise timestamp with time zone)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','extensions'
AS $function$
DECLARE _tenant uuid := public.current_tenant_id();
  _safe_limit integer := LEAST(GREATEST(COALESCE(_limit,50),1),200);
  _busca_norm text := NULLIF(TRIM(LOWER(COALESCE(_busca,''))),'');
  _busca_digits text := NULLIF(REGEXP_REPLACE(COALESCE(_busca,''),'\D','','g'),'');
BEGIN
  IF _tenant IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH at_cancelados AS (
    SELECT 'atendimento'::text AS kind, a.id AS row_id, a.id AS atendimento_id, a.protocolo, a.paciente_nome, a.paciente_cpf,
      a.data AS data_protocolo, COALESCE(a.updated_at,a.data) AS occurred_at,
      COALESCE(NULLIF(a.motivo_cancelamento,''),'Não informado') AS motivo,
      NULL::text AS exame_nome, NULL::text AS exame_material, NULL::timestamptz AS exame_data_coleta, NULL::timestamptz AS exame_data_analise
    FROM public.atendimentos a WHERE a.tenant_id = _tenant AND a.status_atendimento IN ('Cancelado','Pedido Cancelado')
  ),
  ex_cancelados AS (
    SELECT 'amostra'::text AS kind, e.id AS row_id, a.id AS atendimento_id, a.protocolo, a.paciente_nome, a.paciente_cpf,
      a.data AS data_protocolo, COALESCE(e.updated_at,e.data_analise,e.data_coleta,a.data) AS occurred_at,
      COALESCE(NULLIF(e.motivo_cancelamento,''),CASE WHEN e.data_analise IS NOT NULL THEN 'Cancelado na etapa de análise' ELSE 'Cancelado na etapa de coleta' END) AS motivo,
      e.nome_exame AS exame_nome, NULLIF(m.nome,'') AS exame_material, e.data_coleta AS exame_data_coleta, e.data_analise AS exame_data_analise
    FROM public.atendimento_exames e
    JOIN public.atendimentos a ON a.id = e.atendimento_id AND a.tenant_id = _tenant
    LEFT JOIN public.materiais_amostra m ON m.id = e.material_id
    WHERE e.tenant_id = _tenant AND e.status = 'cancelado' AND a.status_atendimento NOT IN ('Cancelado','Pedido Cancelado')
  ),
  unificado AS (SELECT * FROM at_cancelados UNION ALL SELECT * FROM ex_cancelados),
  filtrado AS (
    SELECT * FROM unificado u
    WHERE (_date_from IS NULL OR u.occurred_at >= _date_from)
      AND (_date_to IS NULL OR u.occurred_at < _date_to + interval '1 day')
      AND (_busca_norm IS NULL OR LOWER(u.paciente_nome) LIKE '%'||_busca_norm||'%' OR LOWER(u.protocolo) LIKE '%'||_busca_norm||'%'
        OR (_busca_digits IS NOT NULL AND REGEXP_REPLACE(u.paciente_cpf,'\D','','g') LIKE '%'||_busca_digits||'%'))
      AND (_cursor_occurred_at IS NULL OR u.occurred_at < _cursor_occurred_at
        OR (u.occurred_at = _cursor_occurred_at AND ((u.kind,u.row_id) < (COALESCE(_cursor_kind,'zzz'),COALESCE(_cursor_id,9223372036854775807)))))
  )
  SELECT f.kind,f.row_id,f.atendimento_id,f.protocolo,f.paciente_nome,f.paciente_cpf,f.data_protocolo,f.occurred_at,f.motivo,f.exame_nome,f.exame_material,f.exame_data_coleta,f.exame_data_analise
  FROM filtrado f ORDER BY f.occurred_at DESC, f.kind ASC, f.row_id DESC LIMIT _safe_limit;
END; $function$;
