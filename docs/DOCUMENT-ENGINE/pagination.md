# Paginação Determinística

## Antes (Print Engine legado)

`window.print()` direto. O navegador decidia:
- onde quebrar o exame;
- se cabia ou não;
- como repetir cabeçalho/rodapé;
- se a marca d'água aparecia.

Resultado: cada combinação de Chrome × OS × escala gerava um PDF diferente.

## Agora (Document Engine 3.0)

Paged.js fragmenta o fluxo **antes** do `window.print()`. O DOM resultante já
é uma sequência de `<div class="pagedjs_page">`, cada uma do tamanho A4
exato. O navegador só materializa.

### Algoritmo

1. **LayoutEngine** define a geometria oficial (A4, margens 4/11/4/11mm).
2. **PaginationEngine** emite CSS com:
   - `@page { size: A4; margin: 4mm 11mm 4mm 11mm }`
   - `.exame-bloco { break-inside: avoid }` — bloco indivisível
   - `.exame-fragmentavel tr { break-inside: avoid }` — exceção para
     tabelas muito grandes (quebra apenas entre linhas)
3. **DocumentComposer** envolve o corpo em uma `<table class="laudo-a4-page">`
   com `<thead>` (cabeçalho) e `<tfoot>` (rodapé). CSS-Fragmentation padrão
   garante repetição em todas as páginas.
4. **PagedRenderer** chama `previewer.preview()`, que:
   - mede a altura disponível por página;
   - mede a altura de cada bloco;
   - se o bloco cabe, renderiza; senão, move para a próxima página;
   - para tabelas marcadas como fragmentáveis, quebra apenas em
     fronteiras válidas (`<tr>`).
5. Resultado: N elementos `.pagedjs_page` reais, cada um com cabeçalho,
   corpo, rodapé e marca d'água.

## Garantias

- ✅ Nenhum exame inicia no fim da página se cabe inteiro na próxima.
- ✅ A ordem de `atendimento_exames.ordem` é preservada — o Document
  Engine só lê, nunca reordena.
- ✅ Cabeçalho/rodapé com altura constante em todas as páginas.
- ✅ Marca d'água em **todas** as páginas (injetada por hook do
  PagedRenderer, não depende do navegador).
- ✅ Saída determinística entre navegadores homologados.
