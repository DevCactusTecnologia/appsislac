
-- Tabela de movimentações
CREATE TABLE public.amostra_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT current_tenant_id(),
  amostra_id uuid NOT NULL,
  posicao_origem_id uuid,
  posicao_destino_id uuid NOT NULL,
  caminho_origem text,
  caminho_destino text,
  motivo text NOT NULL DEFAULT 'manual',
  lote_id uuid,
  desfeita boolean NOT NULL DEFAULT false,
  desfeita_em timestamptz,
  desfeita_por uuid,
  executada_por uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.amostra_movimentacoes TO authenticated;
GRANT ALL ON public.amostra_movimentacoes TO service_role;

ALTER TABLE public.amostra_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY mov_select ON public.amostra_movimentacoes FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() OR is_super_admin());
CREATE POLICY mov_insert ON public.amostra_movimentacoes FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY mov_update ON public.amostra_movimentacoes FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());
CREATE POLICY mov_super_all ON public.amostra_movimentacoes FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE INDEX idx_mov_amostra ON public.amostra_movimentacoes (tenant_id, amostra_id, created_at DESC);
CREATE INDEX idx_mov_lote ON public.amostra_movimentacoes (tenant_id, lote_id);

-- Helper: monta caminho legível de uma posição
CREATE OR REPLACE FUNCTION public.soroteca_caminho_posicao(p_posicao uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.nome || ' / ' || g.nome || ' / ' || p.codigo
  FROM posicoes_galeria p
  JOIN galerias g ON g.id = p.galeria_id
  JOIN locais_armazenamento l ON l.id = g.local_id
  WHERE p.id = p_posicao;
$$;

-- RPC: mover amostra
CREATE OR REPLACE FUNCTION public.mover_amostra(
  p_amostra uuid,
  p_destino uuid,
  p_motivo text DEFAULT 'manual',
  p_lote uuid DEFAULT NULL,
  p_observacao text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid := current_tenant_id();
  v_aloc_id uuid;
  v_origem uuid;
  v_dest_ativo boolean;
  v_dest_ocupado boolean;
  v_mov_id uuid;
  v_caminho_origem text;
  v_caminho_destino text;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'tenant_nao_resolvido';
  END IF;

  -- Alocação ativa atual
  SELECT id, posicao_id INTO v_aloc_id, v_origem
  FROM amostra_alocacoes
  WHERE amostra_id = p_amostra AND tenant_id = v_tenant AND retirada_em IS NULL
  ORDER BY alocada_em DESC LIMIT 1;

  -- Valida destino: ativo + tenant
  SELECT ativo INTO v_dest_ativo
  FROM posicoes_galeria
  WHERE id = p_destino AND tenant_id = v_tenant;
  IF v_dest_ativo IS NULL THEN
    RAISE EXCEPTION 'posicao_inexistente';
  END IF;
  IF NOT v_dest_ativo THEN
    RAISE EXCEPTION 'posicao_inativa';
  END IF;

  IF v_origem = p_destino THEN
    RAISE EXCEPTION 'posicao_igual_atual';
  END IF;

  -- Destino ocupado?
  SELECT EXISTS (
    SELECT 1 FROM amostra_alocacoes
    WHERE posicao_id = p_destino AND tenant_id = v_tenant AND retirada_em IS NULL
  ) INTO v_dest_ocupado;
  IF v_dest_ocupado THEN
    RAISE EXCEPTION 'posicao_ocupada';
  END IF;

  v_caminho_origem := CASE WHEN v_origem IS NOT NULL THEN soroteca_caminho_posicao(v_origem) END;
  v_caminho_destino := soroteca_caminho_posicao(p_destino);

  -- Encerra alocação anterior
  IF v_aloc_id IS NOT NULL THEN
    UPDATE amostra_alocacoes
       SET retirada_em = now(),
           motivo_retirada = COALESCE(motivo_retirada, 'movimentacao')
     WHERE id = v_aloc_id;
  END IF;

  -- Nova alocação
  INSERT INTO amostra_alocacoes (tenant_id, amostra_id, posicao_id, alocada_em, usuario_id, observacao)
  VALUES (v_tenant, p_amostra, p_destino, now(), auth.uid(), p_observacao);

  -- Atualiza localização legível na amostra
  UPDATE amostras SET localizacao = v_caminho_destino, updated_at = now()
  WHERE id = p_amostra AND tenant_id = v_tenant;

  -- Registra movimentação
  INSERT INTO amostra_movimentacoes
    (tenant_id, amostra_id, posicao_origem_id, posicao_destino_id, caminho_origem, caminho_destino, motivo, lote_id, executada_por)
  VALUES
    (v_tenant, p_amostra, v_origem, p_destino, v_caminho_origem, v_caminho_destino, COALESCE(p_motivo,'manual'), p_lote, auth.uid())
  RETURNING id INTO v_mov_id;

  RETURN v_mov_id;
END;
$$;

-- RPC: desfazer movimentação
CREATE OR REPLACE FUNCTION public.desfazer_movimentacao(p_mov uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid := current_tenant_id();
  v_mov amostra_movimentacoes%ROWTYPE;
  v_ultima uuid;
  v_origem_ocupada boolean;
  v_aloc_atual uuid;
  v_new_mov uuid;
BEGIN
  SELECT * INTO v_mov FROM amostra_movimentacoes
   WHERE id = p_mov AND tenant_id = v_tenant;
  IF v_mov.id IS NULL THEN RAISE EXCEPTION 'movimentacao_inexistente'; END IF;
  IF v_mov.desfeita THEN RAISE EXCEPTION 'movimentacao_ja_desfeita'; END IF;
  IF v_mov.posicao_origem_id IS NULL THEN RAISE EXCEPTION 'sem_origem_para_desfazer'; END IF;

  SELECT id INTO v_ultima FROM amostra_movimentacoes
   WHERE amostra_id = v_mov.amostra_id AND tenant_id = v_tenant AND desfeita = false
   ORDER BY created_at DESC LIMIT 1;
  IF v_ultima <> p_mov THEN RAISE EXCEPTION 'apenas_ultima_movimentacao'; END IF;

  -- Verifica que origem está livre
  SELECT EXISTS (
    SELECT 1 FROM amostra_alocacoes
    WHERE posicao_id = v_mov.posicao_origem_id AND tenant_id = v_tenant AND retirada_em IS NULL
  ) INTO v_origem_ocupada;
  IF v_origem_ocupada THEN RAISE EXCEPTION 'origem_ocupada'; END IF;

  -- Encerra alocação atual (destino)
  SELECT id INTO v_aloc_atual FROM amostra_alocacoes
   WHERE amostra_id = v_mov.amostra_id AND tenant_id = v_tenant AND retirada_em IS NULL
   ORDER BY alocada_em DESC LIMIT 1;
  IF v_aloc_atual IS NOT NULL THEN
    UPDATE amostra_alocacoes SET retirada_em = now(), motivo_retirada = 'undo' WHERE id = v_aloc_atual;
  END IF;

  -- Recria alocação na origem
  INSERT INTO amostra_alocacoes (tenant_id, amostra_id, posicao_id, alocada_em, usuario_id, observacao)
  VALUES (v_tenant, v_mov.amostra_id, v_mov.posicao_origem_id, now(), auth.uid(), 'undo de movimentação');

  UPDATE amostras SET localizacao = COALESCE(v_mov.caminho_origem, localizacao), updated_at = now()
  WHERE id = v_mov.amostra_id AND tenant_id = v_tenant;

  -- Marca original como desfeita
  UPDATE amostra_movimentacoes
     SET desfeita = true, desfeita_em = now(), desfeita_por = auth.uid()
   WHERE id = p_mov;

  -- Registra mov de undo
  INSERT INTO amostra_movimentacoes
    (tenant_id, amostra_id, posicao_origem_id, posicao_destino_id, caminho_origem, caminho_destino, motivo, executada_por)
  VALUES
    (v_tenant, v_mov.amostra_id, v_mov.posicao_destino_id, v_mov.posicao_origem_id, v_mov.caminho_destino, v_mov.caminho_origem, 'undo', auth.uid())
  RETURNING id INTO v_new_mov;

  RETURN v_new_mov;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mover_amostra(uuid,uuid,text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desfazer_movimentacao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soroteca_caminho_posicao(uuid) TO authenticated;
