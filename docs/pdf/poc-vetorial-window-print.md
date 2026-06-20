# PoC — Impressão Vetorial via `window.print()`

**Data:** 2026-06-20  
**Escopo:** prova de conceito, sem alterar layouts/CKEditor/templates.  
**Coexistência:** o motor legado (`html2pdf`/`html2canvas`) continua intacto.

---

## O que foi feito

1. Nova função `doImprimirVetorial` em `src/pages/ResultadoDetalhe.tsx`.
2. Reusa **integralmente** `buildLaudoHtml` (mesmo HTML, mesmo `@page`, mesmo `@media print`, mesmos cabeçalhos/rodapés/assinaturas/QR Codes).
3. Abre o HTML em uma nova aba e chama `window.print()` automaticamente após `load`.
4. Botão **"Imprimir Vetorial"** adicionado ao lado de "Imprimir todos" no header do paciente (ambas as views — empilhada e desktop). Variante secundária para deixar claro que é experimental.
5. Telemetria simples: `console.info("[PDF Vetorial] HTML renderizado em Xms — exames=N")`.

### Não foi alterado

- `buildLaudoHtml`, `renderExameComLayout`, `exame_layouts`, parâmetros, CKEditor, templates de cabeçalho/rodapé/assinatura, QR Codes, RLS, multi-tenancy.
- `doImprimirHtml` e `doExportPdf` (motor legado html2pdf) continuam funcionando para A/B.

---

## Como usar

1. Abra um laudo digitado/liberado em **/resultados/:id**.
2. Clique em **"Imprimir Vetorial"** no header do paciente.
3. Uma nova aba abre, renderiza o HTML do laudo e dispara o diálogo nativo de impressão.
4. Em "Destino", escolha **"Salvar como PDF"** para gerar o arquivo vetorial.

---

## Comparação A/B (preencher após homologação)

| Métrica                  | html2pdf (legado)                       | window.print() (PoC)                    |
| ------------------------ | --------------------------------------- | --------------------------------------- |
| Tempo até PDF (1 página) | ~3-5 s                                  | < 1 s (estimado)                        |
| Tempo (5 páginas)        | ~8-12 s                                 | ~1-2 s (estimado)                       |
| Tempo (20 páginas)       | ~25-40 s                                | ~3-5 s (estimado)                       |
| Tamanho 1 página         | 800 KB – 1,5 MB (PNG raster)            | 60-150 KB (vetorial)                    |
| Tamanho 20 páginas       | 12-25 MB                                | 400 KB – 1,2 MB                         |
| Texto selecionável       | ❌ (rasterizado)                         | ✅                                       |
| Texto pesquisável        | ❌                                       | ✅                                       |
| Nitidez em zoom          | Embaça acima de 200%                    | Nítido em qualquer zoom                 |
| Respeita `@page`         | ❌ (ignorado, usa `jsPDF.format`)        | ✅                                       |
| Respeita `@media print`  | ❌                                       | ✅                                       |
| `page-break-inside`      | Parcial                                 | Total                                   |
| Fontes                   | Rasterizadas (Helvetica/Courier embaça) | Renderização nativa do SO               |
| Bloqueia UI (main thread)| Sim (html2canvas pesado)                | Não                                     |
| Dependências bundle      | +370 KB (html2pdf)                      | 0 KB                                    |

> Os números do "PoC" são estimativas baseadas no comportamento de `window.print()` em Chromium. Substitua pelos valores reais coletados em homologação.

---

## UX — diferença real

- **Legado:** clica → spinner → aba abre com PDF pronto → usuário clica "salvar/imprimir" do viewer do navegador.
- **PoC:** clica → aba abre com o laudo renderizado → diálogo nativo de impressão aparece automaticamente → usuário escolhe "Salvar como PDF" ou impressora física.

A UX muda em **um passo extra** (escolher destino no diálogo nativo). Em troca: instantâneo, vetorial, pesquisável e fiel ao `@media print`.

---

## Limitações conhecidas

- Pop-up bloqueado: o navegador pode bloquear `window.open` se o clique não for tratado como gesto direto. Tratado com toast.
- Cabeçalhos/rodapés do navegador: por padrão o Chrome adiciona "URL / data" no PDF impresso. Usuário precisa desmarcar "Cabeçalhos e rodapés" no diálogo (ou definimos via instruções no app).
- Margens do diálogo: o usuário pode sobrescrever as margens do `@page`. Recomendar "Margens: padrão" ou "nenhuma".
- Imagens base64 dos cabeçalhos/assinaturas continuam funcionando (mesmo HTML).

---

## Próximos passos (após validação visual)

1. Homologar com:
   - 1 página
   - 5 páginas
   - 20 páginas
   - tabelas extensas
   - layouts CKEditor complexos com imagens
   - assinaturas com QR Code
2. Coletar tempos reais (console `[PDF Vetorial]`) e tamanhos de PDF salvo.
3. Decidir se `window.print()` substitui `html2pdf` como padrão, ou se vamos adicionar Chromium headless via serviço externo (Browserless/Gotenberg) para gerar o PDF server-side sem o passo "Salvar como PDF".
4. Se aprovado: trocar variante do botão para `primary` e descontinuar `html2pdf` do fluxo padrão (manter como fallback).
