# SISLAC — Laravel vs Lovable: Security & Domain Comparison (Phase 9)

**Data:** 2026-06-15. Somente leitura. Complementa `docs/audits/laravel-vs-lovable-comparativo.md` com foco em **segurança e domínio**.

---

## 1. Permissões

| Eixo | Laravel SISLAC | Lovable SISLAC |
|---|---|---|
| Storage | `users.permissions` (string serializada) | `user_roles` (tabela dedicada, enum `app_role`) |
| Check | `Sentinel::hasPermission(...)` em controllers | `has_permission(uid, perm)` em **RLS** + frontend |
| Risco | privilege escalation por mass-assign | mitigado: roles em tabela separada com policy anti-escalation |

**Laravel é mais simples**, Lovable é **mais seguro**. Manter Lovable.

---

## 2. Papéis

| | Laravel | Lovable |
|---|---|---|
| Modelagem | `roles` + pivô | `user_roles` + enum |
| Hierarquia | nenhuma | `super_admin > admin > manager > user` |
| Multi-tenant | inexistente (single-lab) | papéis com escopo de tenant |

---

## 3. Fluxos

| Fluxo | Laravel | Lovable |
|---|---|---|
| Criar atendimento | Pipeline de 6 classes (`Store→Save→Check→Finish→Show→Print`) | 1 RPC monolítica `create_atendimento_tx` |
| Resultado | Trait `ContentPdf` (~1000 linhas) | `documentoRenderer.ts` + `laudoResolver.ts` (modular) |
| Pagamento | `transactions` simples | `atendimento_pagamentos` + saldo derivado |
| Auditoria | 1 tabela (`routine_traceabilities`) | 10 tabelas especializadas |

**Laravel ensina:** pipeline explícito + 1 tabela de auditoria.

---

## 4. Domínio

| | Laravel | Lovable |
|---|---|---|
| Tabelas | 52 | 97 |
| Tabelas de auditoria | 1 | 10 |
| Tabelas de integração | 1 (vazia) | 17 (Hermes/DBSync reais) |
| Parâmetros de exame | 1 (`new_parameter`) | 4 (`exame_parametros`, `valores_referencia`, `reguas_etarias`, `valores_referencia`) |

---

## 5. Clareza ("olhou, entendeu?")

| Item | Veredito |
|---|---|
| Policies simples (~85%) | 🟢 olhou, entendeu |
| Policies com 4-6 OR de permissions | 🟡 funciona, leitura demora |
| `create_atendimento_tx` | 🟡 entendeu, com tempo |
| 10 tabelas de auditoria | 🔴 não entendeu sem ler doc |
| `super-admin-*` (16 funções) | 🟢 olhou, entendeu |

---

## 6. O que o Laravel faz mais simples (e por quê)

| Item Laravel | Por que mais simples | Por que Lovable não pode copiar literal |
|---|---|---|
| `users.permissions text` | 1 lookup | Vulnerável a escalation; Lovable é SaaS multi-tenant |
| 1 tabela de auditoria | 1 leitor | Lovable precisa separar plataforma vs operacional por compliance, mas 10 é excessivo (consolidar em 2) |
| Pipeline Pipes | testável | Lovable pode adotar dentro da RPC com `PERFORM step_x(...)` |
| Sem RLS | rapidez | Lovable não pode abrir mão — é base do isolamento multi-tenant |
| Sem rate-limit | simplicidade | Inaceitável em SaaS público |

---

## 7. Veredito

- **Segurança:** Lovable está claramente mais avançado. **Não copiar Laravel aqui.**
- **Clareza de domínio:** Laravel ganha em pipeline e auditoria. **Adotar parcialmente** (P1 e P3 em `complexity-reduction-opportunities.md`).
- **Multi-tenant:** Laravel não tem. **Não comparável.**

**Fim Fase 9.** Nada alterado.
