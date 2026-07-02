# 04 — RLS Audit

## Cobertura
- **373 policies** em 119 tabelas do schema `public`.
- **0 tabelas com RLS desabilitada** (query: `pg_tables WHERE rowsecurity=false` → 0).

## Policies permissivas (`USING true` / `WITH CHECK true`)

Auditadas via `pg_policies`:

| Tabela | Policy | Análise |
|---|---|---|
| `cities`, `states` | `*_anon_read` (SELECT true) | **OK** — dicionário geo público, sem PII |
| `public_rate_limits` | `rate_limits_service_only_*` | **OK** — restringidas via GRANT a `service_role` |
| `guia_sequence` | `guia_sequence_service_all` | **OK** — service_role only |
| `tenant_rate_limit` | `ratelimit_service_all` | **OK** — service_role only |
| `whatsapp_outbox`, `whatsapp_opt_out`, `whatsapp_metrics_tenant`, `whatsapp_templates_cache` | `*_service_all` | **OK** — service_role only. **Depende de GRANT correto** — se `authenticated` tiver acesso, vaza |
| `documento_templates` | `doc_templates_demo_anon_select` | **⚠️ REVISAR** — nome "demo" sugere resíduo. SELECT anon em templates de laudo |
| `solicitacoes_publicas` | `solicpub_deny_anon_select` (USING …) + `solicpub_public_insert_secure` | Insert público esperado (formulário site); SELECT bloqueado |
| `signup_attempts` | `anon_insert_signup_attempts` | Esperado (rate-limit de signup) |

## SECURITY DEFINER
- `current_tenant_id`, `is_super_admin`, `has_permission`, `has_role` — todas com `SET search_path = public` (mitigação search_path hijack).
- 200 funções em `public` — auditoria exaustiva de cada uma **não realizada nesta fase**. Amostragem manual não encontrou wildcards.

## Padrão de isolamento
Template canônico (4 policies) verificado em amostra: `atendimentos`, `atendimento_exames`, `amostras`, `pacientes`, `atendimento_pagamentos`, `caixa_sessoes`, `alocacoes` — todas seguem `tenant_id = current_tenant_id() OR is_super_admin()`.

## Risco de vazamento
| Tabela crítica | RLS | Vetor residual |
|---|---|---|
| `pacientes` | 4 policies canônicas | Nenhum via RLS. Vetor = super_admin ou service-role |
| `atendimentos` | 4 policies | idem |
| `integration_credentials` | 4 policies | Cifradas — service-role decifra |
| `tenant_registry` | Super-admin-only | Vetor = super-admin comprometido |
| `platform_audit` | Super-admin-only | idem |

## Achados
| # | Item | Severidade |
|---|---|---|
| R01 | `documento_templates.doc_templates_demo_anon_select` — anon SELECT em templates | ALTO (revisar) |
| R02 | Auditoria exaustiva das 200 funções SECURITY DEFINER não concluída | INCONCLUSIVO |
| R03 | GRANTs por tabela não auditados 1-a-1 (amostragem passou) | INCONCLUSIVO |
| R04 | Nenhuma tabela sem RLS encontrada | INFORMATIVO |
