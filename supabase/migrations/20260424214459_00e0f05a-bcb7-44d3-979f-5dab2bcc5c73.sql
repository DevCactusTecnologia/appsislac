-- ============================================================
-- 1) tenant_settings_public — configuração da vitrine
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenant_settings_public (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  exibir_exames boolean NOT NULL DEFAULT false,
  permitir_reserva boolean NOT NULL DEFAULT true,
  mostrar_preco boolean NOT NULL DEFAULT true,
  titulo_vitrine text NOT NULL DEFAULT 'Nossos exames',
  descricao_vitrine text NOT NULL DEFAULT '',
  whatsapp_contato text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_settings_public ENABLE ROW LEVEL SECURITY;

-- Leitura pública (anônima): qualquer um pode ler a config pública do tenant
CREATE POLICY tsp_public_read
ON public.tenant_settings_public
FOR SELECT
TO anon, authenticated
USING (true);

-- Apenas admin do próprio tenant pode escrever
CREATE POLICY tsp_admin_insert
ON public.tenant_settings_public
FOR INSERT
TO authenticated
WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY tsp_admin_update
ON public.tenant_settings_public
FOR UPDATE
TO authenticated
USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY tsp_admin_delete
ON public.tenant_settings_public
FOR DELETE
TO authenticated
USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- 2) exames_publicos — quais exames cada tenant expõe
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exames_publicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  exame_id uuid NOT NULL REFERENCES public.exames_catalogo(id) ON DELETE CASCADE,
  destaque boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, exame_id)
);

CREATE INDEX IF NOT EXISTS exames_publicos_tenant_idx ON public.exames_publicos(tenant_id, ativo);

ALTER TABLE public.exames_publicos ENABLE ROW LEVEL SECURITY;

-- Leitura pública apenas dos ativos
CREATE POLICY ep_public_read_active
ON public.exames_publicos
FOR SELECT
TO anon, authenticated
USING (ativo = true);

-- Admin do tenant gerencia
CREATE POLICY ep_admin_insert
ON public.exames_publicos
FOR INSERT
TO authenticated
WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY ep_admin_update
ON public.exames_publicos
FOR UPDATE
TO authenticated
USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY ep_admin_delete
ON public.exames_publicos
FOR DELETE
TO authenticated
USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- 3) View pública: exames_publicos + nome + preço PARTICULAR
-- ============================================================
-- Apenas tabela "Própria" (particular) é exposta. Nunca preços de convênio.
CREATE OR REPLACE VIEW public.exames_publicos_view
WITH (security_invoker = true)
AS
SELECT
  ep.id                AS publico_id,
  ep.tenant_id         AS tenant_id,
  ep.exame_id          AS exame_id,
  ep.destaque          AS destaque,
  ep.ordem             AS ordem,
  ec.nome              AS nome,
  ec.categoria         AS categoria,
  ec.material          AS material,
  ec.preparo_paciente  AS preparo,
  ec.requer_jejum      AS requer_jejum,
  COALESCE(tpi.valor, 0)::numeric AS valor
FROM public.exames_publicos ep
JOIN public.exames_catalogo ec
  ON ec.id = ep.exame_id
 AND ec.tenant_id = ep.tenant_id
 AND ec.ativo = true
LEFT JOIN public.tabela_preco_itens tpi
  ON tpi.exame_id = ep.exame_id
 AND tpi.tenant_id = ep.tenant_id
 AND tpi.tabela = 'Própria'
 AND tpi.ativo = true
WHERE ep.ativo = true;

GRANT SELECT ON public.exames_publicos_view TO anon, authenticated;

-- ============================================================
-- 4) solicitacoes_publicas — leads
-- ============================================================
CREATE TABLE IF NOT EXISTS public.solicitacoes_publicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  telefone text NOT NULL,
  cpf text NULL,
  observacao text NOT NULL DEFAULT '',
  exames jsonb NOT NULL,
  total_estimado numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'PENDENTE',
  origem text NOT NULL DEFAULT 'landing',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS solicpub_tenant_idx
  ON public.solicitacoes_publicas(tenant_id, status, created_at DESC);

