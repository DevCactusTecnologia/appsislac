# Equipe 2.0 — Relatório Executivo

## Em uma frase

O módulo **Equipe é uma única tela `/equipe`** servida por `Usuarios.tsx` + `usuariosStore.ts` + 3 edge functions admin (`invite/update/delete`), apoiada por `profiles` (identidade) e `user_roles` (roles fortes), com permissão fina via `has_permission`. Não há RH escondido.

## SSOT (Source of Single Truth)

- **Identidade aplicacional**: `public.profiles` (1:1 com `auth.users`).
- **Roles fortes**: `public.user_roles`.
- **Catálogo de permissões finas**: duplicado entre `src/data/usuariosStore.ts` (UI) e `public.has_permission` (RLS).
- **Vínculo com unidades**: array `profiles.unidade_ids[]` (sem tabela ponte).
- **Assinatura no laudo**: 3 colunas em `profiles`.

## Ciclo de vida

`Convidar → Auth cria user → trigger cria profile + role 'user' → edge atualiza profile (perfil/permissões/unidades/tenant) → (opcional) upsert role 'admin' → Ativo → editar/inativar/excluir`. Fluxo único, sem ramos paralelos relevantes.

## Permissões

Dois eixos coexistem:
1. Role forte (`user`/`admin`/`super_admin`) — usada em RLS via `has_role`.
2. Perfil + extras/revogadas (32 permissões) — usada em UI e em RLS via `has_permission`.

Sistema funcional, mas **catálogo duplicado em TS e SQL** (drift possível). **3 permissões fantasmas** existem só no SQL.

## Duplicações

- `AuthContext.login()` vs `signInWithPassword()` — funções gêmeas, mesma lógica.
- Policy `unidades_public_read` ≡ `und_select` para o role `authenticated`.
- Defaults por perfil em TS e SQL (espelho manual).

## Código morto

Praticamente inexistente. Caminhos defensivos no `handle_new_user` (branch `role` em `raw_user_meta_data`) não são exercitados, mas são proteções. Sem componentes/hooks órfãos.

## Riscos operacionais

1. **`profiles_update_self`** permite ao próprio usuário gravar `permissoes_extras` arbitrárias via PostgREST direto → auto-escalation de permissões finas (não eleva a admin, mas concede ações sensíveis em outros módulos). **Severo.**
2. **`admin-delete-user`** não bloqueia caller deletando a si mesmo no edge (só na UI). Admin pode "decapitar" o tenant via curl.
3. **`admin-invite-user`** não valida `unidadeIds ⊂ unidades(tenant)` — risco baixo de gravar lixo.
4. **Assinatura é mutável retroativamente**: trocar imagem altera laudos reimpressos antigos.

## Complexidade desnecessária

Pontual:
- Bloco de permissões finas (32 toggles) no diálogo de edição — usuário típico nunca toca, mas ocupa espaço cognitivo. Pode ser colapsado em "Permissões avançadas".
- Bloco de assinatura no editor de usuário — confunde com configuração de admin. Melhor em `/perfil` do próprio dono.
- Coluna `profiles.telefone` existe mas não é exposta na UI — vestigial.

## O módulo é intuitivo?

**Sim para gestão básica** ("convidei alguém, defini perfil, está ativo"). **Não para permissões finas** — exige conhecimento do que cada toggle faz. Mas isso é inerente a um SaaS sério.

## O módulo está virando RH?

**Não.** Filosofia "Olhou. Entendeu. Resolveu." mantida. Nenhum sinal de cargo/salário/ponto/escala. O escopo está disciplinado.

## Veredito por área

| Área | Estado | Ação sugerida (Fase 2) |
|---|---|---|
| Modelo de dados | Sólido, minimalista | Manter |
| Ciclo de vida | Único, claro | Manter |
| Permissões — catálogo | Duplicado TS/SQL | Unificar OU aceitar drift e documentar |
| Permissões — UI | 32 toggles expostos | Colapsar atrás de "Avançado" |
| Assinatura no laudo | Embarcada no editor admin | Mover para tela `/perfil` (self) |
| RLS `profiles_update_self` | **Vulnerável a escalation** | Restringir colunas atualizáveis (trigger BEFORE UPDATE) |
| Edge `admin-delete-user` | Sem auto-bloqueio | Validar `caller != target` no servidor |
| Edge `admin-invite-user` | Sem check de tenant em unidades | Validar `unidadeIds ⊂ tenant.unidades` |
| Performance | Adequada até ~500 usuários | Considerar paginação se >500 |
| Código morto | Quase nada | Limpar `login`/`signInWithPassword` duplicados |

## Resposta às perguntas oficiais

- **SSOT?** `profiles` + `user_roles` + (catálogo de permissões em código).
- **Ciclo de vida do colaborador?** Único: convite/criação por admin → ativo → editar/inativar/excluir.
- **Como permissões funcionam?** Role forte + perfil + extras/revogadas; RLS via `has_role`/`has_permission`; UI via wildcard `*` ou consulta direta.
- **Duplicações?** Catálogo TS/SQL; `login`/`signInWithPassword`; policy `unidades_public_read`.
- **Código morto?** Resíduos defensivos sem impacto.
- **Risco operacional?** Sim — escalation por `profiles_update_self` e auto-delete admin.
- **Complexidade desnecessária?** Bloco de 32 toggles expostos; assinatura no editor admin.
- **Intuitivo?** Sim para fluxo principal; permissões finas exigem expertise.
- **Virando RH?** Não.
- **Como simplificar?** Colapsar permissões avançadas; mover assinatura para `/perfil`; consertar os 3 hotspots de segurança.

## Critério de sucesso atendido

> Quem trabalha? `profiles` filtrado por tenant.
> O que faz? `perfil` + permissões.
> Onde atua? `unidade_ids` + `unidade_ativa`.
> O que pode acessar? `has_permission` + `has_role`.

Tudo respondível **em uma tela**, em **menos de 30 segundos**, sem burocracia.

---

## Parada (REGRA)

Auditoria encerrada. Nenhuma alteração foi feita.

Próxima fase exige aprovação explícita.
