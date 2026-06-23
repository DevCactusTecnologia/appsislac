# Equipe 2.0 — Inventário Completo (Fase 1)

> Auditoria 100% leitura. Nenhum arquivo, tabela, policy ou migração foi alterado.

## 1. Rotas e menu

| Rota | Arquivo | Permissão | Observação |
|---|---|---|---|
| `/equipe` | `src/App.tsx:422` → `src/pages/Usuarios.tsx` | `gestao_usuarios` | Único entrypoint do módulo. |
| `/usuarios` | `src/App.tsx:423` | — | `<Navigate to="/equipe" replace />` (alias legado). |
| Menu “Equipe” | `src/components/AppSidebar.tsx:79` (icon `Users2`) | `gestao_usuarios` (PERMISSION_BY_PATH, linha 123) | |

Não existem rotas `/equipe/*` filhas. Não existem subpáginas (cargo, escala, ponto, salário, etc.).

## 2. Páginas

| Página | LOC | Responsabilidade |
|---|---|---|
| `src/pages/Usuarios.tsx` | 738 | Lista + diálogo único de criar/editar (perfil, permissões, unidades, senha, assinatura) + desativar + reset de senha + excluir definitivo + painel de inconsistência multi-tenant. |
| `src/pages/Especialistas.tsx` | — | Cadastro de **médicos/profissionais solicitantes externos** (não pertence ao módulo Equipe; CRM/CPF, usado em atendimentos). Compartilha apenas a permissão `visualizar_pacientes`. |

## 3. Componentes

| Caminho | Uso |
|---|---|
| `src/components/usuarios/AssinaturaSection.tsx` | Sub-bloco do diálogo de edição: escolhe carimbo vs imagem, faz upload S3 (`uploadAssinatura`, `removerAssinaturaImagem`, `fetchAssinaturaUrl`). Único componente em `src/components/usuarios/`. |
| `src/components/CadastroEspecialistaDialog.tsx` | Diálogo de Especialistas (escopo paciente/atendimento, não Equipe). |

Não existem componentes “TeamCard”, “FuncionarioCard”, “Cargo”, “ColaboradorRow”, etc.

## 4. Hooks

Nenhum hook dedicado ao módulo Equipe. O contexto `useAuth()` (`src/contexts/AuthContext.tsx`) cobre todas as leituras necessárias (`hasPermission`, `user.unidadeAtiva`, `switchUnidade`).

## 5. Stores (data layer)

| Store | LOC | Conteúdo |
|---|---|---|
| `src/data/usuariosStore.ts` | 430 | SSOT do frontend. Cache em memória, listeners, catálogo de permissões (`PERMISSOES_AGRUPADAS`, `TODAS_PERMISSOES`, `DEFAULTS_POR_PERFIL`), `resolverPermissoesEfetivas`, mutações via edge functions (`inviteUsuario`/`updateUsuario`/`deleteUsuario`/`sendPasswordResetEmail`), uploads de assinatura/avatar, `fetchUsuariosIntegridade`. |
| `src/data/unidadeStore.ts` | 145 | Cadastro de unidades — consumido por Equipe para mostrar/atribuir `unidade_ids`. |
| `src/data/especialistaStore.ts` | 149 | Médicos solicitantes — fora do escopo Equipe (catálogo de quem PEDE exames). |

## 6. Edge functions

| Função | Papel | Validação |
|---|---|---|
| `admin-invite-user` | Cria via `auth.admin.createUser` ou `inviteUserByEmail`, força `tenant_id` ao do caller, popula `profiles`, opcional role `admin`. | Caller autenticado + `has_role(caller, 'admin')`. |
| `admin-update-user` | Atualiza nome, perfil, status, unidades, permissões, senha, assinatura. Usa `assertSameTenantOrSuperAdmin`. | Caller admin + mesmo tenant que alvo (ou super). |
| `admin-delete-user` | Exclui usuário definitivamente (auth + profile). Usa `assertSameTenantOrSuperAdmin`. | Idem. |
| `upload-assinatura` | Upload/remoção da imagem da assinatura (S3). Self ou admin. | — |
| `assinatura-url` | URL assinada para imagem da assinatura. | — |

Pasta `_shared/tenantGuard.ts` centraliza o guard de mesmo-tenant.

## 7. Tabelas (Postgres / public)

| Tabela | Colunas relevantes | Uso |
|---|---|---|
| `profiles` | `user_id`, `tenant_id`, `friendly_id`, `nome`, `email`, `avatar`, `avatar_key`, `perfil`, `unidade_ids[]`, `unidade_ativa`, `permissoes_extras[]`, `permissoes_revogadas[]`, `status`, `telefone`, `assinatura_tipo`, `assinatura_imagem_key`, `assinatura_conselho`, `created_at`, `updated_at` | Espelho aplicacional do `auth.users`. SSOT de identidade + permissão fina + assinatura. |
| `user_roles` | `user_id`, `role app_role` (`admin`/`super_admin`/`user`), `created_at` | Roles fortes. Única fonte de admin/super_admin. |
| `unidades` | `id text`, `nome`, `tipo (SEDE/FILIAL/PONTO_DE_COLETA)`, `padrao`, `sede_pai_id`, `tenant_id`, `ativo` | Vínculo operacional. |
| `tenants` | `id`, `status`, `plano`, `database_strategy`, `database_url` | Boundary multi-tenant. |
| `especialistas` | médicos solicitantes externos | NÃO é colaborador. |

Não existem tabelas `funcionarios`, `colaboradores`, `cargos`, `tenant_members`, `equipe`, `escala`, `ponto`. SSOT é única.

## 8. Funções/RPCs

- `current_tenant_id()` — lê `profiles.tenant_id` do `auth.uid()`.
- `has_role(_user_id, _role)` — SECURITY DEFINER, lê `user_roles`.
- `is_super_admin(_user_id)` — wrapper de `has_role(..., 'super_admin')`.
- `has_permission(_user_id, _permission)` — espelho do `DEFAULTS_POR_PERFIL` no banco; aplica `extras`/`revogadas`.
- `handle_new_user()` — trigger `auth.users → profiles + user_roles('user')`. Honra `__admin_provisioned`/`tenant_id`/`role` apenas quando vem de edge admin.
- `tenant_users_integrity()` — diagnóstico consumido pelo painel.

## 9. Storage

Bucket S3 implícito via edge `upload-assinatura` / `upload-image` (categoria `avatar`).
Chaves persistidas em `profiles.avatar_key` e `profiles.assinatura_imagem_key`.

## 10. O que NÃO existe (relevante para Fase 12)

- Cargos formais (CLT/PJ/horista) · folha · ponto · férias · escala
- Contratos, anexos de RH, documentos pessoais
- Vínculo many-to-many usuário↔unidade em tabela separada (é `text[]` na própria `profiles`)
- Tabela de “permissions” (catálogo vive em código)
- Telas/menus filhos do `/equipe`
