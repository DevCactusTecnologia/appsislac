# 03 — Relationship Map

## Números
- **147** FKs (`information_schema.referential_constraints`).
- 116/119 tabelas carregam `tenant_id` (relacionamento lógico com `tenants`, **não modelado como FK** — decisão do multi-tenant para permitir dicionários globais e evitar cascatas).

## Hubs (tabelas mais referenciadas por FKs)
| Tabela | FKs saindo | Papel |
|---|---:|---|
| `atendimento_exames` | 8 | Linha central do fluxo clínico |
| `amostras` | 6 | Rastreabilidade |
| `amostra_emprestimos` | 6 | Movimentação entre unidades |
| `exames_catalogo` | 4 | Catálogo de exames |
| `atendimento_pagamentos` | 3 | Financeiro |
| `mapa_exames` | 3 | Agrupamento operacional |
| `valores_referencia` | 3 | Referência clínica |
| `convenio_fatura_itens` | 3 | Faturamento |
| `convenio_faturas` | 3 | Faturamento |
| `convenio_glosas` | 3 | Glosas |
| `estoque_lotes`, `estoque_movimentacoes` | 3 | Estoque |
| `criticos_comunicacoes` | 3 | Comunicação crítica |
| `resultados_entregas` | 3 | Entrega de laudo |

## Cadeias principais

### Cadeia clínica (obrigatória)
```
pacientes 1─N atendimentos 1─N atendimento_exames N─1 exames_catalogo
                                       │
                                       ├─ N─1 exame_parametros (via exame_id)
                                       ├─ 1─N amostras
                                       ├─ 1─N recoletas
                                       ├─ 1─N criticos_comunicacoes
                                       └─ 1─N resultados_entregas
```

### Cadeia amostra
```
atendimento_exames 1─N amostras 1─N amostra_alocacoes N─1 posicoes_galeria N─1 galerias
                             1─N amostra_movimentacoes
                             1─N amostra_emprestimos
                             1─N expurgo_itens N─1 expurgo_lotes
```

### Cadeia financeira
```
atendimentos 1─N atendimento_pagamentos
caixa_sessoes 1─N (financeiro_saidas | financeiro_estornos)
convenios 1─N convenio_competencias 1─N convenio_faturas 1─N convenio_fatura_itens N─1 atendimento_exames
                                                              1─N convenio_glosas
```

### Cadeia catálogo (configuração)
```
exames_catalogo 1─N exame_parametros
                1─N exame_layouts
                1─N exame_pops
                1─N valores_referencia N─1 reguas_etarias
                1─N mapa_exames N─1 mapas_trabalho
```

### Cadeia integração
```
integrations 1─N integration_jobs 1─N (integration_requests, integration_responses, integration_results, integration_pdfs)
             1─N integration_dead_jobs
             1─N integration_exam_map N─1 exames_catalogo
             1─N integration_sync_state
integration_provider_exams 1─N integration_provider_exam_params
                          1─N integration_provider_exam_refs
```

### Cadeia plataforma
```
tenants 1─1 tenant_registry
        1─1 tenant_lab_config
        1─1 tenant_settings_public
        1─N tenant_subscriptions 1─N tenant_subscriptions_billing
        1─N tenant_pages
        1─N tenant_migration_runs 1─N tenant_migration_log
        1─N profiles N─1 auth.users
        1─N user_roles N─1 auth.users
```

## Classificação dos relacionamentos

| Tipo | Exemplos |
|---|---|
| **Obrigatório de domínio** | `atendimento_exames.atendimento_id`, `.exame_id`; `amostras.atendimento_exame_id`; `valores_referencia.exame_id` |
| **Opcional de domínio** | `atendimentos.especialista_id`, `.convenio_id` (particular = sem convênio); `atendimento_exames.terceirizado_id` |
| **Histórico** | `atendimento_pagamentos`, `amostra_movimentacoes`, `resultados_entregas`, `criticos_comunicacoes`, `subscription_changes_log` |
| **Auditoria** | Todas as `*_audit`, `audit_logs`, `platform_audit`, `pdf_override_audit`, `storage_audit`, `tenant_provision_audit`, `tenant_migration_log` |
| **Infraestrutura** | `friendly_id_counters`, `protocolo_sequence`, `guia_sequence`, `amostra_sequence`, `cron_health`, `comprovante_links`, `public_rate_limits`, `tenant_rate_limit` |
| **Lógico (sem FK)** | `tenant_id` em 116 tabelas — isolamento validado por RLS, não por FK |

## Observação
Não existem relacionamentos M-N via junction table explícita além dos naturais (`atendimento_exames` é a junção entre `atendimentos` e `exames_catalogo`; `mapa_exames` entre `mapas_trabalho` e `exames_catalogo`; `orcamento_exames` entre `orcamentos` e `exames_catalogo`).
