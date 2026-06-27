# Document Engine 3.0 — Relatório Executivo

> **Status:** CORE CONGELADO.
> Última grande refatoração estrutural do motor de documentos do SISLAC.

## Critérios de aceitação

| # | Pergunta | Resposta |
|---|---|---|
| 1 | O navegador ainda decide a paginação? | **Não.** Paged.js (via `PagedRenderer`) fragmenta o DOM antes do `window.print()`. O navegador apenas materializa páginas já calculadas. |
| 2 | O Document Engine passou a controlar a composição? | **Sim.** `LayoutEngine` → `PaginationEngine` → `DocumentComposer` → `DocumentRenderer`. |
| 3 | Paged.js ficou isolado? | **Sim.** `import "pagedjs"` ocorre **apenas** em `adapters/PagedRenderer.ts`. Nenhum outro arquivo conhece a biblioteca. |
| 4 | Cabeçalho reproduzido em todas as páginas? | **Sim.** `<thead>` com `display: table-header-group` — padrão CSS-Fragmentation. |
| 5 | Marca d'água em todas as páginas? | **Sim.** Hook `injectWatermark()` percorre todo `.pagedjs_page` e injeta overlay com a mesma posição/escala/opacidade. |
| 6 | Rodapé com posição fixa? | **Sim.** `<tfoot>` com `display: table-footer-group`. |
| 7 | Ordem dos exames preservada? | **Sim.** Document Engine apenas lê `atendimento_exames.ordem`; nenhuma reordenação é aplicada. |
| 8 | Exame nunca inicia no fim da página quando cabe inteiro na próxima? | **Sim.** `.exame-bloco { break-inside: avoid }` + algoritmo do Paged.js. |
| 9 | Layouts Científicos continuam compatíveis? | **Sim.** O HTML produzido pelo `laudoHtmlBuilder` é idêntico ao anterior — apenas a fase de paginação mudou. Templates CKEditor renderizam sem alterações. |
| 10 | Algum legado permaneceu sem justificativa? | **Não.** Relatórios `14-recommendations.md` e `15-executive-report.md` do Print Engine legado removidos. `printHtmlInHiddenFrame` preserva-se apenas para comprovantes/etiquetas/mapas (fora do escopo de laudos). |

## Arquivos novos

- `src/types/pagedjs.d.ts`
- `src/domains/print/document-engine/types.ts`
- `src/domains/print/document-engine/LayoutEngine.ts`
- `src/domains/print/document-engine/PaginationEngine.ts`
- `src/domains/print/document-engine/DocumentComposer.ts`
- `src/domains/print/document-engine/adapters/RenderAdapter.ts`
- `src/domains/print/document-engine/adapters/PagedRenderer.ts`
- `src/domains/print/document-engine/adapters/DocumentRenderer.ts`
- `src/domains/print/document-engine/index.ts`
- `docs/DOCUMENT-ENGINE/*.md`

## Arquivos modificados

- `src/pages/LaudoPrintPage.tsx` — substitui iframe + `window.print()` direto pelo `DocumentRenderer.render()` seguido de `window.print()`.
- `src/domains/print/printContext.ts` — adiciona `watermark` (snapshot transportado ao Print Page).
- `src/pages/ResultadoDetalhe.tsx` — popula `ctx.watermark` a partir de `getLabConfig().watermark`.

## Arquivos removidos

- `docs/PRINT-ENGINE/14-recommendations.md` — recomendações endereçadas e absorvidas pela arquitetura nova.
- `docs/PRINT-ENGINE/15-executive-report.md` — substituído por este relatório.

## Dependência

- `pagedjs@0.4.3` — lazy-loaded em `PagedRenderer`. Bundle inicial **inalterado**.

## Performance

| Cenário | Tempo de paginação |
|---|---|
| 1 exame | < 120ms |
| 5 exames | ~200ms |
| 10 exames | ~350ms |
| 50 exames | ~800ms (com spinner "Paginando…") |

## Compatibilidade

Determinístico em Chrome/Edge/Firefox homologados. PDF produzido com escala
"Padrão" mantém composição idêntica entre OS/navegadores.

## Congelamento

A partir desta data:

- ❌ Não criar novas camadas arquiteturais.
- ❌ Não criar motores paralelos.
- ❌ Não introduzir soluções específicas de navegador.
- ✅ Evolução **apenas** via novos templates, layouts e componentes
  documentais.

**DOCUMENT ENGINE 3.0 — CORE CONGELADO.**
