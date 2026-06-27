# 08 — Quebra de página por exame

## Mecanismo atual

Cada exame é envelopado por:

```html
<div class="exame-bloco" style="page-break-inside:avoid;break-inside:avoid;margin-bottom:20px;">
  ...
</div>
```

E o CSS reforça em `@media print`:

```css
.exame-bloco { page-break-inside: avoid; break-inside: avoid; }
@media print {
  .exame-bloco { page-break-inside: avoid !important; break-inside: avoid !important; }
}
```

## O sistema mede altura?

**Não.** A decisão de quebrar é **inteiramente do navegador**:

1. Navegador renderiza o fluxo no contexto `@page A4`.
2. Quando encontra um `.exame-bloco` que não cabe no espaço restante da página atual:
   - Se o bloco couber em **uma página inteira**: empurra para a próxima página.
   - Se o bloco for **maior que uma página**: ignora o `avoid` e quebra onde der (comportamento padrão CSS-fragmentation).
3. Sem antecipação, sem cálculo, sem decisão algorítmica do SISLAC.

## Bloco indivisível?

| Caso | Indivisível? |
|---|---|
| Exame com até ~1 página de altura | Sim (respeitado pelo Chrome) |
| Exame com > 1 página de altura | **Não** — quebra silenciosa |
| Exame com tabela longa (custom layout CKEditor) | Pode quebrar mesmo dentro do `avoid` se o `<table>` interno não tiver `break-inside: avoid` por linha |

## Risco

Não há instrumentação para detectar quando um exame "vazou" para a próxima página. Não há fallback de fragmentação consciente (ex.: "se exame > altura útil, quebrar em sub-blocos de N parâmetros").
