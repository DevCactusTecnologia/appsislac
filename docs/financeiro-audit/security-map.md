# Mapa de Segurança — Financeiro SISLAC

> Levantamento de RLS, policies e permissões reais do banco. Roles são `super_admin` (plataforma), `admin` / `manager` / `user` (tenant). Permissões são strings checadas por `has_permission(_user_id, _permission)`.

## Permissões usadas pelo módulo

| Permissão | Onde |
|---|---|
| `visualizar_financeiro` | SELECT em `financeiro_saidas`, `convenio_faturas`, `convenio_fatura_itens`, `atendimento_pagamentos`. Habilita aba Integrações. |
| `gestao_financeira` | INSERT/UPDATE em `financeiro_saidas`, `convenio_faturas`, `convenio_fatura_itens` e dicionários `select_options/financeiro_*`. Habilita aba Integrações. |
| `registrar_pagamento` | INSERT/UPDATE em `atendimento_pagamentos`. Validado também pela edge function `update-atendimento`. |
| `editar_atendimento` | Atualizações em geral via `update-atendimento` (ex.: editar exames). |
| `cancelar_atendimento` | Cancelamento total (`_cancelar_tudo` ou `motivo_cancel` definido). |
| `visualizar_atendimentos` | SELECT em `atendimento_pagamentos` (alternativa a `visualizar_financeiro`). |

`app_role = 'admin'` é exigido **adicionalmente** para DELETE em todas as tabelas financeiras.

## Tabela `atendimento_pagamentos`

| Comando | Quem pode | Condição |
|---|---|---|
| SELECT | super_admin, ou tenant com `visualizar_atendimentos` ou `visualizar_financeiro` | `tenant_id = current_tenant_id()` |
| INSERT | tenant com `registrar_pagamento` | `tenant_id = current_tenant_id()` |
| UPDATE | tenant com `registrar_pagamento` | both USING e WITH CHECK |
| DELETE | super_admin, ou tenant `admin` | `tenant_id = current_tenant_id()` |

Defesa em profundidade: a edge function `update-atendimento` revalida `has_permission` antes da RPC.

## Tabela `convenio_faturas` (cf_*)

| Comando | Quem pode |
|---|---|
| SELECT | super_admin OU `visualizar_financeiro` (no tenant) |
| INSERT | `gestao_financeira` |
| UPDATE | `gestao_financeira` |
| DELETE | `app_role = 'admin'` |

Triggers `protect_convenio_fatura_paga` e `protect_convenio_fatura_codigo` são guardas adicionais (impedem alterar fatura paga ou trocar o código).

## Tabela `convenio_fatura_itens` (cfi_*)

Mesmas permissões de `convenio_faturas`. Itens não-faturados/faturados são separados pelo simples fato de existir/não-existir um row aqui.

## Tabela `financeiro_saidas` (fin_*)

Mesmas permissões: SELECT (`visualizar_financeiro`), INSERT/UPDATE (`gestao_financeira`), DELETE (`admin`).

## `select_options` — categorias financeiras

Migration `20260613_select_options_per_category_rls` aplica RLS por categoria:
- Leitura: dicionário global (`tenant_id IS NULL` permitido) ou do tenant.
- Escrita nessas 3 categorias específicas: `gestao_financeira`.
- Exclusão de itens `sistema=true` é bloqueada por trigger.

## View `financeiro_entradas`

Não tem RLS própria (views não têm). A segurança vem das tabelas-base (`atendimento_pagamentos`, `convenio_faturas`, `atendimentos`, `convenios`). O usuário precisa de permissão de leitura nas tabelas-base para ver linhas.

## RPCs

| RPC | Marcação | Filtro tenant |
|---|---|---|
| `a_receber_pacientes_page` | `STABLE` (não documentado se SECURITY DEFINER aqui — depende da definição) | Implícito via `current_tenant_id()` nas tabelas-base |
| `financeiro_resumo` | `STABLE`, `SET search_path = public` | `WHERE tenant_id = current_tenant_id()` em todas as CTEs |
| `update_atendimento_tx` | Transacional | RLS das tabelas-base + revalidação na edge function |
| `create_atendimento_tx` | Transacional | RLS das tabelas-base |

## Quem pode o quê — resumo operacional

| Ação | super_admin | admin | manager | user (com permissão) |
|---|---|---|---|---|
| Ver Financeiro | ✓ (cross-tenant via `is_super_admin`) | ✓ se `visualizar_financeiro` | ✓ se `visualizar_financeiro` | ✓ se `visualizar_financeiro` |
| Lançar pagamento de paciente | ✓ | ✓ se `registrar_pagamento` | ✓ se `registrar_pagamento` | ✓ se `registrar_pagamento` |
| Editar pagamento de paciente | mesma | mesma | mesma | mesma |
| Excluir pagamento | ✓ | ✓ (role admin) | ✗ | ✗ |
| Lançar saída/despesa | ✓ | ✓ se `gestao_financeira` | ✓ se `gestao_financeira` | ✓ se `gestao_financeira` |
| Excluir saída | ✓ | ✓ (role admin) | ✗ | ✗ |
| Criar fatura de convênio | ✓ | ✓ se `gestao_financeira` | ✓ se `gestao_financeira` | ✓ se `gestao_financeira` |
| Marcar fatura como paga | ✓ | ✓ | ✓ | ✓ (todos com `gestao_financeira`) |
| Cancelar fatura | ✓ | ✓ (admin) | ✗ | ✗ |
| Cancelar atendimento | ✓ | ✓ se `cancelar_atendimento` | ✓ se permissão | ✓ se permissão |
| Editar dicionários | ✓ | ✓ se `gestao_financeira` | ✓ se `gestao_financeira` | ✓ se `gestao_financeira` |
| Fechar caixa | — (não existe) | — | — | — |

## Auditoria

- Trigger `audit_atendimento_pagamentos` registra INSERT/UPDATE/DELETE em `atendimento_pagamentos` (tabela `audit_logs` ou `operational_audit`, conforme convenção).
- `atendimento_audit` armazena auditoria de mudanças no atendimento.
- Não há tabela dedicada de auditoria para `financeiro_saidas` ou `convenio_faturas`.
