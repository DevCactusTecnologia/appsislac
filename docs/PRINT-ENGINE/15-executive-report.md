# 15 — Relatório Executivo — Motor de Impressão SISLAC

> Fase: RADIOGRAFIA (read-only). Nenhum arquivo do código foi alterado.
> Metodologia: OLHOU → ENTENDEU → MAPEOU → VALIDOU → RECOMENDOU.

---

## Pergunta central

> **O Motor de Impressão do SISLAC é um processador profissional de documentos, ou apenas imprime HTML em PDF?**

## Resposta direta

**Apenas imprime HTML em PDF.** O SISLAC entrega uma string HTML+CSS ao navegador e delega 100% da paginação, repetição de cabeçalho/rodapé, marca d'água e geração do PDF ao `window.print()` do Chrome.

Não existe:
- biblioteca PDF própria no caminho do laudo (`html2pdf.js` só atua em comprovantes);
- algoritmo de paginação;
- medição de altura de blocos;
- numeração de páginas;
- garantia de marca d'água por página em laudos multipágina;
- cache de PDF;
- testes visuais automatizados.

O motor atual funciona **bem para laudos de 1 página**. A partir da 2ª página começam a aparecer problemas estruturais (P1, P2, P4 — ver `13-problems.md`).

---

## Diagnóstico sumarizado

| Componente | Como funciona | Avaliação |
|---|---|---|
| **Cabeçalho** | HTML em `<thead>` com `display: table-header-group` | ✅ Funciona; repete em todas as páginas |
| **Rodapé** | HTML em `<tfoot>` com `display: table-footer-group` | ✅ Funciona; sem numeração de páginas |
| **Marca d'água** | CSS `::before` em `.laudo-a4-page` | ⚠️ Falha em laudos 2+ páginas |
| **Paginação** | Delegada ao Chrome via `page-break-inside: avoid` | ⚠️ Sem controle programático |
| **Ordem dos exames** | `atendimento_exames.ordem ASC` preservada | ✅ Correto |
| **Blocos indivisíveis** | `page-break-inside: avoid` por exame | ⚠️ Ignorado se exame > 1 página |
| **Motor PDF** | Chrome `window.print()` | ⚠️ Sem controle de margens/cores do usuário |
| **Layout científico** | Templates HTML do CKEditor com placeholders | ✅ Funciona; bug menor em `pageMargins` |
| **Instrumentação** | Nenhuma | ❌ Sem visibilidade |

---

## Recomendação executiva

### Cenário A — Manter motor atual e corrigir os 10 problemas (`14-recommendations.md`)

- Esforço: ~5 a 8 dias-dev distribuídos em 3 sprints.
- Cobre: numeração de páginas, marca d'água por página, `pageMargins`, `print-color-adjust` global, sessionStorage.
- **Não resolve estruturalmente** a P2 (fragmentação) — só mitiga.
- Continua refém do diálogo do navegador.

### Cenário B — Reestruturar com Paged.js (recomendação R8)

- Esforço: ~10 a 15 dias-dev.
- Resolve definitivamente: paginação determinística cross-browser, numeração nativa, marca d'água por página, fragmentação consciente, headers/footers nomeados, cobertura de "1ª página diferente".
- Permite snapshots em CI (R7).
- Custo: +300 KB no bundle (lazy import resolve).
- Quebra zero para o usuário final — só muda a engine de render dentro do `LaudoPrintPage`.

### Decisão recomendada

**Cenário B — adotar Paged.js + R5 + R7 + R4** como projeto "Print Engine 3.0".

Justificativa técnica:
1. O SISLAC vende laudo. Laudo é o produto. Não é aceitável que a qualidade dependa de qual navegador o cliente abriu.
2. O custo de manter o motor atual (paliativos sucessivos) é maior que o custo de migrar uma vez para um engine determinístico.
3. As features que clientes profissionais esperam ("Página X de Y", marca d'água garantida, integridade) são **gratuitas** após R8.

---

## Critérios de sucesso atendidos por este relatório

- ✅ Como o PDF é construído — `02-render-pipeline.md`, `10-pdf-engine.md`.
- ✅ Como cada página é gerada — `06-pagination.md`, `10-pdf-engine.md`.
- ✅ Como cabeçalho/marca d'água/rodapé são renderizados — `03`, `04`, `05`.
- ✅ Como ocorre a quebra de páginas — `06`, `08`.
- ✅ Como a ordem dos exames é definida — `07-exams-order.md`.
- ✅ Como impedir que um exame seja dividido — `08-page-break.md` (parcial; R3 propõe solução).
- ✅ Como manter o mesmo espaçamento vertical em todas as páginas — `03`, `09` (depende do `thead`/`tfoot` constante).
- ✅ Se o motor atual é suficiente — **NÃO** para um laboratório profissional com laudos multipágina; SIM para laudos de 1 página. Reestruturação recomendada (Cenário B).

---

## REGRA DE PARADA

**PARAR.** Nenhuma implementação será iniciada sem aprovação explícita do usuário sobre qual cenário adotar (A, B, ou subset priorizado de R1–R10).
