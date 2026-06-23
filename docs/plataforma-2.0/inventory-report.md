# Plataforma 2.0 — Fase 1: Inventário Completo

**Modo:** somente leitura. Nenhuma alteração executada.
**Data da auditoria:** 2026-06-23

## Totais

| Objeto                          | Quantidade |
|---------------------------------|-----------:|
| Tabelas (`public`)              | 116        |
| Views (`public`)                | 13         |
| Funções/RPCs (`public`)         | 190        |
| Triggers (não-internos)         | 192 (294 entradas em `information_schema.triggers` contando múltiplos eventos) |
| Policies RLS                    | 366        |
| Índices                         | 465        |
| Migrations                      | 292        |
| Tamanho do banco                | 47 MB      |

## Top 15 tabelas por tamanho

| Tabela                  | Tamanho  | Linhas |
|-------------------------|---------:|------:|
| audit_logs              | 8.4 MB   | 6 020 |
| operational_audit       | 7.4 MB   | 6 025 |
| pacientes               | 3.5 MB   | 2 236 |
| documento_templates     | 1.6 MB   | 6     |
| cities                  | 1.3 MB   | 5 570 |
| atendimento_audit       | 1.1 MB   | 428   |
| exames_catalogo         | 656 kB   | 441   |
| atendimentos            | 448 kB   | 4     |
| exame_layouts           | 408 kB   | 441   |
| atendimento_exames      | 280 kB   | 14    |
| tabela_preco_itens      | 256 kB   | 441   |
| amostras                | 208 kB   | 19    |
| especialistas           | 192 kB   | 266   |
| select_options          | 168 kB   | 67    |
| tenants                 | 136 kB   | 1     |

## Views (13)

`convenio_competencia_resumo`, `convenio_fatura_resumo`, `exames_publicos_view`, `financeiro_entradas`, `platform_health_aggregate`, `provider_health_current`, `tenant_public`, `unidades_publicas`, `vw_coleta_diaria`, `vw_coletas_operacionais`, `vw_liberacao_diaria`, `vw_producao_diaria`, `vw_producao_operacional`.

## RPCs (190 funções)

Distribuídas em: tenancy (`current_tenant_id`, `is_super_admin`, `has_role`, `has_permission`), atendimento (`atendimentos_page`, `create_atendimento_tx`, `dashboard_metrics`), financeiro (`financeiro_a_receber_v2`, `caixa_abrir/fechar`, `competencia_*`, `convenio_fatura_*`), soroteca (`gerar_codigo_amostra`, `mover_amostra`, `marcar_amostras_vencidas`), integrações (`circuit_*`, `claim_integration_jobs`, `health_record_sample`), estoque (`estoque_aplicar_movimentacao`, `estoque_marcar_lotes_vencidos`), auditoria (`audit_*`, `fwd_*`), whatsapp (`enqueue_whatsapp`), e utilitários (`cnpj_digits`, `next_friendly_id`, `generate_protocolo_sequencial`).

## Consumo a partir do frontend
- `.rpc(...)` distintos referenciados em `src/`: **34**.
- Demais funções são triggers internos, helpers ou consumidas por edge functions / cron.

> Inventário detalhado por consumidor está nos arquivos seguintes (orphan-tables, orphan-views, orphan-rpcs).
