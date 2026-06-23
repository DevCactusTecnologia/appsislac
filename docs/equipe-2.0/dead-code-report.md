# Equipe 2.0 — Código Morto

> Mapeado, NÃO removido.

## Frontend

| Símbolo | Local | Status |
|---|---|---|
| `getEspecialistas`, `addEspecialista`, etc. | `especialistaStore.ts` | **Vivo** (página Especialistas + atendimentos) — fora do escopo Equipe, mas não morto. |
| `removerAvatar(targetUserId)` | `usuariosStore.ts:376` | **Vivo** apenas via `Perfil.tsx`/`Usuarios.tsx`? Apenas referenciado dentro do próprio store; nenhuma chamada em outras páginas. Provável uso parcial. Não confirmado morto. |
| `sendPasswordResetEmail` | `usuariosStore.ts:299` | **Vivo** (botão `KeyRound` em /equipe). |
| `fetchUsuariosIntegridade` | `usuariosStore.ts:415` | **Vivo** (banner). |
| `getSedesEFiliais` | `unidadeStore.ts:76` | Não usado em /equipe. Provavelmente usado em outras telas (Configurações > Unidades). Não validado para Equipe. |
| Alias `/usuarios → /equipe` | `App.tsx:423` | **Vivo intencionalmente** (rota legada). Manter. |

## Backend

| Objeto | Status |
|---|---|
| `tenant_users_integrity()` | **Vivo**. Consumido pelo banner. |
| `handle_new_user` branch `__admin_provisioned + role` | **Morto na prática**. Edge `admin-invite-user` não usa `raw_user_meta_data.role` para criar role admin — faz `upsert user_roles` direto. O branch é defensivo, sem dano. |
| Policy `unidades_public_read` | **Redundante** com `und_select` (ambas só para `authenticated`). Sem dano. |
| Permissões `integracoes.gerenciar`, `gerenciar_soroteca`, `armazenar_amostra` | Vivas em `has_permission`, mas **invisíveis no UI** (catálogo TS não as expõe). Tecnicamente concedidas só a admins. |

## Componentes / hooks / serviços

Nenhum componente órfão em `src/components/usuarios/` (só `AssinaturaSection`, importado por `Usuarios.tsx`). Nenhum hook dedicado.

## RPCs sem consumidor

Nenhum no escopo Equipe. Todas as RPCs (`has_role`, `is_super_admin`, `has_permission`, `current_tenant_id`, `tenant_users_integrity`) são consumidas.

## Triggers sem uso

`handle_new_user` é vital (cria profile + user_roles inicial). Não há trigger morto.

## Índices redundantes

Não auditado em detalhe. Indicado para Fase 2 se houver evidência.
