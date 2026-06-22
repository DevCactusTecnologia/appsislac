# Soroteca — Estrutura Física

## Hierarquia
`locais_armazenamento → galerias → posicoes_galeria` com `amostra_alocacoes` ligando amostra ↔ posição.

## Operações
- **Locais:** `criarLocal:95`, `atualizarLocal:122`, `removerLocal:137` (`sorotecaEstruturaStore.ts`).
- **Galerias:** `criarGaleria:156`, `atualizarGaleria:179`, `removerGaleria:194`.
- **Posições:** `criarPosicao:213`, `criarPosicoesEmLote:239`, `atualizarPosicao:262`, `removerPosicao:277`.

`atualizarLocal/Galeria/Posicao` são **importadas mas não chamadas** pela UI (`SorotecaEstrutura.tsx:712-714` usa `void` para suprimir warning). UI ainda não tem edição inline.

## Sugestão automática
`proximaPosicaoLivre` (`sorotecaEstruturaStore.ts:289-311`) — dois roundtrips: busca posições ativas no escopo (galeria ou local) + coleta `amostra_alocacoes.posicao_id` com `retirada_em IS NULL` e retorna a primeira sem alocação ativa.

## Path completo
`getPosicaoCaminho` (`:411`) — join `posicoes_galeria → galerias!inner → locais_armazenamento!inner` numa só query.

## Consistência e conflitos — garantida no banco
- `uniq_posicao_ativa` (PARTIAL WHERE `retirada_em IS NULL`) em `amostra_alocacoes` — uma posição não pode ter duas alocações ativas (migration `20260622213755:180`).
- `uniq_amostra_alocacao_ativa` (PARTIAL WHERE `retirada_em IS NULL`) — uma amostra não pode estar em duas posições ao mesmo tempo (mesma migration, linha 184).

## Riscos
- Sem fluxo UI de **movimentação** de amostra para outra posição (precisa retirar e re-alocar manualmente).
- Sem fluxo UI de **edição** de local/galeria/posição (mortas, ver `dead-code-report.md`).
- Sem **soft-delete**: `removerLocal/Galeria/Posicao` fazem `delete` físico — se existir alocação ativa, o banco bloqueia via FK; se inativa, perde a referência histórica.
