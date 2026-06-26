# Manual de Resultados e Laudos

## Objetivo
Registrar valores dos parâmetros, validar clinicamente e liberar o laudo.

## Fluxo
```
Digitação → Validação clínica (sexo+idade) → Conferência → Liberação → Laudo (PDF) → Entrega
```

## Regras críticas
- Liberação **exige confirmação** do usuário — o Assistente nunca libera sozinho.
- Após liberado, edição é bloqueada (somente reaberto com justificativa).
- Valores de referência resolvidos no momento da digitação.
- Resultados críticos exigem marcação e conduta.

## Impressão
- Layout científico, quando definido, prevalece.
- Marca d'água respeita configuração do tenant + flag do documento.
- Cabeçalho e rodapé do laudo são travados (não alterar sem pedido explícito).

## Principais perguntas
- "Abra o hemograma da Alicia."
- "Insira 4,5 em Hemácias."
- "Libere o resultado."
- "Esse valor está crítico?"
- "Quantos resultados pendentes de liberação?"

## Principais ações
| Intenção | Capability |
| --- | --- |
| Abrir resultado | `resultado.abrir` (quando registrada) |
| Preencher parâmetro | `resultado.preencher` (quando registrada) |
| Liberar | `resultado.liberar` (needsApproval) |
| Listar críticos | `resultado.criticos` (quando registrada) |

## Erros frequentes
- Liberar com parâmetro vazio.
- Liberar sem revisar crítico.
- Digitar valor sem confirmar unidade.

## Boas práticas
- Sempre revisar críticos antes de liberar.
- Usar Enter para navegar entre parâmetros (mantém ritmo de digitação).
