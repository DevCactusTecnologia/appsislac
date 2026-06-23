# Segurança — Estoque 2.0

## Permissões / Roles

### Permissão de rota
- `/estoque` exige permissão `configuracoes_sistema` (definida em `AppSidebar.tsx` e `App.tsx`).
- Significa que **apenas perfis com acesso a Configurações do Sistema enxergam o módulo**. Operadores de coleta/recepção não acessam.

### RLS por tabela
Todas as 4 tabelas seguem padrão:

| Operação | Tabela | Quem pode |
|---|---|---|
| SELECT | todas | `is_super_admin(auth.uid())` OU `tenant_id = current_tenant_id()` (qualquer authenticated do tenant) |
| INSERT | todas | `tenant_id = current_tenant_id()` AND `has_role(auth.uid(), 'admin')` |
| UPDATE | fornecedores/insumos/lotes | mesmo critério (admin do tenant) |
| UPDATE | **movimentacoes** | ❌ **policy não existe** — ninguém pode atualizar (correto: histórico imutável) |
| DELETE | todas | admin do tenant |

### Resumo por ação
| Quem | Pode comprar (criar lote/entrada)? | Pode ajustar saldo? | Pode movimentar? | Pode excluir? |
|---|---|---|---|---|
| user/manager (sem role admin) | ❌ (RLS bloqueia INSERT) | ❌ | ❌ | ❌ |
| admin do tenant | ✅ | ✅ | ✅ | ✅ |
| super_admin | ✅ (via SELECT em todos tenants) | ✅ | ✅ | ✅ |

## Pontos fortes
- `tenant_id NOT NULL` + RLS em todas as tabelas.
- Sem update em movimentações → histórico imutável (até excluir).
- Trigger `SECURITY DEFINER` com `search_path = public` (correto).
- Super admin separado.

## Pontos fracos / riscos
1. **DELETE permitido em `estoque_movimentacoes`** — admin pode apagar trilha de auditoria. Recomenda-se remover a policy de delete ou exigir super_admin.
2. **Permissão de menu = `configuracoes_sistema`** mas a RLS exige role `admin`. Há cenários onde o operador vê a tela mas falha em qualquer ação. UX confusa.
3. **`usuario_email` é texto preenchido pelo cliente** — não há `created_by uuid REFERENCES auth.users`. Falsificável.
4. **Status do lote sem CHECK constraint** — qualquer string entra.
5. **Tipo da movimentação sem CHECK** — idem.
6. **CASCADE em `estoque_lotes.insumo_id`** — excluir insumo apaga todos os lotes.
7. **`anon` não tem grant** (correto), mas confirmar via linter ao consolidar.

## Resposta direta
- **Quem pode comprar?** admin do tenant.
- **Quem pode ajustar?** admin do tenant.
- **Quem pode excluir?** admin do tenant (incluindo histórico).
- **Quem pode movimentar?** admin do tenant.
