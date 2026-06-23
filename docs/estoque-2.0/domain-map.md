# Mapa de Domínio — Estoque 2.0

## Entidades reais

```
Fornecedor (catálogo institucional, /configuracoes)
   │
   ├── 1:N ── Insumo (catálogo operacional)
   │            │
   │            └── 1:N ── Lote (estoque físico real)
   │                        │
   │                        └── 1:N ── Movimentacao (auditoria de delta)
   │
   └── 1:N ── Lote (denormalizado em lote.fornecedor_id)
```

## Tabela por tabela

### `estoque_fornecedores`
- **Quem cria/altera**: admin do tenant via `FornecedorDialog` (a partir de Configurações > Fornecedores OU do `LoteDialog`/`InsumoDialog` no estoque).
- **Quem consome**: `estoque_insumos.fornecedor_id`, `estoque_lotes.fornecedor_id`. Exibido em colunas das tabelas de Insumos/Lotes.
- **Dependentes**: insumos e lotes (FK SET NULL — pode deletar sem quebrar).

### `estoque_insumos` (catálogo)
- **Quem cria/altera**: admin via `InsumoDialog`.
- **Quem consome**: `estoque_lotes.insumo_id`, `estoque_movimentacoes.insumo_id`. Painel de Inteligência, KPIs e DecisionPanel.
- **Dependentes**: lotes (CASCADE: apagar insumo apaga seus lotes — risco operacional, ver `security-audit.md`).
- **NÃO armazena saldo** — saldo é derivado da soma dos lotes ativos via `totalEstoque()`.

### `estoque_lotes` (estoque real)
- **Quem cria/altera**: admin via `LoteDialog` (criação gera entrada automática se `quantidade_inicial > 0`). Updates de saldo são feitos pela trigger.
- **Quem consome**: tabelas de Lotes, cálculo de saldo, painel de inteligência (vencimento), KPIs.
- **Dependentes**: movimentações (FK SET NULL).
- **Fonte de verdade de**: saldo físico, validade, custo unitário, status.

### `estoque_movimentacoes` (audit log + motor de delta)
- **Quem cria**: admin via `MovimentacaoDialog` + criação automática pelo `LoteDialog` (entrada inicial).
- **Quem consome**: drawer Histórico, cálculo de consumo 30d no DecisionPanel.
- **Dependentes**: nenhum.
- **Particularidade**: não é só log — é o *único caminho válido* para alterar `quantidade_atual` (via trigger). Mas o frontend ainda permite editar `quantidade_atual` direto pelo `LoteDialog` (ver `entries-audit.md`).

## SSOT
- **Saldo por insumo** → SUM `estoque_lotes.quantidade_atual` WHERE `status = 'ativo'` (helper `totalEstoque`).
- **Saldo por lote** → `estoque_lotes.quantidade_atual` (escrito por trigger).
- **Custo médio em estoque** → SUM `quantidade_atual * custo_unitario` dos lotes ativos.
- **Consumo histórico** → `estoque_movimentacoes.tipo IN ('saida','descarte')` agregado por data.

## Conceitos ausentes (intencionalmente ou não)
- Pedido de compra
- Recebimento (separado da entrada manual)
- Inventário cíclico (contagem com fechamento)
- Transferência entre unidades
- Reserva / consumo vinculado a atendimento ou exame
- Categorias por tenant (lista é hard-coded em `CATEGORIAS_INSUMO`)
- Unidades de medida por tenant (hard-coded em `UNIDADES_MEDIDA`)
