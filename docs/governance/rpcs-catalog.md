# SISLAC — RPCs Catalog

**Total:** 151 funções em `public`. **Fonte:** `docs/security/_inventory-rpcs.txt`.

## Distribuição por categoria

| Categoria | # | Exemplos |
|---|---:|---|
| **Segurança (SSOT)** | 7 | `current_tenant_id`, `current_tenant_id_strict`, `is_super_admin`, `has_role`, `has_permission`, `current_user_email`, `current_tenant_feature_flags` |
| **Domínio — Atendimento** | 12 | `create_atendimento_tx`, `update_atendimento_tx`, `atendimento_assign_protocolo`, `atendimento_sign_protocolo`, `atendimento_exames_rbac_check`, `atendimento_exames_snapshot_regulatorio`, `aplicar_enriquecimento_exame`, `atendimentos_kpis`, `atendimentos_page`, `a_receber_pacientes_page`, `_is_post_finalizacao`, `is_post_finalizacao` |
| **Domínio — Financeiro** | ~10 | `registrar_pagamento_tx`, `estornar_pagamento_tx`, `criar_fatura_convenio_tx`, `financeiro_saida_tx`, etc. |
| **Domínio — Dashboard** | 3 | `dashboard_kpis`, `dashboard_metrics`, `dashboard_daily_series` |
| **Infraestrutura — Integração** | ~15 | `claim_integration_jobs`, `circuit_record_failure/success/should_allow`, `cron_health_record` |
| **Infraestrutura — Protocolos** | 4 | `_calc_dv_amostra`, `_get_protocolo_hmac_key`, `cnpj_digits`, `_get_audit_justificativa` |
| **Triggers (functions)** | ~75 | `audit_trigger`, `audit_app_settings`, `touch_*_updated_at`, `tg_*_updated_at`, `trg_recompute_*`, `fwd_*_to_*`, `ensure_*`, `protect_*`, `require_justificativa_pos_finalizacao`, `snapshot_exame_terceirizado`, `block_friendly_id_update` |
| **Públicas RPC (anon)** | 2 | `get_published_tenant_page`, `lookup_paciente_publico` (rate-limit aplicado em ambas) |
| **Legado** | 1 | `_import_legacy_exec` (apenas para migração — não chamar em runtime) |

## Catálogo das RPCs críticas

### Segurança (não tocar)
| RPC | I/O | Chamada por | Tabelas |
|---|---|---|---|
| `current_tenant_id()` | → uuid | RLS de todas as 97 tabelas | `profiles` |
| `is_super_admin(uuid)` | uid → bool | RLS / edge functions | `user_roles` |
| `has_role(uuid, app_role)` | uid, role → bool | RLS / código | `user_roles` |
| `has_permission(uuid, text)` | uid, perm → bool | RLS | `user_roles` |

### Domínio — Atendimento
| RPC | Responsabilidade | Riscos |
|---|---|---|
| `create_atendimento_tx(_atendimento, _exames, _pagamentos)` | Insere atendimento + exames + pagamentos atomicamente | **Monolito** (~600 LOC). Candidata a quebrar em pipeline (P1). |
| `update_atendimento_tx` | Update transacional do conjunto | Mesmo padrão. |
| `atendimento_assign_protocolo` | Gera protocolo no BEFORE INSERT | OK |
| `atendimento_sign_protocolo` | Assina HMAC no AFTER INSERT | OK |
| `atendimento_exames_rbac_check` | Bloqueia mutações pós-finalização sem permissão | OK |
| `atendimento_exames_snapshot_regulatorio` | Congela CBHPM/TUSS no BEFORE INSERT/UPDATE | OK |

### Públicas (anon)
| RPC | Por quê pública | Salvaguarda |
|---|---|---|
| `get_published_tenant_page` | Portal público do tenant | Filtra por `status='published'`; sem PII. |
| `lookup_paciente_publico` | Paciente consulta resultado | Rate-limit via `public_rate_limits` + OTP. |

## Funções de trigger consolidáveis
- **75 `touch_*_updated_at` / `tg_*_updated_at`** — todas fazem `NEW.updated_at = now(); RETURN NEW;`. Já existe `touch_app_settings_updated_at` reutilizada em várias tabelas. **Recomendação:** padronizar uma única `set_updated_at()` e remover variantes.
- **2 cópias de auditoria em `app_settings`**: `audit_trigger` + `audit_app_settings` rodam ambas no mesmo evento. **Remover `audit_app_settings_trigger`** (P1).
- **`atendimento_exames`** tem `audit_atendimento_exames` + `audit_trigger` no mesmo evento. Idem.

## Multi-responsabilidade (refator P2)
- `create_atendimento_tx` faz: validação → insert atendimento → assign protocolo → insert exames → snapshot regulatório → insert pagamentos → recompute status. Quebrar em pipeline nomeado melhora rastreabilidade.

## Núcleo comum compartilhável
- `cnpj_digits`, `_calc_dv_amostra`, `_get_protocolo_hmac_key` — já são SSOT.
- `circuit_*` (3 funções) — núcleo de circuit breaker; OK como é.