ALTER TABLE public.solicitacoes_publicas ENABLE ROW LEVEL SECURITY;

-- Validação de payload + rate-limit por telefone/tenant (60s)
CREATE OR REPLACE FUNCTION public.solicitacao_publica_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_phone text;
  v_items_count int;
BEGIN
  -- Tamanho/limites
  IF length(coalesce(NEW.nome, '')) < 2 OR length(NEW.nome) > 120 THEN
    RAISE EXCEPTION 'nome inválido';
  END IF;

  v_phone := regexp_replace(coalesce(NEW.telefone, ''), '\D', '', 'g');
  IF length(v_phone) < 10 OR length(v_phone) > 15 THEN
    RAISE EXCEPTION 'telefone inválido';
  END IF;
  NEW.telefone := v_phone;

  IF NEW.cpf IS NOT NULL AND length(regexp_replace(NEW.cpf, '\D', '', 'g')) NOT IN (0, 11) THEN
    RAISE EXCEPTION 'cpf inválido';
  END IF;

  IF jsonb_typeof(NEW.exames) <> 'array' THEN
    RAISE EXCEPTION 'exames deve ser uma lista';
  END IF;
  v_items_count := jsonb_array_length(NEW.exames);
  IF v_items_count < 1 OR v_items_count > 30 THEN
    RAISE EXCEPTION 'quantidade de exames fora do limite (1 a 30)';
  END IF;

  IF length(coalesce(NEW.observacao, '')) > 1000 THEN
    RAISE EXCEPTION 'observação muito longa';
  END IF;

  -- Rate-limit: máx 1 envio por minuto por (tenant, telefone)
  SELECT count(*) INTO v_count
  FROM public.solicitacoes_publicas
  WHERE tenant_id = NEW.tenant_id
    AND telefone = NEW.telefone
    AND created_at > now() - interval '60 seconds';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'aguarde antes de enviar novamente';
  END IF;

  -- Garante que o tenant aceita reservas
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_settings_public
    WHERE tenant_id = NEW.tenant_id AND permitir_reserva = true
  ) THEN
    RAISE EXCEPTION 'tenant não aceita reservas públicas';
  END IF;

  NEW.status := 'PENDENTE';
  NEW.origem := COALESCE(NEW.origem, 'landing');
  NEW.created_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS solicitacao_publica_validate_trg ON public.solicitacoes_publicas;
CREATE TRIGGER solicitacao_publica_validate_trg
BEFORE INSERT ON public.solicitacoes_publicas
FOR EACH ROW
EXECUTE FUNCTION public.solicitacao_publica_validate();

-- Anônimo pode inserir (validação no trigger)
CREATE POLICY solicpub_public_insert
ON public.solicitacoes_publicas
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Apenas equipe interna do tenant lê
CREATE POLICY solicpub_internal_select
ON public.solicitacoes_publicas
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (tenant_id = public.current_tenant_id())
);

-- Apenas equipe interna pode atualizar status
CREATE POLICY solicpub_internal_update
ON public.solicitacoes_publicas
FOR UPDATE
TO authenticated
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY solicpub_admin_delete
ON public.solicitacoes_publicas
FOR DELETE
TO authenticated
USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS solicpub_touch ON public.solicitacoes_publicas;
CREATE TRIGGER solicpub_touch BEFORE UPDATE ON public.solicitacoes_publicas
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS tsp_touch ON public.tenant_settings_public;
CREATE TRIGGER tsp_touch BEFORE UPDATE ON public.tenant_settings_public
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS ep_touch ON public.exames_publicos;
CREATE TRIGGER ep_touch BEFORE UPDATE ON public.exames_publicos
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();