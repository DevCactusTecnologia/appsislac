# SISLAC — Relatório de Complexidade Acidental

**Filosofia:** "Existe porque é necessário, ou porque ninguém revisou?"

## Mapa de complexidade essencial × acidental

| Área | Essencial | Acidental |
|---|---|---|
| Multi-tenant (RLS + `current_tenant_id`) | ✅ | — |
| Super-admin / control plane (16 edge fns) | ✅ | — |
| Integração externa (circuit breaker, queue, cron) | ✅ | — |
| 305 policies | ✅ (288) | 3 duplicadas |
| 149 triggers | ✅ (120) | ~24 duplicações de auditoria + 75 `touch_*` variantes |
| Auditoria (10 tabelas: `audit_logs`, `atendimento_audit`, `app_settings_audit`, `pdf_override_audit`, `storage_audit`, `platform_audit`, `operational_audit`, `tenant_provision_audit`, `protocolo_auditoria`, `subscription_changes_log`) | Parcial | Stack fragmentado; refator caro |

## 1. Helpers duplicados

### Tenant resolution
- **Server-side (SSOT):** `current_tenant_id()` — único, correto.
- **Client-side:** `src/lib/db/tenantResolver.ts` (`getTenantContext`, `getCurrentTenantId`) + `src/data/_tenant.ts` (ex-resolver). **Já consolidado** pela camada `db.*` (ver `src/lib/db/README.md`). ✅

### Auditoria
- **9 funções:** `audit_trigger`, `audit_atendimentos`, `audit_atendimento_exames`, `audit_atendimento_pagamentos`, `audit_app_settings`, `fwd_app_settings_audit_to_platform`, `fwd_atendimento_audit_to_operational`, `fwd_audit_logs_split`, etc.
- **Realidade:** `audit_trigger` é genérico (escreve `audit_logs`); as específicas escrevem em tabelas dedicadas. Não é duplicação — é split intencional. **Acidental:** ter `audit_atendimentos` + `audit_trigger` no MESMO evento.

### Validações
- `_calc_dv_amostra`, `cnpj_digits`, `cpf` (frontend `src/lib/cpf.ts`) — SSOT por domínio. ✅
- `validarCredenciaisAnalista` agora roda server-side via `has_role` RPC (hardening 2026-06-15). ✅

### Uploads
- 3 edge functions (`upload-image`, `upload-pdf`, `upload-assinatura`) replicam validação de tenant + bucket + mime + audit. **Acidental moderado.** Refator opcional.

### Integrações
- Registry em `src/integrations/providers/registry.ts` ✅
- 15 edge functions `integration-*` — cada uma tem responsabilidade única; não há duplicação.

## 2. Pontos críticos de complexidade acidental

### A. Auditoria duplicada nos triggers (P1)
| Tabela | Triggers redundantes |
|---|---|
| `atendimentos` | `audit_atendimentos` + `audit_trigger` + `trg_audit_atendimentos` |
| `atendimento_exames` | `audit_atendimento_exames` + `audit_trigger` + `trg_audit_atendimento_exames` |
| `atendimento_pagamentos` | `audit_atendimento_pagamentos` + `audit_trigger` + `trg_audit_atendimento_pagamentos` |
| `app_settings` | `audit_app_settings` + `audit_app_settings_trigger` + `audit_trigger` |

**Impacto:** cada INSERT escreve 2-3 linhas de auditoria. Performance + storage.
**Ação:** escolher uma; documentar a decisão.

### B. 75 variantes de `touch_*_updated_at` (P2)
Todas fazem `NEW.updated_at = now()`. Padronizar em `set_updated_at_timestamp()`.

### C. Função `touch_app_settings_updated_at()` reusada fora de `app_settings` (P2)
Nome induz erro. Renomear para `set_updated_at()` sem mudar comportamento.

### D. SSOT do `plano` (P2)
`tenants.plano` (legado) + `tenant_subscriptions_billing.plano_atual` coexistem. Definir uma única fonte; manter a outra como view ou coluna gerada.

### E. 10 tabelas de auditoria (P3, alto risco)
Stack fragmentado por bom motivo (RLS distintas, volumes distintos). Consolidação custa muito e ganha pouco. **Manter como está, monitorar volume.**

## 3. Itens que NÃO são complexidade acidental
- Modelo `user_roles` separado de `profiles` — **mandatório por segurança**.
- 16 edge functions super-admin — cada uma é uma operação auditada.
- `current_tenant_id()` + `has_permission()` + `has_role()` + `is_super_admin()` — quatro helpers porque há quatro perguntas distintas.
- `tenant_registry` separado de `tenants` — separa identidade (estável) de infraestrutura (mutável).

## 4. Métricas
| Métrica | Valor |
|---|---:|
| Linhas de policy duplicadas | ~3 |
| Triggers duplicados | ~10 |
| Funções `updated_at` consolidáveis | 75 → 1 |
| Edge functions consolidáveis | 5 → 2 |
| Tabelas de auditoria refatoráveis | 10 → 2 (não recomendado agora) |

**Ratio complexidade acidental / total:** ~5%. **Sistema é majoritariamente essencial.**
