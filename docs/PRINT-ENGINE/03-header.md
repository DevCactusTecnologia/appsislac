# 03 — Cabeçalho

## Como é renderizado

- **Fonte**: template HTML editável em `documento_templates` (tipo `cabecalho`, padrão por tenant), montado por `renderCabecalhoPadrao()`.
- **Inserção no documento**: vai dentro de `<table class="laudo-a4-page"><thead><tr><td>...</td></tr></thead>` (linhas 401-411 do `laudoHtmlBuilder.ts`).
- **Repetição automática por página**: `table > thead { display: table-header-group !important; }` (linha 152). É a **mecânica nativa de `<thead>` em impressão**: o navegador repete o `thead` no topo de cada página gerada.
- **Imagem da logo**: vem como `<img>` dentro do HTML do template (CKEditor). Não é desenhada no PDF — é um elemento HTML normal.
- **CSS de normalização**: ~150 linhas zerando `margin-left`, `padding-left`, `cellpadding`, `figure.table` do CKEditor para que o cabeçalho fique alinhado ao corpo (188mm úteis).

## Características

| Pergunta | Resposta |
|---|---|
| É componente React? | Não na hora da impressão — é string HTML inerte. |
| É HTML? | Sim, dentro de `<thead>` da `<table class="laudo-a4-page">`. |
| É imagem? | Não; pode conter `<img>`. |
| É CSS? | A repetição depende de CSS (`display: table-header-group`). |
| É desenhado no PDF? | Não — o PDF é gerado pelo navegador a partir do HTML. |
| Repetido automaticamente? | Sim, em **todas** as páginas (mecânica padrão de `thead`). |
| Aparece só na 1ª página? | Não. |

## Riscos / observações

1. **Altura do cabeçalho** não é limitada — se o template for grande, ele consome mais área útil em **todas** as páginas (não só na primeira).
2. Trimming de blocos vazios (`trimTrailingEmptyBlocks`, linhas 94-106) tenta mitigar a "sobra" do CKEditor, mas é heurístico (regex em até 20 iterações).
3. Helvetica forçado em `!important` (linhas 171-175) sobrescreve qualquer fonte definida no editor — é um trade-off para estabilidade.
