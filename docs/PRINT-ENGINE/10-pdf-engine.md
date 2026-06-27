# 10 — Motor PDF

## Qual biblioteca?

**Nenhuma para o laudo.** O PDF é produzido por `window.print()` → diálogo nativo do navegador → "Salvar como PDF" (Chrome PDF Engine / Skia).

A única biblioteca instalada (`html2pdf.js@^0.14.0`) é usada exclusivamente em `src/domains/result/services/comprovantesRender.ts` para gerar **comprovantes** que sobem ao storage — caminho independente do laudo.

## Como funciona o caminho do laudo

1. Builder gera HTML (string).
2. Página `LaudoPrintPage` injeta no `<iframe srcDoc>`.
3. `iframe.contentWindow.print()` abre o diálogo nativo.
4. Usuário escolhe destino: impressora ou "Salvar como PDF".
5. Chrome converte o DOM renderizado em PDF (Skia rasteriza vetores; texto fica vetorial).

## Limitações

| Limite | Impacto |
|---|---|
| Comportamento divergente entre Chrome, Edge, Firefox, Safari | Mesmo HTML pode paginar diferente |
| Não temos controle sobre fonte embarcada | Depende das fontes locais do SO |
| Sem `@page` regiões (`@top-*`, `@bottom-*`) suportadas universalmente | Não dá para usar `counter(page)` confiavelmente em todos os browsers |
| Sem APIs de "Header/Footer/Running Elements" do CSS Paged Media Level 3 | Suporte experimental fora do escopo |
| Sem **Page Templates** | Impossível ter "1ª página diferente das demais" via CSS de forma confiável |
| Sem **Named Pages** | Idem |
| Sem **fragmentação programática** | Não há como saber em runtime onde o Chrome decidiu quebrar |
| Sem callback "página gerada" | Impossível instrumentar qualidade |
| Margens variam: usuário pode mudar "Margens: padrão/nenhuma" no diálogo | Pode arruinar o layout |
| Background image do CSS pode ser desligado no diálogo ("Gráficos de fundo") | Marca d'água some |

## Recursos próprios usados

Apenas dois — ambos do **navegador**, não do SISLAC:
- `<thead>` / `<tfoot>` com `display: table-{header,footer}-group` → repetição automática.
- `page-break-inside: avoid` → respeitado dentro do limite de 1 página por bloco.

## Conclusão

O "motor PDF" do SISLAC é, na prática, **delegação total ao Chrome**. Não temos código próprio que toque em PDF para o laudo. Toda a engenharia está no HTML e CSS entregues ao navegador.
