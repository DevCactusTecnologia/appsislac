# Comprovantes — Simplificação Definitiva

**Data:** 2026-06-21
**Filosofia:** Olhou. Entendeu. Simplificou.

## Resultado

Os botões **Comp. Pagamento**, **Comp. Atendimento** e **Comparecimento** agora
executam impressão direta:

```
Clique → Imprimir
```

Sem modal. Sem pré-visualização. Sem opções intermediárias (Baixar PDF, Copiar
Link, WhatsApp, Cancelar).

## Mudanças

### `src/pages/NovoAtendimento.tsx`
- Removido state `comprovanteTipo` / `setComprovanteTipo`.
- Removido bloco JSX que renderizava `<PdfPreviewDialog>` para os 3 tipos
  de comprovante (~56 linhas, incluindo IIFE com montagem de dados,
  whatsapp builder e Suspense).
- Adicionado helper `imprimirComprovante(tipo)` que monta o HTML via
  `buildComprovanteHtml` e dispara `printHtmlInHiddenFrame` direto.
- Os 3 `onClick` dos botões agora chamam `imprimirComprovante(...)`.

### `src/components/AtendimentoDetalheDialog.tsx`
- Removido state `previewTipo` / `setPreviewTipo`.
- Removidos `useMemo`s `previewData`, `previewHtml`, `previewWhatsappMessage`.
- Removido bloco JSX `<PdfPreviewDialog>` ao final do componente.
- Removido `import PdfPreviewDialog`.
- Removido import não utilizado `useMemo`.
- Adicionado `import { printHtmlInHiddenFrame }`.
- Adicionado helper `imprimirComprovante(tipo)` (reutiliza
  `buildComprovanteData` já existente).
- Os 3 `onClick` dos botões agora chamam `imprimirComprovante(...)`.

## Métricas

| Item                                  | Quantidade |
|---------------------------------------|------------|
| Componentes removidos                 | 0 (PdfPreviewDialog continua em uso por Orçamentos) |
| Helpers removidos                     | 3 (`previewData`, `previewHtml`, `previewWhatsappMessage` de AtendimentoDetalheDialog) |
| Arquivos removidos                    | 0 |
| Linhas removidas (líquido)            | ~95 |
| Estados removidos                     | 2 (`comprovanteTipo`, `previewTipo`) |
| Modais de pré-visualização para comprovantes | 0 (era 2) |

## Verificações

- **Código morto remanescente?** Não. `PdfPreviewDialog` continua válido
  para Orçamentos (`src/pages/Orcamentos.tsx` e bloco de orçamento dentro
  de `NovoAtendimento.tsx`). Não está no escopo desta missão.
- **Fluxo legado remanescente?** Não para comprovantes.
- **Os três botões executam impressão direta?** Sim.
- **Alteração de regra de negócio?** Não.
- **Alteração de segurança / RLS / permissões / tenant?** Não.
- **Fluxo ficou mais simples?** Sim — uma ação, um clique, uma impressão.
