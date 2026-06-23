# Equipe 2.1 — Hardening e Simplificação

Plano em 8 fases, executadas em ordem. Sem RH, sem cargos, sem ponto. Apenas fechar furos, unificar catálogo e enxugar a UI.

## Fase 2.1 — Fechar auto-escalonamento (RLS)

**Migration:**
- Substituir policy `profiles_update_self` por trigger `BEFORE UPDATE` em `public.profiles` que, quando `auth.uid() = user_id` e o caller NÃO é admin/super_admin, **bloqueia mudanças** em: `perfil`, `permissoes_extras`, `permissoes_revogadas`, `unidade_ids`, `unidade_ativa`, `status`, `tenant_id`.
- Usuário comum só consegue alterar: `nome`, `telefone`, `avatar_url`, `assinatura_*`.

## Fase 2.2 — Bloquear auto-exclusão server-side

**Edge `admin-delete-user`:** já tem o check `userId === caller.id`. Confirmar e endurecer mensagem. *(Verificado: já implementado — manter e adicionar log.)*

## Fase 2.3 — Validar unidades no convite

**Edge `admin-invite-user`:**
- Antes de gravar `unidade_ids`, consultar `public.unidades` filtrando por `tenant_id = callerTenantId` e validar que TODO id do array pertence ao tenant.
- Se inválido → 400 com mensagem clara. Super admin bypassa.

## Fase 2.4 — Permissões fantasmas

Decisão por permissão (apenas em SQL `has_permission`, ausentes do catálogo TS):

| Permissão | Decisão | Justificativa |
|---|---|---|
| `integracoes.gerenciar` | **Adicionar ao catálogo TS** (grupo Configurações) | Usada em rotas/edge de integrações |
| `gerenciar_soroteca` | **Adicionar ao catálogo TS** (grupo Rotina) | Usada nas rotas `/soroteca/*` |
| `armazenar_amostra` | **Adicionar ao catálogo TS** (grupo Rotina) | Usada em fluxo de armazenamento |

Resultado: 0 permissões órfãs. Catálogo TS passa de 32 → 35.

## Fase 2.5 — Catálogo único

Fonte oficial: **TypeScript** (`src/data/usuariosStore.ts:PERMISSOES_AGRUPADAS` + `DEFAULTS_POR_PERFIL`). SQL `has_permission` deriva — mantemos a função, mas adicionamos comentário SQL apontando a SSOT e checklist no PR. Não dá para gerar SQL automaticamente sem build step novo (proibido por escopo); a regra escrita + comentário é suficiente.

## Fase 2.6 — UX: permissões avançadas colapsadas

**`src/pages/Usuarios.tsx` (ou dialog):**
- Topo do dialog: campos básicos (nome, email, perfil, admin toggle, unidades).
- Bloco "Permissões avançadas" em `<details>`/`Collapsible` fechado por padrão. Texto: "Ajustes finos — só altere se souber o que está fazendo."
- Sem mudança de lógica de salvamento.

## Fase 2.7 — Assinatura no /perfil

- Criar rota `/perfil` (`src/pages/Perfil.tsx`) com: nome, telefone, avatar, **assinatura** (imagem + carimbo + texto), botão Salvar.
- Usar policy do 2.1 (usuário pode editar esses campos próprios).
- Remover bloco de assinatura do `UsuarioDialog` (admin não edita assinatura alheia — princípio de propriedade).
- Adicionar link "Meu perfil" no menu do usuário (avatar no header).

## Fase 2.8 — Limpeza

- Unificar `AuthContext.login()` e `signInWithPassword()` em uma única função.
- Remover policy duplicada `unidades_public_read` (manter `und_select`).
- Coluna `profiles.telefone` — passa a ser usada em `/perfil`. Não remove.
- Confirmar que nenhuma referência ao bloco antigo de assinatura sobrou.

## Menu final

```
Equipe
├─ Usuários       (existente)
└─ Convites       (subaba/filtro em Usuários — não criar rota nova)
```

*Convites não é tela separada — fica como filtro/aba dentro de Usuários para evitar inflar o menu.*

## Ordem de execução

1. Migration (2.1 + remover policy duplicada da 2.8) — **requer aprovação**.
2. Edge functions (2.2 confirmação + 2.3 validação tenant).
3. Catálogo TS (2.4 + 2.5).
4. UI: colapsar avançado (2.6).
5. Página `/perfil` + remover bloco do dialog (2.7).
6. Limpeza login duplicado (2.8).
7. Smoke tests manuais (Playwright opcional para fluxo crítico).
8. Relatório `docs/equipe-2.1/equipe-hardening-report.md`.

## Riscos / pontos de atenção

- **Trigger BEFORE UPDATE em profiles** precisa permitir o trigger `handle_new_user` e edges com service-role passarem. Solução: checar `auth.role() = 'authenticated'` E `auth.uid() = user_id` antes de bloquear. Service-role (edge functions) usa role `service_role` → não cai no bloqueio.
- **Adicionar 3 permissões ao catálogo TS** muda defaults visíveis. Admins existentes têm wildcard `*` — sem impacto. Perfis não-admin não recebem essas novas por default.
- **`/perfil` nova rota** = mudança estrutural. Incluída neste plano para sua aprovação explícita junto com o resto.

Aguardando **"ok"** para executar.
