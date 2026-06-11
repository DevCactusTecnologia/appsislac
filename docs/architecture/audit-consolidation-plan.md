# Audit Consolidation Plan

> 10 tabelas de auditoria → 2. Compatibilidade via views.

---

## 1. Inventário

| Tabela | Escopo | Volume (est.) | Retenção legal |
|---|---|---|---|
| `audit_logs` | Genérico operacional | Alto | 5 anos |
| `atendimento_audit` | Atendimento + críticos | Médio | 20 anos (clínico) |
| `storage_audit` | Uploads | Médio | 5 anos |
| `pdf_override_audit` | Override de laudo | Baixo | 20 anos |
| `tenant_provision_audit` | Provisionamento | Baixo | 10 anos |
| `subscription_changes_log` | Billing | Baixo | 10 anos |
| `tenant_migration_log` | Migração DB | Muito baixo | 10 anos |
| `app_settings_audit` | Settings | Baixo | 5 anos |
| `protocolo_auditoria` | Protocolo | Médio | 20 anos |
| `criticos_comunicacoes` | Notificação crítica | Médio | 20 anos |

---

## 2. Proposta — 2 tabelas

### 2.1 `operational_audit` (escopo tenant)
```
id, tenant_id, ator_id, ator_papel,
recurso_tipo,      -- 'atendimento' | 'exame' | 'storage' | 'protocolo' | 'critico' | 'pdf_override' | 'settings'
recurso_id,
acao,              -- 'created' | 'updated' | 'released' | 'cancelled' | 'overridden' | ...
contexto jsonb,    -- payload livre
critico boolean,   -- flag p/ retenção estendida
created_at
```

Migra: `atendimento_audit`, `storage_audit`, `pdf_override_audit`, `protocolo_auditoria`, `criticos_comunicacoes`, `app_settings_audit`, parte de `audit_logs` com `tenant_id`.

### 2.2 `platform_audit` (escopo super admin)
```
id, ator_id, ator_papel,
recurso_tipo,      -- 'tenant' | 'subscription' | 'migration' | 'provisioning'
recurso_id,
acao,
contexto jsonb,
created_at
```

Migra: `tenant_provision_audit`, `subscription_changes_log`, `tenant_migration_log`, parte de `audit_logs` sem `tenant_id`.

---

## 3. Compatibilidade (views)

```sql
CREATE VIEW atendimento_audit AS
SELECT id, tenant_id, ator_id as analista_id, recurso_id as atendimento_id,
       acao, contexto, created_at
FROM operational_audit
WHERE recurso_tipo IN ('atendimento','exame','critico');
```

Repetir para cada tabela legada — código existente continua funcionando durante transição.

---

## 4. Plano (3 sprints)

| Sprint | Ação | Risco |
|---|---|---|
| 1 | Criar `operational_audit` + `platform_audit` + RLS + GRANTs. Triggers que copiam INSERTs das tabelas legadas. Criar views. | Médio |
| 2 | Backfill histórico (job batch off-hours). Validar contagens. | Médio |
| 3 | Trocar writers para escreverem direto nas novas; desativar triggers; tabelas legadas viram somente-leitura por 90d. | Médio |
| 4 (futuro) | Após retenção legal cumprida, dropar tabelas legadas. | Baixo |

---

## 5. RLS

```sql
CREATE POLICY operational_audit_tenant_read ON operational_audit
  FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() OR is_super_admin());

CREATE POLICY platform_audit_super_admin_only ON platform_audit
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());
```

GRANTs explícitos para `authenticated` e `service_role` (conforme regra de projeto).

---

## 6. Não fazer

- ❌ Dropar qualquer tabela antes de 90d de validação + cumprimento legal.
- ❌ Misturar escopos tenant/plataforma na mesma tabela (boundary de segurança).
- ❌ Remover view de compatibilidade antes de migrar 100% dos readers.
