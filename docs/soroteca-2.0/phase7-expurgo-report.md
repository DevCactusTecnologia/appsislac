# Fase 7 — Expurgo Programado

**Status:** ✅ Concluída
**Data:** 2026-06-22

## Objetivo

Implementar fluxo auditável de **descarte programado de amostras**, substituindo a marcação ad-hoc por lotes com critério, pré-visualização, execução controlada e snapshot histórico — sem regressão nos módulos existentes.

## Modelo de dados

### `expurgo_lotes`
Agendamento de descarte. Campos principais:
- `titulo`, `descricao`, `data_programada`
- `status` (`PROGRAMADO` → `EM_EXECUCAO` → `CONCLUIDO` | `CANCELADO`)
- Critério snapshot: `criterio_material_ids[]`, `criterio_coleta_ate`, `criterio_validade_ate`
- Totais agregados: `total_itens`, `total_executados`, `total_pulados`
- Auditoria: `criado_por_user_id/nome`, `concluido_em`, `cancelado_em`, `motivo_cancelamento`

### `expurgo_itens`
Uma linha por amostra dentro do lote:
- `lote_id`, `amostra_id`
- `status` (`PENDENTE` → `EXECUTADO` | `PULADO`)
- Snapshot da amostra no momento do agendamento (`snapshot_codigo_barra`, `snapshot_material`, `snapshot_localizacao`, `snapshot_data_coleta`, `snapshot_data_validade`)
- Auditoria: `executado_em`, `executado_por_user_id/nome`, `motivo_pulo`, `observacao`

**Índice único parcial** `uniq_expurgo_amostra_ativa` impede que a mesma amostra seja agendada em dois lotes pendentes simultaneamente.

## Trigger `aplicar_expurgo_amostra()`

`AFTER UPDATE` em `expurgo_itens`:
- Item passou a `EXECUTADO` → `amostras.status = 'DESCARTADA'`, `localizacao = ''` e a alocação ativa (`amostra_alocacoes` com `retirada_em IS NULL`) é fechada com `motivo_retirada = 'EXPURGO'`. O contador `total_executados` do lote é incrementado.
- Item passou a `PULADO` → incrementa `total_pulados`.

Resultado: o descarte físico é refletido automaticamente no estoque e nas posições, garantindo rastreabilidade ponta-a-ponta.

## Frontend

### Store — `src/data/sorotecaExpurgoStore.ts`
- `preverCandidatas(criterio)` — busca amostras `DISPONIVEL` no critério, excluindo amostras já agendadas em lote pendente.
- `criarLote(...)` — cria lote + insere itens (com snapshot) em transação lógica.
- `listarLotes / obterLote / listarItens`.
- `iniciarExecucao / executarItem / pularItem / concluirLote / cancelarLote`.

### Página — `src/pages/SorotecaExpurgo.tsx` (`/soroteca/expurgo`)
- **Listagem com abas:** Ativos / Programados / Em execução / Concluídos / Cancelados / Todos.
- **Card de lote:** título, status, data programada, barra de progresso (% processado), contadores `descartadas/puladas`.
- **Novo lote (wizard único):** título + data + critério (materiais, coleta_ate, validade_ate) → pré-visualização com checkboxes → criar com a seleção.
- **Detalhe / Execução:** lista de itens com snapshot, ações "Descartar" / "Pular" item a item, controles "Iniciar", "Concluir", "Cancelar lote" (com motivo obrigatório). Estatísticas vivas no topo.

## Segurança e RLS

- Tenant isolado via `current_tenant_id()`.
- `INSERT/UPDATE` exigem `has_permission(auth.uid(), 'armazenar_amostra')`.
- `DELETE` restrito a `super_admin`.
- Trigger é `SECURITY DEFINER` com `search_path = public` (atende padrão do projeto).

## Auditoria

- Quem criou o lote, quem executou cada item, quando, motivo de pulo, motivo de cancelamento.
- Snapshot da amostra preserva o estado original mesmo após o descarte físico.
- Alocação fechada registra `motivo_retirada = 'EXPURGO'`.

## Impacto em módulos existentes

- ✅ **Atendimento / Coleta / Resultados:** sem alterações de schema; apenas o `status` da amostra passa a `DESCARTADA` (mesmo enum já usado em outros descartes).
- ✅ **Estrutura física:** alocação ativa é liberada automaticamente — a posição volta a ficar livre para nova armazenagem (Fase 2/3 já tratam `retirada_em IS NULL`).
- ✅ **Empréstimos (Fase 6):** uma amostra agendada para expurgo continua bloqueada para reutilização e empréstimo enquanto pendente; após executada, é `DESCARTADA` (também bloqueia).
- ✅ **Catálogo (Fase 4):** o critério reutiliza `materiais_amostra.id`.

## Critério de sucesso

> Operador define critério, revisa amostras candidatas, agenda o lote e na data programada executa item a item com 1 clique — com motivo registrado em qualquer pulo, status sincronizado e auditoria completa.

✅ Atendido.

## Pendências para fases futuras

- **Fase 8 — Timeline real:** integrar eventos de expurgo na timeline da amostra (criação do lote, execução, pulo, cancelamento).
- **Notificações:** alertar responsáveis na data programada (depende de jobs agendados).
- **Relatórios:** exportação de lotes concluídos para conformidade.

---

**PARADA.** Aguardando aprovação explícita para a Fase 8 — Timeline real.
