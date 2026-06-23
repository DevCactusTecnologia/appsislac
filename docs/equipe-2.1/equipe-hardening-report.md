# Equipe 2.1 — Hardening e Simplificação · Relatório Final

## Resumo

Auditoria 2.0 → execução 2.1. Foco: fechar furos de segurança, unificar catálogo de permissões, simplificar UI e mover assinatura para o auto-serviço do usuário. Zero RH, zero burocracia, zero novas rotas além de `/perfil` enriquecido.

## Fases executadas

### Fase 2.1 — Auto-escalonamento (RLS)
- **Migration**: trigger `profiles_guard_self_update` (BEFORE UPDATE em `public.profiles`).
- Quando `auth.uid() = OLD.user_id` E caller não é `admin` nem `super_admin`, bloqueia mudanças em: `perfil`, `permissoes_extras`, `permissoes_revogadas`, `unidade_ids`, `unidade_ativa`, `status`, `tenant_id`, `email`, `friendly_id`.
- Usuário comum só edita: `nome`, `telefone`, `avatar*`, `assinatura_*`.
- Service-role (edge functions) e trigger `handle_new_user` passam transparentemente (auth.uid() NULL).

### Fase 2.2 — Auto-exclusão
- `admin-delete-user` já valida `userId === caller.id` (linhas 73-75). Confirmado: server-side, não só UI.

### Fase 2.3 — Validar unidades no convite
- `admin-invite-user`: novo bloco antes da criação consulta `public.unidades` filtrando por `tenant_id = callerTenantId` e verifica que TODO id do array pertence ao tenant.
- Inválido → 400 com lista dos ids ofensivos. Super admin bypassa.

### Fase 2.4 — Permissões fantasmas
| Permissão | Decisão |
|---|---|
| `integracoes.gerenciar` | Adicionada ao grupo "Configurações & Cadastros" |
| `gerenciar_soroteca` | Adicionada ao grupo "Rotina" |
| `armazenar_amostra` | Adicionada ao grupo "Rotina" |

Resultado: **0 permissões órfãs**. Catálogo TS: 32 → 35.

### Fase 2.5 — Catálogo único
- Fonte oficial declarada: `src/data/usuariosStore.ts` (`PERMISSOES_AGRUPADAS` + `DEFAULTS_POR_PERFIL`).
- `public.has_permission` continua espelhando defaults. Comentário SQL aponta SSOT.
- Drift detectado nesta auditoria → corrigido (3 permissões antes só em SQL agora estão em TS também).

### Fase 2.6 — UX: permissões avançadas colapsadas
- Dialog de Usuário: bloco de 35 toggles agora em `<details>` fechado por padrão, rotulado "Permissões avançadas — Ajustes finos, só altere se souber o que está fazendo."
- Topo visível: nome, e-mail, senha, perfil, toggle Administrador, unidades.

### Fase 2.7 — Assinatura no `/perfil`
- `src/pages/Perfil.tsx` enriquecido: agora contém telefone + bloco completo de assinatura (carimbo/imagem + conselho + upload).
- Bloco `AssinaturaSection` removido de `UsuariosDialog`: admin não edita assinatura alheia.
- Correção de bug: query original usava `.eq("id", user.id)` (errado); agora `user_id`.

### Fase 2.8 — Limpeza
- `AuthContext.signInWithPassword` reduzido a alias de `login` (eram funções gêmeas idênticas).
- Policy duplicada `unidades_public_read` removida (`und_select` já cobre, com escopo super_admin adicional).
- `profiles.telefone` agora tem UI consumindo (auto-serviço).
- Mantido `estoque_marcar_lotes_vencidos`, mantido `AssinaturaSection` (reaproveitado em /perfil).

## Menu final

```
Equipe
└─ Usuários   (inclui filtro de convites pendentes)
```

Sem submenus separados. Sem inflar a navegação.

## Testes recomendados

1. **Convite com unidade inválida** → tenta atribuir `und-xyz` de outro tenant → 400 com mensagem clara.
2. **Auto-escalation via PostgREST** → usuário comum tenta `PATCH /profiles?user_id=eq.<self>` com `permissoes_extras=["gestao_usuarios"]` → trigger bloqueia (42501).
3. **Self-update permitido** → mesmo usuário atualiza `telefone` ou `assinatura_conselho` → ok.
4. **Auto-exclusão** → admin tenta deletar a si mesmo → edge retorna 400.
5. **Assinatura em laudo** → usuário muda assinatura em `/perfil` → próximo laudo impresso reflete a mudança.

## Resposta às perguntas oficiais

| Pergunta | Resposta |
|---|---|
| Riscos eliminados? | Auto-escalonamento de permissões finas; vazamento de unidades entre tenants; auto-deleção (confirmado já bloqueado). |
| Existe auto-escalonamento? | **Não.** Trigger BEFORE UPDATE bloqueia. |
| Existe auto-exclusão? | **Não.** Validação em `admin-delete-user`. |
| Permissões órfãs? | **Não.** 3 fantasmas migradas para o catálogo TS. |
| Duplicação de catálogo? | TS é SSOT. SQL espelha defaults (regra escrita + comentário). |
| UX ficou mais simples? | Sim — toggles agora colapsados; assinatura saiu do dialog admin. |
| Continua enxuto? | Sim — menu segue com 1 item ("Usuários"). |
| Código morto restante? | Nenhum identificado. `signInWithPassword` reduzido a alias. |
| Continua fora de RH? | Sim. Nenhum conceito de cargo, ponto, folha ou férias. |
| Filosofia "Olhou, Entendeu, Resolveu" preservada? | Sim. Operador vê quem trabalha, edita o que pode e acabou. |

## Arquivos alterados

- **Migration:** trigger `profiles_guard_self_update_trg` + DROP policy `unidades_public_read`
- **Edge:** `supabase/functions/admin-invite-user/index.ts` (validação de unidades)
- **TS:** `src/data/usuariosStore.ts` (+3 permissões)
- **UI:** `src/pages/Usuarios.tsx` (collapsible + remoção de assinatura)
- **UI:** `src/pages/Perfil.tsx` (telefone + assinatura self-service, fix `user_id`)
- **Auth:** `src/contexts/AuthContext.tsx` (alias signInWithPassword=login)

## Critério de sucesso

Operador agora consegue, sem treinamento:
- Convidar usuário → 1 dialog, campos básicos visíveis.
- Ativar/desativar → 1 clique em "Desativar".
- Editar sua própria assinatura → `/perfil` → seção "Assinatura no laudo".
- Não consegue → escalonar permissões, deletar a si mesmo, vincular unidades de outro tenant. ✅
