# Soroteca — Mapa de Domínio

> Quem cria, quem altera, quem consulta. Citações em `arquivo:linha`.

## `amostras`
- **Lê:** `sorotecaStore.ts:360` (listarAmostras), `:291` (buscarAmostrasReutilizaveis), `:509` (buscarAmostrasAvancado), `:682` (getAmostraDetalhe); `sorotecaEstruturaStore.ts:379` (buscarAmostraPorCodigo); `sorotecaExpurgoStore.ts:89` (preverCandidatas), `:156` (criarLote).
- **Escreve:** `sorotecaStore.ts:147` (criarAmostraParaExame INSERT), `:328` (reutilizarAmostra UPDATE → UTILIZADA), `:557` (atualizarAmostra patch); trigger `aplicar_expurgo_amostra` (UPDATE → DESCARTADA); trigger `sync_amostra_tipo_material`; trigger `sync_amostra_localizacao`.
- **RPCs:** `marcar_amostras_vencidas`, `gerar_codigo_amostra`.

## `materiais_amostra`
- **Lê:** `materiaisAmostraStore.ts:58`, `Soroteca.tsx:265`, `SorotecaExpurgo.tsx:55`.
- **Escreve:** `materiaisAmostraStore.ts:84,114,123` (criar/atualizar/remover).
- **Triggers:** `audit_materiais_amostra` → `audit_logs`.

## `locais_armazenamento`
- **Lê:** `sorotecaEstruturaStore.ts:83` (listarLocais), `SorotecaTriagem.tsx:422`.
- **Escreve:** `sorotecaEstruturaStore.ts:105,127,138` (criar/atualizar/remover — atualizar é código morto, ver dead-code-report).

## `galerias`
- **Lê:** `sorotecaEstruturaStore.ts:145`, `sorotecaStore.ts:443` (filtro de pesquisa).
- **Escreve:** `:164,184,194` (criar/atualizar/remover).

## `posicoes_galeria`
- **Lê:** `sorotecaEstruturaStore.ts:202`, `:295` (proximaPosicaoLivre), `:415` (getPosicaoCaminho), `sorotecaStore.ts:439`.
- **Escreve:** `:221,248,266,277` (criar/criarEmLote/atualizar/remover).

## `amostra_alocacoes`
- **Lê:** `sorotecaEstruturaStore.ts:304,390,406,437`, `SorotecaTriagem.tsx:449`.
- **Escreve:** `alocarAmostra:323` (INSERT), `retirarAmostra:344` (UPDATE retirada_em); trigger `aplicar_expurgo_amostra` (UPDATE retirada_em).

## `amostra_emprestimos`
- **Lê:** `sorotecaEmprestimosStore.ts:261,284,309`.
- **Escreve:** `:105` (solicitar), `:137` (aprovar), `:163` (rejeitar), `:184` (retirada), `:204` (devolução), `:232` (cancelar).
- **RPCs:** `amostra_em_emprestimo_ativo()` definida mas não chamada pelo frontend.

## `expurgo_lotes`
- **Lê:** `sorotecaExpurgoStore.ts:187,195`.
- **Escreve:** `:135,214,268,279` (criar/iniciar/concluir/cancelar); trigger `aplicar_expurgo_amostra` atualiza totais.

## `expurgo_itens`
- **Lê:** `:201,107`.
- **Escreve:** `:172` (insert batch), `:226` (executarItem), `:246` (pularItem).
- **Triggers:** `trg_expurgo_aplicar` → `aplicar_expurgo_amostra()`.
