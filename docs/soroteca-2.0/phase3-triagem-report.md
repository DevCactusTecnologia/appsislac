# Soroteca 2.0 — Fase 3 · Triagem e Armazenamento

## Como a triagem funciona?
1. Operador foca a tela `/soroteca/triagem` (captura HID global ativa).
2. Bipa a etiqueta da amostra → `buscarAmostraPorCodigo()` localiza 1 registro.
3. Sistema valida alocação ativa via `getAlocacaoAtiva()`:
   - Se já alocada → bloqueia com **"Amostra já armazenada"** e mostra a localização atual.
   - Se não alocada → chama `proximaPosicaoLivre({})` e exibe sugestão "Local › Galeria › Posição".
4. Operador clica **Armazenar** → `alocarAmostra()` insere em `amostra_alocacoes`.
5. Trigger `sync_amostra_localizacao()` (Fase 2) atualiza o campo legado `amostras.localizacao`.

## Quantos cliques?
- **1 bip + 1 clique** no fluxo padrão.
- Tempo-alvo: < 10s, sem treinamento.

## Como a posição é sugerida?
Exclusivamente via `proximaPosicaoLivre()` da Fase 2. Sem escopo na 1ª iteração (qualquer local/galeria do tenant); retorna a primeira posição ativa sem alocação ativa, ordenada por `ordem, codigo`.

## Existe escolha manual?
Sim, como **exceção**. Botão "Trocar" abre diálogo com seleção em cascata Local → Galeria → Posição (apenas posições livres listadas). Fluxo padrão continua sendo aceitar a sugestão.

## Houve criação de novos status?
**Não.** Nenhum status novo em `amostras`. A regra é derivada:
- Sem alocação ativa → "Pendente de Armazenamento".
- Com alocação ativa → "Armazenada".

## Houve duplicação de dados?
**Não.** Verdade única em `amostras` + `amostra_alocacoes`. Nenhuma tabela nova nesta fase.

## Quais permissões foram utilizadas?
`registrar_coleta` (mesma das demais rotas Soroteca). Nenhuma permissão nova criada — alinhado ao escopo "Nenhuma nova permissão nesta fase".

## Houve regressão?
**Não.** Nenhum store/tela existente foi alterado:
- `sorotecaStore.ts` intocado.
- `Soroteca.tsx`, `SorotecaEstrutura.tsx` intocados.
- Trigger e RLS da Fase 2 reaproveitados.
- `tsc --noEmit` passa sem erros.

## O scanner HID foi preservado?
**Sim.** Mesma estratégia da página `/soroteca`: listener `keydown` global, buffer com janela de 50ms, finalizado com `Enter`. Não interfere quando há input/textarea/select focado ou diálogo aberto.

## A filosofia de simplicidade foi respeitada?
Sim:
- 1 arquivo de página (`SorotecaTriagem.tsx`).
- 0 services novos — reuso de `alocarAmostra`/`proximaPosicaoLivre`.
- 0 tabelas novas.
- 0 RPCs novas.
- 0 status novos.
- Diálogo de troca manual minimalista (apenas selects em cascata).

## Arquivos criados
- `src/pages/SorotecaTriagem.tsx` — página única da triagem.
- `docs/soroteca-2.0/phase3-triagem-report.md` — este relatório.

## Arquivos alterados
- `src/data/sorotecaEstruturaStore.ts` — adicionados helpers de leitura:
  `buscarAmostraPorCodigo`, `getAlocacaoAtiva`, `getPosicaoCaminho`,
  `contarPendentesArmazenamento`. Nenhum método existente alterado.
- `src/App.tsx` — registro da rota `/soroteca/triagem` (lazy).

## Casos cobertos
| Caso | Resultado |
|------|-----------|
| Etiqueta válida + posição livre | Sugestão exibida, 1 clique armazena ✅ |
| Amostra já armazenada | Bloqueio: "Amostra já armazenada" + localização atual ✅ |
| Sem posição livre | Bloqueio: "Nenhuma posição livre encontrada" ✅ |
| Código inválido | Bloqueio: "Amostra não localizada" ✅ |

## Fora de escopo (próximas fases)
Empréstimos, devoluções, expurgo, retenção, dashboard, timeline, catálogo de materiais, movimentações avançadas — todos preservados para fases futuras conforme determinado.
