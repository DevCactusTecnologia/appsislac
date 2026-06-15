# SISLAC — Análise de Necessidade

**Modo:** somente leitura · **Premissa:** SaaS híbrido (shared + dedicated + super-admin).

## Resumo
| Camada | Total | Realmente necessárias | Consolidáveis | Removíveis |
|---|---:|---:|---:|---:|
| Policies | 305 | ~288 | ~14 | ~3 |
| Triggers | 149 | ~120 | ~24 | 0 |
| RPCs | 151 | ~145 | ~6 | 0 |
| Edge functions | 51 | 46 | 5 | 0 |

## 1. Policies — 305 são necessárias?
**Quase todas, sim.** Justificativa: 97 tabelas × 4 verbos = 388 policies teóricas. Estamos em 305 porque várias tabelas têm policy combinada de INSERT/UPDATE/DELETE. **Não há excesso quantitativo.**

### Duplicadas (remover): 3
1. `audit_logs.“Admins veem logs do seu tenant”` — duplicada por `audit_logs_select`. Remover a legada.
2. `cities.cities_anon_read` ≡ `cities.cities_public_read` — manter apenas uma.
3. `comprovante_links` — nomes PT-BR coexistem com técnicos. Padronizar nomenclatura sem mudar comportamento.

### Redundantes (revisar): ~11
- `atendimentos_*` listas de 6 permissões — refletem ciclo de vida (necessário, mas comentar).
- `select_options` 5 policies — necessário p/ globais.
- `solicitacoes_publicas` 5 policies — necessário p/ portal.

### Herdáveis (não fazer agora)
Helper `can_access_tenant_row(tenant_id uuid)` consolidaria ~150 lookups, mas o ganho não compensa o custo de auditar uma camada nova. **Manter padrão atual.**

## 2. Triggers — 149 são necessárias?
**Não. ~24 são duplicações.**

### Executam exatamente a mesma função (P1):
- `audit_atendimento_exames` + `audit_trigger` em `atendimento_exames` (escolher 1)
- `audit_atendimento_pagamentos` + `audit_trigger` em `atendimento_pagamentos`
- `audit_atendimentos` + `audit_trigger` em `atendimentos`
- `audit_app_settings` + `audit_app_settings_trigger` em `app_settings`

### Compartilham helper (P2):
- 75 variantes de `touch_*_updated_at` → padronizar em `set_updated_at_timestamp()`.

## 3. RPCs — 151 são necessárias?
**Quase todas.** Distribuição:
- 75 são funções de trigger (não chamadas externamente, parte da camada de domínio)
- 7 são SSOT de segurança
- ~25 são RPCs de domínio (atendimento/financeiro/dashboard)
- ~15 são infraestrutura de integração (circuit breaker, claim jobs, health)
- 2 são públicas (anon)
- 1 legada (`_import_legacy_exec` — manter, mas marcar `DEPRECATED` no DDL)

### Multi-responsabilidade (P1):
`create_atendimento_tx` faz 7 etapas → quebrar em pipeline nomeado.
`update_atendimento_tx` idem.

### Responsabilidade única (manter como está):
Todas as `circuit_*`, `current_tenant_id`, `has_*`, `is_super_admin`, `*_assign_protocolo`, `*_sign_protocolo`.

### Núcleo comum (já compartilhado):
`cnpj_digits`, `_calc_dv_amostra`, `_get_protocolo_hmac_key`.

## 4. Edge Functions — 51 são necessárias?
**46 são essenciais.** 5 são consolidáveis (P2/P3, opcional).

### Claras (não tocar): 46
Todas as `super-admin-*`, `integration-*`, `tenant-*`, `whatsapp-*`, `create-atendimento`, `update-atendimento`, `ai-suggest-exames`, `extract-requisicao-exames`, `leads-manager`, `sitemap`, `comprovante-*`.

### Candidatas a consolidação (opcional): 5
- `upload-image` + `upload-pdf` + `upload-assinatura` → `upload-storage`
- `image-url` + `assinatura-url` → `signed-url`

### Duplicadas: 0
Nenhuma duplicação funcional encontrada.

## Veredito
> Não há excesso quantitativo. O sistema é grande porque o domínio é grande (laboratório clínico multi-tenant com integração externa, portal público, super-admin e billing). **As oportunidades reais de simplificação são pontuais (~30 itens), não estruturais.**
