# Equipe 2.0 — Auditoria de Segurança

## RLS por tabela

### `profiles`

| Policy | Cmd | Quem |
|---|---|---|
| `profiles_select` | SELECT | super_admin **OU** `auth.uid()=user_id` **OU** (mesmo tenant **E** admin **E** alvo NÃO é super) |
| `profiles_update_self` | UPDATE | `auth.uid()=user_id` (limitado pelo trigger? — ver abaixo) |
| `profiles_update_admin` | UPDATE | super_admin OU (mesmo tenant + admin) |
| `profiles_insert` | INSERT | super_admin OU (mesmo tenant + admin) |
| `profiles_delete` | DELETE | super_admin OU (mesmo tenant + admin) |

**Atenção: `profiles_update_self` permite UPDATE com `with_check (auth.uid()=user_id)`** — o usuário pode tecnicamente atualizar qualquer coluna do próprio profile, incluindo `perfil`, `permissoes_extras`, `unidade_ids`, `tenant_id`, `status`. **Não há coluna proibida por trigger** (não vimos `BEFORE UPDATE` de proteção).

→ **Risco real de escalonamento**: usuário não-admin pode, via PostgREST direto, fazer `PATCH /rest/v1/profiles?user_id=eq.<self>` com `{"perfil":"admin","permissoes_extras":["*"]}`. A wildcard `*` no `AuthContext.hasPermission` só atua se ele também conseguir entrar em `user_roles` como admin — o que ele **não** consegue (policy `user_roles_manage` exige admin). Mas o `has_permission` SQL aceita `extras`, então qualquer permissão fina pode ser auto-concedida.

> Isso já era um padrão conhecido; a `roles-and-permissions.md` documenta. Fica registrado como **Hotspot #1** para Fase 2.

### `user_roles`

| Policy | Cmd | Quem |
|---|---|---|
| `user_roles_select` | SELECT | super_admin OU `auth.uid()=user_id` OU admin |
| `user_roles_manage` | ALL | super_admin OU (admin **E** role <> super_admin) |

Bem fechado. Admin não consegue criar super_admin via `user_roles_manage`. **Hotspot #1** acima não afeta `user_roles`.

### `unidades`

Padrão `tenant + admin` para mutação, leitura para mesmo tenant. OK.
Existe ainda `unidades_public_read` (ativo=true + mesmo tenant) — redundante com `und_select` para `authenticated`, mas inofensivo.

### `especialistas`

INSERT/UPDATE com `has_permission('cadastrar_paciente'/'editar_paciente')`. DELETE só admin. Coerente.

## Edge functions

- `admin-invite-user`: valida `has_role(caller, admin)` ✅. Resolve `tenant_id` server-side ✅. **Não** valida que `unidadeIds` pertencem ao tenant (furo discutido em `units-and-memberships.md`).
- `admin-update-user`: usa `assertSameTenantOrSuperAdmin` ✅. Bloqueia admin tocando super_admin ✅.
- `admin-delete-user`: mesmo guard ✅.

## Quem pode

| Ação | Quem |
|---|---|
| Criar usuário em /equipe | `admin` do tenant (via edge) |
| Editar perfil/permissões | `admin` do tenant |
| Toggle `isAdmin` | `admin` do tenant (mas não consegue criar super_admin — bloqueado por `user_roles_manage` `with_check`) |
| Excluir definitivo | `admin` do tenant (não pode excluir o próprio uid — bloqueio no frontend, **não** no edge) |
| Reset de senha | `admin` (envia email) ou self (link) |
| Atualizar próprio profile (campos pessoais) | self (`profiles_update_self`) |
| **Auto-escalar permissões finas** | **possível via PostgREST direto** (Hotspot #1) |

## Hotspots

1. **Auto-escalation de `permissoes_extras` via `profiles_update_self`**. Severo. Não bloqueia admin route (porque rota usa wildcard ou role), mas concede permissões finas que disparam ações em outros módulos.
2. **`admin-delete-user` não valida `caller.id != target.id`** no edge — só no frontend. Admin pode se autoexcluir via curl. Quebra o tenant ao remover o último admin.
3. **`admin-invite-user` não valida `unidadeIds ⊂ unidades(tenant)`** — admin de tenant A poderia gravar id de unidade de tenant B em `unidade_ids` (mas não enxergaria nada porque RLS filtra). Risco baixo de "lixo", não de exfiltração.
4. **`handle_new_user` aceita `__admin_provisioned` do `raw_user_meta_data`**. Service-role consegue setá-lo (correto). Edge admin não usa esse mecanismo — usa `update profiles` no passo 5. Caminho redundante; OK.
