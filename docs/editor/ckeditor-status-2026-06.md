# CKEditor 5 — Status de Encerramento da Fase 1

**Data:** 2026-06-15
**Status:** ✅ CONCLUÍDA (sem retrabalho)

## Verificação

A Fase 1 do programa "UX & Operational Simplification" pediu instalar e
configurar CKEditor 5 como editor oficial do SISLAC. A auditoria do repositório
confirmou que **a fase já estava concluída** antes do início do programa:

| Item exigido | Estado atual | Evidência |
|---|---|---|
| CKEditor 5 instalado (oficial, GPL) | ✅ `ckeditor5@48.2.0` + `@ckeditor/ckeditor5-react@11.2.0` | `package.json`, `docs/editor/ckeditor-install-report.md` |
| Componente único oficial | ✅ `src/components/editor/CKEditor.tsx` | arquivo presente, 1 export |
| Tabelas (inserir/mesclar/dividir/resize) | ✅ `TableProperties`, `TableCellProperties`, `TableColumnResize`, `mergeTableCells` no toolbar | `CKEditor.tsx` config |
| Word-like / Paste do Word e Excel | ✅ `PasteFromOffice` + `ClipboardPipeline` + `GeneralHtmlSupport` | `CKEditor.tsx` config |
| Preservação de `{{PACIENTE}}`, `{{IDADE}}`, `{{EXAME}}`, `{{RESULTADO}}`, `{{ASSINATURA}}` | ✅ Texto puro, sem escape/remoção | validado em `/admin/ckeditor-test` |
| HTML limpo / compatível com PDF, impressão, Portal e modelos | ✅ Processado por `normalizeMapaHtml`, `mapaPrint.ts`, `documentoRenderer.ts`, `laudoTemplate.ts` | sem ajustes adicionais |
| Integrado nos pontos críticos | ✅ `MapaTrabalhoDialog`, `DocumentoTemplateDialog`, `LayoutDialog` | core memory `features/editor/ckeditor` |
| Tela de validação manual | ✅ `/admin/ckeditor-test` (rota protegida) | `src/pages/admin/CKEditorTest.tsx` |

## Decisão

Nenhuma reinstalação, troca de configuração ou alteração de CSS de impressão
foi realizada. A Fase 1 é considerada **encerrada** e segue como referência
para as Fases 2 e 3.

## Regra de parada respeitada

- Não foram criados editores alternativos.
- Não foi alterado banco, RLS, edge function ou regra de negócio.
- Não foi tocado o CSS de impressão do laudo (`constraints/layout-impressao-travado`).
