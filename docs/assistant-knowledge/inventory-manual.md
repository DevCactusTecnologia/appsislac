# Manual de Estoque

## Objetivo
Controlar insumos, lotes e validades.

## Fluxo
```
Entrada (nota/compra) → Lote (validade) → Consumo (saída) → Reposição (alerta de mínimo)
```

## Conceitos
- **Lote**: identifica fabricação e validade.
- **Saída**: pode ser por uso técnico, perda ou ajuste.
- **Reposição**: disparada por estoque mínimo.

## Principais perguntas
- "Quais reagentes estão vencendo?"
- "Qual o saldo do lote X?"
- "Preciso repor algo esta semana?"

## Principais ações
| Intenção | Capability |
| --- | --- |
| Listar próximos a vencer | `estoque.vencendo` (quando registrada) |
| Saldo por item | `estoque.saldo` (quando registrada) |

## Boas práticas
- Sempre registrar lote na entrada.
- FEFO (First Expire, First Out) no consumo.
- Conferir validade antes da liberação técnica.
