# Plataforma 2.1 — Fase 8: Revisão de índices `idx_scan = 0`

> **Regra:** apenas classificar; **nada removido**.

## Origem dos `idx_scan = 0`

`pg_stat_user_indexes.idx_scan` zerado pode significar:

1. **Base vazia ou sub-povoada** — índice nunca encontrou linhas a varrer.
2. **Índice obrigatório** — UNIQUE / PK / FK; usado para constraint, não scan.
3. **Candidato real à remoção** — tabela populada, índice nunca acessado em consulta.

## Classificação

| Padrão | Exemplos | Categoria |
|--------|----------|-----------|
| `*_pkey` | todos | Obrigatório — PK |
| `*_unique` / `*_uidx` | `pacientes_tenant_cpf_unique`, `pacientes_tenant_friendly_id_uidx`, `orcamentos_*_uidx` | Obrigatório — UNIQUE |
| `idx_<tabela>_tenant_*` em tabelas com < 100 linhas | `tabela_preco_itens`, `select_options`, `setores_laboratoriais`, `recoletas_motivos`, `materiais_amostra` | Base vazia/pequena — manter |
| `idx_integration_*` em fluxos não ativados | maioria de `integration_*` | Aguardando Interface Engine (fase futura) — manter |
| `idx_whatsapp_outbox_*` | em uso baixo até go-live total do WhatsApp 2.0 | Manter |
| Novo: `idx_pacientes_tenant_nome_asc` | recém-criado | Ainda não usado (estatísticas serão atualizadas no próximo `ANALYZE`) |

## Candidatos reais à remoção

Identificados após cruzar `idx_scan = 0` com `relpages > 100` (tabela povoada):

**Nenhum.** Todas as tabelas com índices não-usados ou estão sub-povoadas, ou os índices são UNIQUE/PK.

## Recomendação

**Não remover índices nesta fase.** Reavaliar quando:
- algum tenant ultrapassar 10 k atendimentos,
- Interface Engine entrar em produção (alterando padrões de query sobre `integration_*`).
