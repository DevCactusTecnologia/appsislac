-- Onda 1 — Formalizar global dictionaries (somente comentários semânticos)
-- Nenhuma alteração de schema, dados, RLS ou nullability.

COMMENT ON TABLE public.select_options IS
'Opções configuráveis para selects/dropdowns da UI. Suporta DICIONÁRIOS GLOBAIS (tenant_id IS NULL — read-only para todos os tenants, ex.: tipos sanguíneos, estados, classificações universais) e OVERRIDES POR TENANT (tenant_id = current_tenant_id()). Tenant overrides têm prioridade sobre globais com mesmo `valor`. ATENÇÃO: tabelas operacionais de tenant (atendimentos, pacientes, financeiro, etc.) NUNCA devem permitir tenant_id NULL — esse padrão é exclusivo de catálogos compartilhados explicitamente declarados.';

COMMENT ON COLUMN public.select_options.tenant_id IS
'NULL = dicionário global da plataforma (intencional, read-only para todos os tenants). UUID = override específico do tenant. RLS: USING (tenant_id IS NULL OR tenant_id = current_tenant_id()). Não replicar esse padrão em tabelas operacionais.';