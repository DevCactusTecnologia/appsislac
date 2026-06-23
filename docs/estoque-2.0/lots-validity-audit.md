# Lotes e Validade — Estoque 2.0

## Controle real
- Cada `estoque_lotes` tem `numero_lote`, `data_validade`, `quantidade_inicial`, `quantidade_atual`, `custo_unitario`, `data_entrada`, `nota_fiscal`, `status`.
- Status válidos (texto livre, sem CHECK): `ativo | esgotado | vencido | descartado`.
- Frontend usa `statusValidade(data_validade, alerta_dias)` para classificar em `ok | vence_em_breve | vencido` (visual), independente do campo `status` no banco.

## Rastreabilidade
- Cada lote vincula `insumo_id`, `fornecedor_id`, `nota_fiscal`.
- Movimentações guardam `lote_id`, permitindo reconstituir consumo por lote.
- Falha: se o lote é excluído, movimentações ficam órfãs (`lote_id` SET NULL).

## Alertas de vencimento
| Camada | Como funciona | Status |
|---|---|---|
| Visual no app | Linha "Xd vencido / vence hoje / Xd restantes" + badge colorido. KPI "Vencendo em breve" e "Lotes vencidos" no topo. | ✅ Funciona quando o operador abre a página. |
| Painel de inteligência | DecisionPanel lista vencidos/vencendo como crítico. | ✅ Funciona on-page. |
| Marcar status='vencido' no banco | RPC `estoque_marcar_lotes_vencidos()` | ❌ **NUNCA é chamada** (sem cron, sem trigger, sem invocação no front). Lotes com `status='ativo'` e validade passada nunca migram para `'vencido'`. |
| Notificação proativa (email, WhatsApp, push) | — | ❌ Não existe. |

## Risco / Gap
1. Operador sai de férias → lotes vencem em silêncio. Nenhum alerta sai do app.
2. `status` no banco fica eternamente `ativo` mesmo após validade — relatórios externos (backup, integrações) refletem dado incorreto.
3. FEFO (first-expire-first-out) não é forçado: `MovimentacaoDialog` deixa o operador escolher qualquer lote ativo. UI ordena por validade ASC, mas não obriga.

## Resposta direta
- **Controle real?** Sim, no app.
- **Rastreabilidade?** Sim, enquanto o lote existir.
- **Alerta?** Apenas visual quando alguém abre o módulo. Nenhum disparo automático.
