ALTER TABLE public.exame_parametros
  ADD COLUMN IF NOT EXISTS qtd_resultados_anteriores integer NOT NULL DEFAULT 5;
COMMENT ON COLUMN public.exame_parametros.qtd_resultados_anteriores IS
  'Quantos resultados anteriores exibir (gráfico ##GRAFICOHIST## ou linha inline) quando exibir_anterior = SIM.';