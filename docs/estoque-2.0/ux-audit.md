# UX e Operação — Estoque 2.0

## Página `/estoque`

### Estrutura visível
1. PageHeader com 4 ações: Histórico • Movimentar • Novo lote • Novo insumo.
2. 5 KPI cards: Insumos ativos · Lotes vencidos · Vencendo · Abaixo do mínimo · Sem estoque. 4 deles funcionam como toggle de smart filter.
3. DecisionPanel (3 colunas): Inteligência de estoque (críticos), Top consumo 30d, Taxa de descarte/consumo.
4. Tabs pill: Insumos | Lotes.
5. Filtros: select de categoria + busca livre.
6. Tabela ativa.
7. Drawer Histórico (sob demanda).

### O operador entende em <30s?
**Parcialmente.** Pros e contras:

✅ Pros
- KPIs claros, action-as-filter funciona bem.
- DecisionPanel comunica "o que fazer agora" — muito alinhado com a filosofia SISLAC.
- Apenas 2 tabs operacionais (Insumos / Lotes).
- Histórico fora da rota principal (drawer) — correto.

⚠ Contras
- 4 botões no header competem por atenção. "Movimentar" vs "Novo lote" pode confundir quem está aprendendo.
- KPI "Sem estoque" vs filtro "zerados" + "Abaixo do mínimo" + "Vencidos" — 4 filtros inteligentes, todos ativáveis individualmente, nenhum combinável. Cognitivo médio.
- Coluna "Mínimo" na tabela só faz sentido quando o operador sabe o que é estoque mínimo. Sem onboarding/tooltip.
- O DecisionPanel duplica informação dos KPIs (críticos = vencidos + zerados + baixo + vencendo). Boa redundância, mas pode pesar visualmente.
- 5 KPIs em mobile (2 colunas) viram 3 linhas — aceitável mas denso.
- Tipo "ajuste" no MovimentacaoDialog aceita valor negativo via texto — operador precisa ler hint para entender. Fonte de erro silencioso.

### Cards demais?
5 KPIs + DecisionPanel (3 sub-painéis) = 8 blocos informativos. Limite do tolerável para uma operação rápida.

### Filtros demais?
- Categoria (select) + busca + 4 smart filters. Os smart filters são bons; o select de categoria + busca cobre o resto. **OK**.

### Ações duplicadas?
- "Movimentar" aparece no header E em cada linha da tabela. Correto.
- "Novo lote" aparece no header E na linha do insumo. Correto.
- Não há duplicação problemática.

### Poluição visual?
Baixa-média. O design respeita a identidade Lovable minimalist. Cores indicativas (red/amber/emerald) são funcionais.

## Dialogs

### InsumoDialog
Form padrão (nome, categoria, unidade, fornecedor, estoque mínimo, alerta dias). Aceitável.

### LoteDialog
**Risco UX**: campo `quantidade_atual` editável em modo edição → bypass do histórico. Operador não percebe consequência.

### MovimentacaoDialog
Bom: 4 cards de tipo de movimento, hint contextual. Ruim: "ajuste" aceitando negativo via input numérico.

## Classificação por componente

| Item | Decisão sugerida |
|---|---|
| KPI cards | **Preservar** |
| DecisionPanel (Inteligência) | **Preservar** — alinhado com filosofia. |
| Tab Insumos | **Preservar** |
| Tab Lotes | **Preservar** |
| Drawer Histórico | **Preservar** |
| InsumoDialog | **Simplificar** — remover `observacao` e `codigo` se não usados; tornar `alerta_validade_dias` herdável de default global. |
| LoteDialog (campo qty_atual editável) | **Refatorar** — tornar somente leitura; forçar ajuste via movimentação. |
| MovimentacaoDialog "ajuste negativo" | **Refatorar** — separar em "ajuste +" e "ajuste -" ou pedir saldo final esperado e gerar delta automático. |
| FornecedorDialog inline | **Preservar** |
| RPC `estoque_marcar_lotes_vencidos` | **Remover** (ou ativar via cron diário). |
| Tela de Inventário cíclico | **Não criar** sem demanda explícita. |
| Pedidos de compra | **Não criar** sem demanda explícita. |

## Respostas diretas
- **Entende em <30s?** Operador treinado sim; novo, parcialmente.
- **Cards demais?** No limite, não excessivo.
- **Filtros demais?** Não.
- **Ações duplicadas?** Não.
- **Poluição visual?** Baixa.
