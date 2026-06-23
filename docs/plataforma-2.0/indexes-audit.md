# Plataforma 2.0 — Fase 10: Índices

**Total:** 465 índices em `public`.

| Classe                | Critério            | Qtd |
|-----------------------|---------------------|----:|
| Muito utilizado       | `idx_scan` > 1 000  | ~25 |
| Utilizado             | 100 ≤ scan ≤ 1 000  | ~50 |
| Baixo uso             | 1 ≤ scan ≤ 99       | ~125 |
| Nunca utilizado       | `idx_scan` = 0      | **265** |
| **Total**             |                     | 465 |

> 57 % dos índices estão com `idx_scan = 0`. Esse número está inflado por:
> 1. **PKs de tabelas vazias** (`orcamentos`, `financeiro_saidas`, `convenio_glosas`, `convenio_faturas`, `recoletas`, etc.) — não podem ser removidos.
> 2. **UKs/UNIQUE necessários** mesmo sem leitura (`tenants_dominio_custom_uidx`, `atendimentos_protocolo_unique`).
> 3. **Bases novas** (pré-produção) — sem tráfego real ainda.

## Candidatos reais à revisão (NÃO remover sem confirmação)

| Índice | Tabela | Motivo |
|--------|--------|--------|
| `idx_atendimentos_status_at`, `idx_atendimentos_origem`, `idx_atendimentos_tenant`, `idx_atendimentos_unidade`, `idx_atendimentos_tenant_data`, `idx_atendimentos_tenant_status_data`, `idx_atendimentos_tenant_paciente`, `idx_atendimentos_tenant_cpf`, `idx_atendimentos_nome_trgm`, `idx_atendimentos_protocolo_trgm` | `atendimentos` | 10 índices, 4 linhas, 0 scans — provável over-indexing. Pode ter contagem zerada por base pequena. |
| `idx_at_pagamentos_*` (3) | `atendimento_pagamentos` | Mesmo padrão. |
| `idx_estoque_lotes_*`, `idx_estoque_insumos_*` | estoque | Tabelas zeradas em produção. |
| `idx_convenio_glosas_*` (4) | `convenio_glosas` | Tabela sem dados ainda. |
| `whatsapp_outbox_*_idx` (4) | `whatsapp_outbox` | Em base mais ativa, devem subir. |

## Conclusão
Sem decisão de remoção nesta fase. Recomenda-se reavaliar após 30 dias de produção real. **Não remover** índices com base atual zerada — base ainda imatura.
