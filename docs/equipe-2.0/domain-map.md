# Equipe 2.0 — Mapa de Domínio

## Entidades canônicas

```text
auth.users (Supabase Auth — credencial, e-mail, senha, sessão)
   │  1:1 trigger handle_new_user
   ▼
public.profiles (identidade aplicacional do tenant)
   ├─ tenant_id  → public.tenants
   ├─ perfil     ∈ {admin, analista, recepcionista, financeiro}
   ├─ permissoes_extras[] / permissoes_revogadas[]
   ├─ unidade_ids[] / unidade_ativa  → public.unidades
   └─ assinatura_tipo / assinatura_imagem_key / assinatura_conselho
   │
   └─ 1:N public.user_roles (role app_role: user|admin|super_admin)
```

`especialistas` é catálogo de **profissionais externos solicitantes** (CRM). Não faz parte da Equipe operacional do laboratório. Mantido fora da SSOT da Equipe.

## Quem cria / altera / consome

| Entidade | Cria | Altera | Consome |
|---|---|---|---|
| `auth.users` | edge `admin-invite-user` (admin) · signup público landing | edge `admin-update-user` (senha) · auth (reset) | sessão (`useAuth`) |
| `profiles` | trigger `handle_new_user` | edge `admin-update-user` · trigger update self via RLS `profiles_update_self` · edge `upload-assinatura` (imagem) · edge `upload-image` (avatar) | `AuthContext.hydrateFromSupabase` · `usuariosStore` · `ResultadoDetalhe.tsx` (assinatura) · `Perfil.tsx` (self) |
| `user_roles` | trigger `handle_new_user` (`'user'`) · edge `admin-invite-user` (`'admin'` opcional) · super-admin tools | edge `admin-update-user` (toggle admin) · super-admin | `has_role` · `is_super_admin` · `AuthContext` |
| `unidades` | tela `Unidades.tsx` | tela `Unidades.tsx` | toda app (filtro tenant + unidade ativa) |
| `especialistas` | tela `Especialistas.tsx` / `CadastroEspecialistaDialog` | mesma | atendimentos (solicitante) |

## Dependências de saída do módulo Equipe

`profiles.assinatura_*` é lido por `src/pages/ResultadoDetalhe.tsx:149` para compor o laudo. Esse é o único uso operacional dos dados de Equipe fora do próprio módulo (além da camada de auth/permissão).

`profiles.unidade_ativa` direciona toda a UI multi-unidade (cabeçalho, filtros, atendimentos).

## Fronteiras

- **Tenant**: `profiles.tenant_id` é a fronteira. Super admin é entidade de plataforma (existe sem `profiles`), filtrada explicitamente da listagem por `usuariosStore` (defesa em profundidade além da RLS).
- **Unidade**: vínculo é `text[]` dentro do próprio `profiles` (sem tabela ponte). Um usuário pode pertencer a N unidades do mesmo tenant; **não pode** atravessar tenants.
- **Role × Permissão**: `user_roles` é coarse (super/admin/user). `perfil` + arrays `extras/revogadas` é fine-grained.
