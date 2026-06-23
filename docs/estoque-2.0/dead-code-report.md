# Código Morto / Não Utilizado — Estoque 2.0

> Apenas documentação. Nada foi removido.

## Backend

| Item | Local | Status |
|---|---|---|
| RPC `estoque_marcar_lotes_vencidos()` | migration 20260423220056 | **Órfã.** Exportada nos types mas nenhum chamador no projeto (frontend, edge function ou cron). |
| Trigger `touch_*` em `estoque_fornecedores/insumos/lotes` | mesma migration | Usadas ✅. |
| Index `idx_estoque_insumos_categoria` | migration | Provavelmente subutilizado — categoria é filtro client-side. Não chega a ser código morto, mas baixo ROI. |
| Index `idx_estoque_insumos_nome` | migration | Subutilizado — busca por nome é client-side com `searchNormalize`. Baixo ROI. |
| Policy de DELETE em `estoque_movimentacoes` | migration | Existe e é perigosa (ver security-audit). Tecnicamente em uso (admin pode acionar), mas não há UI que dispare delete. |

## Frontend

| Item | Local | Status |
|---|---|---|
| Comentário "FornecedoresTabela removida" + bloco morto | `src/pages/Estoque.tsx:678` | OK — só comentário. |
| `UNIDADES_MEDIDA` exportado | `estoqueStore.ts` | Usado em `InsumoDialog`/`LoteDialog`? Verificar — pode ser hard-coded duplicado. |
| `CATEGORIAS_INSUMO` | `estoqueStore.ts` | Usado em `Estoque.tsx` e diálogos. ✅. |
| Tipo `MovimentacaoTipo` "ajuste" com lógica especial | `MovimentacaoDialog` permite negativo | Funciona, mas UX exótica; raramente usada. |
| Filtro `categoria` na aba Lotes | `Estoque.tsx` | Aplica filtro categoria via insumo — funciona, mas overlap com aba Insumos. |

## RPCs / triggers redundantes
- Nenhuma redundância de trigger detectada.
- O par "criar lote com qtd inicial" + "registrar movimentação 'entrada'" é redundância **intencional** (atalho UX).

## Conclusão
- 1 RPC verdadeiramente morta (`estoque_marcar_lotes_vencidos`).
- 2 índices de baixo ROI por não haver query do banco que se beneficie deles.
- 0 componente React órfão.
- 0 store/serviço órfão.
- Código morto do módulo é mínimo — é o ponto positivo do estoque atual.
