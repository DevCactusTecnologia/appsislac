# Soroteca 2.0 — Fase 8 — Timeline real do Expurgo

## Objetivo
Mostrar, em linha do tempo, todos os eventos cronológicos de um lote de expurgo:
criação, início, descartes, pulos, conclusão e cancelamento — por lote e por item.

## Princípio (enxuto)
Nada de novas tabelas, novos status ou novos campos.
A timeline é **derivada** dos campos já existentes em `expurgo_lotes` e
`expurgo_itens`:

| Evento        | Origem                                                   |
|---------------|----------------------------------------------------------|
| Criação       | `expurgo_lotes.created_at` + `criado_por_nome`           |
| Início        | 1º `expurgo_itens.executado_em` (quando status ≠ PROGRAMADO) |
| Execução item | `expurgo_itens.executado_em` (status `EXECUTADO`)        |
| Pulo de item  | `expurgo_itens.executado_em` (status `PULADO`)           |
| Conclusão     | `expurgo_lotes.concluido_em`                             |
| Cancelamento  | `expurgo_lotes.cancelado_em` + `motivo_cancelamento`     |

## Implementação
- Componente `TimelineLote` inline em `src/pages/SorotecaExpurgo.tsx`.
- Usa `useMemo` para montar e ordenar a lista cronológica.
- Reutiliza `cn`, `lucide-react` e tokens já presentes na página.
- Aparece automaticamente no diálogo de detalhe do lote.

## UI
- Cabeçalho com ícone de relógio + contador de eventos.
- Coluna vertical com bolinhas coloridas por tipo de evento.
- Cada item: título, timestamp (`dd/MM/yyyy HH:mm`), descrição opcional e autor.
- `max-h-64 overflow-auto` para lotes grandes.

## Zero regressão
- Sem mudança no schema, RLS, triggers ou store.
- Sem dependências novas.
- Sem alteração em Atendimento, Coleta, Produção, Resultados.
- Scanner HID, etiquetas, reuso e expurgo permanecem inalterados.

## Critério de sucesso
O operador abre o detalhe de um lote → vê instantaneamente quando foi criado,
quando começou a executar, cada amostra descartada/pulada com hora e autor,
e quando foi concluído ou cancelado.
