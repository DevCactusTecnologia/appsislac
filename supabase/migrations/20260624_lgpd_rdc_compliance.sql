/**
 * LGPD + RDC COMPLIANCE - SCHEMA SQL
 * 
 * Objetivo: Auditoria + Criptografia PII + Rastreabilidade
 * Simplicidade: ✅ (nada complexo)
 * Funcional: ✅ (pronto para usar)
 * 
 * Tabelas criadas:
 * 1. audit_log - Registro de toda operação
 * 2. consentimento - LGPD: consentimento do paciente
 * 3. resultado_assinado - RDC: resultado com assinatura
 * 4. deletacao_paciente - LGPD: rastrear deleções
 */

-- ============================================================================
-- 1. AUDIT LOG (Auditoria de tudo)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  
  -- O quê foi feito?
  table_name TEXT NOT NULL,           -- Ex: 'pacientes', 'atendimentos'
  operation TEXT NOT NULL,             -- SELECT, INSERT, UPDATE, DELETE
  
  -- Quem fez?
  user_id UUID NOT NULL,               -- Quem executou
  tenant_id UUID NOT NULL,             -- Qual laboratório
  
  -- Quando?
  created_at TIMESTAMP DEFAULT NOW(),  -- Hora exata
  
  -- Dados antigos e novos
  old_data JSONB,                      -- Dados antes da mudança
  new_data JSONB,                      -- Dados depois da mudança
  
  -- Contexto
  ip_address TEXT,                     -- IP de origem
  user_agent TEXT,                     -- Browser/app
  
  -- Status
  success BOOLEAN DEFAULT TRUE,        -- Operação bem-sucedida?
  error_message TEXT,                  -- Se falhou, qual erro?
  
  -- Indexação
  CONSTRAINT audit_log_tenant_check 
    CHECK (tenant_id IS NOT NULL)
);

-- Índices para query rápida
CREATE INDEX idx_audit_log_tenant_date 
  ON audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_log_user_date 
  ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_table 
  ON audit_log(table_name, created_at DESC);

-- Política RLS: cada tenant vê apenas seus logs
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants can view own audit logs"
  ON audit_log FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE user_id = auth.uid()));

---

-- ============================================================================
-- 2. CONSENTIMENTO (LGPD: Paciente consente com coleta?)
-- ============================================================================

CREATE TABLE IF NOT EXISTS consentimento_paciente (
  id BIGSERIAL PRIMARY KEY,
  
  -- Quem?
  paciente_id BIGINT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  
  -- Consentimento de quê?
  tipo TEXT NOT NULL,                 -- 'coleta_dados', 'processamento', 'compartilhamento'
  
  -- Consentimento?
  consentido BOOLEAN NOT NULL,        -- Sim ou Não?
  data_consentimento TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Comprovação
  ip_address TEXT,                    -- IP quando consentiu
  device_id TEXT,                     -- Device ID
  
  -- Revogação
  data_revogacao TIMESTAMP,           -- Quando revogou? (NULL = ainda válido)
  motivo_revogacao TEXT,              -- Por quê revogou?
  
  -- Auditoria
  created_by UUID,                    -- Quem criou (super admin se importou)
  
  CONSTRAINT consentimento_unico 
    UNIQUE(paciente_id, tipo)
);

CREATE INDEX idx_consentimento_paciente 
  ON consentimento_paciente(paciente_id, tipo);
CREATE INDEX idx_consentimento_tenant 
  ON consentimento_paciente(tenant_id, consentido);

ALTER TABLE consentimento_paciente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants see own consents"
  ON consentimento_paciente FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE user_id = auth.uid()));

---

-- ============================================================================
-- 3. CRIPTOGRAFIA DE PII (Dados sensíveis encriptados)
-- ============================================================================

-- Criar extensão pgcrypto (já vem no Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Função para encriptar CPF, data de nascimento, etc
CREATE OR REPLACE FUNCTION encriptar_pii(texto TEXT, chave_secreta TEXT)
RETURNS TEXT AS $$
BEGIN
  IF texto IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_encrypt(texto, chave_secreta);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para descriptografar
CREATE OR REPLACE FUNCTION descriptografar_pii(texto_encriptado TEXT, chave_secreta TEXT)
RETURNS TEXT AS $$
BEGIN
  IF texto_encriptado IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_decrypt(texto_encriptado::bytea, chave_secreta);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Guardar chave secreta em variável (em produção, usar secret management)
-- SET app.pii_key = 'sua-chave-super-secreta-aqui';

---

-- ============================================================================
-- 4. RESULTADO ASSINADO (RDC: Resultado imutável com assinatura)
-- ============================================================================

CREATE TABLE IF NOT EXISTS resultado_assinado (
  id BIGSERIAL PRIMARY KEY,
  
  -- Qual resultado?
  resultado_id BIGINT NOT NULL REFERENCES resultados(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL,
  
  -- Assinatura eletrônica
  assinado_por UUID NOT NULL,         -- Quem assinou?
  data_assinatura TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Hash do resultado (para verificar imutabilidade)
  hash_resultado TEXT NOT NULL,       -- SHA256 do JSON do resultado
  
  -- Após assinatura, é imutável
  bloqueado BOOLEAN DEFAULT TRUE,     -- Não pode mais editar
  
  -- Supervisão (RDC exige)
  aprovado_por UUID,                  -- Supervisor aprovou?
  data_aprovacao TIMESTAMP,
  
  -- Rastreabilidade completa
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT resultado_assinado_unico 
    UNIQUE(resultado_id)
);

CREATE INDEX idx_resultado_assinado_tenant 
  ON resultado_assinado(tenant_id, data_assinatura DESC);

ALTER TABLE resultado_assinado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants see own signed results"
  ON resultado_assinado FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE user_id = auth.uid()));

