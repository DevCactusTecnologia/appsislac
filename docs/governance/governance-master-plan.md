# SISLAC — Plano de Governança (24 meses)

## Princípios

1. **Olhou. Entendeu. Manteve.** — Refator só quando há ganho mensurável.
2. **Toda nova policy/RPC/trigger/edge-function exige documentação.** — Caso contrário, PR é rejeitado.
3. **Frontend nunca confia em `tenant_id` do cliente.** — Sempre `current_tenant_id()`.
4. **Roles via `user_roles`. Nunca em `profiles` ou `users`.**
5. **Auditoria por domínio quando o volume/significado justificar.**

## Categoria A — NUNCA alterar
| Item | Razão |
|---|---|
| `current_tenant_id()`, `has_role()`, `has_permission()`, `is_super_admin()` | SSOT de autorização — RLS, RPCs e edge functions dependem |
| `user_roles` separado de `profiles` | Mitigação de privilege escalation |
| Modelo de auditoria split (10 tabelas) | RLS distinta por domínio; volumes distintos |
| `tenant_registry.database_strategy` permanecendo em banco shared | Roteamento dinâmico depende disso |
| `tenants`, `profiles`, `user_roles`, billing, audit cross-tenant em banco shared | Mesmo em modo dedicated, esses **não migram** |
| RLS em 100% das tabelas | Não negociável |
| Edge functions `super-admin-*` com service-role + revalidação `is_super_admin` | Control plane auditado |

## Categoria B — Pode evoluir
- Adicionar tabelas de domínio com `tenant_id` + 4 policies + `set_updated_at_timestamp()` + `audit_trigger`.
- Adicionar edge functions seguindo o pattern.
- Adicionar RPCs `<dominio>_<acao>_tx` para mutações multi-step.
- Adicionar providers de integração via `src/integrations/providers/registry.ts`.

## Categoria C — Consolidar (planejado)

### P1 (próximas 4 semanas)
- [ ] Remover policies duplicadas: `audit_logs` (legada), `cities` (uma das duas `USING(true)`).
- [ ] Remover triggers de auditoria duplicados em `atendimentos`, `atendimento_exames`, `atendimento_pagamentos`, `app_settings`.
- [ ] Padronizar nomenclatura de policies em `comprovante_links`.

### P2 (próximos 3 meses)
- [ ] Quebrar `create_atendimento_tx` em pipeline nomeado (`validate → assign_protocolo → insert_exames → snapshot → insert_pagamentos → recompute`).
- [ ] Idem para `update_atendimento_tx`.
- [ ] Renomear `touch_app_settings_updated_at()` → `set_updated_at_timestamp()`; migrar triggers usando-a.
- [ ] Consolidar variantes `touch_*_updated_at` na função genérica.
- [ ] SSOT do `plano` (decidir `tenants.plano` vs `tenant_subscriptions_billing.plano_atual`).

### P3 (próximos 12 meses)
- [ ] Avaliar consolidação `upload-image|pdf|assinatura` → `upload-storage`.
- [ ] Avaliar consolidação `image-url|assinatura-url|integration-pdf-url` → `signed-url`.
- [ ] Particionar `audit_logs` / `atendimento_audit` por mês se volume crescer >10M linhas.
- [ ] Implementar pipeline de migration para tenants `dedicated` (Fase 2 multi-db).
- [ ] Streaming em `super-admin-tenant-backup` se tenants ultrapassarem 1GB.

## Categoria D — REMOVER
- Função SQL `_import_legacy_exec` — marcar `DEPRECATED`, remover após confirmar 0 chamadas.

## Categoria E — DOCUMENTAR obrigatoriamente
- Toda nova tabela: entrada em `docs/governance/database-catalog.md` com classe Shared/Dedicated/SuperAdmin.
- Toda nova RPC: entrada em `docs/governance/rpcs-catalog.md` com I/O + tabelas afetadas.
- Toda nova edge function: entrada em `docs/governance/edge-functions-catalog.md`.
- Toda decisão de não-consolidação: ADR em `docs/architecture/`.

## Regra de PR (proposta)

```yaml
# .github/PULL_REQUEST_TEMPLATE.md
## Checklist de Governança
- [ ] Sem nova policy/RPC/trigger/edge-function SEM entrada em catalog
- [ ] Sem nova tabela de domínio sem `tenant_id NOT NULL` + RLS + 4 policies
- [ ] Sem `tenant_id` enviado do frontend
- [ ] Sem role armazenada em `profiles`/`users`
- [ ] Toda mutação sensível tem `audit_trigger`
```

## Métricas de saúde (revisar trimestralmente)

| KPI | Atual | Meta |
|---|---:|---:|
| Tabelas sem RLS | 0 | 0 |
| Policies duplicadas | 3 | 0 |
| Triggers de auditoria duplicados | ~10 | 0 |
| Funções `touch_*_updated_at` variantes | 75 | 1 |
| Edge functions sem doc | 0 | 0 |
| RPCs com responsabilidade única | ~95% | 100% |
| Tabelas sem entrada em catalog | 0 | 0 |

## Calendário sugerido
- **Mês 1:** P1 completo.
- **Mês 2-4:** P2 (pipeline de atendimento + consolidação `updated_at`).
- **Mês 5-12:** P3 conforme necessidade.
- **Mês 12-24:** Fase 2 multi-db (provisionamento dedicated real).
