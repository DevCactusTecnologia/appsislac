# SISLAC — Security Hardening Master Plan (Phase 10)

**Data:** 2026-06-15. **Plano somente.** Nenhuma alteração de código, policy, edge function, RPC, banco, auth ou RLS.

Prioridades:
- **P0** — Segurança crítica (corrigir já)
- **P1** — Clareza estrutural
- **P2** — Simplificação
- **P3** — Otimização

---

## P0 — Segurança

Após o hardening de 2026-06-15 (DOMPurify, HIBP, anti-escalation `super_admin`, `tenant_payment_gateways` RBAC, função `search_path`, revogação `EXECUTE` para `PUBLIC`/`anon`, remoção de `admin_senha_hash`, fechamento de `inscricoes` para `anon`), **não foram identificados itens P0 abertos** nesta auditoria.

Acompanhamento P0 contínuo (sem ação imediata):
- **P0-W1.** Garantir que `current_tenant_id()` priorize `profiles.tenant_id` em vez de claims do JWT (revisão de definição da função em manutenção futura).
- **P0-W2.** Revisar `solicitacoes_publicas` INSERT policy para garantir que `tenant_id` enviado pelo `anon` é validado contra uma whitelist resolvida pelo `tenant-resolve` (defesa em profundidade).

---

## P1 — Clareza

- **P1-1.** Quebrar `create_atendimento_tx` / `update_atendimento_tx` em steps nomeados (`Validate→Price→Persist→Invoice→Audit→Notify`) dentro de uma única transação. Inspiração: Laravel Pipes.
- **P1-2.** Investigar e remover sobreposição de triggers de auditoria em `app_settings` (`audit_app_settings` × `audit_app_settings_trigger`).
- **P1-3.** Decidir SSOT do campo `plano` do tenant: manter apenas em `tenant_subscriptions_billing` e remover do payload de `super-admin-update-tenant`.

---

## P2 — Simplificação

- **P2-1.** Criar helper `can_access_tenant_row(uid, perms[])` SECURITY DEFINER e reescrever ~36 policies amarelas.
- **P2-2.** Criar `supabase/functions/_shared/auth.ts` com `requireSuperAdmin`, `requireRoleInTenant`, `auditAction`. Refatorar 16 funções `super-admin-*` + 3 `admin-*`.
- **P2-3.** Consolidar uploads: `upload-image|pdf|assinatura` → `upload-asset`; `image-url|assinatura-url` → `asset-url`.
- **P2-4.** Genérico `touch_updated_at()` substituindo ~75 funções snowflake.
- **P2-5.** Consolidar `integration-test-connection` + `dbsync-test-connection`.
- **P2-6.** Avaliar invocação direta da RPC `create_atendimento_tx`/`update_atendimento_tx` pelo frontend, dispensando wrappers `create-atendimento`/`update-atendimento` se não houver lógica de orquestração extra.

---

## P3 — Otimização

- **P3-1.** Consolidar 10 tabelas de auditoria em 2 (`audit_operational`, `audit_platform`) com views compat — **alto risco, janela de manutenção**.
- **P3-2.** Adicionar `pg_stat_statements` review para identificar RPCs/funções nunca executadas.
- **P3-3.** Avaliar particionamento de `audit_logs` / `atendimento_audit` por data (volume crescente).
- **P3-4.** Stream tenant backup (`super-admin-tenant-backup`) em chunks para evitar OOM em tenants grandes.

---

## Resumo executivo do plano

| Prioridade | Itens | Esforço total |
|---|---:|---|
| P0 | 2 (monitoramento) | — |
| P1 | 3 | 1-2 sprints |
| P2 | 6 | 2-3 sprints |
| P3 | 4 | trimestre dedicado |

**Fim Fase 10.** Nada alterado.
