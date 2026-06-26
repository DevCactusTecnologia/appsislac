# Manual da Soroteca

## Objetivo
Armazenar amostras pós-análise para reanálise, complementação ou auditoria.

## Estrutura
- **Estrutura física**: geladeira → caixa → posição.
- **Triagem**: define o que entra na soroteca.
- **Materiais**: tipo de amostra (soro, plasma, sangue total).
- **Expurgo**: descarte após prazo regulamentar.

## Fluxo
```
Triagem → Armazenamento (posição definida) → Consulta → Reutilização ou Expurgo
```

## Principais perguntas
- "Onde está a amostra do atendimento X?"
- "Quais amostras vencem o prazo de soroteca esta semana?"
- "Posso reutilizar a amostra para outro exame?"

## Principais ações
| Intenção | Capability |
| --- | --- |
| Localizar amostra | `soroteca.localizar` (quando registrada) |
| Listar expurgo | `soroteca.expurgo` (quando registrada) |

## Boas práticas
- Posicionar amostra imediatamente após triagem.
- Nunca expurgar sem confirmação documentada.
