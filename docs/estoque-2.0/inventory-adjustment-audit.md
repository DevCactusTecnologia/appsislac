# Inventário (Contagem) — Estoque 2.0

## Estado atual

| Recurso | Existe? |
|---|---|
| Tela de contagem cíclica | ❌ |
| Snapshot de saldo em data X | ❌ |
| Lista de divergências | ❌ |
| Fechamento / reconciliação | ❌ |
| Histórico de inventários | ❌ |
| Aprovação de ajuste por outro perfil | ❌ |

## Como corrigem divergências hoje
Somente via `MovimentacaoDialog` tipo `ajuste`:
- Operador digita a diferença (positiva ou negativa) em um único lote.
- Campo `motivo` é texto livre.
- Movimentação fica no histórico — **sem agrupamento por sessão de contagem**.

## Existe histórico de ajustes?
Sim: filtrando `estoque_movimentacoes WHERE tipo='ajuste'`. Porém:
- Não há agrupamento por evento de contagem (cada ajuste é solitário).
- Não há campo "saldo antes / saldo depois" — só o delta.
- Admin pode deletar o registro de ajuste.

## Auditoria
- Sem aprovação de duplo controle.
- Qualquer admin do tenant aplica qualquer ajuste em qualquer lote, sem teto, sem motivo obrigatório.

## Resposta direta
- **Como corrigem divergências?** Movimentação `ajuste` pontual.
- **Histórico?** Existe linha a linha; não existe conceito de "inventário".
- **Auditoria?** Mínima: usuario_email + data. Sem aprovação, sem snapshot, sem evidência fotográfica.
