# Ciclo de Vida do Item — Estoque 2.0

## Fluxo real implementado

```
[1] Cadastro do INSUMO  (catálogo)
        │  InsumoDialog → estoque_insumos
        ▼
[2] Cadastro do LOTE    (estoque físico)
        │  LoteDialog → estoque_lotes
        │              ↳ se qtd_inicial>0 → registra movimentação 'entrada'
        ▼
[3] Estoque ATIVO (lote.status='ativo', quantidade_atual>0)
        │
        ├──► [4a] CONSUMO  → MovimentacaoDialog 'saida'  → trigger -qtd → se=0 status='esgotado'
        ├──► [4b] DESCARTE → MovimentacaoDialog 'descarte' → trigger -qtd → se=0 status='esgotado'
        ├──► [4c] AJUSTE   → MovimentacaoDialog 'ajuste'   → trigger +/-qtd
        └──► [4d] ENTRADA EXTRA → MovimentacaoDialog 'entrada' → trigger +qtd
        ▼
[5] Lote ESGOTADO ou VENCIDO
        │  vencido só vira 'vencido' se RPC `estoque_marcar_lotes_vencidos` for executada
        │  (RPC existe mas NUNCA é chamada — ver dead-code-report.md)
        ▼
[6] Lote DESCARTADO  (status='descartado' apenas via edição manual no LoteDialog)
```

## Etapas redundantes / paralelas

1. **Edição direta de `quantidade_atual`** no `LoteDialog` é um caminho paralelo ao trigger — gera divergência com o histórico. Ver `entries-audit.md`.
2. **Status do lote** pode ser:
   - escrito pela trigger (`esgotado`)
   - escrito por RPC nunca usada (`vencido`)
   - escrito manualmente no LoteDialog (`descartado`)
   - calculado on-the-fly no frontend por `statusValidade()` (sobrepõe o valor do banco)
   → 4 fontes para 1 mesmo campo.
3. **Entrada inicial automática** ao criar lote *e* `MovimentacaoDialog 'entrada'` são dois caminhos para o mesmo efeito. OK como atalho, mas precisa documentação clara para o operador.

## Etapas inexistentes
- Compra → Pedido → Recebimento: tudo colapsa em "criar lote".
- Reserva / pré-baixa por atendimento: não existe vínculo com `atendimento_exames`.
- Inventário (contagem com snapshot e reconciliação): só há "ajuste" pontual.
- Transferência entre unidades: não modelada.

## Conclusão
O ciclo real é minimalista e funcional para um laboratório pequeno: Cadastro → Lote → Consume → Esgota.
Toda complexidade extra é potencial, não realizada — boa base para simplificar, ruim para escalar sem decisões adicionais.
