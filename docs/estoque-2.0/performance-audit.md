# Performance — Estoque 2.0

## Consultas atuais

| Função | Query | Tamanho típico | Risco |
|---|---|---|---|
| `listarFornecedores` | `SELECT * FROM estoque_fornecedores ORDER BY nome` | dezenas | baixo |
| `listarInsumos` | `SELECT * FROM estoque_insumos ORDER BY nome` | centenas | baixo |
| `listarLotes` | `SELECT * FROM estoque_lotes ORDER BY data_validade ASC` | centenas a milhares | médio com o tempo |
| `listarMovimentacoes({limit:200})` | `SELECT * ... ORDER BY data DESC LIMIT 200` | 200 fixos | baixo |

### Observações
- **SELECT \*** em todas as funções — traz colunas que o frontend não consome. Para `lotes` e `movimentacoes` cresce com a operação.
- Sem paginação real em `listarInsumos` e `listarLotes` — todo o tenant é trazido em uma chamada.
- `listarMovimentacoes` tem limite hard-coded de 200, sem cursor/offset. Drawer Histórico nunca mostra além disso.
- Em `Estoque.tsx`, `carregar()` dispara as 4 listas em paralelo (`Promise.all`) — bom.
- KPIs e DecisionPanel são calculados via `useMemo` sobre os arrays carregados — sem chamadas extras (correto).

## Padrões problemáticos
- **N+1**: não detectado (não há fetch por item).
- **Cálculo de saldo no cliente** (`totalEstoque`): O(L) por insumo, dentro de `useMemo`. Para 500 insumos × 2000 lotes ≈ 1M ops — ainda viável, mas degrada com a base. Solução natural: view materializada `vw_estoque_saldo_atual` ou coluna calculada no banco.
- **Consumo 30d no cliente**: itera todas as movimentações carregadas (limit=200). Se houver dia com mais de 200 movimentações, o KPI fica errado por amostragem incompleta.

## Índices
Cobertura adequada para SELECT por tenant + filtro principal:
- insumos: `(tenant_id)`, `(tenant_id, categoria)`, `(tenant_id, nome)` — extras provavelmente subutilizados.
- lotes: `(tenant_id)`, `(insumo_id)`, `(tenant_id, data_validade)` — bom.
- movimentações: `(tenant_id)`, `(insumo_id)`, `(lote_id)`, `(tenant_id, data DESC)` — bom para a query principal.
- Sem índice composto `(tenant_id, insumo_id, status)` que beneficiaria o cálculo de saldo.

## Filtros / paginação
- Tabs Insumos/Lotes filtram em memória — funciona até alguns milhares de itens; ruim acima disso.
- Smart filters (vencidos/vencendo/baixo/zerados) também em memória.

## Resposta direta
- **SELECT \*?** Sim, em todas as queries do estoque.
- **N+1?** Não.
- **Carregamento desnecessário?** Sim — `listarLotes` e `listarInsumos` trazem 100% do tenant todo refresh.
