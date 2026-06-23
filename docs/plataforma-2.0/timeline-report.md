# Plataforma 2.0 — Fase 4: Linha do Tempo

## 2026-04 — Fundação (89 migrations)
- Bootstrap inicial (`20260417003409`): roles, profiles, RLS base.
- Multi-tenant (`20260417020426`): tabela `tenants`, `current_tenant_id()`, isolamento via JWT.
- Catálogos primários: exames, materiais, especialistas, unidades, setores.
- Implantação de `has_role()` + `user_roles` (security definer).

## 2026-05 — Evoluções estruturais (107 migrations)
- Estoque 2.0: lotes, validade, fornecedores.
- Equipe 2.0/2.1: signatures, perfis, hardening.
- Financeiro 2.0: caixa_sessoes, competências, A/R.
- Convênios 2.0: faturas, glosas, reapresentação.
- Soroteca 2.0: amostras, alocações, empréstimos.

## 2026-06 — Hardening e módulos 2.x (96 migrations)
- WhatsApp 2.0: outbox + dispatcher + templates (`20260622164235` removeu legado).
- Soroteca 2.1: hardening operacional, expurgo, timeline.
- Exames 2.1 (`20260623115853`): cleanup — 21 colunas mortas removidas, 3 colunas de interface readiness adicionadas.
- Exames 2.2 (`20260623123400`): desacoplamento do layout científico para `exame_layouts`.
- Exames 2.3 (`20260623133636` + `20260623135452`): material como FK; DROP de colunas texto; rewrite de 6 views + 3 RPCs.
- Exames 2.4: auditoria final (somente leitura, sem migration).

## Marcos estruturais
1. **17-abr-2026** — multi-tenant ativo (corte arquitetural).
2. **mai-2026** — três módulos críticos reescritos (estoque/equipe/financeiro).
3. **22-jun-2026** — WhatsApp legado removido.
4. **23-jun-2026** — Exames 2.x sela o domínio operacional (SSOT material + layout desacoplado).
