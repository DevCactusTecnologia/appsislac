# WhatsApp 2.0 — Fase 3F.2 — Padronização Global de UX

Data: 2026-06-22
Status: ✅ Concluído

## Objetivo

Eliminar variações textuais e visuais de envio manual de WhatsApp
(`Enviar WhatsApp`, `Enviar via WhatsApp`, `Enviar ao paciente`, etc.)
e centralizar em **um único componente canônico** reutilizado por
todas as telas operacionais do SISLAC.

---

## Padrão oficial

| Item    | Valor                                  |
|---------|----------------------------------------|
| Rótulo  | `Send WhatsApp`                        |
| Tooltip | `Send mensagem pelo WhatsApp`          |
| Ícone   | `Send` (lucide)                        |
| Cor     | Verde WhatsApp — `hsl(142, 70%, 45%)`  |
| Altura  | `h-9` (md) ou `h-11` (lg)              |

Estados visuais: `idle` → "Send WhatsApp" · `loading` → "Enviando…" ·
`success` → "WhatsApp enviado" · `error` → "Falha no envio".

---

## Arquivos criados

| Arquivo | Responsabilidade |
|---|---|
| `src/components/whatsapp/WhatsappActionButton.tsx` | Componente canônico **único**. Não duplicar. |
| `src/components/whatsapp/WhatsappTimeline.tsx` | Histórico compacto lendo `whatsapp_outbox` por `atendimento_protocolo`. |
| `src/lib/whatsapp/getBestWhatsappAction.ts` | Decisor único: escolhe `resultado_pronto` / `comprovante_pagamento` / `comprovante_atendimento` automaticamente. |

---

## Pontos padronizados

| Tela / Componente | Antes | Depois |
|---|---|---|
| `ResultadoDetalhe.tsx` (2 cabeçalhos) | `<button>Enviar WhatsApp</button>` custom | `<WhatsappActionButton />` |
| `PdfPreviewDialog.tsx` (rodapé) | `<button>Enviar WhatsApp</button>` custom + `Loader2/Send` | `<WhatsappActionButton state="loading|idle" />` |
| `Orcamentos.tsx` (pós-conversão) | `Enviar via WhatsApp` | `Send WhatsApp` + tooltip padrão |
| `SolicitarRecoletaDialog.tsx` (toast) | `label: "Enviar WhatsApp"` | `label: "Send WhatsApp"` |
| `AtendimentoDetalheDialog.tsx` (novo) | (não existia) | Seção "Ações" com `<WhatsappActionButton onSendAsync={…}>` + timeline |

**Total de pontos canonizados:** 5 telas, 6 botões/toasts.

---

## Decisor único `getBestWhatsappAction(atendimento, ctx)`

Centraliza a lógica antes espalhada em "if resultado / if recoleta /
if comprovante":

1. `ctx.todosLiberados === true` → `resultado_pronto` (força,
   reaproveita `notifyResultadoPronto({force:true})`).
2. `pagamentosRealizados.total > 0` → `comprovante_pagamento`
   (enqueue via `enqueueNotification`).
3. Default → `comprovante_atendimento`.

Recoleta NÃO entra no decisor: o disparo de recoleta acontece no
momento da criação (`SolicitarRecoletaDialog`), com fluxo dedicado e
motivo obrigatório.

---

## Histórico visual (`WhatsappTimeline`)

Aplicado **somente no `AtendimentoDetalheDialog`** (decisão de
produto, confirmada pelo usuário: não onerar listagens).

- Query: `whatsapp_outbox` filtrado por `atendimento_protocolo`,
  limit 20, ordem decrescente.
- RLS: `outbox_select_tenant_or_super` (já existente — Fase 3A).
- Status mapeados: `sent` ✓ · `pending/sending` ⏳ · `failed/failed_permanent` ⚠ · `opted_out/cancelled` 🚫 · `rate_limited` ⏳.
- Refresh por `refreshKey` incrementado após disparo manual.

---

## Auditoria de UX

| Pergunta | Resposta |
|---|---|
| Quantos textos foram padronizados? | 6 (5 botões + 1 toast) |
| Quantos componentes passaram a reutilizar o canônico? | 3 telas usam `<WhatsappActionButton>`; demais (Orçamento, Recoleta toast) padronizaram texto. |
| Ocorrências de "Enviar WhatsApp" em UI? | 0 (resta apenas em comentários de helpers — não afetam UX). |
| Ocorrências de "Enviar via WhatsApp"? | 0 |
| Ocorrências de "Enviar ao paciente"? | 0 |
| Código morto removido? | `Send` import de `ResultadoDetalhe.tsx` (não usado após canonização). |
| Componentes órfãos? | Nenhum encontrado. |
| Duplicação eliminada? | Sim: 3 botões com a mesma estrutura/cor/tooltip viraram um único componente. |
| Houve regressão? | Não. Pipeline (Outbox → Dispatcher → Meta) intacto; políticas, opt-out, rate-limit, idempotência inalterados. |
| UX consistente em todo o SISLAC? | Sim: mesmo rótulo, ícone, cor, tooltip e estados em todos os pontos manuais. |

---

## Fora de escopo (deliberado)

- **PagamentoDialog**: é um modal de input de pagamento (sem
  contexto de paciente/protocolo nas props). Após `confirm`, o
  parente abre o `AtendimentoDetalheDialog` ou volta à listagem —
  ambos já possuem o `<WhatsappActionButton>` canônico. Refatorar
  PagamentoDialog exigiria propagar `protocolo` + telefone por
  várias camadas sem ganho de UX (1 clique já garantido pelo
  `AtendimentoDetalheDialog`).
- **Badges em listagens** (Resultado, Recoleta, Orçamento): excluído
  por decisão do usuário ("Só no Detalhes do Atendimento — 1 query
  pontual"). Mantém listagens performáticas; status fica visível
  onde o operador investiga.
- **OTP, chatbot, campanhas, marketing**: explicitamente fora do
  WhatsApp 2.0.

---

## Critério de sucesso ✅

Qualquer operador, em qualquer tela operacional do SISLAC, encontra:

```
[ Send WhatsApp ]
```

com o mesmo ícone, cor (verde WhatsApp), tooltip
(`Send mensagem pelo WhatsApp`) e comportamento — em **no máximo 1
clique**, sem treinamento, sem menus escondidos.

---

## Próxima fase

**Fase 3G — Confirmação de Consulta** (próxima missão).
