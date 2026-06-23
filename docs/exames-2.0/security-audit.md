# Auditoria de Segurança

## Resumo
| Tabela | RLS | Policies | Tenant isolation | OK |
|---|---|---:|---|---|
| `exames_catalogo` | ✔ | 4 (read auth / admin C/U/D) | `current_tenant_id()` | ✔ |
| `exame_parametros` | ✔ | 4 | herdado | ✔ |
| `exame_layouts` | ✔ | 4 | herdado | ✔ |
| `valores_referencia` | ✔ | 4 | herdado | ✔ |
| `tabela_preco_itens` | ✔ | 4 | `current_tenant_id()` | ✔ |
| `setores_laboratoriais` | ✔ | 4 | `current_tenant_id()` | ✔ |
| `materiais_amostra` | ✔ | 4 | `current_tenant_id()` | ✔ |
| `labs_apoio` | ✔ | 4 | `current_tenant_id()` | ✔ |

## Quem pode o quê
- **Read:** qualquer usuário autenticado do tenant.
- **Create / Update / Delete:** apenas `admin` (via `has_role`).
- **Inativar:** soft-delete via `ativo=false` (mantém histórico).

## Auditoria
- `trg_audit_atendimento_exames` captura mudanças em `atendimento_exames`.
- **Não há** trigger de auditoria em `exames_catalogo` — mudanças no
  cadastro do exame não geram log.
- Recomendação: adicionar `trg_audit_exames_catalogo` (apenas C/U/D, sem
  read).

## Riscos identificados
1. 🟡 Falta auditoria no cadastro do exame — operações administrativas não
   ficam rastreadas.
2. 🟢 RLS bem aplicada — sem `USING (true)`.
3. 🟢 Sem rotas públicas expondo exames sem filtro de tenant.
