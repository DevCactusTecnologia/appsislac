# 14 — Recomendações Priorizadas

> Nenhuma alteração aplicada — aprovação explícita necessária.

Cada item segue o formato obrigatório: **Problema · Causa · Impacto · Correção ideal · Complexidade · Risco · Benefício · Prioridade**.

---

## R1 — Marca d'água por página (corrige P1)

- **Problema**: marca d'água some a partir da página 2.
- **Causa**: `::before` de tabela única não se repete por página.
- **Impacto**: branding/segurança visual perdida em laudos longos.
- **Correção ideal**: aplicar marca d'água via `body::before { position: fixed }` (já comprovadamente repetido por página pelo Chrome) **e** garantir `print-color-adjust: exact` global, OU usar `@page { background-image: url(...) }` (rotação não suportada).
- **Complexidade**: Baixa.
- **Risco**: Médio (pode interferir com z-index do laudo).
- **Benefício**: Alto.
- **Prioridade**: **P0**.

## R2 — Numeração de páginas (corrige P4)

- **Problema**: laudo sem "Página X de Y".
- **Causa**: `@page` não define `@bottom-*` com `counter`.
- **Impacto**: auditoria, compliance laboratorial.
- **Correção ideal**: adicionar `@page { @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 8pt Helvetica; } }` — ou injetar como célula do `<tfoot>` com `counter(page)` via CSS quando suportado.
- **Complexidade**: Baixa.
- **Risco**: Baixo (suporte parcial em Firefox; OK em Chrome).
- **Benefício**: Alto.
- **Prioridade**: **P0**.

## R3 — Fragmentação consciente de exames grandes (corrige P2)

- **Problema**: exames maiores que uma página quebram aleatoriamente.
- **Causa**: CSS fragmentation ignora `avoid` para blocos > 1 página.
- **Correção ideal**: dividir layouts científicos longos em sub-blocos com `page-break-inside: avoid` cada (responsabilidade do editor), OU pré-medir altura via iframe oculto antes do `print` e inserir `page-break-before` programaticamente.
- **Complexidade**: Alta (medição) / Média (refator do editor).
- **Risco**: Médio.
- **Benefício**: Alto para exames longos.
- **Prioridade**: **P1**.

## R4 — Corrigir `pageMargins` (corrige P3)

- **Problema**: margens do último exame sobrescrevem todas.
- **Causa**: `pageMargins = entry.margins` sem agregação.
- **Correção ideal**: definir margens **uma vez por documento** (configuração do tenant) em vez de por layout, OU pegar o **máximo** de cada lado entre os layouts.
- **Complexidade**: Baixa.
- **Risco**: Baixo.
- **Benefício**: Médio.
- **Prioridade**: **P1**.

## R5 — `print-color-adjust: exact` global (corrige P5)

- **Problema**: fundos sumindo quando marca d'água está off.
- **Correção ideal**: mover `-webkit-print-color-adjust: exact; print-color-adjust: exact;` para `html, body` no `<style>` do laudo, independente do `buildWatermarkCss`.
- **Complexidade**: Trivial.
- **Risco**: Nulo.
- **Benefício**: Médio.
- **Prioridade**: **P1**.

## R6 — Mover HTML para `BroadcastChannel` ou rota com query short-id (corrige P6)

- **Problema**: `sessionStorage` estoura com laudos com logos/imagens base64 grandes.
- **Correção ideal**: armazenar HTML em `IndexedDB` (cota ~50% do disco) com TTL, OU manter `printable` na origem e re-renderizar na rota dedicada (pago em CPU para economizar storage).
- **Complexidade**: Média.
- **Risco**: Baixo.
- **Benefício**: Alto para clientes com cabeçalhos pesados.
- **Prioridade**: **P2**.

## R7 — Instrumentação de qualidade (corrige P8)

- **Problema**: regressões visuais só são vistas pelo cliente.
- **Correção ideal**: snapshot PDF via Playwright em CI (1 laudo curto + 1 longo + 1 multi-solicitante) — diff de pixels com tolerância.
- **Complexidade**: Média (setup CI).
- **Risco**: Nulo.
- **Benefício**: Alto a longo prazo.
- **Prioridade**: **P2**.

## R8 — Avaliar Paged.js (resposta à pergunta "reestruturar?")

- **Problema**: navegador é "caixa-preta" para paginação.
- **Correção ideal**: integrar [Paged.js](https://pagedjs.org/) — biblioteca client-side que **implementa** CSS Paged Media corretamente: numeração, headers/footers nomeados, fragmentação determinística, cross-browser estável.
- **Complexidade**: Alta (refator do `LaudoPrintPage` para usar `Previewer`).
- **Risco**: Médio (peso ~300 KB; lazy import resolve).
- **Benefício**: Muito alto — abre porta para tudo que está hoje fora de alcance (R1, R2, R3 viram triviais).
- **Prioridade**: **P1 ESTRATÉGICO** — recomendação central do relatório executivo.

## R9 — Marca d'água via `<watermark>` em PDF real (alternativa a R1+R8)

- **Problema**: depender de `background-image` é frágil (usuário pode desligar).
- **Correção ideal**: pós-processar PDF com pdf-lib após geração (gera PDF via Paged.js → injeta XObject de imagem em todas as páginas).
- **Complexidade**: Alta.
- **Risco**: Médio.
- **Benefício**: Alto (laudo "blindado" — usuário não tem opção de tirar a marca).
- **Prioridade**: **P3** (depende de R8).

## R10 — Eliminar `!important` do builder (corrige P10)

- **Problema**: customização por template impossível.
- **Correção ideal**: usar CSS Layers (`@layer base, override, template`) — permite que templates sobrescrevam sem `!important`.
- **Complexidade**: Média.
- **Risco**: Médio (regressão visual em laudos já validados).
- **Benefício**: Médio.
- **Prioridade**: **P3**.
