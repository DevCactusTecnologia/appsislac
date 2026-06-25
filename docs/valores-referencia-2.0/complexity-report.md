# Relatório de Complexidade

## Tamanho dos arquivos relevantes (LOC)

| Arquivo | LOC |
|---|---|
| `src/components/configuracoes/ParametrosDialog.tsx` | 914 |
| `src/components/configuracoes/FiltrosDialog.tsx` | 624 |
| `src/components/configuracoes/MatrizValoresReferencia.tsx` | 456 |
| `src/components/configuracoes/FiltrosPorPerfil.tsx` | 439 |
| `src/pages/admin/AuditoriaVR.tsx` | 353 |
| `src/components/configuracoes/GerenciarReguasDialog.tsx` | 290 |
| `src/data/exameParametrosStore.ts` | 277 |
| `src/data/valoresReferenciaStore.ts` | 205 |
| `src/data/reguasEtariasStore.ts` | 131 |
| `src/domains/result/services/parseValorReferencia.ts` | 121 |
| `src/pages/ResultadoDetalhe/services/criticoPipeline.ts` | 62 |
| `src/domains/result/services/criticoChecker.ts` | 47 |
| **Total** | **3.919 LOC** apenas neste subsistema |

## Pontos de complexidade

1. **3 UIs para o mesmo dado**: Filtro, Matriz, Lista. Cada um tem seu próprio caminho de save/validação.
2. **Réguas etárias** introduzem outro modelo mental sem persistência server.
3. **2 fontes para "texto do laudo"** (descricao × valor_referencia).
4. **2 fontes para "crítico"** (parametro × VR).
5. **Conversões idade ↔ dias** dispersas (`idadeFaixas.ts`, `parseIdadeAnos`).
6. **Lookups por texto** (case-insensitive em JS) em vez de FK + index.

## Lógica espalhada

- Resolução de VR: `valoresReferenciaStore.resolverReferencia` + duplicação parcial em `laudoResolver`.
- Avaliação crítica: `criticoChecker` + `criticoPipeline` + override no `ResultadoDetalhe`.
- Formatação da idade: 3 helpers (`idade.ts`, `idadeFaixas.ts`, `idadeFormat.ts`).

## Risco

Alto **acoplamento implícito** (mudança em um nome de parâmetro quebra layouts). Sem testes de integração específicos para o pipeline completo Exame → VR → Laudo (existe apenas `formula.test.ts`).
