
-- Atendimento 2.0 — Fase 2.3 / 2.4 / 2.5
-- Views SSOT operacionais (somente leitura).
-- security_invoker=on => herda RLS das tabelas-base por tenant.
-- Nenhuma alteração de schema, RPCs, triggers, RLS ou comportamento.

-- ── 2.3 — SSOT Coleta ───────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_coletas_operacionais
WITH (security_invoker = on) AS
SELECT
  ae.tenant_id,
  ae.atendimento_id,
  ae.id              AS atendimento_exame_id,
  ae.exame_id,
  ae.nome_exame,
  ae.material,
  ae.status,
  ae.coletor,
  ae.data_coleta,
  a.id               AS amostra_id,
  a.codigo_barra     AS amostra_codigo,
  a.tipo_material    AS amostra_tipo_material,
  a.status           AS amostra_status,
  a.data_validade    AS amostra_validade,
  at.id              AS atendimento_pk,
  at.protocolo,
  at.unidade_id,
  at.paciente_id,
  at.paciente_nome,
  at.data            AS atendimento_data
FROM public.atendimento_exames ae
LEFT JOIN public.amostras a
  ON a.atendimento_exame_id = ae.id
JOIN public.atendimentos at
  ON at.id = ae.atendimento_id
WHERE ae.data_coleta IS NOT NULL
   OR ae.status IN ('coletado','em_bancada','em_analise','analisado','finalizado','liberado');

GRANT SELECT ON public.vw_coletas_operacionais TO authenticated;

COMMENT ON VIEW public.vw_coletas_operacionais IS
  'SSOT operacional de coleta (Atendimento 2.0 — Fase 2.3). Read-only. Herda RLS por tenant.';

-- ── 2.4 — SSOT Produção ────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_producao_operacional
WITH (security_invoker = on) AS
SELECT
  ae.tenant_id,
  ae.atendimento_id,
  ae.id              AS atendimento_exame_id,
  ae.exame_id,
  ae.nome_exame,
  ae.material,
  ae.status,
  ae.analista,
  ae.coletor,
  ae.data_coleta,
  ae.data_analise,
  ae.data_liberacao,
  ae.tipo_processo,
  ae.lab_apoio_id,
  ae.retificado,
  at.protocolo,
  at.unidade_id,
  at.paciente_id,
  at.paciente_nome,
  ec.categoria       AS exame_categoria,
  ec.codigo          AS exame_codigo
FROM public.atendimento_exames ae
JOIN public.atendimentos at
  ON at.id = ae.atendimento_id
LEFT JOIN public.exames_catalogo ec
  ON ec.id = ae.exame_id
WHERE ae.status IN ('coletado','em_bancada','em_analise','analisado','finalizado','liberado');

GRANT SELECT ON public.vw_producao_operacional TO authenticated;

COMMENT ON VIEW public.vw_producao_operacional IS
  'SSOT operacional de produção (Atendimento 2.0 — Fase 2.4). Read-only. Herda RLS por tenant.';

-- ── 2.5 — KPIs diários (views regulares; promover a MV se medir gargalo)

-- Coleta diária por tenant/unidade
CREATE OR REPLACE VIEW public.vw_coleta_diaria
WITH (security_invoker = on) AS
SELECT
  tenant_id,
  unidade_id,
  (data_coleta AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
  COUNT(*)                                      AS total_coletas,
  COUNT(DISTINCT atendimento_id)                AS total_atendimentos,
  COUNT(DISTINCT amostra_id)                    AS total_amostras
FROM public.vw_coletas_operacionais
WHERE data_coleta IS NOT NULL
GROUP BY tenant_id, unidade_id, (data_coleta AT TIME ZONE 'America/Sao_Paulo')::date;

GRANT SELECT ON public.vw_coleta_diaria TO authenticated;

-- Produção diária por tenant/categoria
CREATE OR REPLACE VIEW public.vw_producao_diaria
WITH (security_invoker = on) AS
SELECT
  tenant_id,
  exame_categoria,
  (COALESCE(data_analise, data_coleta) AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
  COUNT(*) FILTER (WHERE status = 'em_bancada')              AS em_bancada,
  COUNT(*) FILTER (WHERE status = 'em_analise')              AS em_analise,
  COUNT(*) FILTER (WHERE status = 'analisado')               AS analisado,
  COUNT(*) FILTER (WHERE status IN ('finalizado','liberado')) AS liberado,
  COUNT(*)                                                    AS total
FROM public.vw_producao_operacional
GROUP BY tenant_id, exame_categoria,
         (COALESCE(data_analise, data_coleta) AT TIME ZONE 'America/Sao_Paulo')::date;

GRANT SELECT ON public.vw_producao_diaria TO authenticated;

-- Liberação diária + tempo médio coleta→liberação (segundos)
CREATE OR REPLACE VIEW public.vw_liberacao_diaria
WITH (security_invoker = on) AS
SELECT
  tenant_id,
  unidade_id,
  (data_liberacao AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
  COUNT(*)                                                AS total_liberados,
  AVG(EXTRACT(EPOCH FROM (data_liberacao - data_coleta))) FILTER (
    WHERE data_coleta IS NOT NULL AND data_liberacao IS NOT NULL
  ) AS tempo_medio_coleta_liberacao_seg
FROM public.vw_producao_operacional
WHERE data_liberacao IS NOT NULL
GROUP BY tenant_id, unidade_id, (data_liberacao AT TIME ZONE 'America/Sao_Paulo')::date;

GRANT SELECT ON public.vw_liberacao_diaria TO authenticated;

COMMENT ON VIEW public.vw_coleta_diaria     IS 'KPI diário de coleta (Atendimento 2.0 — Fase 2.5).';
COMMENT ON VIEW public.vw_producao_diaria   IS 'KPI diário de produção (Atendimento 2.0 — Fase 2.5).';
COMMENT ON VIEW public.vw_liberacao_diaria  IS 'KPI diário de liberação + lead time (Atendimento 2.0 — Fase 2.5).';
