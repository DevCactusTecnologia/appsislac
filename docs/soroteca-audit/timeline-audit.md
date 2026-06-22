# Soroteca — Timeline e Auditoria

## Timeline da amostra (`AmostraDetalheDialog`)
Construída **sinteticamente** em `sorotecaStore.ts:781-844` a partir de campos das tabelas — **sem consultar `audit_logs`**:

| Evento | Origem |
|---|---|
| `CRIACAO` | `amostras.created_at` (linha 785) |
| `REUTILIZACAO` / `ANALISE` / `LIBERACAO` | campos de `atendimento_exames` (linhas 794-821) |
| `DESCARTE` / `VENCIDA` | `amostras.status` + `amostras.updated_at` (linhas 825-841) |

A label "Histórico e auditoria" em `AmostraDetalheDialog.tsx:512,516` é **cosmética** — os dados não vêm da auditoria.

## Timeline do lote de expurgo
**Não existe componente `TimelineLote`.** A página de expurgo lista itens diretamente de `expurgo_itens` via `listarItens`. Sem visualização cronológica de eventos do lote.

## `audit_logs`
- Tabela criada em `migration 20260424144244`.
- Função genérica `audit_trigger()` cria triggers dinâmicos via `EXECUTE format(...)`.
- **Confirmado:** `materiais_amostra` está coberto (trigger explícito em `migration 20260622223230:87`).
- **Não confirmado:** `amostras`, `amostra_alocacoes`, `amostra_emprestimos`, `expurgo_*` — nenhuma migration lida cria triggers de auditoria explícitos para essas tabelas.

## Duplicação
- A "timeline" da amostra é uma **fonte paralela** à `audit_logs`. Se ambos passarem a existir, haverá divergência.

## Fonte única
Hoje, **não há** fonte única de timeline. Cada modal monta a sua a partir dos campos das próprias tabelas.
