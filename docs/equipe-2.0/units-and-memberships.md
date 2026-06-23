# Equipe 2.0 — Vínculo com Unidades

## Modelo

```text
profiles.unidade_ids  text[]   -- conjunto de unidades em que o usuário atua
profiles.unidade_ativa text    -- unidade atualmente selecionada na sessão
profiles.tenant_id    uuid     -- tenant (fronteira hard)
unidades.id           text     -- "und-001", "und-002", ...
unidades.tenant_id    uuid
```

- **N usuários × M unidades**, persistido como array embutido em `profiles`. **Não existe tabela ponte** (`user_unit` ou `tenant_members`).
- Default em código: `["und-001"]` quando ausente. Compatível com tenant default (`00000000-…-001`).
- Troca em runtime via `AuthContext.switchUnidade()` — atualiza estado local e persiste `profiles.unidade_ativa` (best-effort).

## Multi-tenant

- `unidades.tenant_id` + RLS `und_select: is_super_admin OR tenant_id = current_tenant_id()` impedem ver unidades de outro tenant.
- `unidade_ids` armazena strings opacas; nada impede gravar um id de outra tenant **se a edge function não validasse**. Hoje a validação acontece **só implicitamente** porque a tela `/equipe` lista apenas `getUnidadesAtivas()` (já filtrado por RLS), então o admin não tem como digitar id alheio. A edge `admin-update-user` **não re-valida** que `unidadeIds ⊂ unidades(tenant_id=caller)`. É um furo teórico — exploível só por chamada direta à function.

## Conflitos

- Se admin remove uma unidade de `unidade_ids` enquanto ela está em `unidade_ativa`, não há tratamento explícito. O usuário continua com `unidade_ativa` apontando para id que não pertence a ele.
- `und-001` é o fallback hard-coded em vários pontos (`AuthContext`, `usuariosStore`, `handle_new_user`). Acoplamento ao seed inicial.

## Múltiplas unidades

Sim: o usuário pode atuar em múltiplas unidades do **mesmo tenant**. O switcher do header altera `unidade_ativa`. Toda query operacional usa `unidade_ativa` como filtro lógico.

Cross-tenant **não é possível** (e não deve ser): cada usuário tem **um** `tenant_id` único em `profiles`.

## Tabela `tenant_members`?

Não existe. Não é necessária na arquitetura atual (vínculo é 1:1 usuário↔tenant). Mantida fora do escopo.
