# Relatório Executivo — Documentos Operacionais SISLAC

Auditoria somente-leitura, conduzida 2026-06-21. Sem alterações em código,
banco, RLS, edge functions ou regras de negócio.

## Perguntas-chave

### Quantos documentos existem?
**18 artefatos** (HTML/PDF que vão para papel, PDF ou WhatsApp), agrupados em
4 famílias: comprovantes (3), relatórios financeiros (3), operacionais (5),
administrativos/comercial (7). Detalhe em `inventory.md`.

### Quantos builders existem?
**14 builders independentes**. Apenas 3 famílias reaproveitam o header/footer
canônicos (`buildEmitenteHeader` / `buildAssinaturaRodape`). Detalhe em
`technical-map.md`.

### Quantos motores de impressão existem?
**2.**
- `printHtmlInHiddenFrame` (vetorial via `window.print()`) — usado por ~95% dos
  documentos.
- `html2pdf.js` (raster, ≈370 KB lazy) — usado **somente** por Orçamentos
  (precisa de Blob para shortlink WhatsApp) e pelo path legado de export PDF
  do laudo.

### Existe duplicação relevante?
**Sim, alta**, em 3 eixos:
1. Boilerplate `<!DOCTYPE>+@page+<script>print()</script>` em 9 builders.
2. CSS de impressão (`@page`, fontes, tabela A4) em 9 builders.
3. Cabeçalhos institucionais — 11 cabeçalhos paralelos, sendo só 1 canônico.

Detalhe em `duplication-report.md`.

### Existe falta de padrão visual?
**Sim.** Convivem 3 identidades visuais distintas (Lovable Minimalist,
Relatório Admin azul, Tabela Operacional crua). Branding institucional (logo +
CNPJ + endereço) aparece consistentemente em apenas 3 dos 18 documentos.
Detalhe em `design-consistency.md`.

### Existe código redundante?
**Sim.** 6 reimplementações de `escapeHtml`, 4 de formatação de data BR,
`<script>window.print()</script>` redundante em 4 arquivos (o
`printHtmlInHiddenFrame` já dispara), alias trivial `buildOrcamentoHtmlPublic`.

### Existe oportunidade de SSOT?
**Sim.** SSOT já existe para motor de impressão, helpers numéricos,
verificação legal e branding-data (`getLabConfig`). **Falta SSOT** para:
header HTML institucional, CSS de impressão A4, helpers de formatação.
Detalhe em `ssot-report.md`.

### O sistema está coerente?
**Parcialmente.** A camada de **execução** (motor de impressão, validação,
templates configuráveis) está coerente e segue os padrões da plataforma. A
camada de **apresentação visual** está fragmentada: cada relatório
administrativo carrega sua própria identidade.

### O que vale a pena padronizar?
Em ordem de prioridade (`opportunities.md`):
1. Consolidar `escapeHtml` para uma única importação.
2. Extrair shell A4 compartilhado (`wrapA4Document`).
3. Aplicar `buildAdminReportHeader` (logo + dados do lab) aos 7 relatórios
   admin que hoje não exibem branding.
4. Unificar `formatDateBR`.
5. Remover alias trivial `buildOrcamentoHtmlPublic`.

### O que NÃO vale a pena mexer?
- Laudo (constraint `mem://constraints/layout-impressao-travado.md`).
- Mapa de Trabalho (CSS próprio intencionalmente divergente).
- Pipeline `html2pdf.js` para Orçamentos (precisa de Blob).
- Unificação Caixa × Detalhado × Tabelas de preço (alto risco, ganho marginal).

## Veredito

O ecossistema documental do SISLAC tem **fundação técnica sólida**
(motor único, SSOT de branding-data, templates configuráveis) mas **vestiu
camisas diferentes** ao longo do tempo. As oportunidades de padronização
identificadas são **5 mudanças cosméticas/estruturais de baixo risco** que
podem trazer **identidade visual única** sem tocar em uma única regra de
negócio.

Conforme a regra de parada: **PARAR aqui**. Próximo passo é decisão do
usuário sobre quais oportunidades autorizar.

---

**Artefatos desta auditoria:**
- `docs/documentos/inventory.md`
- `docs/documentos/technical-map.md`
- `docs/documentos/duplication-report.md`
- `docs/documentos/design-consistency.md`
- `docs/documentos/ssot-report.md`
- `docs/documentos/opportunities.md`
- `docs/documentos/executive-report.md` (este)
