# Plataforma 2.0 — Fase 8: Auditoria de Triggers

**Totais:** 192 triggers distintos por (tabela, nome) — 294 entradas em `information_schema.triggers` (multi-evento conta repetido) — 182 nomes únicos.

## Padrões dominantes

| Padrão | Qtd ≈ | Função |
|--------|------:|--------|
| `update_*_updated_at` / `set_updated_at_*` | ~60 | Atualiza `updated_at` em UPDATE. Padrão consistente. |
| `audit_*` / `*_audit_trg` | ~22 | Auditoria de mudança (`atendimentos`, `atendimento_exames`, `pagamentos`, `convenio_competencias`, `convenio_glosas`, `app_settings`). |
| `fwd_*` | ~8 | Forwarders entre tabelas de auditoria → `operational_audit` / `platform_audit`. |
| Guards (`guard_*`, `block_*`) | ~10 | Bloqueio de updates em competências fechadas, friendly_id imutável, deletes que exigem estorno. |
| Sequence/Assign (`*_assign_*`, `*_sign_*`) | ~10 | Atribuição de protocolos/códigos antes de INSERT. |
| Snapshot regulatório | 2 | `atendimento_exames_snapshot_regulatorio`, `atendimento_exames_rbac_check`. |
| Domínio (estoque/soroteca/financeiro/whatsapp) | ~80 | Triggers de negócio específicos. |

## Triggers redundantes / suspeitos

| Trigger | Observação |
|---------|------------|
| Triggers `update_updated_at_column` aplicados em tabelas sem coluna mutável → não detectado, padrão íntegro. |
| `audit_trigger` (genérica) vs `audit_atendimentos`/`audit_atendimento_exames` — possível redundância para a mesma tabela. |
| `fwd_legacy_dict_to_select_options` — utilizado em tabelas de dicionário legadas; verificar se origem ainda existe. |
| `sync_amostra_tipo_material` — **JÁ REMOVIDO** na fase Exames 2.3. Confirmar via `pg_trigger` que não restou stub. |

## Triggers duplicados

Nenhum par `(tabela, evento, função)` idêntico detectado. As 294 entradas refletem triggers com múltiplos eventos (BEFORE INSERT OR UPDATE).

## Triggers mortos

Nenhum confirmado. Tudo o que se referia a colunas dropadas em Exames 2.1/2.3 foi removido junto.

## Recomendação
Padrão saudável. Auditoria fina de `audit_trigger` genérico vs. específicos é a única oportunidade real (sem ação nesta fase).
