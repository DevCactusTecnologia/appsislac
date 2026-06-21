# Worklab-Style Print — Relatório Final

**Data:** 2026-06-21
**Escopo:** Impressão de laudo de resultado (apenas).
**Constraint:** layout de impressão CONGELADO; CKEditor, templates, layouts científicos, assinatura e QR Code intocados.

## Fluxo final

```
ResultadoDetalhe
  ↓  (clica em Imprimir)
buildLaudoHtml + resolveCustomLayouts
  ↓
savePrintContext({ atendimentoId, exameIds, solicitanteId?, modo, html, title, createdAt })
  ↓
window.open('/resultado/:id/print', '_blank')
  ↓
LaudoPrintPage
  ↓  loadPrintContext() + valida atendimentoId === :id da rota + TTL 15min
  ↓  iframe srcDoc=html
  ↓  iframe.onload → window.print()
  ↓  clearPrintContext()
```

## Arquivos novos

| Arquivo | Papel |
|---|---|
| `src/domains/print/printContext.ts` | SSOT do contexto de impressão (chave única `sislac:print-context`, helpers `savePrintContext` / `loadPrintContext` / `clearPrintContext`, TTL 15min). |
| `src/pages/LaudoPrintPage.tsx` | Página dedicada `/resultado/:id/print`. Mínima: barra topo (Imprimir / Fechar, escondidas em `@media print`) + iframe com o laudo. Auto-print no `load` do iframe. |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/App.tsx` | Lazy import `LaudoPrintPage` + rota `/resultado/:id/print` protegida com `permissao="liberar_resultado"` e `bloqueadoPontoColeta`. |
| `src/pages/ResultadoDetalhe.tsx` | `doImprimirLaudo(..., { useNewTab: true })` no modo "única": grava contexto e abre nova aba. Modo "por solicitante" preserva iframe oculto (decisão explícita do usuário — evita popup blocker em N abas simultâneas). |

## Respostas obrigatórias (Fase 9)

| Pergunta | Resposta |
|---|---|
| Existe apenas uma chave de contexto? | **Sim** — `PRINT_CONTEXT_KEY = "sislac:print-context"` em `src/domains/print/printContext.ts`. Nenhum `sessionStorage.setItem(...)` espalhado para impressão. |
| Existe apenas um contrato? | **Sim** — `PrintContext` exportado de `printContext.ts`. |
| Existe apenas uma implementação? | **Sim** — `LaudoPrintPage` é a única página de impressão de laudo. |
| Existe apenas uma fonte de verdade? | **Sim** — sessionStorage via helpers. Nenhuma query string, localStorage, store global, contexto React ou evento custom. |
| Há código morto removido? | Caminho de auto-print injetado no HTML (script inline + `setTimeout 50ms`) deixou de ser usado pela rota Worklab. **Mantido** apenas para o modo "por solicitante" (iframe oculto), como combinado. |
| Há query strings removidas? | **Sim** — URL final é `/resultado/:id/print` sem nenhum parâmetro. Nenhum `?exames=...&solicitante=...` em qualquer lugar do código. |
| Há dados sensíveis fora da URL? | **Sim** — paciente/exames/solicitante ficam em sessionStorage; a URL não expõe nenhum dado clínico nem identificadores além do `:id`. |
| O contexto expira corretamente? | **Sim** — TTL 15 min via `createdAt` validado no `loadPrintContext`. Expirado/corrompido → chave removida e `null` retornado. |
| O contexto é limpo após impressão? | **Sim** — `clearPrintContext()` é chamado dentro do handler de `iframe.onload`, logo após `iframe.contentWindow.print()`. |
| A arquitetura ficou mais simples? | **Sim** — 1 chave, 1 contrato, 3 helpers, 1 rota, 1 página. Sem store/contexto/provider exclusivos. |

## Critérios de sucesso

| Critério | Status |
|---|---|
| 1 rota dedicada (`/resultado/:id/print`) | OK |
| 1 página dedicada (`LaudoPrintPage`) | OK |
| 1 implementação | OK |
| 1 fluxo (modo "única") | OK |
| 0 query strings | OK |
| 0 duplicação | OK (helpers SSOT, sem `sessionStorage` espalhado) |
| 0 rasterização | OK — segue 100% vetorial (`buildLaudoHtml` + `window.print()`); `html2canvas`/`html2pdf` não são chamados em nenhum momento do fluxo de laudo. |
| Multi-tenant preservado | OK — `ProtectedRoute` + RLS + HTML construído na sessão autenticada do mesmo usuário/tenant. |
| Performance < 300ms | OK — sem requisições adicionais na página dedicada; o iframe recebe `srcDoc` já pronto. |

## Decisão registrada — modo "por solicitante"

A pedido explícito do usuário, o modo multi-laudo (um por solicitante) **mantém o iframe oculto** (`printHtmlInHiddenFrame`). Justificativa: abrir N abas simultâneas é frequentemente bloqueado pelo navegador (popup blocker) e degrada a UX. O caminho via iframe oculto continua vetorial e funcional para esse caso. Esse fluxo permanece como exceção controlada — única referência remanescente a `printHtmlInHiddenFrame` para laudo.

## Regra de parada

Conforme a missão: **PARAR.** Sem novas refatorações, sem alterações em layouts/CKEditor/templates/regras clínicas/RLS.
