# WhatsApp 2.0 — Fase 3D.1 — Migração dos Produtores (Onda 1)

**Data:** 2026-06-22
**Status:** ✅ Concluído

---

## 1. Produtores migrados nesta onda

| # | Produtor              | Template Meta              | Status na migração |
|---|-----------------------|----------------------------|---------------------|
| 1 | Comprovante Atendimento (pós-conversão de orçamento, em `Orcamentos.tsx`) | `comprovante_atendimento` | ✅ Migrado via `enqueueNotification` |
| 2 | Orçamento (PdfPreviewDialog em `Orcamentos.tsx`)                          | `orcamento`               | ✅ Migrado via `enqueueNotification` |
| 3 | Comprovante de Agendamento                                                | `comprovante_agendamento` | ⚠ Nenhum produtor de código encontrado no front (feature de agendamento ainda não emite WhatsApp). Pronto para uso assim que a feature instalar `enqueueNotification` com `template: "comprovante_agendamento"`. |
| 4 | Orçamento Clínica                                                         | `orcamento_clinica`       | ⚠ Nenhum produtor distinto de "Orçamento" foi identificado. Será endereçado quando a variante B2B for separada. |

> A infraestrutura (`enqueueNotification`, `whatsapp_outbox`, `whatsapp-dispatcher`) é a mesma para todos os 8 templates. Os 2 produtores faltantes não exigem nova plumbing — apenas adicionar a chamada quando as features existirem.

## 2. Fluxo após a migração

```
Produtor (Orcamentos.tsx / PdfPreviewDialog)
        ↓
enqueueNotification(tenantId, template, vars, idempotencyKey)
        ↓
RPC enqueue_whatsapp  →  valida opt-out + rate limit + idempotência
        ↓
whatsapp_outbox (status=pending)
        ↓
whatsapp-dispatcher (fire-and-forget + cron 1 min)
        ↓
Meta Graph API v21 (template)
        ↓
Paciente
```

## 3. Helpers / código morto removido

- ❌ `src/domains/result/services/comprovantesWhatsapp.ts` — **arquivo deletado** (única função era `buildWaUrl`).
- ❌ `enviarOrcamentoPorWhatsapp()` em `src/lib/comprovantes.ts` — removido (montava texto + abria wa.me).
- ❌ `enviarComprovantePorWhatsapp()` em `src/lib/comprovantes.ts` — removido (mesmo padrão).
- ❌ Export `buildWaUrl` da fachada `comprovantes.ts` — removido.
- ❌ Imports mortos em `src/pages/NovoAtendimento.tsx` (`gerarOrcamentoPDF`, `enviarOrcamentoPorWhatsapp`) — removidos.
- ❌ `PdfPreviewDialog` — prop legada `buildWhatsappMessage` substituída pela prop tipada `notify: PdfNotifyParams`. Caminho `handleWhatsapp`/`handleShareMobile` que abria `wa.me` ou `navigator.share` foi removido.

Critério atingido para tudo o que foi tocado: **0 imports / 0 referências / 0 consumidores**.

## 4. Resposta direta às perguntas da missão

| Pergunta                                         | Resposta |
|--------------------------------------------------|----------|
| Quais produtores foram migrados?                 | Orçamento (preview em `Orcamentos.tsx`) e Comprovante de Atendimento (pós-conversão). |
| Quais helpers foram removidos?                   | `comprovantesWhatsapp.ts`, `enviarOrcamentoPorWhatsapp`, `enviarComprovantePorWhatsapp`, `buildWaUrl`, prop `buildWhatsappMessage` do `PdfPreviewDialog`. |
| Existe código morto removido?                    | Sim — ver §3. |
| Existe envio direto restante?                    | Não nos produtores oficiais. Permanecem botões de "abrir WhatsApp" puramente manuais (Pacientes, Especialistas, contato site, landing) — são ações 1:1 do usuário, não notificações automatizadas, e não fazem parte dos 8 templates. |
| Existe uso de `wa.me` restante?                  | Restam 3 usos de marketing/CRM em `Orcamentos.tsx` (templates "lembrete", "reforço", "última chance") + ações manuais citadas acima. Nenhum é template oficial — serão tratados em Wave 2 ou descontinuados conforme decisão de produto. |
| Existe auditoria?                                | Sim — `whatsapp_outbox`, `whatsapp_mensagens`, `whatsapp_metrics_tenant` registram cada envio. |
| Existe opt-out?                                  | Sim — validado dentro do RPC `enqueue_whatsapp` antes do enfileiramento. |
| Existe rate limit?                               | Sim — `tenant_rate_limit` aplicado no mesmo RPC. |
| Existe regressão?                                | Não. `tsc --noEmit` e `vitest run` passam (22/22). |
| Está pronto para Wave 2?                         | Sim. |

## 5. Validações executadas

- ✅ `bunx vitest run` → **22/22 passaram**.
- ✅ Build TypeScript limpo após cada edição (corrigidos todos os erros surgidos no caminho).
- ✅ Grep final: `rg "buildWaUrl\|enviarComprovantePorWhatsapp\|enviarOrcamentoPorWhatsapp" src` → **0 ocorrências**.

## 6. Próxima missão

**Fase 3D.2 — Onda 2** — migrar:
- Comprovante de Agendamento (quando o produtor existir)
- Orçamento Clínica (quando a variante B2B for separada)
- Templates de marketing (lembrete/reforço/última chance) ou sua descontinuação
- Resultado Pronto, OTP, Recoleta, Confirmação de Consulta (Onda 3)

**Parada respeitada:** nenhum produtor de Resultado/OTP/Recoleta/Consulta foi tocado.
