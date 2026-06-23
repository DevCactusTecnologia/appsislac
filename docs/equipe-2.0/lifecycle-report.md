# Equipe 2.0 — Ciclo de Vida do Colaborador

## Fluxo único (existe um só caminho oficial)

```text
[Admin clica "Convidar usuário" em /equipe]
        │
        ▼
[Diálogo: nome, e-mail, perfil, admin?, unidades, permissões, (senha opcional)]
        │
        ▼
[POST edge admin-invite-user]
        │     ├── valida caller admin
        │     ├── resolve tenant_id do caller (NUNCA do client)
        │     ├── se senha: auth.admin.createUser(email_confirm:true)
        │     └── se sem senha: auth.admin.inviteUserByEmail (magic link)
        │
        ▼
[trigger handle_new_user cria profile + user_roles('user')]
        │
        ▼
[edge atualiza profile: perfil, unidades, extras/revogadas, tenant_id forçado]
        │
        ▼
[se isAdmin: upsert user_roles('admin')]
        │
        ▼
ATIVO  ──────────────────►  uso operacional
   │
   ├── editar (admin-update-user): nome, perfil, unidades, permissões, senha, assinatura, isAdmin
   ├── reset de senha (resetPasswordForEmail → /reset-password)
   ├── inativar (admin-update-user status=Inativo) → bloqueia login (AuthContext checa)
   └── excluir definitivo (admin-delete-user, exige digitar "EXCLUIR")
```

## Caminhos paralelos / desvios

1. **Signup público da Landing/Inscrição** → cria `auth.users` sem `__admin_provisioned`. O trigger força `perfil='recepcionista'` e `tenant_id` default (`00000000-…-001`). Esse caminho atende a fluxo de “inscrição de novo laboratório”, **não** entra no `/equipe` de tenant existente.
2. **Super admin** → criado fora do tenant via ferramentas `super-admin-*`. Filtrado explicitamente da listagem em `/equipe` (`usuariosStore` linhas 233-238).
3. **Realtime auto-hydrate** — `AuthContext` assina `profiles UPDATE` próprio: se `status=Inativo` ou tenant suspenso, derruba a sessão em tempo real.

## Inconsistências observadas (somente leitura)

- `tenant_users_integrity()` é renderizado como banner no topo de `/equipe`. Hoje no banco há **1 profile com 3 entries em user_roles** (admin + super_admin + user) — coerente, mas sinaliza que a função existe para detectar usuário sem role/sem tenant após operações administrativas erradas (ex.: import de admin de tenant). Não é problema operacional, é rede de segurança.
- O caminho de "Senha definida agora" e "Convite por e-mail" usam APIs Auth diferentes (`createUser` vs `inviteUserByEmail`). Resultado funcional é o mesmo, mas geram dois ramos no edge function.

## Estados de um colaborador

- `Ativo`/`Inativo` (em `profiles.status`)
- `isAdmin` (presença em `user_roles.role='admin'`)
- `super_admin` (presença em `user_roles.role='super_admin'`) — **fora** do escopo Equipe

Não existe estado "Convidado pendente" persistido — quem ainda não logou aparece como Ativo na lista. Convite pendente fica em `auth.users` (e-mail não confirmado) e não é visualizado em `/equipe`.
