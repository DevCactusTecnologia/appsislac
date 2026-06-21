# PDF — Relatório Executivo de Hardening Final

> Encerra a missão de consolidação pós-migração vetorial. Auditoria detalhada
> em `docs/pdf/final-cleanup-audit.md`.

## Respostas diretas

| Pergunta | Resposta |
|----------|----------|
| Quantos arquivos mortos removidos? | **0** — nenhum arquivo órfão encontrado |
| Quantas funções removidas? | **1** — `buildWaUrl` duplicada em `PdfPreviewDialog.tsx` |
| Quantos imports removidos? | **0** novos; cópia local substituída por import compartilhado |
| Quantas linhas removidas? | **~7** (cópia de `buildWaUrl`) |
| Existe duplicação residual? | **Não** |
| Existe legado residual? | **Não** — apenas 2 comentários documentando que html2pdf foi descontinuado em pontos específicos |
| `html2pdf` ficou restrito ao WhatsApp? | **Sim** — único arquivo que importa `html2pdf.js` é `comprovantesRender.ts`, consumido pelo pipeline WhatsApp + `PdfPreviewDialog` |
| `printHtmlInHiddenFrame` virou SSOT? | **Sim** — 13 consumidores, nenhuma variante paralela |
| Bundle reduziu? | Não materialmente — `html2pdf.js` já era `import()` dinâmico (não estava no chunk inicial). Limpezas foram em código próprio (~10 linhas) |
| Sistema ficou mais simples? | **Sim** — removida duplicação de `buildWaUrl` e `export` desnecessário em `loadHtml2Pdf` |

## Mudanças aplicadas

1. **`src/domains/result/services/comprovantesRender.ts`** — `export` removido de `loadHtml2Pdf` (helper interno, 0 consumidores externos).
2. **`src/lib/comprovantes.ts`** — `buildWaUrl` adicionada à lista de re-exports (era importada mas não re-exportada).
3. **`src/components/PdfPreviewDialog.tsx`** — removida cópia local de `buildWaUrl` (7 linhas); passa a importar de `@/lib/comprovantes`.

Total: **3 arquivos editados, 0 arquivos criados, 0 arquivos deletados.**

## Estado final dos fluxos

```
┌──────────────────────────────────────────────────────────────┐
│  IMPRESSÃO / EXPORTAÇÃO LOCAL  →  printHtmlInHiddenFrame     │
│  (laudo, relatórios, mapas, etiquetas, LGPD, auditoria,      │
│   tabelas de preço, financeiro, produção, exames, convênios) │
│  → window.print() vetorial nativo · 0 deps · 13 consumidores │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  WHATSAPP / PREVIEW DE COMPROVANTE  →  comprovantesRender    │
│  (orçamento + comprovante: pagamento/atendimento/declaração) │
│  → html2pdf.js (Blob) → uploadPdfAndGetUrl → shortlink       │
│  → enviarPdfWhatsappCloud / wa.me                            │
│  · 1 dep (html2pdf.js, dynamic import)                       │
│  · 2 consumidores: comprovantes.ts, PdfPreviewDialog.tsx     │
└──────────────────────────────────────────────────────────────┘
```

## Decisões deliberadas (Fase 4)

- **Não foi criado `src/domains/pdf/`.** Justificativa em
  `final-cleanup-audit.md` §3: criaria abstração artificial. `printHtml.ts`
  tem 120 linhas e 1 função; `comprovantesRender` pertence ao domínio
  `result/`. Sem ganho real.

## Decisões deliberadas (Fase 5)

- **`html2pdf.js` permanece em `package.json`.** Bloqueado pela necessidade
  de `Blob` para upload no fluxo WhatsApp. Decisão herdada de
  `pdf-migration-plan.md` §"Conclusão realista".

## Validação

- TypeScript: build limpo (corrigido o conflito `Import declaration conflicts
  with local declaration of 'buildWaUrl'` durante a consolidação).
- Sem mudança em `buildLaudoHtml`, layouts CKEditor, cabeçalhos, rodapés,
  assinaturas, QR Codes, RLS, `current_tenant_id()`, `has_role()`,
  `is_super_admin()`.

## Critério de sucesso

- ✅ PDF Vetorial = 1 fluxo (`printHtmlInHiddenFrame`)
- ✅ WhatsApp = 1 fluxo (`comprovantesRender` → `comprovantesUpload` → `comprovantesWhatsapp`)
- ✅ Sem duplicação
- ✅ Sem legado ativo (apenas comentários documentais)
- ✅ Sem código morto detectável
- ✅ Sem regressão (HTML/layouts intocados)

## Parada

Missão encerrada. Próximas alterações no módulo PDF requerem nova solicitação
explícita do usuário.
