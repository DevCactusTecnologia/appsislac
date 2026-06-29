ALTER TABLE public.tenant_lab_config
ADD COLUMN IF NOT EXISTS terceirizado_recebimento_automatico boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tenant_lab_config.terceirizado_recebimento_automatico IS
'Quando true, exames terceirizados sem integração são marcados como recebidos/finalizados automaticamente ao abrir a tela de Inserir Resultado. Quando false (padrão), exige clique manual em "Marcar como recebido".';