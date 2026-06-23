# Soroteca — Movimentações inteligentes, histórico, IA e validações

Escopo focado em ampliar `/soroteca/estrutura` (mapa 2D) e adicionar fluxos de movimentação seguros e auditáveis. Sem mudança de rotas, sem novas deps de runtime, mantendo SaaS multi-tenant.

## 1. Banco de dados (1 migration)

Nova tabela `public.amostra_movimentacoes` para histórico imutável de movimentações entre posições:

- `id uuid pk`, `tenant_id uuid not null default current_tenant_id()`
- `amostra_id uuid not null` (fk lógica)
- `posicao_origem_id uuid`, `posicao_destino_id uuid not null`
- `caminho_origem text`, `caminho_destino text` (snapshot legível: Local / Galeria / Código)
- `motivo text` (ex.: `manual`, `otimizacao_ia`, `undo`, `conflito_resolvido`)
- `lote_id uuid` (agrupa movimentações da mesma reorganização IA)
- `desfeita boolean default false`, `desfeita_em timestamptz`, `desfeita_por uuid`
- `executada_por uuid not null default auth.uid()`, `created_at timestamptz default now()`
- Índices: `(tenant_id, amostra_id, created_at desc)`, `(tenant_id, lote_id)`
- GRANT padrão + RLS (4 policies: `current_tenant_id() = tenant_id` + `has_permission`/`is_super_admin`)

Função `public.mover_amostra(p_amostra uuid, p_destino uuid, p_motivo text, p_lote uuid)`:
- `security definer`, valida tenant, lê alocação ativa
- Valida posição destino: ativa, livre (sem alocação ativa), mesma `galeria` opcional? não — entre galerias é permitido
- Valida compatibilidade térmica (ver §4)
- Em transação: encerra `amostra_alocacoes` ativa (set `liberada_em`), insere nova alocação para destino, insere linha em `amostra_movimentacoes`
- Atualiza `amostras.atualizada_em` (data de movimentação)
- Retorna `movimentacao_id`

Função `public.desfazer_movimentacao(p_mov uuid)`:
- Lê movimentação, valida que é a última ativa da amostra e que origem ainda está livre
- Chama lógica simétrica (sem registrar nova mov de undo? sim — registrar com `motivo='undo'`, `desfeita=true` na original)

## 2. Edge function `soroteca-reorganizar-galeria` (IA)

- Input: `{ galeria_id }`
- Carrega posições + alocações + materiais + datas previstas de expurgo
- Monta prompt para `google/gemini-3-flash-preview` com `Output.object` schema:
  ```ts
  { movimentacoes: [{ amostra_id, posicao_destino_id, motivo }], resumo: string, ganho_estimado: string }
  ```
- Heurísticas no prompt: agrupar por material/temperatura, deixar próximas do expurgo nas posições de saída fácil (ordem baixa), consolidar espaços livres contíguos
- Valida output server-side: todas as amostras pertencem à galeria/tenant, posições destino válidas e únicas
- **Não aplica** — apenas retorna o plano. Aplicação é client-side via `mover_amostra` em loop com `lote_id` compartilhado

## 3. Frontend

### `src/data/sorotecaEstruturaStore.ts`
- `moverAmostra(amostraId, destinoId, motivo)` → chama RPC `mover_amostra`
- `desfazerMovimentacao(movId)` → RPC `desfazer_movimentacao`
- `listarMovimentacoes(filtros)` → últimas N por galeria/amostra com nome do usuário (join `profiles`)
- `validarCompatibilidade(amostraId, destinoId)` → checa material + temperatura do local (campo `temperatura` já existe em `locais_armazenamento`?). Se não houver, infere por nome ou usa `materiais_amostra.temperatura_recomendada` quando presente; senão retorna `ok`

### `src/pages/SorotecaEstrutura.tsx`
- Mapa 2D atual ganha drag-and-drop nativo HTML5 (`draggable`, `onDragStart/Over/Drop`) — sem nova dep
- Slot ocupado é arrastável; slot livre é alvo válido (highlight). Slot ocupado como alvo abre dialog de troca (swap) com aviso
- Drop dispara `validarCompatibilidade` → se warning, abre `ConfirmarMovimentacaoDialog` (motivo, alerta térmico, paciente, origem→destino). Confirmar chama `moverAmostra` + toast com botão **Desfazer** (chama `desfazerMovimentacao`)
- Novo botão **Histórico** no header da galeria → `HistoricoMovimentacoesDialog` (lista paginada, badge "desfeita", botão desfazer por linha quando elegível, mostra usuário)
- Novo botão **Reorganizar com IA** → chama edge function, abre `ReorganizarPreviewDialog`:
  - Tabela: Amostra · Origem · Destino · Motivo
  - Diff visual sobre o mapa (cores: vai sair / vai entrar)
  - Resumo + ganho estimado
  - Ações: **Aplicar tudo** (loop com `lote_id`, progresso, rollback automático se falhar metade) · **Aplicar selecionados** · **Descartar**
- Conflitos: se durante aplicação em lote uma posição destino virou ocupada (race), abre `ResolverConflitoDialog` (manter atual, mover atual para próxima livre, pular)

### Componentes novos em `src/components/soroteca/`
- `ConfirmarMovimentacaoDialog.tsx`
- `HistoricoMovimentacoesDialog.tsx`
- `ReorganizarPreviewDialog.tsx`
- `ResolverConflitoDialog.tsx`

Todos usam `SorotecaDialogShell` (padrão flat já estabelecido).

## 4. Validações de conflito e compatibilidade

- **Posição ocupada (swap)**: drop em slot ocupado → dialog "Trocar amostras" (executa duas movimentações no mesmo `lote_id`, via posição temporária se necessário — na prática: mover A para destino direto falha por unique; então estratégia = mover B para origem de A primeiro, depois A para destino)
- **Temperatura incompatível**: bloqueia com aviso forte mas permite override com `motivo` obrigatório (registrado em `amostra_movimentacoes.motivo`)
- **Material incompatível com galeria** (se galeria tem `material_id` definido): igual ao térmico, bloqueia com override
- **Race condition**: RPC `mover_amostra` retorna erro com código `posicao_ocupada` → UI exibe `ResolverConflitoDialog`
- **Posição inativa**: bloqueio duro, sem override

## 5. Out of scope

- Drag-and-drop entre galerias diferentes via UI (apenas via diálogo manual de mover)
- Mobile drag (touch) — para desktop/tablet por enquanto, mobile usa botão "Mover" no popover do slot
- Aprovação multi-usuário do plano de IA

## Ordem de execução

1. Migration (tabela + funções RPC) — aguarda aprovação do usuário
2. Edge function `soroteca-reorganizar-galeria`
3. Store helpers + tipos
4. Dialogs novos
5. Integração no mapa da `SorotecaEstrutura.tsx`
