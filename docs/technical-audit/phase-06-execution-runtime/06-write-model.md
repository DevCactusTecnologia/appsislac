# 06 — Write Model

Quem escreve, onde escreve, e por qual caminho.

## Escritas críticas (só via RPC `*_tx`)
| Tabela | INSERT | UPDATE | DELETE |
|---|---|---|---|
| atendimentos | `create_atendimento_tx` | `update_atendimento_tx`, `cancel_atendimento_tx` | — |
| atendimento_exames | `create_atendimento_tx`, `update_atendimento_tx` | `update_atendimento_tx`, `sign_resultado_tx` | `update_atendimento_tx` |
| atendimento_pagamentos | `register_pagamento_tx` | webhook PIX (via edge) | `financeiro_estornar` |
| amostras | `move_amostra_tx` | `move_amostra_tx`, `emprestar_amostra_tx` | `expurgar_amostras_tx` |
| caixa_sessoes | `open_caixa_tx` | `close_caixa_tx` | — |
| convenio_faturas | `fechar_fatura_convenio_tx` | `fechar_fatura_convenio_tx`, `registrar_glosa_tx` | — |
| financeiro_saidas | insert direto (validado por policy) | update direto | `financeiro_estornar` |

Frontend **não faz INSERT direto** nessas tabelas (validado por `scripts/check-data-plane-routing.sh`).

## Escritas de cadastro (via supabase.from)
- `pacientes`, `convenios`, `especialistas`, `unidades`, `exames_catalogo`, `exame_parametros`, `valores_referencia`, `reguas_etarias`, `documento_templates`, etc.
- Sempre passam por RLS (policies com `has_permission`).

## Escritas por trigger (side-effect)
- `*_audit` (todas): apenas trigger `audit_<tabela>`.
- `updated_at`: trigger `set_updated_at`.
- Sequenciadores: RPCs `next_*` chamadas dentro de `*_tx`.

## Escritas por Edge Function
- Integrações: `integration_jobs`, `integration_requests`, `integration_responses`, `integration_results`, `integration_pdfs`, `integration_dead_jobs`, `provider_circuit_state`, `provider_health_metrics`.
- Super Admin: `tenant_registry`, `tenant_migration_runs`, `tenant_migration_log`, `tenant_provision_audit`.
- IA: `ai_audit`.
- Público: `inscricoes`, `solicitacoes_publicas`, `signup_attempts`, `public_rate_limits`.

## Histórico
- Sempre por trigger de auditoria → tabelas `*_audit` (padrão único).
- `amostra_movimentacoes` como histórico de negócio (não confundir com auditoria).
