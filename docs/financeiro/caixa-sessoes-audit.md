# Auditoria — `caixa_sessoes`

**Fase:** Financeiro 2.0 — Fase 2 (somente diagnóstico).
**Status:** tabela existe no banco mas **não é consumida pelo frontend**.

## Schema atual

| Coluna             | Tipo                       | Nulo |
|--------------------|----------------------------|------|
| `id`               | bigint (PK)                | não  |
| `tenant_id`        | uuid                       | não  |
| `unidade_id`       | text                       | não  |
| `aberta_em`        | timestamptz                | não  |
| `fechada_em`       | timestamptz                | sim  |
| `responsavel_id`   | uuid                       | sim  |
| `valor_abertura`   | numeric                    | não  |
| `valor_fechamento` | numeric                    | sim  |
| `observacoes`      | text                       | sim  |
| `status`           | text (`aberta` / `fechada`)| não  |
| `created_at`       | timestamptz                | não  |
| `updated_at`       | timestamptz                | não  |

A coluna `unidade_id` é coerente com o resto do domínio (`atendimentos.unidade_id`, `financeiro_saidas` etc.).

## Está em uso?

**Não.** Busca `rg "caixa_sessoes" src/` retorna 0 ocorrências. A tabela é puramente esqueleto preparado para Fase 5.

## Possui dados?

**Não.** `SELECT count(*) FROM caixa_sessoes` → `0` linhas em produção.

## RLS está habilitada?

**Sim.** `rowsecurity = true`.

## Policies

Quatro policies existentes — todas ancoradas em `current_tenant_id()` + `has_permission()`, padrão SISLAC:

| Policy                              | Comando | Quem                                                                                |
|-------------------------------------|---------|-------------------------------------------------------------------------------------|
| `caixa_sessoes_select_tenant`       | SELECT  | super_admin OU (tenant + `visualizar_financeiro` ou `gestao_financeira`)            |
| `caixa_sessoes_insert_tenant`       | INSERT  | super_admin OU (tenant + `gestao_financeira`)                                       |
| `caixa_sessoes_update_tenant`       | UPDATE  | super_admin OU (tenant + `gestao_financeira`)                                       |
| `caixa_sessoes_delete_super_admin`  | DELETE  | apenas `super_admin` (operacional **não** apaga sessão)                             |

Conformidade SaaS: ✔ tenant isolado, ✔ super_admin com escopo platform, ✔ DELETE bloqueado para roles operacionais.

## Triggers

**Nenhuma.** A tabela não tem triggers de auditoria, `updated_at`, recompute, validação ou bloqueio de fechamento. Estes serão necessários na Fase 5 (mínimo: `touch_updated_at`, validação "1 sessão aberta por unidade").

## Conclusão

`caixa_sessoes` está **pronta estruturalmente** para a Fase 5:

- ✔ Schema cobre o modelo "1 sessão aberta por unidade" (sem operador, sem múltiplos turnos).
- ✔ RLS isola por tenant.
- ✘ Falta apenas, na Fase 5: trigger `updated_at`, índice parcial `UNIQUE (tenant_id, unidade_id) WHERE status = 'aberta'`, e RPCs `caixa_abrir` / `caixa_fechar`.

Nenhuma alteração nesta fase. **Não implementar abertura/fechamento agora.**
