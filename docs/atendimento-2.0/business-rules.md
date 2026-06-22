# Atendimento 2.0 — Fase 1.4 — Regras de Negócio

> Para cada regra: descrição, **onde vive** (Banco / Trigger / RPC / Edge / Frontend / Store) e observação.

## 1. Novo Atendimento
| Regra | Onde vive |
|---|---|
| Protocolo único e sequencial por tenant | RPC `atendimento_assign_protocolo` + `protocolo_sequence` + trigger `protect_atendimento_protocolo` (Banco) |
| Snapshot de paciente (nome/CPF/nascimento) gravado no atendimento | RPC `create_atendimento_tx` |
| RBAC `criar_atendimento` revalidado server-side | Edge `create-atendimento` (1.b) + RLS |
| Linha de exame nasce com status `pendente` | RPC `create_atendimento_tx` |
| Snapshot terceirização (tipo_processo, lab_apoio_id) | Trigger `snapshot_exame_terceirizado` |
| Snapshot regulatório (metodologia, unidade) | Trigger `atendimento_exames_snapshot_regulatorio` |
| Pagamento inicial vinculado a caixa aberta | Trigger `attach_pagamento_to_caixa` |

## 2. Complementação (adicionar exame ao atendimento existente)
| Regra | Onde vive |
|---|---|
| Permitida enquanto atendimento não estiver em estado terminal | Frontend (`atendimentoPolicy`) + RBAC `editar_atendimento` |
| Após terminal: justificativa obrigatória | RPC `set_audit_justificativa` + trigger `require_justificativa_pos_finalizacao` |
| Recalcula status agregado e totais | Triggers `recompute_status_on_exame` + `recompute_totais_on_exame` |

## 3. Cancelamento
| Regra | Onde vive |
|---|---|
| Motivo escolhido em `motivos_cancelamento` (catálogo) | Frontend + Banco |
| Permissão `cancelar_atendimento` | RLS + Edge `update-atendimento` |
| Estado terminal — mutações posteriores exigem justificativa | Trigger `require_justificativa_pos_finalizacao` |
| Pagamentos não são deletados — exigem **estorno formal** | Trigger `block_delete_use_estorno` (Financeiro 2.0) |

## 4. Recoleta
| Regra | Onde vive |
|---|---|
| Motivo obrigatório (sistema ou tenant) | Tabela `recoletas_motivos` + RPC `ensure_recoleta_motivo_nome` |
| Vincula nova amostra ao exame | `recoletasStore` |
| Motivos de sistema protegidos contra alteração | Trigger `protect_recoletas_motivos_sistema` |
| Seed automático no provisionamento | RPC `seed_default_recoletas_motivos_for_tenant` |

## 5. Pendência
| Regra | Onde vive |
|---|---|
| Exame fica em `pendente` até coleta efetiva | Frontend + RPC `update_atendimento_exame_tx` |
| Atendimento "Pedido Realizado" enquanto não houver coleta | Trigger `recompute_atendimento_status` |
| Painel de pendências derivado de `atendimentos_page` | RPC `atendimentos_page` + KPIs |

## 6. Crítico
| Regra | Onde vive |
|---|---|
| Detecção sugerida pelo runtime do layout (faixa fora do VR + flag CRITICO) | `src/lib/criticoChecker.ts` (Frontend) |
| Comunicação obrigatória registrada | Tabela `criticos_comunicacoes` + `RegistrarCriticoDialog` |
| Trilha encaminhada à auditoria operacional | Trigger `fwd_criticos_comunicacoes_to_operational` |
| Pipeline de validação na liberação | `ResultadoDetalhe/services/criticoPipeline.ts` |

## 7. Urgência
| Regra | Onde vive |
|---|---|
| Marcação por exame (campo no catálogo / atendimento) | `exames_catalogo` / `atendimento_exames` |
| Reflete em filtros e ordenação dos painéis | Frontend (Resultados, Mapa, Producao) |

## 8. Liberação
| Regra | Onde vive |
|---|---|
| Permissão `liberar_resultado` | RLS + trigger `atendimento_exames_rbac_check` |
| Exige assinatura, layout válido, snapshots congelados | Frontend (`ResultadoDetalhe`) + triggers de snapshot |
| `data_liberacao` setada no exame | RPC `update_atendimento_exame_tx` |
| Atendimento agregado vai a "Resultado Liberado" | Trigger `recompute_atendimento_status` |

## 9. Retificação
| Regra | Onde vive |
|---|---|
| Permitida apenas após liberação | Frontend (`ResultadoDetalhe`) |
| Exige justificativa | RPC `set_audit_justificativa` + trigger `require_justificativa_pos_finalizacao` |
| `retificado=true`, `retificado_at=now` | Banco (coluna) |
| Status agregado vai para "Em Retificação" → "Retificado" | Trigger `recompute_atendimento_status` |
| Trilha completa em `atendimento_audit` | Triggers `audit_atendimento_exames` + `trg_audit_atendimento_exames` |

## 10. Entrega
| Regra | Onde vive |
|---|---|
| Identidade confirmada antes da entrega | `ConfirmarIdentidadeDialog` → `identidade_confirmacoes` |
| Orientações exibidas e marcadas | `RegistrarOrientacoesDialog` → `orientacoes_entregues` |
| Entrega registrada (canal, responsável) | `RegistrarEntregaDialog` → `resultados_entregas` |
| Comprovantes via shortlink | Edge `comprovante-shortlink` + tabela `comprovante_links` |

## 11. Auditoria transversal
| Regra | Onde vive |
|---|---|
| Toda mutação cria linha em `audit_logs` | Trigger genérico `audit_trigger` |
| Mutações de atendimento criam linha em `atendimento_audit` (com diff) | Triggers `audit_atendimento_*` |
| Operacional consolidado em `operational_audit` | Trigger `fwd_atendimento_audit_to_operational` |
| Pós-finalização exige justificativa | Trigger `require_justificativa_pos_finalizacao` |

## 12. Tenant isolation
- `tenant_id` em todas as tabelas, resolvido por `current_tenant_id()`.
- Frontend nunca envia `tenant_id`.
- 4 policies (SELECT/INSERT/UPDATE/DELETE) por tabela operacional, condicionadas a `has_permission()`.

— FIM —
