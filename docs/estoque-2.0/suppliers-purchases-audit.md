# Fornecedores e Compras — Estoque 2.0

## Fornecedores
- Tabela: `estoque_fornecedores` (10 colunas: nome, cnpj, contato, telefone, email, ativo + tenant + timestamps).
- UI: 2 portas de entrada para o mesmo CRUD:
  - `/configuracoes` → aba **Fornecedores** (`FornecedoresTab`).
  - `/estoque` → modal `FornecedorDialog` é aberto a partir do `LoteDialog`/`InsumoDialog` para cadastro inline.
- Vinculados em: `estoque_insumos.fornecedor_id` e `estoque_lotes.fornecedor_id`.

## Compras / Pedidos
| Recurso | Existe? |
|---|---|
| Tabela de pedidos de compra | ❌ |
| Cotações | ❌ |
| Status de pedido (rascunho / enviado / recebido) | ❌ |
| Recebimento separado da entrada | ❌ |
| Vínculo com nota fiscal estruturada (XML, número, série) | ⚠ apenas campo texto `nota_fiscal` no lote |
| Histórico de preços por fornecedor | ⚠ implícito em `custo_unitario` dos lotes, sem agregação |

## É realmente utilizado?
- Fornecedor: usado como rótulo informativo em colunas e relatórios. Não bloqueia nada, não dispara nada.
- Compras: não existem. O ciclo "comprar → receber" colapsa em "criar lote".

## Agrega valor?
- **Fornecedor**: sim, como dado de contato e para análise simples ("de quem comprei este lote?"). Vale manter, simplificado.
- **Compras** (não implementadas): não há sinal de demanda real do laboratório. Seguir filosofia "olhou, entendeu, resolveu" sugere **não criar** módulo de compras agora — usar campo `nota_fiscal` no lote como suficiente.

## Resposta direta
- **Realmente utilizado?** Fornecedor sim (passivamente); compras não existem.
- **Agrega valor?** Fornecedor agrega pouco mas custa quase nada. Compras formais não devem ser introduzidas sem demanda explícita.
- **Ou apenas complexidade?** Hoje, complexidade controlada. Adicionar pedidos/cotações sem demanda real seria over-engineering.
