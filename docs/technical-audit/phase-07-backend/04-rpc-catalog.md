# 04 — RPC Catalog (221 funções `public.*`)

## Classificação

### Transacionais (7) — sufixo `_tx`
- `create_atendimento_tx` — cria atendimento + exames + pagamentos + auditoria.
- `update_atendimento_tx` — atualiza preservando estado, jejum, terceirizados.
- `finalize_resultado_tx`, `sign_laudo_tx`, `cancel_atendimento_tx`, `estornar_pagamento_tx`, `__test_update_atendimento_tx_state` (harness).

### Segurança (6)
- `current_tenant_id()`, `current_tenant_feature_flags()`.
- `is_super_admin()`, `is_super_admin(_user_id)`.
- `has_permission(_user_id,...)`, `has_permission_safe(...)`.
- Complementares: `assert_user_in_tenant(...)`, `atendimento_exames_rbac_check()`.

### Consulta / Paginação
- `atendimentos_page(...)`, `atendimentos_kpis(...)`, `a_receber_pacientes_page(...)`, `super_admin_tenants_metrics()`, `super_admin_dump_table_page(...)`.

### Super Admin (5)
- `super_admin_dump_auth_users`, `super_admin_dump_ddl`, `super_admin_dump_table_page`, `super_admin_list_migration_tables`, `super_admin_tenants_metrics` — todas revalidam `is_super_admin()`.

### Auditoria (8) — triggers
`audit_trigger`, `audit_trigger_function`, `audit_app_settings`, `audit_atendimentos`, `audit_atendimento_exames`, `audit_atendimento_pagamentos`, `audit_convenio_competencias`, `audit_convenio_glosas`.

### Integração / Engine (Circuit + DLQ + Jobs)
- `circuit_should_allow`, `circuit_record_success`, `circuit_record_failure`.
- `claim_integration_jobs(p_batch,...)` — atomic claim para o runner.

### Domínio financeiro
- `caixa_abrir`, `caixa_fechar` (2 assinaturas), `attach_pagamento_to_caixa`, `attach_saida_to_caixa`.
- `competencia_abrir/fechar/reabrir`, `competencia_esta_fechada`.
- `convenio_fatura_recalc/cancelar/glosar/reapresentar/assign_codigo/sign_codigo/set_competencia`.

### Utilitário / Guards
- `_calc_dv_amostra`, `cnpj_digits`, `_get_audit_justificativa`, `_get_protocolo_hmac_key`.
- `atendimento_assign_protocolo`, `atendimento_sign_protocolo`, `atendimento_exames_snapshot_regulatorio`, `atendimento_exames_valor_original_guard`, `atendimento_exames_short_circuit_rotina`, `block_delete_use_estorno`, `block_friendly_id_update`.

## Padrão observado
- 100% em schema `public`.
- Convenção: `SECURITY DEFINER`, `SET search_path = public`, sufixos consistentes (`_tx`, `_page`, `_kpis`, `audit_*`, `is_*`, `has_*`, `circuit_*`, `super_admin_*`).
- Guards de contexto (`current_tenant_id`) chamados dentro das próprias RPCs.
