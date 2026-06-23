# Plataforma 2.0 — Fase 3: Auditoria de Migrations

Total: **292 migrations** em `supabase/migrations/`.

## Distribuição por mês

| Mês     | Qtd | Característica dominante |
|---------|----:|--------------------------|
| 2026-04 |  89 | Fundação + bootstrap multi-tenant |
| 2026-05 | 107 | Evoluções estruturais (estoque, equipe, soroteca, financeiro 2.0) |
| 2026-06 |  96 | Hardening + módulos 2.x (WhatsApp 2.0, Soroteca 2.x, Exames 2.x) |

## Classificação estimada

| Categoria    | Qtd ≈ | Descrição |
|--------------|------:|-----------|
| Fundação     |   12  | Bootstrap (roles, profiles, tenants, RLS base, `has_role`, `current_tenant_id`) |
| Estruturais  |   75  | Criação/refatoração de tabelas de domínio (atendimentos, exames, soroteca, estoque, convênios, integrações) |
| Correções    |  120  | Hotfixes — ajuste de policies, grants, índices faltantes, defaults, search_path, NOT NULL |
| Evoluções    |   60  | Novos recursos (whatsapp, convenios 2.0, financeiro 2.0, soroteca 2.x, exames 2.x) |
| Legado       |   25  | Substituídas posteriormente — DROP/ALTER de objetos hoje inexistentes (ex.: mock seeds, colunas removidas em Exames 2.1, sync triggers removidos em Exames 2.3) |

> Classificação obtida por leitura de descritores de arquivo e análise dos verbos SQL predominantes. Sem alteração executada.

## Observações

- Mês com maior volume: **maio/2026 (107)** — corresponde aos auditos 2.0 de financeiro/estoque/equipe.
- Padrão de muitos hotfixes consecutivos (correções de RLS/grants) sugere oportunidade de consolidação em **baseline 1.0** (ver `baseline-study.md`).
- Não há migrations destrutivas órfãs sem migration de criação correspondente.
