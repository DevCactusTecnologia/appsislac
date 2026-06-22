# Atendimento 2.0 — Fase 1.6 — Segurança e Governança

## RLS / Policies

Tabelas centrais do domínio com **4 policies** (SELECT/INSERT/UPDATE/DELETE) cada, todas escopadas a `tenant_id = current_tenant_id()` e gateadas por `has_permission()`:

| Tabela | Policies | Permissões usadas |
|---|---|---|
| `atendimentos` | 4 | `editar_atendimento`, `cancelar_atendimento`, `analisar_amostra`, `liberar_resultado`, `registrar_coleta` |
| `atendimento_exames` | 4 | mesmas + `criar_atendimento` |
| `atendimento_pagamentos` | 3 | DELETE bloqueado por trigger; UPDATE/INSERT por permissão financeira |
| `amostras` | 4 | `registrar_coleta`, `analisar_amostra` |
| `recoletas` | 4 | `registrar_coleta`, `editar_atendimento` |
| `criticos_comunicacoes` | 2 | `analisar_amostra`, `liberar_resultado` |
| `resultados_entregas` | 2 | `entregar_resultado` |
| `identidade_confirmacoes` | 2 | `entregar_resultado` |
| `orientacoes_entregues` | 2 | `entregar_resultado` |
| `atendimento_audit` | 1 | leitura por admin/manager |

## RPCs críticas (SECURITY DEFINER)

| RPC | Risco | Defesas |
|---|---|---|
| `create_atendimento_tx` | Criação total — payload livre | RBAC `criar_atendimento` revalidado na edge **antes** da RPC; RPC valida `current_tenant_id`; trigger `protect_atendimento_protocolo` |
| `update_atendimento_tx` | Edição total | RBAC `editar_atendimento`/`cancelar_atendimento` na edge; trigger RBAC `atendimento_exames_rbac_check` revalida transição |
| `update_atendimento_exame_tx` | Bypass de status | Trigger `atendimento_exames_rbac_check` checa permissão por transição de status |
| `recompute_atendimento_status` | Não é exposta direto — disparada por trigger | Sem entrada de cliente |
| `set_audit_justificativa` | GUC de sessão lida pelos triggers de pós-finalização | Tolerante; sem efeito se ausente — mas trigger bloqueia mutação se faltar |

## Triggers críticos

| Trigger | Função |
|---|---|
| `atendimento_exames_rbac_check_trg` | Defesa em profundidade — recusa transições sem permissão mesmo se RPC for chamada direto |
| `trg_require_just_atex` / `trg_require_just_atpag` | Bloqueia UPDATE/DELETE pós-finalização sem `set_audit_justificativa` |
| `trg_block_delete_pagamentos` | Impede DELETE — força fluxo de estorno formal |
| `recompute_status_on_exame` / `recompute_status_on_pagamento` | Garante que status agregado é sempre consistente (cliente não consegue mentir) |
| `trg_atendimento_exames_snapshot_regulatorio` | Congela metodologia/unidade — não regride após liberação |
| `trg_snapshot_exame_terceirizado` | Congela `tipo_processo` e `lab_apoio_id` na criação |
| `protect_atendimento_protocolo` | Protege coluna `protocolo` contra UPDATE manual |
| `protect_recoletas_motivos_sistema` | Impede edição/exclusão de motivos do sistema |
| `audit_trigger` + `audit_atendimento_*` | Trilha completa em `audit_logs` e `atendimento_audit` |
| `fwd_atendimento_audit_to_operational` / `fwd_criticos_comunicacoes_to_operational` | Replicam para `operational_audit` |

## Edge Functions críticas

| Edge | Risco | Defesas |
|---|---|---|
| `create-atendimento` | Criação | JWT obrigatório; `has_permission(_user_id, 'criar_atendimento')` antes da RPC; mensagens de erro saneadas (não vazam detalhes); rollback transacional pela RPC |
| `update-atendimento` | Edição | JWT + RBAC + revalidação de tenant; rollback transacional |
| `lab-apoio-adapter` / `lab-apoio-cron-fetch` / `lab-apoio-upload-pdf` | Atualizam `atendimento_exames.status_externo`, `pdf_override_url` | RBAC + trilha em `pdf_override_audit` |
| `integration-*` | Disparam jobs e atualizam status_externo | Service-role com guarda de tenant; tudo gravado em `integration_logs` |
| `ai-suggest-exames`, `extract-requisicao-exames` | IA — somente sugestão; não escreve no domínio | Apenas leitura/output |

## Riscos identificados

| Risco | Status |
|---|---|
| Bypass de status via UPDATE direto em `atendimento_exames` | ❌ Bloqueado por `atendimento_exames_rbac_check` (trigger BEFORE UPDATE) |
| Alteração de protocolo | ❌ Bloqueado por `protect_atendimento_protocolo` |
| Mutação pós-liberação sem trilha | ❌ Bloqueado por `require_justificativa_pos_finalizacao` |
| DELETE em pagamento | ❌ Bloqueado por `block_delete_use_estorno` |
| Cliente forjar `tenant_id` | ❌ Coluna não é aceita do payload — resolvida por `current_tenant_id()` |
| Snapshot regulatório regride | ❌ Trigger congela ao salvar/finalizar |
| Permissão divergente entre RLS e Edge | ⚠ **Potencial** — Edge revalida via `has_permission`, RLS também. Defesa em profundidade mantida |
| Status externo terceirizado dessincronizado de `integration_jobs` | ⚠ Baixo — atualizado por edge; sem watchdog formal |
| Coleta sem trilha granular ("quem coletou exatamente este tubo?") | ⚠ Baixo — derivável de `audit_logs` + `amostras`, mas não materializado |

## Veredito de governança
- **Nenhum estado crítico é alterável sem trilha**.
- **Nenhuma transição é confiável apenas no frontend** — triggers RBAC repetem a checagem.
- **Auditoria está em três níveis**: `audit_logs` (genérico), `atendimento_audit` (diff por mutação), `operational_audit` (consolidado).
- O domínio está **pronto operacionalmente**; gaps são oportunidades de granularidade (coleta/produção como entidades), não de segurança.

— FIM —
