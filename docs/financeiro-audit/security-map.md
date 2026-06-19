# Mapa de Segurança — Financeiro

Multi-tenant via `tenant_id = current_tenant_id()` em todas as policies. `is_super_admin()` bypass platform.

## RLS por tabela

### `atendimento_pagamentos`
| Cmd | Quem |
|-----|------|
| SELECT | super_admin OU (mesmo tenant E (`visualizar_atendimentos` OU `visualizar_financeiro`)) |
| INSERT | mesmo tenant E `registrar_pagamento` |
| UPDATE | mesmo tenant E `registrar_pagamento` |
| DELETE | super_admin OU (mesmo tenant E role `admin`) |

### `convenio_faturas`
| Cmd | Quem |
|-----|------|
| SELECT | super_admin OU (mesmo tenant E `visualizar_financeiro`) |
| INSERT | mesmo tenant E `gestao_financeira` |
| UPDATE | mesmo tenant E `gestao_financeira` (+ trigger `protect_convenio_fatura_paga`) |
| DELETE | mesmo tenant E role `admin` |

### `convenio_fatura_itens`
| Cmd | Quem |
|-----|------|
| SELECT | super_admin OU (mesmo tenant E `visualizar_financeiro`) |
| INSERT/UPDATE | mesmo tenant E `gestao_financeira` |
| DELETE | mesmo tenant E role `admin` |

### `convenios`
| Cmd | Quem |
|-----|------|
| SELECT | super_admin OU mesmo tenant |
| INSERT/UPDATE/DELETE | mesmo tenant E role `admin` |

### `financeiro_saidas`
| Cmd | Quem |
|-----|------|
| SELECT | super_admin OU (mesmo tenant E `visualizar_financeiro`) |
| INSERT | mesmo tenant E `gestao_financeira` |
| UPDATE | mesmo tenant E `gestao_financeira` |
| DELETE | mesmo tenant E role `admin` |

### `financeiro_destinos_pagamento`, `financeiro_formas_pagamento`, `financeiro_tipos_despesa` (legados)
| Cmd | Quem |
|-----|------|
| SELECT/INSERT/UPDATE/DELETE | mesmo tenant OU super_admin |

> Nota: o código não usa estas tabelas hoje (lê de `select_options`). RLS está aberta para qualquer usuário autenticado do tenant.

### `select_options` (categorias `financeiro_*`)
- Acesso de leitura geral autenticado.
- Escrita exige `gestao_financeira` (RLS específica por categoria, migration `20260613_select_options_per_category_rls`).

### `orcamentos`, `orcamento_exames`
- SELECT: tenant + permissão `visualizar_orcamentos`.
- INSERT/UPDATE: tenant + `criar_orcamento`.
- DELETE: admin do tenant.

## Permissões (vista funcional)

| Permissão | Concedida por padrão a | Habilita |
|-----------|------------------------|----------|
| `visualizar_financeiro` | admin, manager, financeiro | Abas Entradas/Saídas/A Receber/Caixa |
| `gestao_financeira` | admin, manager, financeiro | CRUD saídas, fechar/cancelar fatura, gerir dicionários |
| `registrar_pagamento` | admin, manager, recepção, financeiro | Lançar pagamentos em atendimento |
| `visualizar_atendimentos` | quase todos os perfis operacionais | Ver linhas de pagamento (entradas tipo `pagamento`) |

## Quem pode fazer o quê (resposta direta)

| Ação | Roles típicas |
|------|---------------|
| Visualizar Entradas/Saídas/Caixa/A Receber | admin, manager, financeiro (qualquer um com `visualizar_financeiro`) |
| Lançar pagamento em atendimento | recepção, financeiro, manager, admin |
| Lançar saída/despesa | financeiro, manager, admin |
| Editar saída/despesa | financeiro, manager, admin |
| Excluir saída/despesa | apenas admin |
| Fechar fatura de convênio | financeiro, manager, admin |
| Marcar fatura como paga | financeiro, manager, admin (uma vez `paga`, trigger trava) |
| Cancelar fatura | financeiro, manager, admin (antes de `paga`) |
| Excluir fatura | apenas admin |
| Estornar/excluir pagamento | apenas admin |
| Fechar caixa | **N/A — não existe operação de fechamento** |
| Editar dicionários financeiros | qualquer um com `gestao_financeira` |
| Cadastrar/editar convênio | apenas admin |

## Auditoria

- `audit_atendimento_pagamentos` (trigger) → `atendimento_audit`.
- `protect_*` triggers bloqueiam adulteração de protocolo após emissão.
- Não há trigger de auditoria em `financeiro_saidas` nem em `convenio_faturas` (apenas `touch_convenio_faturas_updated_at`).
