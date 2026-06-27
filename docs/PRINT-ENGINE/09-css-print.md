# 09 — CSS de Impressão (auditoria)

Arquivo: `src/pages/ResultadoDetalhe/services/laudoHtmlBuilder.ts`, linhas 126-398. **Constraint travada** — não alterar sem pedido explícito.

## `@page`

```css
@page { size: A4; margin: 4mm 11mm 4mm 11mm; }   /* topo/inferior 4mm, laterais 11mm */
```

Sem `@page :first`, sem `@page :left/:right`, sem regiões nomeadas (`@top-center`, `@bottom-right`). **Sem número de página.**

## Quebras

| Regra | Onde | Função |
|---|---|---|
| `page-break-inside: avoid` | `.exame-bloco`, `.assinatura-bloco` | Não quebrar bloco no meio |
| `break-inside: avoid` | idem (sintaxe moderna) | Equivalente padrão CSS-fragmentation |
| `page-break-before: avoid` | `.exame-bloco + .assinatura-bloco` | Manter assinatura junto do último exame |
| `widows` / `orphans` | **Não usado** | — |
| `break-before` / `break-after` | **Não usado** explicitamente | — |

## Repetição de header/footer

```css
table.laudo-a4-page > thead { display: table-header-group !important; }
table.laudo-a4-page > tfoot { display: table-footer-group !important; }
```

Mecânica padrão de `<thead>`/`<tfoot>` em impressão — repete em cada página gerada.

## Posicionamento

- `position: fixed` apenas em `body::before` (marca d'água em comprovantes).
- `position: absolute` em `.laudo-a4-page::before` (marca d'água do laudo — ver problema em `04-watermark.md`).
- Sem `position: sticky` (não funcionaria em impressão).
- Sem `position: fixed` no rodapé (depende do mecanismo de `tfoot`).

## Cor & fontes

- `color: #000 !important` forçado em todo `#laudo-content`, cabeçalho e rodapé.
- `-webkit-print-color-adjust: exact` em `body` (via `printShell.BASE_CSS` para outros docs; no laudo é declarado dentro do `buildWatermarkCss` quando marca d'água ativa — ausente quando desativada).
- Fontes do corpo: `Helvetica, Arial, sans-serif` em cabeçalho/rodapé (`!important`); `Courier` na tabela de parâmetros do fallback.

## Tabelas

```css
#laudo-content table { width:100% !important; max-width:100% !important; table-layout: fixed !important; box-sizing: border-box !important; }
#laudo-content td, #laudo-content th { padding: 0 !important; }
```

Largura travada para evitar overflow lateral (188mm úteis).

## Normalização agressiva do CKEditor

Linhas 198-388: ~150 linhas zerando `margin-left`, `padding-left`, `cellpadding`, `figure.table`, `<p>:empty`, etc. — necessárias porque o HTML vem do CKEditor com defaults de browser que desalinham logo/exames.

## Riscos

1. `!important` em quase tudo bloqueia customizações futuras por template.
2. Falta de `print-color-adjust: exact` quando a marca d'água está desligada → cores de células e bordas podem aparecer "lavadas" em alguns browsers.
3. Sem `@page { @bottom-right { content: "Página " counter(page) " de " counter(pages); } }` — capacidade nativa **disponível** e **não usada**.