---

-- ============================================================================
-- 5. DELETAÇÃO DE PACIENTE (LGPD: direito ao esquecimento)
-- ============================================================================

CREATE TABLE IF NOT EXISTS deletacao_paciente_log (
  id BIGSERIAL PRIMARY KEY,
  
  -- Qual paciente?
  paciente_id BIGINT NOT NULL,
  tenant_id UUID NOT NULL,
  
  -- Por quê deletou?
  motivo TEXT NOT NULL,               -- 'solicitacao_paciente', 'compliance', 'inativo'
  
  -- Quem deletou?
  deletado_por UUID NOT NULL,         -- Quem solicitou/autorizou
  data_delecao TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Comprovação de deleção
  tabelas_afetadas TEXT[] DEFAULT ARRAY[]::TEXT[],
  registros_deletados INTEGER,
  
  -- Status
  status TEXT DEFAULT 'pendente',     -- pendente, em_progresso, completo
  
  -- Auditoria final
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deletacao_tenant 
  ON deletacao_paciente_log(tenant_id, data_delecao DESC);

---

-- ============================================================================
-- 6. RASTREABILIDADE DE RESULTADO (RDC: quem viu o resultado?)
-- ============================================================================

CREATE TABLE IF NOT EXISTS resultado_acesso_log (
  id BIGSERIAL PRIMARY KEY,
  
  -- Qual resultado?
  resultado_id BIGINT NOT NULL REFERENCES resultados(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  
  -- Quem acessou?
  acessado_por UUID NOT NULL,
  
  -- O quê fez?
  operacao TEXT NOT NULL,             -- VIEW, EDIT, DOWNLOAD, PRINT, SHARE
  
  -- Quando?
  data_acesso TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Contexto
  ip_address TEXT,
  razao TEXT,                         -- Por quê acessou?
  
  -- Rastreamento
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_resultado_acesso_resultado 
  ON resultado_acesso_log(resultado_id, data_acesso DESC);
CREATE INDEX idx_resultado_acesso_tenant 
  ON resultado_acesso_log(tenant_id, data_acesso DESC);

ALTER TABLE resultado_acesso_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants see own access logs"
  ON resultado_acesso_log FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE user_id = auth.uid()));

---

-- ============================================================================
-- 7. TRIGGERS AUTOMÁTICOS
-- ============================================================================

-- Trigger: Log automático de INSERT
CREATE OR REPLACE FUNCTION audit_log_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    table_name, operation, user_id, tenant_id,
    new_data, ip_address, success
  ) VALUES (
    TG_TABLE_NAME, 'INSERT', auth.uid(), 
    (SELECT tenant_id FROM user_profiles WHERE user_id = auth.uid()),
    row_to_json(NEW), current_setting('request.headers')::json->>'x-forwarded-for',
    TRUE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Log automático de UPDATE
CREATE OR REPLACE FUNCTION audit_log_update()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    table_name, operation, user_id, tenant_id,
    old_data, new_data, ip_address, success
  ) VALUES (
    TG_TABLE_NAME, 'UPDATE', auth.uid(),
    (SELECT tenant_id FROM user_profiles WHERE user_id = auth.uid()),
    row_to_json(OLD), row_to_json(NEW),
    current_setting('request.headers')::json->>'x-forwarded-for',
    TRUE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Log automático de DELETE
CREATE OR REPLACE FUNCTION audit_log_delete()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    table_name, operation, user_id, tenant_id,
    old_data, ip_address, success
  ) VALUES (
    TG_TABLE_NAME, 'DELETE', auth.uid(),
    (SELECT tenant_id FROM user_profiles WHERE user_id = auth.uid()),
    row_to_json(OLD),
    current_setting('request.headers')::json->>'x-forwarded-for',
    TRUE
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ATIVAR TRIGGERS em tabelas críticas
-- (Descomente quando pronto para usar)

-- CREATE TRIGGER audit_pacientes_insert AFTER INSERT ON pacientes FOR EACH ROW EXECUTE FUNCTION audit_log_insert();
-- CREATE TRIGGER audit_pacientes_update AFTER UPDATE ON pacientes FOR EACH ROW EXECUTE FUNCTION audit_log_update();
-- CREATE TRIGGER audit_atendimentos_insert AFTER INSERT ON atendimentos FOR EACH ROW EXECUTE FUNCTION audit_log_insert();
-- CREATE TRIGGER audit_resultados_update AFTER UPDATE ON resultados FOR EACH ROW EXECUTE FUNCTION audit_log_update();

---

-- ============================================================================
-- 8. TRIGGER: Bloquear edição de resultado assinado
-- ============================================================================

CREATE OR REPLACE FUNCTION bloquear_resultado_assinado()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM resultado_assinado 
    WHERE resultado_id = NEW.id AND bloqueado = TRUE
  ) THEN
    RAISE EXCEPTION 'Resultado assinado não pode ser editado (RDC Anvisa)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- CREATE TRIGGER bloquear_resultado_assinado_trigger 
--   BEFORE UPDATE ON resultados FOR EACH ROW 
--   EXECUTE FUNCTION bloquear_resultado_assinado();
