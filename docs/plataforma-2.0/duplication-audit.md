# Plataforma 2.0 — Fase 12: Duplicações

## Duplicações estruturais detectadas

| Tema | Locais | Diagnóstico |
|------|--------|-------------|
| **Auditoria** | `audit_logs`, `operational_audit`, `platform_audit`, `financeiro_audit`, `atendimento_audit`, `app_settings_audit`, `pdf_override_audit`, `protocolo_auditoria`, `storage_audit`, `tenant_provision_audit` | 10 tabelas + 8 forwarders (`fwd_*`). Há **split intencional** (operational vs platform), porém com **redundância real**: `atendimento_audit` é forwarded para `operational_audit`, criando dupla escrita. Documentar e considerar consolidação futura. |
| **Categoria do exame** | `exames_catalogo.categoria` (text) + `exames_catalogo.setor_id` (FK → `setores_laboratoriais`) | Já documentado em Exames 2.4. Texto livre coexiste com FK; em produção `categoria` tem 1 valor distinto. **Candidato a depreciar** (não removido). |
| **Exames públicos** | tabela `exames_publicos` + view `exames_publicos_view` | View deriva do catálogo; tabela parece materialização legada. Verificar se a tabela ainda é populada. |
| **Rate limit** | `tenant_rate_limit`, `public_rate_limits` | Propósitos distintos (tenant vs endpoint público). Sem duplicação real — manter. |
| **Sequências** | `friendly_id_counters`, `guia_sequence`, `protocolo_sequence`, `amostra_sequence` | Cada uma com escopo próprio. Sem duplicação. |
| **Pagamentos x estornos** | `atendimento_pagamentos` + `financeiro_estornos` | Tabelas distintas com integridade via `block_delete_use_estorno`. OK. |

## Domínios sem duplicação (confirmados pelos auditos 2.x)

| Domínio | SSOT |
|---------|------|
| Materiais | `materiais_amostra` (Exames 2.3) |
| Setores | `setores_laboratoriais` |
| Unidades | `unidades` |
| Profissionais | `especialistas` + `profiles` + `user_roles` (uso distinto) |
| Convênios | `convenios` |
| Pacientes | `pacientes` |

## Dupla fonte de verdade real

1. **Auditoria** — sim, parcial, por desenho histórico (forwarders).
2. **`exames_catalogo.categoria` ↔ `setor_id`** — sim, cosmético (já documentado).
3. **`exames_publicos` (tabela) ↔ `exames_publicos_view`** — possível, requer investigação.

## Conclusão
Plataforma com **baixa duplicação estrutural**. Os 3 pontos acima são conhecidos e auditados. Sem ação nesta fase.
