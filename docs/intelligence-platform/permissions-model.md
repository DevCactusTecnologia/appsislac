# Permissions Model

## Princípio
A IA **reusa** o sistema de permissões oficial. Não cria papéis, não cria mapas paralelos, não hardcoda regras.

## Fonte única
- Papéis: `public.user_roles` + enum `app_role` (`super_admin`, `admin`, `manager`, `user`).
- Verificação: função `has_permission(_user_id, _permission)` (SECURITY DEFINER, já existente).
- Super admin: `is_super_admin(_user_id)` (SECURITY DEFINER, já existente).
- Constantes de permissão: `src/lib/constants.ts` (`PERMISSIONS.*`).

## Fluxo de autorização da IA
```
1. Edge ai-chat recebe JWT.
2. Resolve user_id, tenant_id.
3. Para cada Skill candidata:
     if (skill.requiredPermission) {
        ok = await rpc('has_permission', { _user_id, _permission })
     }
4. Apenas Skills permitidas entram no system prompt + tool catalog.
5. Antes de cada Action.execute:
     re-check has_permission(action.requiredPermission)  // defesa em profundidade
6. Falha → tool retorna { code: "FORBIDDEN" } e logga em ai_audit.
```

## Matriz (resumo)
| Categoria | Permissão exigida (existente) |
|---|---|
| Consultar pacientes/atendimentos/exames | `VIEW_*` |
| Criar paciente / atendimento | `CREATE_PATIENT` / `CREATE_APPOINTMENT` |
| Liberar resultado | `RELEASE_RESULT` |
| Imprimir laudo | `PRINT_REPORT` |
| Enviar WhatsApp | política de notificação + `CREATE_APPOINTMENT` ou específico |
| Financeiro (saídas, faturas) | `FINANCIAL_MANAGEMENT` / `REGISTER_PAYMENT` |
| Soroteca expurgo | permissão clínica (a definir caso ainda não exista) |
| Ações administrativas (config) | `admin` role |
| Cross-tenant (super_admin) | `is_super_admin = true` |

## Princípios
- **Sem duplicação**: nenhum array de permissões dentro de Skill que repita constantes.
- **Sem escalonamento implícito**: IA nunca chama Edge admin (`super-admin-*`) por conta própria.
- **Confirmação ≠ permissão**: confirmação humana é UX, não substitui `has_permission`.
- **Logs**: toda negação grava `status: "forbidden"` em `ai_audit` (sem dados sensíveis).

## Mudanças futuras
Se um domínio precisar de permissão nova, ela é adicionada **uma vez** em `PERMISSIONS` + `has_permission` (DB). A Skill apenas referencia.
