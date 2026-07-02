# 06 — Business Rules in DB

## Números
- Funções (schema public): **200**
- Triggers (não internos, todos schemas): **195**
- Policies RLS (public): 373
- Views: 13

## Classificação das 200 funções

### 1. Segurança / RLS helpers (~15)
`current_tenant_id()`, `is_super_admin()`, `has_permission(...)`, `has_role(...)`, `is_admin(...)`, `is_manager(...)`, `enforce_tenant(...)`, `assert_super_admin()`.  
Papel: infraestrutura de segurança. Chamadas por policies e por RPCs sensíveis.

### 2. RPC transacionais de domínio (~40)
Exemplos: `create_atendimento_tx`, `update_atendimento_tx`, `cancel_atendimento_tx`, `sign_resultado_tx`, `register_pagamento_tx`, `close_caixa_tx`, `move_amostra_tx`, `emprestar_amostra_tx`, `expurgar_amostras_tx`, `fechar_fatura_convenio_tx`, `registrar_glosa_tx`.  
Papel: **regra de negócio pura**. Encapsulam operações compostas em transação, gravam auditoria e retornam estado consistente.

### 3. Sequenciadores humanos (~8)
`next_protocolo(tenant_id)`, `next_guia(tenant_id, tipo)`, `next_amostra_codigo(tenant_id)`, `next_friendly_id(tenant_id, scope)`.  
Papel: infraestrutura de nomeação.

### 4. Super Admin / control-plane (5 identificadas)
`super_admin_dump_auth_users`, `super_admin_dump_ddl`, `super_admin_dump_table_page`, `super_admin_list_migration_tables`, `super_admin_tenants_metrics`.  
Papel: plataforma (migração e observabilidade). Todas exigem `is_super_admin()`.

### 5. Auditoria / triggers de log (~40)
Corpo padrão que grava em `*_audit` a diferença entre `OLD` e `NEW`. Instalados como triggers `audit_<tabela>` (ver PARTE Triggers).

### 6. Timestamps / housekeeping (~20)
`update_updated_at_column()`, `ep_touch()`, `amostras_updated_at()`, `update_objects_updated_at()`.  
Papel: infraestrutura.

### 7. Validação / enforcement (~20)
`atendimento_exames_rbac_check()`, `ensure_tenant_billing_after_insert()`, `profiles_require_auth_user()`, `enforce_bucket_name_length()`, `protect_buckets_delete()`, `protect_objects_delete()`, `tr_check_filters()`.  
Papel: **regra de negócio + segurança**.

### 8. Cálculo / derivação (~15)
`calc_preco_atendimento_exame(...)`, `calc_saldo_devedor(...)`, `resolve_vr_por_paciente(...)`, `resolve_critico(...)`, `calc_total_fatura(...)`.  
Papel: regra de negócio (evita divergência frontend/backend).

### 9. Integrações (~10)
`integration_enqueue(...)`, `integration_mark_dead(...)`, `integration_bump_circuit(...)`.  
Papel: infraestrutura de fila.

### 10. Restante (~25)
Utilitários (`slugify`, `normalize_text`, `parse_faixa_etaria`, `format_cpf`), report helpers, cache invalidation.

## Triggers — amostra observada (195 no total)
Padrões dominantes:
- **`audit_<tabela>`** (~40): grava trilha imutável em `<tabela>_audit`.
- **`update_<tabela>_updated_at`** (~50): mantém `updated_at`.
- **`<tabela>_rbac_check_trg`**: valida perfil na escrita (`atendimento_exames_rbac_check_trg`).
- **`ensure_tenant_billing_after_insert`** (em `tenants`): cria assinatura default.
- **`profiles_require_auth_user_trg`**: garante FK lógica com `auth.users`.
- **`cron_job_cache_invalidate`**: invalida cache após rodar cron.
- **`tr_check_filters`**: valida payload de filtros.
- Storage: `enforce_bucket_name_length_trigger`, `protect_buckets_delete`, `protect_objects_delete`.

## Views (13)
Amostra de responsabilidades observadas na base atual: leitura consolidada de dashboards, agregações de KPIs e visões financeiras. Nenhuma view executa DML — todas são projeções somente-leitura.

## Classificação final
| Categoria | % estimada |
|---|---:|
| Regra de negócio (RPCs, cálculos, enforcement) | ~40% |
| Auditoria (triggers de log) | ~20% |
| Infraestrutura (timestamps, sequenciadores, housekeeping) | ~25% |
| Segurança (RLS helpers, super_admin gate) | ~10% |
| Utilitários | ~5% |

**O banco carrega regras de negócio críticas** — não é apenas repositório passivo. RPCs `*_tx` são o único caminho oficial de mutação para atendimentos, pagamentos, amostras, fechamento de caixa e faturamento.
