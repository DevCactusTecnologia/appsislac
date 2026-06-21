# Oportunidades de Padronização — Documentos do SISLAC

Apenas itens com **baixo risco**, **alto ganho** e **zero impacto em regras
de negócio**. Ordem = prioridade sugerida.

## 1. Consolidar `escapeHtml` (Baixo risco · Alto ganho)

- **Hoje:** 6 reimplementações locais em `mapaPrint.ts`, `etiquetaAmostra.ts`,
  `dossieRastreabilidade.ts`, `auditLogsStore.ts`, `lgpdReport.ts`,
  `documentoRenderer.ts`.
- **Ação:** apagar as cópias e importar `@/lib/escapeHtml`.
- **Risco:** nulo — funções idênticas no comportamento sobre strings ASCII.
  Só validar que a versão canônica também escape `'` e `/` (algumas cópias não
  faziam).
- **Ganho:** −60 linhas, fonte única para correção de XSS futura.

## 2. Extrair shell de impressão A4 compartilhado (Baixo risco · Alto ganho)

- **Hoje:** 9 arquivos repetem o mesmo bloco `<!DOCTYPE html>... <style>@page{
  size: A4; margin: 14mm; } body { font-family: Inter; }... </style>...
  <script>window.print()</script>`.
- **Ação:** criar `src/lib/printShell.ts` com helper único
  `wrapA4Document({ title, orientation, margin, bodyHtml, css? })`.
  **Não tocar** o conteúdo dos builders — só o wrapper externo.
- **Risco:** zero se apenas extrair o boilerplate sem mexer no corpo.
- **Ganho:** mudar margem/fonte global passa a ser 1 commit; remove
  `<script>window.print()</script>` redundante (o `printHtmlInHiddenFrame` já
  dispara o print).

## 3. Adicionar header institucional aos relatórios admin (Médio risco · Alto ganho)

- **Hoje:** LGPD, Auditoria, Tabelas, Catálogo, Produção, Dossiê, Detalhe de
  Entrada **não exibem logo nem CNPJ**.
- **Ação:** criar `buildAdminReportHeader({ titulo, periodo? })` em cima de
  `getLabConfig()` — versão "lite" do `buildEmitenteHeader` (sem o badge de
  comprovante e sem QR), e injetar em cada relatório existente.
- **Risco:** baixo se o helper já existir e for opt-in por arquivo.
- **Ganho:** identidade visual coerente em todos os documentos sem reescrever
  nenhum builder.

## 4. Remover alias trivial `buildOrcamentoHtmlPublic` (Baixo risco · Baixo ganho)

- `buildOrcamentoHtmlPublic` apenas chama `buildOrcamentoHtml`. Substituir
  todos os imports e remover o alias. **Cosmético.**

## 5. Unificar `formatDateBR` (Baixo risco · Médio ganho)

- 4 cópias locais. Mover para `@/lib/utils.ts` ou `@/lib/dateBR.ts`.
- Risco zero; ganho médio em manutenção.

## 6. Centralizar tema de cor "admin" (Baixo risco · Médio ganho)

- Documentos administrativos usam `#1e3a8a`, `#2563eb`, `#0f172a`, `#475569`
  inline. Criar 1 constante `ADMIN_PRINT_PALETTE` ou — melhor — alinhar com
  Lovable Minimalist (preto sobre branco, sem azul corporativo) caso o
  usuário aprove a mudança visual.

---

## Não vale a pena (Alto risco / regra de negócio):

- ❌ Reescrever o laudo (`buildLaudoHtml`) — congelado por constraint.
- ❌ Migrar Mapa de Trabalho para o shell A4 compartilhado — usa CSS próprio
  de tickets/colgroup que diverge intencionalmente.
- ❌ Substituir `html2pdf.js` em Orçamentos — ainda precisa de Blob para
  upload + shortlink WhatsApp.
- ❌ Unificar `buildLivroCaixaHtml` com `buildDetalhadoHtml` — semelhantes mas
  com agregações diferentes; risco alto vs. ganho marginal.
- ❌ Migrar tabelas de preço para um único builder — o domínio (CBHPM × TUSS
  × Própria × Convênio × Catálogo) tem regras divergentes; risco alto.
